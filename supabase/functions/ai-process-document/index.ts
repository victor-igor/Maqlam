import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { GoogleGenAI } from "https://esm.sh/@google/genai";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// @ts-ignore
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Update Progress
const updateProgress = async (supabase: any, id: string, progress: number, desc: string, status: 'processing' | 'completed' | 'error' = 'processing', result: any = null, errorMsg: string | null = null) => {
    console.log(`[Progress] ID: ${id}, Progress: ${progress}%, Status: ${status}, Desc: ${desc}`);
    try {
        const { error } = await supabase.from('documentos_importacao').update({
            progress,
            status_description: desc,
            status,
            updated_at: new Date().toISOString(),
            ...(result ? { result_data: result } : {}),
            ...(errorMsg ? { error_message: errorMsg } : {})
        }).eq('id', id);

        if (error) console.error(`[DB Update Error] ${error.message}`);
    } catch (err) {
        console.error("[Update Progress Exception]", err);
    }
};

// --- CORE LOGIC: EVERYTHING HAPPENS HERE ---
const runFullBackgroundProcess = async (supabase: any, geminiKey: string, body: any) => {
    const { record, mode, chunkId, pageStart, pageEnd, totalChunks, model } = body;
    const selectedModel = model || 'gemini-3.0-flash';
    const id = record.id;
    const file_path = record.file_path;

    // Price table
    const PRICE_TABLE: Record<string, { input: number; output: number }> = {
        'gemini-3.0-flash': { input: 0.10, output: 0.40 },
        'gemini-3.0-pro': { input: 1.25, output: 5.00 },
        'gemini-2.5-flash': { input: 0.075, output: 0.30 },
        'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    };

    try {
        // --- 1. DISPATCHER LOGIC (If applicable) ---
        // If this is the Initial Call (mode undefined or 'dispatcher'), check file size first
        if (!mode || mode === 'dispatcher') {
            await updateProgress(supabase, id, 5, "Iniciando análise do arquivo...");
            console.log(`[Dispatcher] Analyzing file: ${file_path}`);

            const { data: fileData, error: dlErr } = await supabase.storage.from('financial-uploads').download(file_path);
            if (dlErr) throw new Error(`Erro ao baixar arquivo: ${dlErr.message}`);

            let isLargeFile = false;
            let pageCount = 0;

            if (fileData.type === 'application/pdf') {
                try {
                    const ab = await fileData.arrayBuffer();
                    const pdf = await PDFDocument.load(ab, { ignoreEncryption: true });
                    pageCount = pdf.getPageCount();
                    // THRESHOLD: 15 pages
                    if (pageCount > 15) isLargeFile = true;
                } catch (e) {
                    console.warn("Could not read PDF page count", e);
                    // SAFETY VALVE: If we can't count pages, check file size.
                    // If > 2MB, assume it's large and unsafe to process monolithically.
                    if (fileData.size > 2 * 1024 * 1024) {
                        throw new Error(`Arquivo grande (${(fileData.size / 1024 / 1024).toFixed(2)}MB) e não foi possível contar páginas. Divida o arquivo em partes menores (max 15 pgs) ou remova proteção.`);
                    }
                }
            }

            if (isLargeFile) {
                // --- SPLIT & DELEGATE ---
                await updateProgress(supabase, id, 15, `Arquivo grande (${pageCount} pgs). Dividindo tarefass...`);

                const PAGES_PER_CHUNK = 15;
                const calculatedTotalChunks = Math.ceil(pageCount / PAGES_PER_CHUNK);
                const invokePromises = [];

                for (let i = 0; i < calculatedTotalChunks; i++) {
                    const start = i * PAGES_PER_CHUNK;
                    const end = Math.min((i + 1) * PAGES_PER_CHUNK, pageCount);

                    const { data: chunk, error: chunkErr } = await supabase.from('importacao_chunks').insert({
                        documento_id: id,
                        chunk_index: i,
                        total_chunks: calculatedTotalChunks,
                        page_start: start,
                        page_end: end,
                        status: 'pending'
                    }).select().single();

                    if (chunkErr) throw chunkErr;

                    // Invoke Worker (Fire-and-Forget at HTTP level, but here we await the fetch call itself)
                    invokePromises.push(
                        supabase.functions.invoke('ai-process-document', {
                            body: {
                                record: record,
                                mode: 'worker',
                                chunkId: chunk.id,
                                pageStart: start,
                                pageEnd: end,
                                totalChunks: calculatedTotalChunks,
                                model: selectedModel
                            }
                        })
                    );
                }

                // Wait for all trigger requests to be sent
                await Promise.all(invokePromises);

                await updateProgress(supabase, id, 20, `Processando ${calculatedTotalChunks} partes em paralelo...`);
                return; // Dispatcher job done
            }

            // If NOT large file, continue to "Normal Processing" below...
            // But we already downloaded the fileData, so we can reuse it if we structured differently.
            // For simplicity, let's just fall through to the logic below, re-downloading is safer code-wise or pass it.
            // Optimally: Extract processing logic to function that accepts fileData.
        }

        // --- 2. WORKER / NORMAL PROCESSING LOGIC ---

        console.log(`[Worker/Normal] Processing ID: ${id}, Mode: ${mode}`);

        // Re-download or use Passed data (refactoring step simplified: just download again for now to ensure clean state)
        // Note: For small files, 2 downloads is negligible compared to the wait.
        const { data: fileData, error: dlErr } = await supabase.storage.from('financial-uploads').download(file_path);
        if (dlErr) throw new Error(`Erro download: ${dlErr.message}`);

        await updateProgress(supabase, id, mode === 'worker' ? 0 : 25, "Lendo arquivo...");

        // Prepare Base64
        let base64Data = '';
        if (mode === 'worker' && pageStart !== undefined && pageEnd !== undefined && fileData.type === 'application/pdf') {
            const ab = await fileData.arrayBuffer();
            const pdfDoc = await PDFDocument.load(ab);
            const subPdf = await PDFDocument.create();
            const copiedPages = await subPdf.copyPages(pdfDoc, Array.from({ length: pageEnd - pageStart }, (_, i) => pageStart + i));
            for (const page of copiedPages) subPdf.addPage(page);
            const subBytes = await subPdf.save();
            base64Data = encodeBase64(subBytes);

            if (chunkId) await supabase.from('importacao_chunks').update({ status: 'processing' }).eq('id', chunkId);
        } else {
            const ab = await fileData.arrayBuffer();
            const uint8 = new Uint8Array(ab);
            base64Data = encodeBase64(uint8);
        }

        await updateProgress(supabase, id, mode === 'worker' ? 0 : 40, "Consultando categorias...");

        // Fetch Categories
        const { data: categories } = await supabase.from('categorias_dre').select('id, nome, codigo, tipo').limit(100);
        const categoriesContext = categories?.map((c: any) => `${c.id} - ${c.nome} (${c.tipo})`).join('\n') || "Categoria Geral";

        // Fetch Suppliers and Instructions from AI Knowledge Base
        const { data: knowledgeRecords } = await supabase
            .from('ai_knowledge_base')
            .select('type, content')
            .in('type', ['supplier', 'instruction']);

        const suppliersList = knowledgeRecords
            ?.filter((r: any) => r.type === 'supplier')
            .map((r: any) => r.content)
            .join(', ') || "";

        const instructionsList = knowledgeRecords
            ?.filter((r: any) => r.type === 'instruction')
            .map((r: any) => `- ${r.content}`)
            .join('\n') || "";

        const suppliersContext = suppliersList ? `
# FORNECEDORES CONHECIDOS
Se a transação mencionar alguma dessas empresas, categorize como "Fornecedores" (ID: 69):
---
${suppliersList}
---
` : "";

        const instructionsContext = instructionsList ? `
# CONHECIMENTO ESPECIFICO DA EMPRESA (REGRA SUPREMA)
Siga estas instruções adicionais com prioridade máxima:
---
${instructionsList}
---
` : "";

        await updateProgress(supabase, id, 50, "Enviando para IA...");

        // Call Gemini
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const prompt = `
# VISAO GERAL
Você é um Motor de Processamento de Dados Financeiros especializado em contabilidade brasileira e estruturação de dados para APIs. Sua função é converter entradas não estruturadas (texto cru vindo de OCR, PDFs ou imagens) em dados JSON estritamente tipados e normalizados.

# OBJETIVOS
1. Analisar o texto fornecido buscando padrões de transações financeiras.
2. Corrigir erros comuns de OCR (ex: 'O' em vez de '0', ',' em vez de '.') no contexto financeiro.
3. Classificar semanticamente cada transação com base na lista de categorias fornecida.
4. Retornar uma saída limpa, pronta para ser consumida por um parser de código.

# DIRETRIZES DE ANALISE
- Validação de OCR: Se encontrar textos truncados ou caracteres estranhos, tente inferir o conteúdo lógico baseado no contexto contábil.
- Datas: Converta qualquer formato de data encontrado para o padrão brasileiro DD/MM/YYYY. Se o ano não for explícito, assuma o ano corrente ou o mais provável pelo contexto do documento.
- Valores Monetários: Identifique valores em formato brasileiro (R$ X.XXX,XX). Converta para Float (X.XX). IMPORTANTE: Despesas devem ser valores NEGATIVOS (-X.XX) e Receitas POSITIVOS (X.XX).
- Direção do Fluxo (CRÍTICO):
  - "despesa": Sinais de menos (-), colunas "Débitos", "Saídas", ou valores entre parênteses. RETORNE VALOR NEGATIVO.
  - "receita": Sinais de mais (+), colunas "Créditos", "Entradas". RETORNE VALOR POSITIVO.
  - CASOS ESPECIAIS (EMPRÉSTIMOS):
     - "Empréstimo Liberado" / "Contratação" / "Crédito em Conta" -> RECEITA (+).
     - "Amortização" / "Pagamento de Parcela" / "Juros" -> DESPESA (-).
  - SE TIVER DÚVIDA, assuma "despesa" (negativo).

# PROTOCOLOS DE CATEGORIZACAO
Utilize a lista de categorias injetada no contexto. Para cada transação:
1. Analise a descrição da transação.
2. Busque uma correspondência semântica (não apenas palavra-chave exata) na lista de categorias.
3. Se houver alta confiança, atribua o ID e o Nome.
4. Se a transação for ambígua ou não se encaixar, defina categoria_sugerida_id como null.

# RESTRICOES DE SAIDA (CRITICO)
- A saída deve ser EXCLUSIVAMENTE o array JSON.
- NÃO utilize blocos de código markdown (como \`\`\`json).
- NÃO inclua texto introdutório ou conclusivo.
- Se não houver transações, retorne apenas: []

# FORMATO DE RESPOSTA (JSON SCHEMA)
[
  {
    "data": "string (DD/MM/YYYY)",
    "descricao": "string (Texto corrigido e limpo)",
    "valor": number (Float positivo, ex: 150.50),
    "tipo": "string ('receita' ou 'despesa')",
    "categoria_sugerida_id": number | null,
    "categoria_nome": "string | null"
  }
]

# CONTEXTO DE CATEGORIAS DISPONIVEIS
---
${categoriesContext}
---

${suppliersContext}

${instructionsContext}

# INPUT PARA PROCESSAMENTO
Analise o seguinte conteúdo extraído e gere o JSON:
`;


        // Helper: Retry Strategy
        const generateWithRetry = async (aiClient: any, modelName: string, payload: any, maxRetries = 5) => {
            let attempt = 0;
            const baseDelay = 2000; // 2 seconds

            while (attempt < maxRetries) {
                try {
                    return await aiClient.models.generateContent({
                        model: modelName,
                        contents: payload.contents
                    });
                } catch (error: any) {
                    attempt++;
                    const isRetryable =
                        error.message?.includes('429') ||
                        error.message?.includes('503') ||
                        error.message?.includes('Resource exhausted') ||
                        error.message?.includes('Overloaded');

                    if (isRetryable && attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt - 1); // 2s, 4s, 8s, 16s...
                        console.warn(`[AI Retry] Erro ${error.status || 'Unknown'}. Tentativa ${attempt}/${maxRetries}. Aguardando ${delay}ms...`);

                        await updateProgress(supabase, id, 50, `Instabilidade na IA. Tentando novamente (${attempt}/${maxRetries})...`);
                        await new Promise(res => setTimeout(res, delay));
                        continue;
                    }
                    throw error; // Not retryable or max retries reached
                }
            }
        };

        const result = await generateWithRetry(ai, selectedModel, { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: fileData.type || 'application/pdf', data: base64Data } }] }] });

        // Parse & Metrics
        const usage = result.usageMetadata;
        const tokensInput = usage?.promptTokenCount || 0;
        const tokensOutput = usage?.candidatesTokenCount || 0;
        const prices = PRICE_TABLE[selectedModel] || { input: 0.10, output: 0.40 };
        const estimatedCost = (tokensInput * prices.input + tokensOutput * prices.output) / 1_000_000;

        let cleanJson = (result.text || "").replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
        if (jsonMatch) cleanJson = jsonMatch[0];

        let transactions = [];
        try { transactions = JSON.parse(cleanJson); } catch (e) { console.error("JSON error"); }
        if (!Array.isArray(transactions) && (transactions as any).transactions) transactions = (transactions as any).transactions;

        // Save
        if (mode === 'worker' && chunkId) {
            await supabase.from('importacao_chunks').update({
                status: 'completed',
                result_data: transactions,
                tokens_input: tokensInput,
                tokens_output: tokensOutput,
                estimated_cost: estimatedCost,
                updated_at: new Date().toISOString()
            }).eq('id', chunkId);

            // Aggregation Check
            const { count } = await supabase.from('importacao_chunks').select('*', { count: 'exact', head: true }).eq('documento_id', id).eq('status', 'completed');
            if (count === totalChunks) {
                const { data: allChunks } = await supabase.from('importacao_chunks').select('result_data, tokens_input, tokens_output, estimated_cost').eq('documento_id', id).order('chunk_index');
                const allTrans = allChunks?.flatMap((c: any) => c.result_data || []) || [];
                const totalIn = allChunks?.reduce((acc: number, c: any) => acc + (c.tokens_input || 0), 0) || 0;
                const totalOut = allChunks?.reduce((acc: number, c: any) => acc + (c.tokens_output || 0), 0) || 0;
                const totalC = allChunks?.reduce((acc: number, c: any) => acc + (c.estimated_cost || 0), 0) || 0;

                await supabase.from('documentos_importacao').update({
                    progress: 100,
                    status_description: `Concluido! ${allTrans.length} transações (via chunks).`,
                    status: 'completed',
                    result_data: allTrans,
                    model_used: selectedModel,
                    tokens_input: totalIn,
                    tokens_output: totalOut,
                    estimated_cost: totalC,
                    updated_at: new Date().toISOString()
                }).eq('id', id);
            }
        } else {
            // Normal Save
            await supabase.from('documentos_importacao').update({
                progress: 100,
                status_description: `Concluido! ${transactions.length} transações.`,
                status: 'completed',
                result_data: transactions,
                model_used: selectedModel,
                tokens_input: tokensInput,
                tokens_output: tokensOutput,
                estimated_cost: estimatedCost,
                updated_at: new Date().toISOString()
            }).eq('id', id);
        }

    } catch (err: any) {
        console.error("Background Process Error:", err);
        // Fail gracefully in DB
        if (mode === 'worker' && chunkId) await supabase.from('importacao_chunks').update({ status: 'error', error_message: err.message }).eq('id', chunkId);
        await updateProgress(supabase, id, 0, "Erro no processamento background", 'error', null, err.message);
    }
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const body = await req.json();

        // --- INSTANT RESPONSE PATTERN ---
        // We validate input, then immediately Trigger Background Work and return 200.
        // No heavyawaiting here.

        if (!body.record || !body.record.id) {
            return new Response(JSON.stringify({ error: "Missing record" }), { status: 400, headers: corsHeaders });
        }

        // Trigger Background Work
        const promise = runFullBackgroundProcess(supabase, geminiKey!, body);

        // The Magic Line
        // @ts-ignore
        EdgeRuntime.waitUntil(promise);

        // Immediate Return
        return new Response(JSON.stringify({
            success: true,
            status: 'queued',
            message: "Processamento iniciado em segundo plano."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});

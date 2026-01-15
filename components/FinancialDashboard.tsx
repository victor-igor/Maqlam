import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Download,
    TrendingUp,
    TrendingDown,
    Info,
    CheckCircle,
    Filter,
    ChevronRight,
    ChevronDown,
    ArrowUpRight,
    Target,
    Landmark, // Using Landmark for tax icon
    LayoutDashboard,
    FileText,
    Settings,
    MoreHorizontal,
    ArrowDownRight,
    Sparkles,
    Brain,
    Plus
} from 'lucide-react';

import { AIKnowledgeManager } from './AIKnowledgeManager';

import { supabase } from '../lib/supabase';
import { FinancialFilters } from './FinancialFilters';

interface FinancialCategory {
    id: number;
    nome: string;
    codigo: string;
    id_pai: number | null;
    nivel: number;
    tipo: string;
    natureza: string;
    monthly_data: Record<string, { dre: number; dfc: number }> | null;
}

interface Transaction {
    id: number;
    data: string;
    descricao: string;
    valor: number;
    forma_pagamento?: string;
}

export const FinancialDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<FinancialCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showKnowledgeManager, setShowKnowledgeManager] = useState(false);

    // Date State (Defaults to Current Year)
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-01-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-12-31`;
    });

    // Dynamic Month Headers will be set by effect, initialize empty or with current
    const [months, setMonths] = useState<string[]>([]);

    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Drill-down State
    const [expandedDrilldownIds, setExpandedDrilldownIds] = useState<Set<number>>(new Set());
    const [drilldownData, setDrilldownData] = useState<Record<number, Transaction[]>>({});
    const [loadingDrilldown, setLoadingDrilldown] = useState<Record<number, boolean>>({});

    // Calculate current quarter months dynamically or fixed for now
    useEffect(() => {
        fetchFinancialData();
    }, []);

    // Helper to generate YYYY-MM array from range
    const generateMonthsArray = (start: string, end: string) => {
        // Parse explicitly as local time [Y, M, D]
        const [sy, sm] = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);

        const monthList = [];
        // Start from the first day of the start month
        let current = new Date(sy, sm - 1, 1);
        // End at the first day of the end month
        const last = new Date(ey, em - 1, 1);

        while (current <= last) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            monthList.push(`${y}-${m}`);
            // Advance by one month
            current.setMonth(current.getMonth() + 1);
        }
        return monthList;
    };

    const fetchFinancialData = async () => {
        try {
            setLoading(true);

            // Recalculate months based on current filters
            const newMonths = generateMonthsArray(startDate, endDate);
            setMonths(newMonths);

            const { data: rawData, error } = await supabase
                .rpc('get_financial_report', {
                    start_date: startDate,
                    end_date: endDate
                });

            if (error) throw error;

            // Helper to sum multiple categories by code
            const sumCategories = (codes: string[], months: string[]) => {
                const result: any = {};
                months.forEach(m => {
                    result[m] = { dre: 0, dfc: 0 };
                    codes.forEach(code => {
                        // Find category (starts with code to include children? No, RPC rolls up to parent)
                        const cat = rawData?.find((d: any) => d.codigo === code);
                        if (cat?.monthly_data?.[m]) {
                            result[m].dre += cat.monthly_data[m].dre || 0;
                            result[m].dfc += cat.monthly_data[m].dfc || 0;
                        }
                    });
                });
                return result;
            };

            // Process Data to inject results
            let processedData = rawData ? [...rawData] : [];
            const monthsList = newMonths;

            if (processedData.length > 0) {
                // --- DEFINIÇÃO DAS CATEGORIAS (Mapping Codes) ---
                // Baseado na migration 20260110_align_categories_v2.sql
                // 1=Receita, 2=Impostos
                // 3,4,5 = Custos Variáveis
                // 6=Vendas, 7=Imóvel, 8=Adm, 9=Funcionários, 10=Tributos (Despesas Fixas)
                // 11=Financeiras, 13=Empréstimos, 14=Parcelamentos (Financeiro)
                // 12=Investimentos, 15=Sócios, 16=Não Operacional

                // --- 1. RECEITA LÍQUIDA (2.1) ---
                // Receita (1) + Impostos (2)
                const rlData = sumCategories(['1', '2'], monthsList);
                const catRL = processedData.find((d: any) => d.codigo === '2.1');
                if (catRL) {
                    catRL.monthly_data = rlData;
                    catRL.is_calculated = true;
                    // catRL.nome = '(=) ' + catRL.nome; // Optional: Add marker
                }

                // --- 2. MARGEM DE CONTRIBUIÇÃO (6.99) ---
                // Receita Líquida - Custos Variáveis (3, 4, 5)
                const mcData = sumCategories(['1', '2', '3', '4', '5'], monthsList);
                const catMC = processedData.find((d: any) => d.codigo === '6.99');
                if (catMC) {
                    catMC.monthly_data = mcData;
                    catMC.is_calculated = true;
                }

                // --- 3. RESULTADO OPERACIONAL / EBITDA (9.99) ---
                // Margem - Despesas Fixas (6, 7, 8, 9, 10)
                const ebitdaData = sumCategories(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], monthsList);
                const catEbitda = processedData.find((d: any) => d.codigo === '9.99');
                if (catEbitda) {
                    catEbitda.monthly_data = ebitdaData;
                    catEbitda.is_calculated = true;
                }

                // --- 4. RESULTADO FINANCEIRO (17.99) ---
                // Somatório do bloco financeiro: 11 + 13 + 14
                const finData = sumCategories(['11', '13', '14'], monthsList);
                const catFin = processedData.find((d: any) => d.codigo === '17.99');
                if (catFin) {
                    catFin.monthly_data = finData;
                    catFin.is_calculated = true;
                }

                // --- 5. RESULTADO LÍQUIDO (REMOVIDO A PEDIDO) ---
                // O usuário solicitou não incluir esta linha automaticamente por enquanto.

                // Sort by code hierarchically (1 < 1.1 < 2 < 10)
                processedData.sort((a: any, b: any) => {
                    const partsA = a.codigo.split('.').map(Number);
                    const partsB = b.codigo.split('.').map(Number);

                    const len = Math.max(partsA.length, partsB.length);
                    for (let i = 0; i < len; i++) {
                        const valA = partsA[i] || 0;
                        const valB = partsB[i] || 0;

                        // Treat undefined (shorter length) as smaller? 
                        // Actually '1' splits to [1], '1.1' splits to [1, 1].
                        // i=0: 1 vs 1.
                        // i=1: undefined vs 1. 
                        // If we use || 0, then undefined becomes 0. So 1.0 vs 1.1. 0 < 1.
                        // So '1' comes before '1.1'. This is correct for parent-before-child.

                        if (valA !== valB) return valA - valB;

                        // Tie-breaker: If values equal (e.g. 1 vs 01), compare string length/value
                        // We want 2.01 < 2.1.
                        // "01" < "1" (String comparison handles this: '0' < '1')
                        const strA = String(a.codigo.split('.')[i] || '');
                        const strB = String(b.codigo.split('.')[i] || '');
                        if (strA !== strB) return strA.localeCompare(strB);
                    }
                    return 0; // Truly identical
                });
            }

            console.log('Processed Financial Data:', processedData);
            setData(processedData || []);
        } catch (error) {
            console.error('Error fetching financial report:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedIds(newSet);
    };

    const handleRowClick = (row: FinancialCategory, e: React.MouseEvent) => {
        const isMultiSelect = e.ctrlKey || e.metaKey;

        // Smarter Toggle Logic
        let newSelected: Set<number>;

        if (isMultiSelect) {
            // Multi-mode: standard toggle (keep others)
            newSelected = new Set(selectedIds);
            if (newSelected.has(row.id)) {
                newSelected.delete(row.id);
            } else {
                newSelected.add(row.id);
            }
        } else {
            // Single-mode:
            // If clicking the ONLY currently selected item -> Deselect All (Toggle Off)
            // If clicking a new item (or one of many) -> Select Only This
            if (selectedIds.has(row.id) && selectedIds.size === 1) {
                newSelected = new Set(); // Deselect
            } else {
                newSelected = new Set([row.id]); // Select Only This
            }
        }

        // UX: If clicking to select/focus a parent, ensure it is expanded so we see children
        // But do NOT collapse it here (use the arrow for that)
        const isRoot = row.nivel === 0;
        const isParent = row.tipo === 'group' || isRoot || (data.some(d => d.id_pai === row.id));

        if (isParent && !expandedIds.has(row.id) && newSelected.has(row.id)) {
            const newExpanded = new Set(expandedIds);
            newExpanded.add(row.id);
            setExpandedIds(newExpanded);
        }

        setSelectedIds(newSelected);
    };

    const handleExpandClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        toggleExpand(id);
    };

    const fetchCategoryTransactions = async (categoryId: number) => {
        if (drilldownData[categoryId]) return;

        setLoadingDrilldown(prev => ({ ...prev, [categoryId]: true }));
        try {
            const { data: txs, error } = await supabase
                .rpc('get_category_transactions', {
                    p_category_id: categoryId,
                    p_start_date: startDate,
                    p_end_date: endDate
                });

            if (error) throw error;

            // Map to internal interface
            const mappedTxs: Transaction[] = (txs || []).map((t: any) => ({
                id: t.id,
                data: t.data,
                descricao: t.descricao,
                valor: t.valor,
                forma_pagamento: t.modalidade?.original_currency
            }));

            setDrilldownData(prev => ({ ...prev, [categoryId]: mappedTxs }));

            // Auto-collapse if empty
            if (mappedTxs.length === 0) {
                setExpandedDrilldownIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(categoryId);
                    return newSet;
                });
            }
        } catch (err) {
            console.error('Error fetching drilldown transactions:', err);
        } finally {
            setLoadingDrilldown(prev => ({ ...prev, [categoryId]: false }));
        }
    };

    const toggleDrilldown = (e: React.MouseEvent, categoryId: number) => {
        e.stopPropagation();
        const isExpanded = expandedDrilldownIds.has(categoryId);
        const newSet = new Set(expandedDrilldownIds);

        if (isExpanded) {
            newSet.delete(categoryId);
        } else {
            newSet.add(categoryId);
            // Trigger fetch when opening
            fetchCategoryTransactions(categoryId);
        }
        setExpandedDrilldownIds(newSet);
    };

    // Calculate the set of IDs that should remain "Focused" (Highlight hierarchy)
    const focusedIds = React.useMemo(() => {
        if (selectedIds.size === 0) return null;
        const ids = new Set<number>();

        selectedIds.forEach(id => {
            // 1. Add Self
            ids.add(id);

            // 2. Add Descendants (Recursive)
            const addDescendants = (parentId: number) => {
                data.forEach(d => {
                    if (d.id_pai === parentId) {
                        ids.add(d.id);
                        addDescendants(d.id);
                    }
                });
            };
            addDescendants(id);

            // 3. Add Ancestors (Walk up)
            let curr = data.find(d => d.id === id);
            while (curr && curr.id_pai) {
                ids.add(curr.id_pai);
                curr = data.find(d => d.id === curr!.id_pai);
            }
        });

        return ids;
    }, [selectedIds, data]);

    // Filter data for visibility based on expanded state
    // Assumes data is sorted hierarchically (parents before children)
    const visibleData = React.useMemo(() => {
        const visible: FinancialCategory[] = [];
        const visibleParents = new Set<number>(); // Set of IDs that are effectively expanding their children

        for (const row of data) {
            const isRoot = row.id_pai === null;
            // A row is visible if it is root, OR its parent is in the visibleParents set
            const isVisible = isRoot || (row.id_pai !== null && visibleParents.has(row.id_pai));

            if (isVisible) {
                visible.push(row);
                // If this row is expanded, add it to visibleParents so its children can be seen
                if (expandedIds.has(row.id)) {
                    visibleParents.add(row.id);
                }
            }
        }
        return visible;
    }, [data, expandedIds]);

    // Helper to format currency
    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return '-';
        const sign = val < 0 ? '-' : '';
        const absoluteVal = Math.abs(val);
        return `${sign}${new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(absoluteVal)}`;
    };

    // Helper to get month label
    const getMonthLabel = (key: string) => {
        const [y, m] = key.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-transparent animate-in fade-in duration-500 font-sans overflow-hidden">
            {/* Header */}
            <header className="h-20 border-b border-border-light dark:border-white/5 flex items-center justify-between px-8 bg-white dark:bg-[#0B1116] sticky top-0 z-40 shrink-0 shadow-sm dark:shadow-2xl dark:shadow-black/20">
                {/* Left: Title */}
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                            Gestão Financeira
                        </h1>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Visão Geral & Fluxo de Caixa</p>
                    </div>
                </div>

                {/* Right: Filters & Actions */}
                <div className="flex items-center gap-4">
                    {/* Date Filters */}
                    <FinancialFilters
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                        onApply={fetchFinancialData}
                        loading={loading}
                    />

                    <div className="h-8 w-px bg-white/10 mx-2"></div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/financial/new')}
                            className="bg-[#0E0069] hover:bg-[#0A0050] text-white h-9 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#0E0069]/20 transition-all border border-white/5"
                        >
                            <Plus className="w-3.5 h-3.5 text-white" />
                            <span>Novo Lançamento</span>
                        </button>
                        <button
                            onClick={() => setShowKnowledgeManager(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all border border-white/10"
                        >
                            <Brain className="w-3.5 h-3.5 text-white" />
                            <span>Memória</span>
                        </button>
                        <button
                            onClick={() => navigate('/financial/import')}
                            className="bg-blue-600 hover:bg-blue-500 text-white h-9 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all border-t border-white/10 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                            <Sparkles className="w-3.5 h-3.5 fill-white text-white" />
                            <span>Importar com IA</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* KPI Grid */}
                {(() => {
                    // KPI Calculation Helper
                    const calculateTotal = (codePrefix: string) => {
                        const categories = data.filter(d => d.codigo === codePrefix || d.codigo.startsWith(codePrefix + '.'));
                        let sum = 0;
                        categories.forEach(cat => {
                            // Only sum root/parent level to avoid double counting if children are present
                            // Actually, fetching specific root code is safer.
                            if (cat.codigo === codePrefix) {
                                months.forEach(m => sum += (cat.monthly_data?.[m]?.dre || 0));
                            }
                        });
                        return sum;
                    };

                    const receitaBruta = calculateTotal('1');
                    const impostos = calculateTotal('2');
                    const csp = calculateTotal('4');
                    const folha = calculateTotal('9'); // Funcionários

                    // Break Even Calculation
                    // Fixed Costs: 7 (Imovel), 8 (Adm), 9 (Func), 11 (Fin)
                    const fixedCosts = Math.abs(calculateTotal('7')) + Math.abs(calculateTotal('8')) + Math.abs(calculateTotal('9')) + Math.abs(calculateTotal('11'));

                    // Variable Costs: 2 (Imp), 3 (Mat), 4 (Serv), 5 (Outros), 6 (Vendas/Com)
                    const variableCosts = Math.abs(calculateTotal('2')) + Math.abs(calculateTotal('3')) + Math.abs(calculateTotal('4')) + Math.abs(calculateTotal('5')) + Math.abs(calculateTotal('6'));

                    const receitaLiquida = receitaBruta; // Simplified for margin base, strictly it's Receita - Deductions but mostly mapped to 1 here or 1-2. Let's use 1 as base volume.
                    // Contribution Margin % = (Revenue - Variable) / Revenue
                    const contributionMargin = receitaBruta > 0 ? (receitaBruta - variableCosts) / receitaBruta : 0;

                    const breakEvenPoint = contributionMargin > 0 ? fixedCosts / contributionMargin : 0;

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
                            {/* Receita Bruta - Premium Glass/Gradient Effect */}
                            <div className="relative group overflow-hidden bg-white dark:bg-[#121921] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/10"></div>
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">Receita Bruta</p>
                                            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                <TrendingUp className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight" title={formatCurrency(receitaBruta)}>
                                            {formatCurrency(receitaBruta)}
                                        </h3>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-full rounded-full"></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Faturamento</span>
                                    </div>
                                </div>
                            </div>

                            {/* Impostos */}
                            <div className="relative group bg-white dark:bg-[#121921] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">Impostos</p>
                                            <div className="p-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400">
                                                <Landmark className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight" title={formatCurrency(Math.abs(impostos))}>
                                            {formatCurrency(Math.abs(impostos))}
                                        </h3>
                                    </div>
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                                            <span>Impacto na Receita</span>
                                            <span className="text-slate-900 dark:text-slate-300">
                                                {receitaBruta > 0 ? ((Math.abs(impostos) / receitaBruta) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(receitaBruta > 0 ? (Math.abs(impostos) / receitaBruta) * 100 : 0, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CSP */}
                            <div className="relative group bg-white dark:bg-[#121921] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">CSP (Serviços)</p>
                                            <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                                                <Filter className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight" title={formatCurrency(Math.abs(csp))}>
                                            {formatCurrency(Math.abs(csp))}
                                        </h3>
                                    </div>
                                    <div className="mt-3">
                                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                            Custos diretos operacionais
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Folha */}
                            <div className="relative group bg-white dark:bg-[#121921] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">Folha / Pessoal</p>
                                            <div className="p-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                                                <CheckCircle className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight" title={formatCurrency(Math.abs(folha))}>
                                            {formatCurrency(Math.abs(folha))}
                                        </h3>
                                    </div>
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                                            <span>Representatividade</span>
                                            <span className="text-slate-900 dark:text-slate-300">
                                                {receitaBruta > 0 ? ((Math.abs(folha) / receitaBruta) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(receitaBruta > 0 ? (Math.abs(folha) / receitaBruta) * 100 : 0, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Ponto de Equilíbrio - Featured Card */}
                            <div className="relative overflow-hidden bg-white dark:bg-primary/10 border border-slate-200 dark:border-primary/20 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                                {/* Abstract Background Decoration */}
                                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                                    <Target className="w-24 h-24 text-primary dark:text-white" />
                                </div>
                                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-primary/5 dark:bg-primary/20 rounded-full blur-2xl"></div>

                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <p className="text-slate-500 dark:text-primary-foreground/70 text-[10px] font-bold uppercase tracking-widest">Ponto de Equilíbrio</p>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-primary-foreground tracking-tight" title={formatCurrency(breakEvenPoint)}>
                                            {formatCurrency(breakEvenPoint)}
                                        </h3>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="flex items-center justify-center size-5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                            <Target className="w-3 h-3" />
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Meta Mínima</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Main Table Container */}
                <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-xl flex flex-col">
                    {/* Table Controls Header */}
                    <div className="p-4 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-card-dark/80 gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white">Demonstrativo Financeiro</h2>
                        </div>
                        <div className="flex gap-3 items-center">
                            <div className="hidden lg:flex items-center gap-6 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-r border-border-light dark:border-border-dark mr-2">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary/40 rounded-sm"></span> DRE: Resultado ($)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-400/50 rounded-sm"></span> AV: Análise Vertical (%)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-accent/40 rounded-sm"></span> AH: Análise Horizontal (%)</span>
                            </div>
                            {/* Filter Button Integrated? No, moved to Header */}
                        </div>
                    </div>

                    {/* Scrollable Table */}
                    <div className="overflow-auto custom-scrollbar max-h-[60vh]">
                        <table className="w-full text-left border-collapse min-w-[1400px]">
                            <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-[#121921] text-[10px] font-black uppercase tracking-widest border-b border-border-light dark:border-border-dark text-slate-500 dark:text-slate-400 shadow-sm">
                                <tr>
                                    <th className="sticky left-0 top-0 z-50 bg-slate-50 dark:bg-[#121921] w-72 p-4 border-r border-border-light dark:border-border-dark" rowSpan={2}>
                                        Estrutura de Contas
                                    </th>
                                    {months.map(m => (
                                        <th key={m} className="p-3 text-center border-r border-border-light dark:border-border-dark bg-slate-100/50 dark:bg-white/5 text-primary dark:text-secondary" colSpan={3}>
                                            {getMonthLabel(m)}
                                        </th>
                                    ))}
                                    <th className="p-3 text-center bg-primary/10 dark:bg-primary/20 text-primary dark:text-secondary" colSpan={3}>Total Período</th>
                                </tr>
                                <tr className="text-[9px] border-b border-border-light dark:border-border-dark">
                                    {/* Repeat headers for each month */}
                                    {months.map(m => (
                                        <React.Fragment key={m}>
                                            <th className="p-2 text-right bg-slate-100/50 dark:bg-white/5">DRE ($)</th>
                                            <th className="p-2 text-right bg-slate-100/50 dark:bg-white/5">AV (%)</th>
                                            <th className="p-2 text-right border-r border-border-light dark:border-border-dark bg-slate-100/50 dark:bg-white/5">DFC AH (%)</th>
                                        </React.Fragment>
                                    ))}

                                    <th className="p-2 text-right bg-primary/5 dark:bg-primary/10">DRE ($)</th>
                                    <th className="p-2 text-right bg-primary/5 dark:bg-primary/10 text-primary dark:text-secondary">AV Média</th>
                                    <th className="p-2 text-right bg-primary/5 dark:bg-primary/10">DFC AH (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-sm text-slate-700 dark:text-slate-300">
                                {loading ? (
                                    <tr><td colSpan={12} className="p-8 text-center">Carregando dados financeiros...</td></tr>
                                ) : visibleData.map((row) => {
                                    // Calculate Row Totals
                                    const totalDre = months.reduce((acc, m) => acc + (row.monthly_data?.[m]?.dre || 0), 0);
                                    const totalDfc = months.reduce((acc, m) => acc + (row.monthly_data?.[m]?.dfc || 0), 0);

                                    // Determine row style based on level/type
                                    const isRoot = row.nivel === 0;
                                    const isParent = row.tipo === 'group' || isRoot || (data.some(d => d.id_pai === row.id));
                                    const isExpanded = expandedIds.has(row.id);
                                    const isSelected = selectedIds.has(row.id);

                                    // Focus Logic
                                    const isDimmed = focusedIds && !focusedIds.has(row.id);

                                    // Dynamic Class construction
                                    let rowBg = 'transition-all duration-300 ';

                                    if (isDimmed) {
                                        rowBg += 'opacity-30 blur-[0.5px] grayscale ';
                                    } else {
                                        if (isSelected) {
                                            rowBg += 'bg-primary/10 dark:bg-primary/20 border-l-4 border-primary shadow-sm z-10 relative ';
                                        } else if (isRoot) {
                                            rowBg += 'bg-slate-50/50 dark:bg-white/5 font-bold hover:bg-slate-100 dark:hover:bg-white/10 ';
                                        } else {
                                            rowBg += 'hover:bg-slate-50 dark:hover:bg-white/5 ';
                                        }
                                    }

                                    return (
                                        <React.Fragment key={row.id}>
                                            <tr className={`group ${rowBg} ${isParent ? 'cursor-pointer' : 'cursor-default'}`} onClick={(e) => handleRowClick(row, e)}>
                                                <td className={`sticky left-0 p-3 border-r border-border-light dark:border-border-dark z-20 flex items-center gap-2 ${isSelected ? 'bg-primary/10 dark:bg-primary/20' : (isDimmed ? 'bg-transparent opacity-80' : 'bg-white dark:bg-card-dark')}`}>
                                                    <div style={{ paddingLeft: `${row.nivel * 16}px` }} className="flex items-center gap-2 text-nowrap">
                                                        {isParent && (
                                                            <div
                                                                onClick={(e) => handleExpandClick(e, row.id)}
                                                                className="p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                                                            >
                                                                {isExpanded ?
                                                                    <ChevronDown className="w-3 h-3 text-primary dark:text-secondary opacity-80" /> :
                                                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                                                }
                                                            </div>
                                                        )}
                                                        {/* Drill-down Toggle for Leaf Nodes or Groups with values */}
                                                        {!isParent && (
                                                            <div
                                                                onClick={(e) => toggleDrilldown(e, row.id)}
                                                                className="rounded-md transition-colors cursor-pointer group/drill p-0.5 hover:bg-slate-200 dark:hover:bg-white/20"
                                                                title="Ver Transações Detalhadas"
                                                            >
                                                                {expandedDrilldownIds.has(row.id) ?
                                                                    <ChevronDown className="w-3 h-3 text-blue-500" /> :
                                                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover/drill:text-blue-400" />
                                                                }
                                                            </div>
                                                        )}

                                                        {!isParent && <span className="hidden"></span>}
                                                        <span className={`${isRoot ? 'font-extrabold uppercase' : ''} ${isParent ? 'font-semibold' : ''} text-slate-900 dark:text-slate-100 tracking-tight`}>
                                                            {row.nome}
                                                        </span>
                                                    </div>
                                                </td>

                                                {months.map((m, monthIndex) => {
                                                    const dreVal = row.monthly_data?.[m]?.dre || 0;
                                                    const dfcVal = row.monthly_data?.[m]?.dfc || 0;

                                                    // AV Calculation (Análise Vertical)
                                                    const revenueRow = data.find(d => d.codigo === '1');
                                                    const monthlyRevenue = revenueRow?.monthly_data?.[m]?.dre || 0;

                                                    let avPercent = 0;
                                                    if (monthlyRevenue !== 0) {
                                                        avPercent = (dreVal / monthlyRevenue) * 100;
                                                    }

                                                    // DFC AH Calculation (Análise Horizontal - Mês a Mês)
                                                    let dfcAhPercent: number | null = null;
                                                    if (monthIndex > 0) {
                                                        const prevMonth = months[monthIndex - 1];
                                                        const prevDfcVal = row.monthly_data?.[prevMonth]?.dfc || 0;
                                                        if (prevDfcVal !== 0) {
                                                            dfcAhPercent = ((dfcVal - prevDfcVal) / Math.abs(prevDfcVal)) * 100;
                                                        }
                                                    }

                                                    return (
                                                        <React.Fragment key={m}>
                                                            <td className={`p-3 text-right ${dreVal < 0 ? 'text-red-500' : ''}`}>{formatCurrency(dreVal)}</td>
                                                            <td className="p-3 text-right text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                                                                {avPercent !== 0 ? `${avPercent.toFixed(1)}%` : '-'}
                                                            </td>
                                                            <td className={`p-3 text-right border-r border-border-light dark:border-border-dark text-[10px] font-medium ${dfcAhPercent === null ? 'text-slate-400 dark:text-slate-500' :
                                                                dfcAhPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                                                    dfcAhPercent < 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'
                                                                }`}>
                                                                {dfcAhPercent === null ? '-' : `${dfcAhPercent > 0 ? '+' : ''}${dfcAhPercent.toFixed(1)}%`}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Period Totals */}
                                                {(() => {
                                                    // Total DFC AH: Last month vs First month
                                                    const firstMonth = months[0];
                                                    const lastMonth = months[months.length - 1];
                                                    const firstDfc = row.monthly_data?.[firstMonth]?.dfc || 0;
                                                    const lastDfc = row.monthly_data?.[lastMonth]?.dfc || 0;
                                                    let totalAhPercent: number | null = null;
                                                    if (firstDfc !== 0 && months.length > 1) {
                                                        totalAhPercent = ((lastDfc - firstDfc) / Math.abs(firstDfc)) * 100;
                                                    }
                                                    return (
                                                        <>
                                                            <td className={`p-3 text-right bg-primary/5 dark:bg-primary/10 font-bold ${totalDre < 0 ? 'text-red-500' : ''}`}>{formatCurrency(totalDre)}</td>
                                                            <td className="p-3 text-right bg-primary/5 dark:bg-primary/10">-</td>
                                                            <td className={`p-3 text-right bg-primary/5 dark:bg-primary/10 font-bold text-[10px] ${totalAhPercent === null ? 'text-slate-400 dark:text-slate-500' :
                                                                totalAhPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                                                    totalAhPercent < 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'
                                                                }`}>
                                                                {totalAhPercent === null ? '-' : `${totalAhPercent > 0 ? '+' : ''}${totalAhPercent.toFixed(1)}%`}
                                                            </td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                            {/* Nested Transaction Drill-down Rows - Each transaction as a table row */}
                                            {expandedDrilldownIds.has(row.id) && (
                                                <>
                                                    {loadingDrilldown[row.id] ? (
                                                        <tr className="animate-in fade-in duration-200">
                                                            <td colSpan={months.length * 3 + 4} className="p-3 border-b border-border-light dark:border-border-dark bg-[#0F172A]/20">
                                                                <div className="flex items-center gap-3 text-slate-500" style={{ paddingLeft: `${(row.nivel + 1) * 24}px` }}>
                                                                    <div className="w-3 h-3 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin"></div>
                                                                    <span className="text-[10px]">Carregando transações...</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (drilldownData[row.id]?.length || 0) > 0 && (
                                                        drilldownData[row.id].map((tx, txIdx) => (
                                                            <tr
                                                                key={`tx-${tx.id}`}
                                                                className="animate-in fade-in slide-in-from-top-1 duration-200 hover:bg-white/5 transition-colors group/tx"
                                                                style={{ animationDelay: `${txIdx * 30}ms` }}
                                                            >
                                                                {/* Name Column - Transaction Description */}
                                                                <td className="p-3 border-b border-border-light dark:border-border-dark bg-[#0F172A]/10 sticky left-0 z-10">
                                                                    <div
                                                                        className="flex items-center gap-2 text-[11px]"
                                                                        style={{ paddingLeft: `${(row.nivel + 1) * 24}px` }}
                                                                    >
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600/50"></div>
                                                                        <span className="text-slate-400 truncate max-w-[280px]" title={tx.descricao}>
                                                                            {tx.descricao}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* Month Columns - Show value only in matching month */}
                                                                {months.map(monthKey => {
                                                                    const isMatchingMonth = tx.data === monthKey;
                                                                    return (
                                                                        <React.Fragment key={`${tx.id}-${monthKey}`}>
                                                                            {/* DRE Value */}
                                                                            <td className={`p-3 text-right border-b border-border-light dark:border-border-dark text-[10px] font-mono ${isMatchingMonth
                                                                                ? (tx.valor < 0 ? 'text-red-400 bg-red-500/5' : 'text-emerald-400 bg-emerald-500/5')
                                                                                : 'text-slate-600 bg-[#0F172A]/10'
                                                                                }`}>
                                                                                {isMatchingMonth
                                                                                    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Math.abs(tx.valor))
                                                                                    : '-'
                                                                                }
                                                                            </td>
                                                                            {/* AV (%) - Empty for transactions */}
                                                                            <td className="p-3 text-right border-b border-border-light dark:border-border-dark text-[10px] text-slate-600 bg-[#0F172A]/10">
                                                                                -
                                                                            </td>
                                                                            {/* DFC AH (%) - Empty for transactions */}
                                                                            <td className="p-3 text-right border-b border-border-light dark:border-border-dark text-[10px] text-slate-600 bg-[#0F172A]/10">
                                                                                -
                                                                            </td>
                                                                        </React.Fragment>
                                                                    );
                                                                })}

                                                                {/* Total Columns - Empty for individual transactions */}
                                                                <td className="p-3 text-right border-b border-border-light dark:border-border-dark bg-[#0F172A]/10 text-[10px] text-slate-600">-</td>
                                                                <td className="p-3 text-right border-b border-border-light dark:border-border-dark bg-[#0F172A]/10 text-[10px] text-slate-600">-</td>
                                                                <td className="p-3 text-right border-b border-border-light dark:border-border-dark bg-[#0F172A]/10 text-[10px] text-slate-600">-</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Horizontal Scroll Bar Indicator */}
                    <div className="p-3 bg-slate-50 dark:bg-background-dark/40 flex justify-between items-center px-6">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                            <Info className="w-4 h-4" />
                            Rolagem horizontal ativa para períodos adicionais
                        </div>
                    </div>
                </div>

                {/* Bottom Cards: Cash Flow & Forecast */}


            </div>

            {/* Footer Status Bar */}
            <footer className="h-10 border-t border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/80 px-6 flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Maqlam Financial</span>
                </div>
                <div className="flex items-center gap-4 hidden sm:flex opacity-70">
                    <span title="Demonstração do Resultado do Exercício">DRE = Demonstração do Resultado</span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span title="Análise Vertical">AV = Análise Vertical</span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span title="Demonstração de Fluxo de Caixa">DFC = Fluxo de Caixa</span>
                </div>
            </footer>

            <AIKnowledgeManager
                isOpen={showKnowledgeManager}
                onClose={() => setShowKnowledgeManager(false)}
            />
        </div >
    );
};

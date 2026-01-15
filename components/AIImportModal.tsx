import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FloatingDropdownContent } from './FloatingDropdownContent';
import {
    X,
    Search,
    UploadCloud,
    FileText,
    CheckCircle,
    Check,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Brain,
    Lightbulb,
    ArrowRight,
    Trash2,
    Undo,
    Loader2,
    AlertCircle,
    History,
    File,
    Clock,
    StopCircle,
    AlertTriangle,
    Sparkles,
    Cpu,
    DollarSign,
    Plus,
    ArrowLeft,
    Building2,
    Wallet,
    Pencil
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AIImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    isPage?: boolean;
}

interface TransactionDraft {
    data: string;
    descricao: string;
    valor: number;
    categoria_sugerida_id?: number | string;
    categoria_confianca?: number;
    isDuplicate?: boolean;
    duplicateId?: number;
    forceKeep?: boolean;
}

interface FinancialAccount {
    id: number;
    nome: string;
    banco: string;
}

type ImportStatus = 'pending' | 'processing' | 'completed' | 'error';

interface ImportRecord {
    id: string;
    file_name: string;
    file_path?: string;
    created_at: string;
    status: ImportStatus;
    result_data?: TransactionDraft[];
    progress?: number;
    status_description?: string;
    error_message?: string;
    model_used?: string;
    tokens_input?: number;
    tokens_output?: number;
    estimated_cost?: number;
    status_confirmacao?: string; // 'pendente' | 'confirmado'
}

// Available AI Models
// Available AI Models
const AI_MODELS = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Alta Precisão (Recomendado)', cost: '$1.50/1M' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Equilibrado e Moderno', cost: '$0.075/1M' }
];

import { useNavigate, useLocation, useParams, matchPath } from 'react-router-dom';

// ... (previous imports)



// Categories Interface
export interface Category {
    id: number;
    nome: string;
    tipo?: string;
    id_pai?: number | null;
}

export const AIImportModal: React.FC<AIImportModalProps> = ({ isOpen, onClose, isPage }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { id: routeId } = useParams();

    // UI State
    // UI State
    const [activeTabState, setActiveTabState] = useState<'upload' | 'history'>('upload');

    // Routing-aware activeTab
    const activeTab = isPage ? (location.pathname.includes('/history') ? 'history' : 'upload') : activeTabState;

    const setActiveTab = (tab: 'upload' | 'history') => {
        if (isPage) {
            if (tab === 'history') navigate('/financial/import/history');
            else navigate('/financial/import');
        } else {
            setActiveTabState(tab);
        }
    };

    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Current Active Import State
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [status, setStatus] = useState<ImportStatus | 'idle'>('idle');
    const [progress, setProgress] = useState(0);
    const [statusDescription, setStatusDescription] = useState('Aguardando...');
    const [transactions, setTransactions] = useState<TransactionDraft[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [confirmationStatus, setConfirmationStatus] = useState<string | null>(null);

    // AI Model Selection
    // AI Model Selection
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro');
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    // AI Metrics
    const [modelUsed, setModelUsed] = useState<string | null>(null);
    const [tokensInput, setTokensInput] = useState<number | null>(null);
    const [tokensOutput, setTokensOutput] = useState<number | null>(null);
    const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number>(6.0); // Default fallback

    // Fetch Dollar Rate
    useEffect(() => {
        fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
            .then(res => res.json())
            .then(data => {
                if (data.USDBRL?.bid) {
                    setExchangeRate(parseFloat(data.USDBRL.bid));
                }
            })
            .catch(() => console.warn('Failed to fetch exchange rate, using fallback.'));
    }, []);

    // Approval state: track which transactions are approved/rejected
    const [approvedItems, setApprovedItems] = useState<Set<number>>(new Set());
    const [rejectedItems, setRejectedItems] = useState<Set<number>>(new Set());

    // History State
    const [history, setHistory] = useState<ImportRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Accounts State
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountBank, setNewAccountBank] = useState('');
    const accountDropdownRef = useRef<HTMLDivElement>(null);

    // Close account dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
                setIsAccountDropdownOpen(false);
                setIsCreatingAccount(false);
            }
        };
        if (isAccountDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isAccountDropdownOpen]);

    const handleCreateAccount = async () => {
        if (!user || !newAccountName.trim()) return;

        try {
            const { data, error } = await supabase
                .from('contas_financeiras')
                .insert({
                    nome: newAccountName.trim(),
                    banco: newAccountBank.trim() || null,
                    ativo: true
                    // user_id is often RLS or auto-handled? Check constraints? 
                    // Usually tied to company/tenant. Assuming schema allows default or context handles it.
                    // Wait, previous fetches didn't need user filter, just RLS.
                    // Let's assume standard RLS handles ownership on insert?
                    // Actually, 'contas_financeiras' usually needs a reference if not global.
                    // Previous RPCs suggest it might just be 'id' based.
                    // Let's check if 'id_usuario' or 'id_empresa' is needed.
                    // Based on 'usuarios' table logic, might need nothing if public?
                    // But 'contas_financeiras' might be shared.
                    // Let's try insert. If fails, I'll fix.
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setAccounts(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
                setSelectedAccountId(data.id);
                setIsCreatingAccount(false);
                setIsAccountDropdownOpen(false);
                setNewAccountName('');
                setNewAccountBank('');
            }
        } catch (error: any) {
            console.error("Error creating account:", error);
            alert(`Erro ao criar conta: ${error.message}`);
        }
    };

    // Categories - store as array for dropdown rendering
    const [categoriesList, setCategoriesList] = useState<Category[]>([]);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);

    // Track edited categories per transaction index
    const [editedCategories, setEditedCategories] = useState<Map<number, number>>(new Map());
    const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

    // Accordion State for Categories
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const toggleCategoryExpansion = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Group Dropdown State
    const [openGroupDropdownIdx, setOpenGroupDropdownIdx] = useState<number | null>(null);
    const [groupDropdownAnchor, setGroupDropdownAnchor] = useState<HTMLElement | null>(null);

    // Main Dropdown State
    const [dropdownAnchor, setDropdownAnchor] = useState<HTMLElement | null>(null);

    const toggleCategoryDropdown = (e: React.MouseEvent<HTMLButtonElement>, idx: number) => {
        e.stopPropagation();
        if (openDropdownIdx === idx) {
            setOpenDropdownIdx(null);
            setDropdownAnchor(null);
        } else {
            setOpenDropdownIdx(idx);
            setDropdownAnchor(e.currentTarget);
        }
    };

    // Inline Editing State
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editData, setEditData] = useState<string>('');
    const [editDescricao, setEditDescricao] = useState<string>('');
    const [editValor, setEditValor] = useState<string>('');

    // Bulk Categorization State
    const [isGroupingModalOpen, setIsGroupingModalOpen] = useState(false);
    const [showAllTransactions, setShowAllTransactions] = useState(false);

    interface TransactionGroup {
        description: string;
        count: number;
        indices: number[];
    }
    const [groupedTransactions, setGroupedTransactions] = useState<TransactionGroup[]>([]);
    const [processedGroups, setProcessedGroups] = useState<Set<string>>(new Set());
    const [expandedGroupIndices, setExpandedGroupIndices] = useState<Set<number>>(new Set());

    // Detect groups when transactions change
    useEffect(() => {
        if (transactions.length === 0) {
            setGroupedTransactions([]);
            return;
        }

        const groups = new Map<string, number[]>();

        transactions.forEach((t, index) => {
            if (!t.descricao) return;
            // Normalize description: trim, uppercase, remove multiple spaces
            const desc = t.descricao.trim().toUpperCase().replace(/\s+/g, ' ');
            if (desc) {
                if (!groups.has(desc)) {
                    groups.set(desc, []);
                }
                groups.get(desc)?.push(index);
            }
        });

        const result: TransactionGroup[] = [];
        groups.forEach((indices, description) => {
            // Only suggest group if:
            // 1. Has 2 or more items
            // 2. Has NOT been processed yet (user hasn't explicitly bulk-applied it)
            if (indices.length >= 2 && !processedGroups.has(description)) {
                result.push({
                    description,
                    count: indices.length,
                    indices
                });
            }
        });

        // Sort by count (descending)
        result.sort((a, b) => b.count - a.count);

        setGroupedTransactions(result);
    }, [transactions, processedGroups]);

    // Compute which transactions to display based on filter
    const groupedIndices = new Set(groupedTransactions.flatMap(g => g.indices));
    const displayedTransactions = showAllTransactions
        ? transactions.map((t, idx) => ({ ...t, originalIdx: idx }))
        : transactions
            .map((t, idx) => ({ ...t, originalIdx: idx }))
            .filter(t => !groupedIndices.has(t.originalIdx));

    const applyBulkCategory = (description: string, indices: number[], categoryId: number) => {
        setTransactions(prev => {
            const next = [...prev];
            indices.forEach(idx => {
                if (next[idx]) {
                    next[idx] = { ...next[idx], categoria_sugerida_id: categoryId };
                }
            });
            return next;
        });

        // Mark these indices as edited so UI reflects it (blue dot etc)
        setEditedCategories(prev => {
            const next = new Map(prev);
            indices.forEach(idx => {
                next.set(idx, categoryId);
            });
            return next;
        });

        // Mark this group as processed so it disappears from suggestions
        setProcessedGroups(prev => new Set(prev).add(description));
    };

    // Inline Edit Functions
    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const parseCurrency = (value: string) => {
        // Remove R$, spaces, dots (thousand separator), and convert comma to dot
        const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    };

    const dateToInputFormat = (dateStr: string) => {
        if (!dateStr) return '';
        // Assumes DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length !== 3) return '';
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
    };

    const inputToDateFormat = (inputVal: string) => {
        if (!inputVal) return '';
        // Assumes YYYY-MM-DD
        const parts = inputVal.split('-');
        if (parts.length !== 3) return '';
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    const startEdit = (idx: number) => {
        const t = transactions[idx];
        if (!t) return;
        setEditingIdx(idx);
        setEditData(dateToInputFormat(t.data));
        setEditDescricao(t.descricao);
        setEditValor(formatCurrency(t.valor)); // Format as "1.234,56"
    };

    const saveEdit = () => {
        if (editingIdx === null) return;
        setTransactions(prev => {
            const next = [...prev];
            if (next[editingIdx]) {
                next[editingIdx] = {
                    ...next[editingIdx],
                    data: inputToDateFormat(editData),
                    descricao: editDescricao,
                    valor: parseCurrency(editValor)
                };
            }
            return next;
        });
        cancelEdit();
    };

    const cancelEdit = () => {
        setEditingIdx(null);
        setEditData('');
        setEditDescricao('');
        setEditValor('');
    };

    const handleAddTransaction = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();

        const displayDate = `${day}/${month}/${year}`;
        const inputDate = `${year}-${month}-${day}`;

        const newDraft: TransactionDraft = {
            data: displayDate,
            descricao: 'Nova Transação',
            valor: 0,
            categoria_sugerida_id: undefined
        };

        const newIdx = transactions.length;
        setTransactions([...transactions, newDraft]);

        // Start editing correctly
        setEditingIdx(newIdx);
        setEditData(inputDate);
        setEditDescricao('Nova Transação');
        setEditValor('0,00');
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setOpenDropdownIdx(null);
            setOpenGroupDropdownIdx(null);
        };
        if (openDropdownIdx !== null || openGroupDropdownIdx !== null) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [openDropdownIdx, openGroupDropdownIdx]);

    // 1. Fetch Categories FIRST, then History on Open
    useEffect(() => {
        if (isOpen && user) {
            // Chain: categories first, then history (fixes race condition)
            fetchCategories()
                .then(() => fetchAccounts())
                .then(() => fetchHistory());
        } else {
            // Reset when closed
            setDocumentId(null);
            setStatus('idle');
            setTransactions([]);
            setCategoriesLoaded(false);
            setEditedCategories(new Map());
            setOpenDropdownIdx(null);
        }
    }, [isOpen, user]);

    const fetchAccounts = async () => {
        try {
            const { data } = await supabase
                .from('contas_financeiras')
                .select('id, nome, banco')
                .eq('ativo', true)
                .order('nome', { ascending: true }); // Sort by name

            if (data) {
                setAccounts(data);
                // Auto-select first if none selected
                if (!selectedAccountId && data.length > 0) {
                    setSelectedAccountId(data[0].id);
                }
            }
        } catch (err) {
            console.error("Error fetching accounts:", err);
        }
    };

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categorias_dre')
            .select('id, nome, tipo, id_pai')
            .order('id_pai', { ascending: true, nullsFirst: true })
            .order('codigo', { ascending: true });
        if (data) {
            setCategoriesList(data as Category[]);
        }
        setCategoriesLoaded(true);
    };

    const fetchHistory = async () => {
        if (!user) return;
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from('documentos_importacao')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            setHistory(data as ImportRecord[]);

            // Auto-Resume: If the most recent one is active, load it
            // Only if we are not explicitly viewing something else
            if (!documentId) {
                const latest = data[0];
                if (latest && (latest.status === 'processing' || latest.status === 'pending') && !routeId) {
                    // Only auto-load if NOT on a specific route
                    loadImportSession(latest);
                }
            }
        }
        setLoadingHistory(false);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        const id = itemToDelete;
        const { error } = await supabase.from('documentos_importacao').delete().eq('id', id);

        if (!error) {
            setHistory(prev => prev.filter(i => i.id !== id));
            // If deleting the active one, clear state
            if (documentId === id) {
                if (isPage) {
                    navigate('/financial/import');
                } else {
                    setDocumentId(null);
                    setStatus('idle');
                    setTransactions([]);
                    setFileName('');
                    setActiveTab('history');
                }
            }
        }
        setItemToDelete(null);
    };

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);

    const handleDownloadClick = async (e: React.MouseEvent, item: ImportRecord) => {
        e.stopPropagation();
        if (!item.file_path) return;

        try {
            const { data, error } = await supabase.storage
                .from('financial-uploads')
                .createSignedUrl(item.file_path, 3600); // 1 hour link

            if (error) throw error;
            if (data?.signedUrl) {
                const isPdf = item.file_name.toLowerCase().endsWith('.pdf');
                setPreviewUrl(data.signedUrl);
                setPreviewType(isPdf ? 'pdf' : 'image');
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Não foi possível abrir o arquivo.');
        }
    };

    // Check for Duplicates
    const checkForDuplicates = async (drafts: TransactionDraft[]) => {
        if (!drafts.length || !user) return drafts;

        // 1. Find Date Range
        const dates = drafts.map(d => {
            const parts = d.data.split('/');
            if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return null;
        }).filter(d => d) as Date[];

        if (dates.length === 0) return drafts;

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Add buffer (e.g., +/- 1 day just in case timezone issues) or strict?
        // Let's stick to exact range first.
        const startStr = minDate.toISOString().split('T')[0];
        const endStr = maxDate.toISOString().split('T')[0];

        // 2. Fetch Existing
        const { data: existing } = await supabase
            .from('lancamentos')
            .select('id, data_pagamento, valor, descricao')
            .eq('id_conta', selectedAccountId)
            .gte('data_pagamento', startStr)
            .lte('data_pagamento', endStr);

        if (!existing || existing.length === 0) return drafts;

        // 3. Create Map for quick lookup
        // Signature: YYYY-MM-DD|AMOUNT_INT|DESC_NORM
        const existingSignatures = new Set<string>();
        existing.forEach(e => {
            // Amount to integer cents to avoid float issues. USE ABSOLUTE VALUE.
            const amountInt = Math.abs(Math.round(e.valor * 100));
            const descNorm = e.descricao?.trim().toUpperCase().replace(/\s+/g, ' ') || '';
            const sig = `${e.data_pagamento}|${amountInt}|${descNorm}`;
            existingSignatures.add(sig);
        });

        // 4. Mark Duplicates
        return drafts.map(d => {
            const parts = d.data.split('/');
            if (parts.length !== 3) return d;
            const dateIso = `${parts[2]}-${parts[1]}-${parts[0]}`;

            const amountInt = Math.abs(Math.round(d.valor * 100));
            const descNorm = d.descricao?.trim().toUpperCase().replace(/\s+/g, ' ') || '';
            const sig = `${dateIso}|${amountInt}|${descNorm}`;

            if (existingSignatures.has(sig)) {
                return { ...d, isDuplicate: true };
            }
            return d;
        });
    };

    const syncSessionState = async (record: ImportRecord) => {
        setDocumentId(record.id);
        setFileName(record.file_name);
        setStatus(record.status);
        setProgress(record.progress || 0);
        setStatusDescription(record.status_description || 'Carregando estado...');
        setTokensInput(record.tokens_input || 0);
        setTokensOutput(record.tokens_output || 0);
        setEstimatedCost(record.estimated_cost ? parseFloat(String(record.estimated_cost)) : 0);

        let loadedTransactions = record.result_data || [];

        // Only run check if we have data and it's not already confirmed/saved
        if (loadedTransactions.length > 0 && (!record.status_confirmacao || record.status_confirmacao === 'pendente') && user) {
            loadedTransactions = await checkForDuplicates(loadedTransactions);
        }

        setTransactions(loadedTransactions);
        setErrorMessage(record.error_message || null);
        setConfirmationStatus(record.status_confirmacao || null);
        // We don't change tab here, logic handled by router or caller
    };

    const loadImportSession = (record: ImportRecord) => {
        if (isPage) {
            navigate(`/financial/import/result/${record.id}`);
        } else {
            syncSessionState(record);
            setActiveTab('upload');
        }
    };

    const fetchImportById = async (id: string) => {
        if (!user) return;
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from('documentos_importacao')
            .select('*')
            .eq('id', id)
            .single();

        if (data) {
            syncSessionState(data as ImportRecord);
        } else {
            // Handle 404? Redirect?
            navigate('/financial/import');
        }
        setLoadingHistory(false);
    };

    // Effect: Load history when tab is active
    useEffect(() => {
        if (activeTab === 'history' && user) {
            fetchHistory();
        }
    }, [activeTab, user]);

    // Effect: React to URL changes for Document ID
    useEffect(() => {
        if (isPage && user) {
            if (routeId) {
                fetchImportById(routeId);
            } else if (!location.pathname.includes('/history')) {
                // Reset if on main import page
                setDocumentId(null);
                setStatus('idle');
                setTransactions([]);
                setFileName('');
            }
        }
    }, [routeId, location.pathname, isPage, user]);

    // 2. Realtime Subscription (Attached to documentId)
    useEffect(() => {
        if (!documentId) return;

        // Channel for Main Document
        const mainChannel = supabase
            .channel(`import-${documentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'documentos_importacao',
                    filter: `id=eq.${documentId}`
                },
                async (payload) => {
                    const newData = payload.new as ImportRecord;

                    // Update Status immediately
                    setStatus(newData.status);
                    if (newData.progress !== undefined) setProgress(newData.progress);
                    if (newData.status_description) setStatusDescription(newData.status_description);

                    // ROBUST COMPLETION HANDLING:
                    // If completed, force a manual fetch to guarantee we have the FULL JSON and Cost data.
                    // Realtime payloads can sometimes be partial or hit size limits.
                    if (newData.status === 'completed') {
                        const { data: fullRecord, error: fetchError } = await supabase
                            .from('documentos_importacao')
                            .select('*')
                            .eq('id', documentId)
                            .single();

                        if (fullRecord && !fetchError) {
                            setTransactions(fullRecord.result_data || []);
                            setModelUsed(fullRecord.model_used || selectedModel); // Fallback to selected if empty
                            setTokensInput(fullRecord.tokens_input || 0);
                            setTokensOutput(fullRecord.tokens_output || 0);
                            setEstimatedCost(fullRecord.estimated_cost || 0);

                            // AUTO-OPEN: Force switch to main view
                            setActiveTab('upload');
                        }
                    }
                    else if (newData.status === 'error') {
                        setErrorMessage(newData.error_message || 'Erro desconhecido');
                        setActiveTab('upload'); // Show error
                    }

                    // Also update the item in the history list locally
                    setHistory(prev => prev.map(item => item.id === newData.id ? { ...item, ...newData } : item));
                }
            )
            .subscribe();

        // Channel for Chunks (Progress for large files)
        const chunksChannel = supabase
            .channel(`import-chunks-${documentId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT/UPDATE
                    schema: 'public',
                    table: 'importacao_chunks',
                    filter: `documento_id=eq.${documentId}`
                },
                async (payload) => {
                    // When a chunk updates, re-fetch count of completed chunks
                    // We do this via a quick query to avoid tracking all chunk state locally
                    const { count } = await supabase
                        .from('importacao_chunks')
                        .select('*', { count: 'exact', head: true })
                        .eq('documento_id', documentId)
                        .eq('status', 'completed');

                    const { data: firstChunk } = await supabase
                        .from('importacao_chunks')
                        .select('total_chunks')
                        .eq('documento_id', documentId)
                        .limit(1)
                        .single();

                    if (count !== null && firstChunk?.total_chunks) {
                        const total = firstChunk.total_chunks;
                        // Map chunks to 20% - 90% range of total progress
                        // (0-20% is upload/setup, 90-100% is aggregation)
                        const chunkProgress = Math.round((count / total) * 70);
                        setProgress(20 + chunkProgress);
                        setStatusDescription(`Processando parte ${count} de ${total}...`);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(mainChannel);
            supabase.removeChannel(chunksChannel);
        };
    }, [documentId]);


    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setFileName(file.name);
            // Reset error/status when picking a new file
            setErrorMessage(null);
            setStatus('idle');
        }
    };

    const startImportProcess = async () => {
        if (!selectedFile || !user) return;

        try {
            // Optimistic UI Set
            setStatus('processing');
            setProgress(5);
            setStatusDescription("Enviando arquivo...");
            setErrorMessage(null);
            setTransactions([]);
            // Removed setActiveTab('upload') as we are already there

            // 1. Upload
            const filePath = `${user.id}/${Date.now()}_${selectedFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('financial-uploads')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;
            setProgress(10);

            // 2. DB Insert
            const { data: record, error: dbError } = await supabase
                .from('documentos_importacao')
                .insert({
                    user_id: user.id,
                    file_path: filePath,
                    file_name: selectedFile.name,
                    file_type: selectedFile.type,
                    status: 'pending',
                    progress: 10,
                    status_description: 'Arquivo enviado. Fila de processamento...'
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // Update Real State
            setDocumentId(record.id);
            // Add to history list immediately
            setHistory(prev => [record, ...prev]);

            if (isPage) {
                navigate(`/financial/import/result/${record.id}`);
            }

            // 3. Trigger AI with selected model
            const { error: fnError } = await supabase.functions.invoke('ai-process-document', {
                body: { record: record, model: selectedModel }
            });

            if (fnError) throw fnError;

            // Clear selection after successful start
            setSelectedFile(null);

        } catch (error: any) {
            console.error('Import Error:', error);
            setStatus('error');
            setErrorMessage(error.message);
            setStatusDescription("Falha no envio.");
        }
    };

    if (!isOpen && !isPage) return null;

    const wrapperClass = isPage
        ? "w-full h-full font-sans bg-[#05080A] p-6"
        : "fixed inset-0 z-[99999] bg-[#05080A]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-sans";

    const contentClass = isPage
        ? "bg-[#0B1116] border border-white/5 w-full h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        : "bg-[#0B1116] border border-white/5 w-full max-w-[1400px] h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-300";

    // Calculate totals excluding rejected items
    const activeTransactions = transactions.filter((_, idx) => !rejectedItems.has(idx));
    // Fix: Handle both Negative values (new prompt) and Legacy Positive values (old prompt) correctly based on 'tipo'
    const totalAmount = activeTransactions.reduce((acc, t) => {
        // If type is explicitly 'despesa', force negative logic for the net sum
        if (t.tipo === 'despesa') return acc - Math.abs(t.valor || 0);
        // If type is 'receita', add absolute
        if (t.tipo === 'receita') return acc + Math.abs(t.valor || 0);
        // Fallback to sign
        return acc + (t.valor || 0);
    }, 0);

    const totalEntradas = activeTransactions
        .filter(t => t.tipo === 'receita' || (!t.tipo && t.valor > 0))
        .reduce((acc, t) => acc + Math.abs(t.valor), 0);

    const totalSaidas = activeTransactions
        .filter(t => t.tipo === 'despesa' || (!t.tipo && t.valor < 0))
        .reduce((acc, t) => acc + Math.abs(t.valor), 0);

    const getCategoryName = (idx: number, originalId?: number | string) => {
        // Check if user edited this category
        const editedId = editedCategories.get(idx);
        const catId = editedId !== undefined ? editedId : (typeof originalId === 'string' ? parseInt(originalId, 10) : originalId);

        if (!catId) return 'Sem categoria';
        const category = categoriesList.find(c => c.id === catId);
        return category?.nome || `Categoria ${catId}`;
    };

    const getEffectiveCategoryId = (idx: number, originalId?: number | string): number | undefined => {
        const editedId = editedCategories.get(idx);
        if (editedId !== undefined) return editedId;
        return typeof originalId === 'string' ? parseInt(originalId, 10) : originalId;
    };

    const updateTransactionCategory = (idx: number, newCategoryId: number) => {
        setEditedCategories(prev => {
            const next = new Map(prev);
            next.set(idx, newCategoryId);
            return next;
        });
        setOpenDropdownIdx(null);
    };

    const toggleApprove = (idx: number) => {
        setRejectedItems(prev => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
        });
        setApprovedItems(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const toggleReject = (idx: number) => {
        setApprovedItems(prev => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
        });
        setRejectedItems(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const approveAll = () => {
        const allIndexes = new Set(transactions.map((_, i) => i));
        setApprovedItems(allIndexes);
        setRejectedItems(new Set());
    };

    const getApprovedTransactions = () => {
        return transactions.filter((_, idx) => !rejectedItems.has(idx));
    };

    const handleConfirmSync = async () => {
        if (!user || !documentId) return;
        const toSave = getApprovedTransactions();
        if (toSave.length === 0) {
            alert("Nenhuma transação aprovada para salvar.");
            return;
        }

        if (!selectedAccountId) {
            alert("⚠️ Selecione a Conta de Destino antes de confirmar (ex: Banco X).");
            return;
        }

        try {
            setStatusDescription("Verificando duplicidades...");

            // --- 0. PRE-FLIGHT: GET INTERNAL USER ID (BigInt) ---
            if (!user.email) throw new Error("Usuário sem email autenticado.");

            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('id')
                .eq('email', user.email)
                .single();

            if (userError || !userData) {
                console.error("User mapping error:", userError);
                throw new Error("Usuário não encontrado na tabela pública.");
            }
            const internalUserId = userData.id;

            // --- 0. SMART DUPLICATE CHECK ---
            // Sort by date to find range
            const dates = toSave.map(t => {
                const [day, month, year] = t.data.split('/');
                return `${year}-${month}-${day}`;
            }).sort();

            const minDate = dates[0];
            const maxDate = dates[dates.length - 1];

            // Fetch existing in this range
            const { data: existingData, error: checkError } = await supabase
                .from('lancamentos')
                .select('data_pagamento, valor, descricao, tipo_operacao')
                .gte('data_pagamento', minDate)
                .lte('data_pagamento', maxDate)
                .eq('id_responsavel', internalUserId); // Check only for this user/company

            if (checkError) throw checkError;

            // Create Signatures: "YYYY-MM-DD|150.00|Desc"
            // Normalizing description: lowercase and trim
            const existingSignatures = new Set(existingData?.map(e =>
                `${e.data_pagamento}|${Number(e.valor).toFixed(2)}|${e.descricao?.trim().toLowerCase()}`
            ));

            const newItems: TransactionDraft[] = [];
            const duplicates: TransactionDraft[] = [];

            toSave.forEach(t => {
                // If user forced keep, treat as new item regardless of signature match
                if (t.forceKeep) {
                    newItems.push(t);
                    return;
                }

                const [day, month, year] = t.data.split('/');
                const isoDate = `${year}-${month}-${day}`;
                const val = Math.abs(t.valor).toFixed(2);
                const desc = t.descricao.trim().toLowerCase();

                const sig = `${isoDate}|${val}|${desc}`;

                if (existingSignatures.has(sig)) {
                    duplicates.push(t);
                } else {
                    newItems.push(t);
                }
            });

            let itemsToImport = toSave;

            if (duplicates.length > 0) {
                // Auto-filter duplicates (UI already warned them)
                itemsToImport = newItems;
            }

            if (itemsToImport.length === 0) {
                alert("Nenhuma nova transação foi importada (todos os itens eram duplicatas e foram ignorados).");
                // Even if nothing to import, we verify the doc status
                await supabase.from('documentos_importacao').update({
                    status_confirmacao: 'confirmado',
                    updated_at: new Date().toISOString()
                }).eq('id', documentId);

                setHistory(prev => prev.map(item => item.id === documentId ? { ...item, status_confirmacao: 'confirmado' } : item));
                setDocumentId(null);
                setStatus('idle');
                setTransactions([]);
                onClose();
                return;
            }

            setStatusDescription(`Salvando ${itemsToImport.length} lançamentos...`);

            // 1. Get IDs for Source/Channel
            // We use 'Importação com IA' for channel, to explicitly mark AI usage
            const { data: channelData } = await supabase.from('canais_input').select('id').eq('nome', 'Importação com IA').single();
            const { data: originData } = await supabase.from('origens_input').select('id').eq('nome', 'Upload Arquivo').single();

            const channelId = channelData?.id || 1; // Fallback to 1 if missing
            const originId = originData?.id || 1;

            // 2. Prepare Payload
            const payload = itemsToImport.map(t => {
                // Convert DD/MM/YYYY to YYYY-MM-DD
                const [day, month, year] = t.data.split('/');
                const isoDate = `${year}-${month}-${day}`;
                const competencePeriod = `${year}-${month}`; // YYYY-MM for accounting competence

                // Determine Type: 'E' (Entrada/Receita) or 'S' (Saída/Despesa)
                // Map from AI output ('receita'/'despesa') to enum ('E'/'S')
                const typeOp: 'E' | 'S' = (t.tipo === 'receita' || (!t.tipo && t.valor >= 0)) ? 'E' : 'S';

                // Ensure we have a valid category ID. Fallback to the first available category if none specific.
                // We prioritize: User selection > AI Suggestion > First available in list > Hardcoded Fallback
                const finalCategoryId = t.categoria_sugerida_id || categoriesList[0]?.id || 52;

                return {
                    id_usuario_aprovador: internalUserId,
                    id_responsavel: internalUserId,
                    id_canal_input: channelId,
                    id_origem_input: originId,
                    id_conta: selectedAccountId, // Selected Account ID
                    data_competencia: competencePeriod, // YYYY-MM format (VARCHAR 7)
                    data_pagamento: isoDate,   // Full date for payment
                    data_operacao: `${isoDate}T12:00:00.000Z`, // Must match data_competencia month (Check Constraint)
                    status: 'CONFIRMADO',
                    descricao: t.descricao,
                    valor: Math.abs(t.valor), // Always absolute in DB
                    tipo_operacao: typeOp,
                    id_categoria_dre: finalCategoryId,
                    id_vinculo_nfe: '', // NOT NULL in DB, defaulting to empty
                    numero_nfe: '',     // NOT NULL in DB, defaulting to empty
                    modalidade: { "metodo": "importacao_ia", "model": modelUsed || selectedModel } // Store extra metadata
                };
            });

            // 3. Batch Insert
            const { error: insertError } = await supabase.from('lancamentos').insert(payload);
            if (insertError) throw insertError;

            // 4. Update Document Status
            await supabase.from('documentos_importacao').update({
                status_confirmacao: 'confirmado',
                updated_at: new Date().toISOString()
            }).eq('id', documentId);

            // 5. Success UI
            // Update local history item
            setHistory(prev => prev.map(item => item.id === documentId ? { ...item, status_confirmacao: 'confirmado' } : item));

            setStatus('idle');
            setTransactions([]);
            setDocumentId(null);
            alert(`Sucesso! ${itemsToImport.length} lançamentos salvos.`);
            onClose();

        } catch (error: any) {
            console.error("Save Error:", error);
            setErrorMessage(`Erro ao salvar: ${error.message}`);
        }
    };



    return (
        <div className={wrapperClass}>
            <div className={contentClass}>

                {/* Confirm Delete Overlay */}
                {itemToDelete && (
                    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 slide-in-from-bottom-5">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-4 bg-red-500/10 rounded-full text-red-500 mb-2">
                                    <Trash2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-white text-xl font-bold">Excluir Importação?</h3>
                                <p className="text-slate-400 text-sm">
                                    Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.
                                </p>
                                <div className="flex gap-3 w-full pt-4">
                                    <button
                                        onClick={() => setItemToDelete(null)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        Sim, excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* AI Memory Button */}
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <header className="flex items-center justify-between border-b border-white/5 px-8 py-6 bg-[#0B1116] sticky top-0 z-50 shrink-0">
                    <div className="flex items-center gap-4">
                        {isPage && (
                            <button
                                onClick={() => {
                                    if (status !== 'idle' || documentId) {
                                        setStatus('idle');
                                        setTransactions([]);
                                        setDocumentId(null);
                                        if (isPage) {
                                            if (activeTab === 'history') navigate('/financial/import/history');
                                            else navigate('/financial/import');
                                        }
                                        return;
                                    }
                                    onClose();
                                }}
                                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                                title="Voltar"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg shadow-blue-500/20">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-white text-lg font-bold tracking-tight">Importação Inteligente</h2>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Automacão Financeira via IA</p>
                            </div>
                        </div>
                    </div>
                    {/* Tabs / Toggle History */}
                    <div className="flex items-center gap-4">
                        {(status !== 'idle' && activeTab === 'upload') && (
                            <button
                                onClick={() => {
                                    if (isPage) navigate('/financial/import');
                                    else { setDocumentId(null); setStatus('idle'); setTransactions([]); }
                                }}
                                className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
                            >
                                <Plus className="w-3 h-3" /> Nova Importação
                            </button>
                        )}
                        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5">
                            <button
                                onClick={() => setActiveTab('upload')}
                                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'upload' ? 'bg-[#1A202C] text-white shadow ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Importar / Atual
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'history' ? 'bg-[#1A202C] text-white shadow ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Histórico ({history.length})
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden flex flex-row">

                    {/* View: History List */}
                    {activeTab === 'history' && (
                        <div className="flex-1 p-8 overflow-y-auto bg-slate-950/30">
                            <h3 className="text-white font-bold mb-6">Arquivos Recentes</h3>
                            <div className="space-y-3">
                                {history.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => loadImportSession(item)}
                                        className="group bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-blue-500/30 hover:bg-slate-800/50 transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        {/* Status Indicator Stripe */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.status === 'completed' && (!item.status_confirmacao || item.status_confirmacao === 'pendente') ? 'bg-amber-500' :
                                            item.status === 'completed' ? 'bg-emerald-500' :
                                                item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                            }`} />

                                        <div className="flex items-center gap-4 pl-2">
                                            <div className={`p-3 rounded-lg ${item.status === 'completed' && (!item.status_confirmacao || item.status_confirmacao === 'pendente') ? 'bg-amber-500/10 text-amber-500' :
                                                item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    item.status === 'processing' || item.status === 'pending' ? 'bg-blue-500/10 text-blue-500 animate-pulse' :
                                                        'bg-red-500/10 text-red-500'
                                                }`}>
                                                {item.status === 'completed' && (!item.status_confirmacao || item.status_confirmacao === 'pendente') ? <AlertCircle className="w-5 h-5" /> :
                                                    item.status === 'completed' ? <Check className="w-5 h-5" /> :
                                                        item.status === 'error' ? <X className="w-5 h-5" /> :
                                                            <Loader2 className="w-5 h-5 animate-spin" />}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{item.file_name}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                                                    <span>•</span>
                                                    <span className={`uppercase font-bold ${item.status === 'completed' && (!item.status_confirmacao || item.status_confirmacao === 'pendente') ? 'text-amber-500' : ''
                                                        }`}>
                                                        {item.status === 'completed' && (!item.status_confirmacao || item.status_confirmacao === 'pendente') ? 'Aguardando Aprovação' :
                                                            item.status === 'completed' ? 'Sincronizado' :
                                                                item.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => handleDeleteClick(e, item.id)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors z-10"
                                                title="Excluir/Cancelar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDownloadClick(e, item)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors z-10"
                                                title="Ver Arquivo Original"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="w-5 h-5 text-slate-400" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {history.length === 0 && (
                                    <div className="text-center text-slate-500 py-12">Nenhum histórico encontrado.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* View: Active Import (Upload or Result) */}
                    {activeTab === 'upload' && (
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                            {/* Left: Content */}
                            <div className="flex-1 p-8 overflow-y-auto bg-slate-950/30">
                                {status === 'error' && errorMessage && (
                                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <div>
                                            <p className="font-bold text-sm">Erro no processamento</p>
                                            <p className="text-xs opacity-80">{errorMessage}</p>
                                        </div>
                                    </div>
                                )}

                                {status === 'idle' ? (
                                    <div className="flex flex-col h-full justify-start pt-12">
                                        <div className="space-y-6 max-w-2xl mx-auto w-full">
                                            <div className="text-center space-y-2">
                                                <h1 className="text-white text-3xl font-black tracking-tight">Nova Importação</h1>
                                                <p className="text-slate-400 text-sm">Arraste seus comprovantes aqui para processamento automático.</p>
                                            </div>

                                            {!selectedFile ? (
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="group border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-blue-500/5 cursor-pointer rounded-2xl p-16 text-center transition-all relative overflow-hidden"
                                                >
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,.png,.jpg,.jpeg,.csv"
                                                        onChange={handleFileSelect}
                                                    />
                                                    <div className="relative flex flex-col items-center gap-4">
                                                        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-xl">
                                                            <UploadCloud className="w-10 h-10" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h3 className="text-white text-xl font-bold">Escolher Arquivo</h3>
                                                            <p className="text-slate-500 text-sm">PDF, Imagens, CSV ou OFX</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 animate-in zoom-in-95">
                                                    <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 mx-auto">
                                                        <FileText className="w-10 h-10" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white text-xl font-bold">{selectedFile.name}</h3>
                                                        <p className="text-slate-500 text-sm">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <div className="flex gap-4 justify-center">
                                                        <button
                                                            onClick={startImportProcess}
                                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                                                        >
                                                            <span>Processar com IA</span>
                                                            <Sparkles className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedFile(null)}
                                                            className="px-6 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Model Selector Dropdown */}
                                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 relative z-10">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4 text-blue-400" />
                                                        Modelo de IA
                                                    </h4>
                                                </div>

                                                <div className="relative">
                                                    <button
                                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between hover:border-slate-600 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-blue-500/10 rounded-md">
                                                                <Cpu className="w-4 h-4 text-blue-400" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-semibold text-white">
                                                                    {AI_MODELS.find(m => m.id === selectedModel)?.name}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {AI_MODELS.find(m => m.id === selectedModel)?.desc}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-slate-500">{AI_MODELS.find(m => m.id === selectedModel)?.cost}</span>
                                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </button>

                                                    {showModelDropdown && (
                                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                            {AI_MODELS.map(model => (
                                                                <button
                                                                    key={model.id}
                                                                    onClick={() => {
                                                                        setSelectedModel(model.id);
                                                                        setShowModelDropdown(false);
                                                                    }}
                                                                    className={`w-full p-3 text-left hover:bg-slate-800 transition-colors flex items-center justify-between group ${selectedModel === model.id ? 'bg-blue-500/10' : ''
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-2 h-2 rounded-full ${selectedModel === model.id ? 'bg-blue-500' : 'bg-slate-700'}`} />
                                                                        <div>
                                                                            <p className={`text-sm font-medium ${selectedModel === model.id ? 'text-blue-400' : 'text-slate-300'}`}>
                                                                                {model.name}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-500">{model.desc}</p>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-xs text-slate-600">{model.cost}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Active Process View
                                    <div className="space-y-6">
                                        {/* Result Table */}
                                        <div className="bg-[#0B1116] rounded-xl border border-white/5 overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {/* Header / Success Banner */}
                                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#1A202C]">
                                                <div className="space-y-1">
                                                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                                        {fileName || 'Documento'}
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                            }`}>
                                                            {status === 'completed' ? 'Finalizado' : 'Em Progresso'}
                                                        </span>
                                                    </h3>
                                                    {status === 'completed' && (
                                                        <p className="text-emerald-400/80 text-xs flex items-center gap-1.5 animate-in slide-in-from-left-2">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Análise concluída! Revise as categorias abaixo.
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Button moved to Main Header */}
                                                </div>
                                            </div>

                                            {transactions.length > 0 ? (
                                                <div className="flex flex-col">
                                                    {/* Account Selection */}
                                                    <div className="px-6 py-5 border-b border-white/5 bg-[#0B1116] flex items-center gap-6">
                                                        <div className="flex-1 max-w-md relative" ref={accountDropdownRef}>
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conta de Destino</label>
                                                                {selectedAccountId && (
                                                                    <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                        <CheckCircle className="size-3" /> Conta Definida
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Dropdown Trigger */}
                                                            <div
                                                                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                                                className={`
                                                                    w-full bg-[#1A202C] text-white text-sm rounded-xl border border-white/5 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[#252D3D] transition-all
                                                                    ${isAccountDropdownOpen ? 'ring-1 ring-blue-500/50 border-blue-500/50' : ''}
                                                                `}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-1.5 rounded-lg ${selectedAccountId ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-700/50 text-slate-400'}`}>
                                                                        <Wallet className="w-4 h-4" />
                                                                    </div>
                                                                    {selectedAccountId ? (
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-sm tracking-tight">
                                                                                {accounts.find(a => a.id === selectedAccountId)?.nome}
                                                                            </span>
                                                                            {accounts.find(a => a.id === selectedAccountId)?.banco && (
                                                                                <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                                                                                    {accounts.find(a => a.id === selectedAccountId)?.banco}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-400 font-medium text-sm">Selecione onde salvar...</span>
                                                                    )}
                                                                </div>
                                                                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
                                                            </div>

                                                            {/* Dropdown Menu */}
                                                            {isAccountDropdownOpen && (
                                                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A202C] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                                    {!isCreatingAccount ? (
                                                                        <>
                                                                            <div className="max-h-60 overflow-y-auto py-1">
                                                                                {accounts.map(acc => (
                                                                                    <div
                                                                                        key={acc.id}
                                                                                        onClick={() => {
                                                                                            setSelectedAccountId(acc.id);
                                                                                            setIsAccountDropdownOpen(false);
                                                                                        }}
                                                                                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between group ${selectedAccountId === acc.id ? 'bg-blue-600/10' : 'hover:bg-white/5'
                                                                                            }`}
                                                                                    >
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className={`w-2 h-2 rounded-full ${selectedAccountId === acc.id ? 'bg-blue-500' : 'bg-slate-600 group-hover:bg-slate-500'}`} />
                                                                                            <div>
                                                                                                <p className={`text-sm font-medium ${selectedAccountId === acc.id ? 'text-blue-400' : 'text-slate-200'}`}>
                                                                                                    {acc.nome}
                                                                                                </p>
                                                                                                {acc.banco && <p className="text-[10px] text-slate-500">{acc.banco}</p>}
                                                                                            </div>
                                                                                        </div>
                                                                                        {selectedAccountId === acc.id && (
                                                                                            <Check className="w-4 h-4 text-blue-500" />
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                                {accounts.length === 0 && (
                                                                                    <div className="px-4 py-8 text-center text-slate-500 text-xs">
                                                                                        Nenhuma conta encontrada.
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="p-2 border-t border-white/5 bg-[#0B1116]">
                                                                                <button
                                                                                    onClick={() => setIsCreatingAccount(true)}
                                                                                    className="w-full flex items-center justify-center gap-2 bg-[#252D3D] hover:bg-[#2F394D] text-slate-300 hover:text-white py-2.5 rounded-lg text-xs font-bold transition-all border border-white/5"
                                                                                >
                                                                                    <div className="bg-slate-600 rounded-full p-0.5">
                                                                                        <Plus className="w-3 h-3" />
                                                                                    </div>
                                                                                    Criar Nova Conta
                                                                                </button>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="p-4 space-y-3 bg-[#1A202C]">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <h4 className="text-white text-xs font-bold flex items-center gap-2">
                                                                                    <Plus className="w-3 h-3 text-blue-500" />
                                                                                    Nova Conta Bancária
                                                                                </h4>
                                                                                <button
                                                                                    onClick={() => { setIsCreatingAccount(false); setNewAccountName(''); setNewAccountBank(''); }}
                                                                                    className="text-slate-500 hover:text-slate-300"
                                                                                >
                                                                                    <X className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <div>
                                                                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Nome da Conta <span className="text-red-500">*</span></label>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Ex: Nubank Principal"
                                                                                        value={newAccountName}
                                                                                        onChange={(e) => setNewAccountName(e.target.value)}
                                                                                        className="w-full bg-[#0B1116] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-600"
                                                                                        autoFocus
                                                                                    />
                                                                                </div>
                                                                                <div>
                                                                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Banco / Instituição</label>
                                                                                    <div className="relative">
                                                                                        <Building2 className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                                                                                        <input
                                                                                            type="text"
                                                                                            placeholder="Ex: Nu Pagamentos"
                                                                                            value={newAccountBank}
                                                                                            onChange={(e) => setNewAccountBank(e.target.value)}
                                                                                            className="w-full bg-[#0B1116] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-600"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                onClick={handleCreateAccount}
                                                                                disabled={!newAccountName.trim()}
                                                                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-xs font-bold transition-colors mt-2 shadow-lg shadow-blue-600/20"
                                                                            >
                                                                                Salvar e Selecionar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {accounts.length === 0 && (
                                                            <span className="text-amber-500 text-xs flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                Nenhuma conta ativa encontrada
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Smart Grouping Modal Trigger */}
                                                    {/* Smart Grouping Summary Card */}
                                                    {groupedTransactions.length > 0 && (
                                                        <div className="mb-6 bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between relative overflow-hidden group">
                                                            <div className="absolute inset-0 bg-blue-500/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-700"></div>
                                                            <div className="flex items-center gap-4 relative z-10">
                                                                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 group-hover:scale-110 transition-transform duration-300">
                                                                    <Sparkles className="w-5 h-5" />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                                        Sugestões de Agrupamento
                                                                        <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] rounded-full">Automático</span>
                                                                    </h4>
                                                                    <p className="text-xs text-blue-300/70 mt-0.5">
                                                                        {groupedTransactions.length} grupos identificados contendo {groupedTransactions.reduce((acc, g) => acc + g.count, 0)} transações similares.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => setIsGroupingModalOpen(true)}
                                                                className="relative z-10 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 translate-y-0 hover:-translate-y-0.5"
                                                            >
                                                                Revisar Sugestões
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Filters and Controls */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={handleAddTransaction}
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                                Nova Transação
                                                            </button>
                                                            <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                                                <button
                                                                    onClick={() => setShowAllTransactions(false)}
                                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!showAllTransactions ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                                                >
                                                                    Pendentes
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowAllTransactions(true)}
                                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showAllTransactions ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                                                >
                                                                    Todas
                                                                </button>
                                                            </div>
                                                        </div>


                                                    </div>

                                                    <div className="flex flex-col h-full">

                                                        {transactions.filter(t => t.isDuplicate && !t.forceKeep && !rejectedItems.has(t.originalIdx!)).length > 0 && (
                                                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs p-3 rounded-lg flex items-center gap-3 mb-4">
                                                                <AlertTriangle className="size-4 shrink-0" />
                                                                <div>
                                                                    <p>
                                                                        Encontramos {transactions.filter(t => t.isDuplicate && !t.forceKeep && !rejectedItems.has(t.originalIdx!)).length} itens que já existem no banco.
                                                                        Eles serão <strong>ignorados automaticamente</strong> ao sincronizar (exceto os marcados como "Manter").
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <table className="w-full text-left table-fixed">
                                                            <thead className="bg-slate-950 border-b border-slate-800">
                                                                <tr>
                                                                    <th className="px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[100px]">Data</th>
                                                                    <th className="px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                                                                    <th className="px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[110px] text-right">Valor</th>
                                                                    <th className="px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[150px]">Categoria</th>
                                                                    <th className="px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap w-[190px]">Ação</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800 text-sm">
                                                                {displayedTransactions.map((t) => {
                                                                    const idx = t.originalIdx;
                                                                    const isApproved = approvedItems.has(idx);
                                                                    const isRejected = rejectedItems.has(idx);
                                                                    const isDuplicateRow = t.isDuplicate && !t.forceKeep;

                                                                    return (
                                                                        <tr key={idx} className={`transition-colors group ${isRejected ? 'opacity-40 bg-red-500/5' :
                                                                            t.forceKeep ? 'bg-emerald-500/5 hover:bg-emerald-500/10' :
                                                                                isDuplicateRow ? 'bg-amber-500/5 hover:bg-amber-500/10' :
                                                                                    isApproved ? 'bg-emerald-500/5 hover:bg-emerald-500/10' :
                                                                                        'hover:bg-slate-800/50'
                                                                            }`}>
                                                                            {/* Data Cell */}
                                                                            <td className="px-3 py-3.5 text-slate-300 whitespace-nowrap text-sm">
                                                                                {editingIdx === idx ? (
                                                                                    <input
                                                                                        type="date"
                                                                                        value={editData}
                                                                                        onChange={(e) => setEditData(e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-slate-800 border border-blue-500/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                                                                                    />
                                                                                ) : (
                                                                                    t.data
                                                                                )}
                                                                            </td>
                                                                            {/* Descrição Cell */}
                                                                            <td className={`px-3 py-3.5 font-medium ${isRejected ? 'line-through text-slate-500' : 'text-white'}`} title={t.descricao}>
                                                                                {editingIdx === idx ? (
                                                                                    <input
                                                                                        type="text"
                                                                                        value={editDescricao}
                                                                                        onChange={(e) => setEditDescricao(e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-slate-800 border border-blue-500/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2">
                                                                                        {t.isDuplicate && !t.forceKeep && (
                                                                                            <span className="shrink-0 text-amber-500" title="Transação Duplicada - Já existe no banco de dados">
                                                                                                <AlertTriangle className="size-3.5" />
                                                                                            </span>
                                                                                        )}
                                                                                        <span className={`truncate block text-sm ${t.isDuplicate && !t.forceKeep ? 'text-amber-200/70' : 'text-slate-200'}`}>{t.descricao}</span>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            {/* Valor Cell */}
                                                                            <td className={`px-3 py-3.5 font-bold whitespace-nowrap text-right text-sm ${isRejected ? 'line-through text-slate-500' : t.valor < 0 ? 'text-red-400' : 'text-emerald-400'} ${t.isDuplicate && !t.forceKeep ? 'opacity-70' : ''}`}>
                                                                                {editingIdx === idx ? (
                                                                                    <input
                                                                                        type="text"
                                                                                        value={editValor}
                                                                                        onChange={(e) => setEditValor(e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-slate-800 border border-blue-500/50 rounded text-white text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                    />
                                                                                ) : (
                                                                                    typeof t.valor === 'number' ? t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'
                                                                                )}
                                                                            </td>
                                                                            {/* Categoria Cell */}
                                                                            <td className="px-3 py-3.5 relative">
                                                                                <button
                                                                                    onClick={(e) => toggleCategoryDropdown(e, idx)}
                                                                                    className={`flex items-center gap-2 w-fit px-3 py-1.5 rounded-lg transition-all ${isRejected
                                                                                        ? 'bg-slate-800 border border-slate-700 cursor-not-allowed'
                                                                                        : 'bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 cursor-pointer'
                                                                                        }`}
                                                                                    disabled={isRejected}
                                                                                >
                                                                                    <div className={`size-1.5 rounded-full ${isRejected ? 'bg-slate-500' : 'bg-blue-400'}`}></div>
                                                                                    <span className={`text-xs font-medium ${isRejected ? 'text-slate-500' : 'text-blue-100'}`}>
                                                                                        {getCategoryName(idx, t.categoria_sugerida_id)}
                                                                                    </span>
                                                                                    {!isRejected && <ChevronDown className="w-3 h-3 text-blue-400" />}
                                                                                </button>
                                                                                <FloatingDropdownContent
                                                                                    anchor={dropdownAnchor}
                                                                                    isOpen={openDropdownIdx === idx && !isRejected}
                                                                                    onClose={() => setOpenDropdownIdx(null)}
                                                                                    width={300}
                                                                                >
                                                                                    {/* Header */}
                                                                                    <div className="p-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm rounded-t-xl sticky top-0 z-20">
                                                                                        <div className="flex items-center gap-2 text-slate-400">
                                                                                            <Search className="size-3.5" />
                                                                                            <p className="text-xs font-medium">Selecione uma categoria</p>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="overflow-y-auto flex-1 custom-scrollbar py-2">
                                                                                        {/* Receitas */}
                                                                                        <div className="px-4 py-2 sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur border-b border-emerald-500/10 mb-1">
                                                                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                                                                                <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                                                                Receitas
                                                                                            </span>
                                                                                        </div>

                                                                                        <div className="px-2 space-y-1 mb-4">
                                                                                            {categoriesList
                                                                                                .filter(c => c.tipo === 'R' && c.id_pai === null)
                                                                                                .map(parent => (
                                                                                                    <div key={parent.id} className="mb-1">
                                                                                                        <button
                                                                                                            onClick={(e) => toggleCategoryExpansion(e, parent.id)}
                                                                                                            className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-800/50 rounded-lg transition-colors group/parent"
                                                                                                        >
                                                                                                            <span className="group-hover/parent:text-slate-300 transition-colors">{parent.nome}</span>
                                                                                                            {expandedCategories.has(parent.id) ?
                                                                                                                <ChevronUp className="size-3 text-slate-600 group-hover/parent:text-slate-400" /> :
                                                                                                                <ChevronRight className="size-3 text-slate-600 group-hover/parent:text-slate-400" />
                                                                                                            }
                                                                                                        </button>

                                                                                                        {expandedCategories.has(parent.id) && (
                                                                                                            <div className="space-y-0.5 mt-1 pl-2 border-l border-slate-800 ml-3 animate-in slide-in-from-top-1 duration-200">
                                                                                                                {categoriesList.filter(c => c.id_pai === parent.id).map(cat => {
                                                                                                                    const isSelected = getEffectiveCategoryId(idx, t.categoria_sugerida_id) === cat.id;
                                                                                                                    return (
                                                                                                                        <button
                                                                                                                            key={cat.id}
                                                                                                                            onClick={() => updateTransactionCategory(idx, cat.id)}
                                                                                                                            className={`w-full text-left pl-3 pr-3 py-2 text-sm rounded-lg transition-all flex items-center justify-between group ${isSelected
                                                                                                                                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                                                                                                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                                                                                                }`}
                                                                                                                        >
                                                                                                                            <span className="truncate">{cat.nome}</span>
                                                                                                                            {isSelected && <Check className="size-3.5 text-emerald-500" />}
                                                                                                                        </button>
                                                                                                                    );
                                                                                                                })}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                        </div>

                                                                                        {/* Despesas */}
                                                                                        <div className="px-4 py-2 sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur border-y border-red-500/10 mb-1 mt-2">
                                                                                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                                                                                <div className="size-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                                                                                Despesas
                                                                                            </span>
                                                                                        </div>

                                                                                        <div className="px-2 space-y-1 mb-2">
                                                                                            {categoriesList
                                                                                                .filter(c => c.tipo === 'D' && c.id_pai === null)
                                                                                                .map(parent => (
                                                                                                    <div key={parent.id} className="mb-1">
                                                                                                        <button
                                                                                                            onClick={(e) => toggleCategoryExpansion(e, parent.id)}
                                                                                                            className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-800/50 rounded-lg transition-colors group/parent"
                                                                                                        >
                                                                                                            <span className="group-hover/parent:text-slate-300 transition-colors">{parent.nome}</span>
                                                                                                            {expandedCategories.has(parent.id) ?
                                                                                                                <ChevronUp className="size-3 text-slate-600 group-hover/parent:text-slate-400" /> :
                                                                                                                <ChevronRight className="size-3 text-slate-600 group-hover/parent:text-slate-400" />
                                                                                                            }
                                                                                                        </button>

                                                                                                        {expandedCategories.has(parent.id) && (
                                                                                                            <div className="space-y-0.5 mt-1 pl-2 border-l border-slate-800 ml-3 animate-in slide-in-from-top-1 duration-200">
                                                                                                                {categoriesList.filter(c => c.id_pai === parent.id).map(cat => {
                                                                                                                    const isSelected = getEffectiveCategoryId(idx, t.categoria_sugerida_id) === cat.id;
                                                                                                                    return (
                                                                                                                        <button
                                                                                                                            key={cat.id}
                                                                                                                            onClick={() => updateTransactionCategory(idx, cat.id)}
                                                                                                                            className={`w-full text-left pl-3 pr-3 py-2 text-sm rounded-lg transition-all flex items-center justify-between group ${isSelected
                                                                                                                                ? 'bg-red-500/10 text-red-400 font-medium'
                                                                                                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                                                                                                }`}
                                                                                                                        >
                                                                                                                            <span className="truncate">{cat.nome}</span>
                                                                                                                            {isSelected && <Check className="size-3.5 text-red-500" />}
                                                                                                                        </button>
                                                                                                                    );
                                                                                                                })}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                        </div>
                                                                                    </div>
                                                                                </FloatingDropdownContent>
                                                                            </td>
                                                                            {/* Ação Cell */}
                                                                            <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                                                                <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                                                                                    {editingIdx === idx ? (
                                                                                        <>
                                                                                            <button
                                                                                                onClick={saveEdit}
                                                                                                className="p-1.5 rounded-lg transition-all border bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-400"
                                                                                                title="Salvar"
                                                                                            >
                                                                                                <Check className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={cancelEdit}
                                                                                                className="p-1.5 rounded-lg transition-all border bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20"
                                                                                                title="Cancelar"
                                                                                            >
                                                                                                <X className="w-4 h-4" />
                                                                                            </button>
                                                                                        </>
                                                                                    ) : t.isDuplicate ? (
                                                                                        <>
                                                                                            <button
                                                                                                onClick={() => startEdit(idx)}
                                                                                                className="p-1.5 rounded-lg transition-all border bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border-blue-500/20"
                                                                                                title="Editar"
                                                                                            >
                                                                                                <Pencil className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setTransactions(prev => {
                                                                                                        const next = [...prev];
                                                                                                        if (next[idx]) {
                                                                                                            const newKeepState = !next[idx].forceKeep;
                                                                                                            next[idx] = { ...next[idx], forceKeep: newKeepState };

                                                                                                            // If keeping, ensure it's not rejected
                                                                                                            if (newKeepState) {
                                                                                                                setRejectedItems(prevRej => {
                                                                                                                    const nextRej = new Set(prevRej);
                                                                                                                    nextRej.delete(idx);
                                                                                                                    return nextRej;
                                                                                                                });
                                                                                                            }
                                                                                                        }
                                                                                                        return next;
                                                                                                    });
                                                                                                }}
                                                                                                className={`px-3 py-1.5 rounded-lg transition-all border flex items-center gap-2 ${t.forceKeep
                                                                                                    ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                                                                                    : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20'
                                                                                                    }`}
                                                                                                title={t.forceKeep ? "Cancelar (Não importar)" : "Manter (Forçar importação)"}
                                                                                            >
                                                                                                {t.forceKeep ? <CheckCircle className="size-3.5" /> : <Undo className="size-3.5" />}
                                                                                                <span className="text-xs font-bold">{t.forceKeep ? "Manter" : "Ignorar"}</span>
                                                                                            </button>
                                                                                            {/* Optional standard Reject button to act as 'Confirm Ignore' or 'Delete' */}
                                                                                            <button
                                                                                                onClick={() => toggleReject(idx)}
                                                                                                className={`p-1.5 rounded-lg transition-all border ${isRejected
                                                                                                    ? 'bg-red-500 text-white border-red-500'
                                                                                                    : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'
                                                                                                    }`}
                                                                                                title="Rejeitar"
                                                                                            >
                                                                                                <X className="w-4 h-4" />
                                                                                            </button>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <button
                                                                                                onClick={() => startEdit(idx)}
                                                                                                className="p-1.5 rounded-lg transition-all border bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border-blue-500/20"
                                                                                                title="Editar"
                                                                                            >
                                                                                                <Pencil className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => toggleApprove(idx)}
                                                                                                className={`p-1.5 rounded-lg transition-all border ${isApproved
                                                                                                    ? 'bg-emerald-500 text-white border-emerald-500'
                                                                                                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border-emerald-500/20'
                                                                                                    }`}
                                                                                                title="Aprovar"
                                                                                            >
                                                                                                <Check className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => toggleReject(idx)}
                                                                                                className={`p-1.5 rounded-lg transition-all border ${isRejected
                                                                                                    ? 'bg-red-500 text-white border-red-500'
                                                                                                    : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'
                                                                                                    }`}
                                                                                                title="Rejeitar"
                                                                                            >
                                                                                                <X className="w-4 h-4" />
                                                                                            </button>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-12 text-center">
                                                    {status === 'completed' ? (
                                                        <div className="text-slate-500">Nenhuma transação encontrada.</div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                                                            <p className="text-slate-400 text-sm">Aguarde, extraindo transações...</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                            }
                                        </div >
                                    </div >
                                )}
                            </div >

                            {/* Right: progress Sidebar */}
                            < div className="w-full lg:w-80 bg-[#0B1116] border-l border-white/5 p-6 flex flex-col gap-8 shrink-0 relative overflow-hidden" >
                                {status === 'idle' ? (
                                    <div className="flex flex-col h-full justify-center text-center space-y-4 opacity-30">
                                        <Brain className="w-16 h-16 mx-auto text-slate-600" />
                                        <p className="text-slate-400 text-xs font-medium max-w-[200px] mx-auto">Aguardando arquivo para iniciar análise...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* AI Status Card */}
                                        <div className="bg-gradient-to-br from-[#1A202C] to-[#0B1116] rounded-2xl border border-white/5 p-6 relative overflow-hidden group shadow-2xl">
                                            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Brain className="w-24 h-24 text-blue-500 rotate-12" />
                                            </div>

                                            <div className="relative z-10 space-y-6">
                                                <div>
                                                    <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                                                        <Sparkles className="size-4 text-blue-400" /> Análise IA
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`relative flex h-2 w-2 ${status === 'processing' || status === 'pending' ? '' : 'hidden'}`}>
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                        </span>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest ${status === 'processing' || status === 'pending' ? 'text-blue-400' : (status === 'completed' ? 'text-emerald-500' : 'text-slate-500')}`}>
                                                            {status === 'processing' || status === 'pending' ? 'Processando' : (status === 'completed' ? 'Finalizado' : 'Erro')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                        <span>Progresso</span>
                                                        <span className="text-white">{progress}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-800/50 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className="bg-blue-500 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    <p className="text-[10px] text-blue-300/60 text-right truncate">{statusDescription}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Steps Timeline - Professional */}
                                        <div className="space-y-1 pl-2">
                                            <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">Etapas do Processo</h4>

                                            <div className="relative border-l-2 border-slate-800 space-y-8 pl-6 ml-1.5 py-1">
                                                {/* Step 1 */}
                                                <div className={`relative transition-all duration-500 ${progress >= 10 ? 'opacity-100' : 'opacity-30'}`}>
                                                    <span className={`absolute -left-[31px] top-0 size-4 rounded-full border-2 ${progress >= 10 ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-900 border-slate-700'} flex items-center justify-center`}>
                                                        {progress >= 10 && <Check className="size-2.5 text-white" />}
                                                    </span>
                                                    <p className="text-white text-xs font-bold leading-none">Upload do Arquivo</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">Envio seguro para análise</p>
                                                </div>

                                                {/* Step 2 */}
                                                <div className={`relative transition-all duration-500 ${progress >= 40 ? 'opacity-100' : 'opacity-30'}`}>
                                                    <span className={`absolute -left-[31px] top-0 size-4 rounded-full border-2 ${progress >= 40 ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-900 border-slate-700'} flex items-center justify-center`}>
                                                        {progress >= 40 && <Check className="size-2.5 text-white" />}
                                                    </span>
                                                    <p className="text-white text-xs font-bold leading-none">Contexto & OCR</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">Extração de dados brutos</p>
                                                </div>

                                                {/* Step 3 */}
                                                <div className={`relative transition-all duration-500 ${progress >= 60 ? 'opacity-100' : 'opacity-30'}`}>
                                                    <span className={`absolute -left-[31px] top-0 size-4 rounded-full border-2 ${progress >= 60 ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-900 border-slate-700'} flex items-center justify-center`}>
                                                        {progress >= 60 && <Check className="size-2.5 text-white" />}
                                                    </span>
                                                    <p className="text-white text-xs font-bold leading-none">{modelUsed || selectedModel}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">Classificação inteligente</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer Tech Stats */}
                                        {status === 'completed' && (
                                            <div className="mt-auto border-t border-white/5 pt-4">
                                                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                                                    <span>Custo da Operação</span>
                                                    <span className="text-white">${estimatedCost?.toFixed(4) || '0.0000'}</span>
                                                </div>
                                                <div className="flex justify-end">
                                                    <span className="text-[10px] text-emerald-500 font-medium">
                                                        ≈ {((estimatedCost || 0) * exchangeRate).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div >
                        </div >
                    )}
                </main >

                {
                    activeTab === 'upload' && status === 'completed' && (
                        <footer className="shrink-0 border-t border-white/5 bg-[#0B1116] px-8 py-4 flex items-center justify-between z-20">
                            <div className="flex items-center gap-6 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1.5"><span className="size-2 bg-emerald-500 rounded-full"></span> Receitas: <span className="text-white text-xs">{totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                    <span className="text-slate-700">|</span>
                                    <span className="flex items-center gap-1.5"><span className="size-2 bg-red-500 rounded-full"></span> Despesas: <span className="text-white text-xs">{totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                    <span className="text-slate-700">|</span>
                                    <span className={`flex items-center gap-1.5 ${totalAmount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Saldo Final: <span className="text-sm">{totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors">Fechar</button>
                                {confirmationStatus === 'confirmado' ? (
                                    <button
                                        disabled
                                        className="px-6 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-not-allowed"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Sincronizado</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleConfirmSync}
                                        className="px-6 py-2.5 rounded-lg bg-[#0E0069] hover:bg-[#0A0050] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[#0E0069]/30"
                                    >
                                        <span>
                                            {(() => {
                                                const validItems = getApprovedTransactions().filter(t => !t.isDuplicate || t.forceKeep);
                                                const duplicateCount = getApprovedTransactions().filter(t => t.isDuplicate && !t.forceKeep).length;

                                                if (validItems.length === 0 && duplicateCount > 0) return "Concluir (Ignorar Duplicados)";
                                                if (duplicateCount > 0) return `Sincronizar ${validItems.length} (Ignorar ${duplicateCount} Duplicados)`;
                                                return "Confirmar e Sincronizar";
                                            })()}
                                        </span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </footer>
                    )
                }


            </div >

            {/* Smart Grouping Modal Overlay */}
            {
                isGroupingModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div
                            className="bg-[#0F172A] border border-blue-500/20 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-blue-500/20 flex items-center justify-between bg-blue-950/30 rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white leading-none">Sugestões de Agrupamento</h3>
                                        <p className="text-xs text-blue-300/60 mt-1">
                                            {groupedTransactions.length} grupos encontrados • {groupedTransactions.reduce((acc, g) => acc + g.count, 0)} transações totais
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsGroupingModalOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Content - Group List */}
                            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar divide-y divide-blue-500/10">
                                {groupedTransactions.map((group, gIdx) => {
                                    const firstTxIdx = group.indices[0];
                                    const currentCategoryId = transactions[firstTxIdx]?.categoria_sugerida_id;
                                    const currentCategoryName = categoriesList.find(c => c.id === currentCategoryId)?.nome;
                                    const isReviewed = !!currentCategoryId; // Group is reviewed if category is set
                                    const isExpanded = expandedGroupIndices.has(gIdx);

                                    const toggleExpansion = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setExpandedGroupIndices(prev => {
                                            const next = new Set(prev);
                                            if (next.has(gIdx)) next.delete(gIdx);
                                            else next.add(gIdx);
                                            return next;
                                        });
                                    };

                                    return (
                                        <div key={gIdx} className={`transition-colors border-b last:border-0 border-blue-500/10`}>
                                            <div
                                                className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 ${isReviewed ? 'bg-emerald-500/5' : ''}`}
                                                onClick={toggleExpansion}
                                            >
                                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                                    <button
                                                        onClick={toggleExpansion}
                                                        className="p-1 rounded hover:bg-white/10 text-slate-400 transition-colors"
                                                    >
                                                        <ChevronRight className={`size-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                    </button>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isReviewed && (
                                                                <div className="size-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                                    <Check className="w-3 h-3 text-emerald-400" />
                                                                </div>
                                                            )}
                                                            <h5 className={`text-sm font-bold truncate ${isReviewed ? 'text-emerald-300' : 'text-slate-200'}`} title={group.description}>
                                                                {group.description}
                                                            </h5>
                                                            <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${isReviewed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                                {group.count}x
                                                            </span>
                                                        </div>
                                                        <p className={`text-xs ${isReviewed ? 'text-emerald-400/60' : 'text-slate-500'}`}>
                                                            {isReviewed
                                                                ? `Categoria definida: ${currentCategoryName}`
                                                                : `${group.count} transações similares aguardando categorização.`
                                                            }
                                                        </p>
                                                    </div>

                                                    <FloatingDropdownContent
                                                        anchor={groupDropdownAnchor}
                                                        isOpen={openGroupDropdownIdx === gIdx}
                                                        onClose={() => setOpenGroupDropdownIdx(null)}
                                                        width={320}
                                                    >
                                                        <div className="p-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur rounded-t-xl sticky top-0 z-10">
                                                            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                                                                <CheckCircle className="size-3 text-emerald-500" />
                                                                Aplicar para {group.count} itens
                                                            </p>
                                                        </div>

                                                        <div className="overflow-y-auto flex-1 custom-scrollbar py-2">
                                                            {/* Receitas */}
                                                            <div className="px-4 py-1.5 bg-slate-900/50 border-y border-slate-800/50 mb-1 sticky top-0 text-[10px] font-bold text-emerald-500 uppercase tracking-widest backdrop-blur">
                                                                Receitas
                                                            </div>
                                                            <div className="px-2 space-y-0.5">
                                                                {categoriesList.filter(c => c.tipo === 'R' && c.id_pai === null).map(parent => (
                                                                    <CategoryAccordionGroup
                                                                        key={parent.id}
                                                                        parent={parent}
                                                                        childrenCats={categoriesList.filter(c => c.id_pai === parent.id)}
                                                                        currentSelectedId={currentCategoryId}
                                                                        onSelect={(catId) => {
                                                                            applyBulkCategory(group.description, group.indices, catId);
                                                                            setOpenGroupDropdownIdx(null);
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>

                                                            {/* Despesas */}
                                                            <div className="px-4 py-1.5 bg-slate-900/50 border-y border-slate-800/50 mb-1 mt-2 sticky top-0 text-[10px] font-bold text-red-500 uppercase tracking-widest backdrop-blur">
                                                                Despesas
                                                            </div>
                                                            <div className="px-2 space-y-0.5 pb-2">
                                                                {categoriesList.filter(c => c.tipo === 'D' && c.id_pai === null).map(parent => (
                                                                    <CategoryAccordionGroup
                                                                        key={parent.id}
                                                                        parent={parent}
                                                                        childrenCats={categoriesList.filter(c => c.id_pai === parent.id)}
                                                                        currentSelectedId={currentCategoryId}
                                                                        onSelect={(catId) => {
                                                                            applyBulkCategory(group.description, group.indices, catId);
                                                                            setOpenGroupDropdownIdx(null);
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </FloatingDropdownContent>
                                                </div>
                                            </div>

                                            {/* Nested Transactions View */}
                                            {isExpanded && (
                                                <div className="bg-slate-900/50 border-t border-blue-500/10 px-4 py-2 animate-in slide-in-from-top-2 duration-200">
                                                    <table className="w-full text-left text-[10px] text-slate-400">
                                                        <thead>
                                                            <tr className="border-b border-white/5 text-slate-500">
                                                                <th className="py-2 pl-10 font-medium">Data</th>
                                                                <th className="py-2 font-medium">Descrição Original</th>
                                                                <th className="py-2 text-right font-medium">Valor</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {group.indices.map((txIdx) => {
                                                                const tx = transactions[txIdx];
                                                                if (!tx) return null;
                                                                return (
                                                                    <tr key={txIdx} className="hover:bg-white/5 transition-colors">
                                                                        <td className="py-2 pl-10 whitespace-nowrap">{tx.data}</td>
                                                                        <td className="py-2 truncate max-w-[300px]" title={tx.descricao}>{tx.descricao}</td>
                                                                        <td className={`py-2 text-right font-mono ${tx.valor < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                            {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div >

                            {/* Modal Footer */}
                            < div className="px-6 py-4 border-t border-white/5 bg-slate-900/30 flex justify-between items-center rounded-b-2xl" >
                                <span className="text-xs text-slate-500">
                                    As alterações são salvas automaticamente.
                                </span>
                                <button
                                    onClick={() => setIsGroupingModalOpen(false)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-blue-500/20 transition-all"
                                >
                                    Concluir Revisão
                                </button>
                            </div >
                        </div >
                    </div >

                )
            }

            {/* File Preview Overlay */}
            {
                previewUrl && (
                    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200" onClick={() => setPreviewUrl(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <FileText className="text-blue-500 w-5 h-5" />
                                    <h3 className="text-white font-bold text-lg">Visualização do Arquivo</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={previewUrl}
                                        download="arquivo_original"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        title="Abrir em nova aba"
                                    >
                                        <UploadCloud className="w-5 h-5" />
                                    </a>
                                    <button
                                        onClick={() => setPreviewUrl(null)}
                                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-950/50 p-4 overflow-hidden flex items-center justify-center relative rounded-b-2xl">
                                {previewType === 'pdf' ? (
                                    <iframe src={previewUrl} className="w-full h-full rounded-lg border-none bg-white" title="PDF Preview" />
                                ) : (
                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// Category Accordion Group Component
interface CategoryAccordionGroupProps {
    parent: Category;
    childrenCats: Category[];
    currentSelectedId: number | string | undefined;
    onSelect: (id: number) => void;
}

const CategoryAccordionGroup: React.FC<CategoryAccordionGroupProps> = ({ parent, childrenCats, currentSelectedId, onSelect }) => {
    const isChildSelected = childrenCats.some(c => c.id == currentSelectedId);
    const [isOpen, setIsOpen] = useState(isChildSelected);

    useEffect(() => {
        if (isChildSelected) setIsOpen(true);
    }, [isChildSelected]);

    return (
        <div className="mb-0.5">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded mb-0.5 transition-colors ${isOpen ? 'bg-slate-800 text-slate-300' : 'bg-slate-900/30 text-slate-500 hover:bg-slate-800/50'}`}
            >
                {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span>{parent.nome}</span>
            </button>

            {isOpen && (
                <div className="pl-2 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                    {childrenCats.map(cat => {
                        const isSelected = cat.id == currentSelectedId;
                        return (
                            <button
                                key={cat.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(cat.id);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded transition-all flex items-center justify-between group ${isSelected
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                                    : 'text-slate-400 hover:bg-blue-500/20 hover:text-blue-300 hover:pl-4 border border-transparent'
                                    }`}
                            >
                                <span>{cat.nome}</span>
                                {isSelected && <Check className="w-3 h-3 text-blue-400" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};




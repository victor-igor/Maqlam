import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Search,
    CreditCard,
    Wallet,
    Calendar,
    Check,
    ChevronsUpDown,
    Save,
    X,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Euro,
    ChevronRight,
    ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const FinancialManualEntry: React.FC = () => {
    const navigate = useNavigate();
    const { session } = useAuth();

    // Form State
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('BRL');
    const [exchangeRate, setExchangeRate] = useState(''); // Empty initially
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');

    // Currency Effect
    useEffect(() => {
        if (currency !== 'BRL') {
            fetchExchangeRate(currency);
        } else {
            setExchangeRate(''); // Reset when back to BRL
        }
    }, [currency]);

    const fetchExchangeRate = async (curr: string) => {
        setIsLoadingRate(true);
        try {
            const response = await fetch(`https://economia.awesomeapi.com.br/json/last/${curr}-BRL`);
            const data = await response.json();
            const key = `${curr}BRL`; // e.g., USDBRL
            if (data[key]) {
                const bid = parseFloat(data[key].bid).toFixed(2); // Use Bid (Compra)
                setExchangeRate(bid);

                // Format time HH:mm
                const now = new Date();
                setLastUpdate(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            }
        } catch (err) {
            console.error('Failed to fetch rate', err);
            // Optional: toast error
        } finally {
            setIsLoadingRate(false);
        }
    };

    // Recurrence / Installments
    const [isInstallment, setIsInstallment] = useState(false);
    const [installments, setInstallments] = useState(1);
    const [interval, setInterval] = useState('Mensal');

    // Category Logic
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    // Toggle Expansion
    const toggleExpand = (e: React.MouseEvent, id: number) => {
        e.stopPropagation(); // Don't select the row
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedIds(newSet);
    };

    // Fetch Categories on Mount
    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categorias_dre')
            .select('*')
            .order('codigo');
        if (!error && data) {
            setCategories(data);
        }
    };



    // Calculation Helpers
    const getConvertedValue = () => {
        const val = parseFloat(amount.replace(/[^0-9.]/g, '') || '0');
        if (currency === 'BRL') return val;
        const rate = parseFloat(exchangeRate.replace(',', '.') || '1');
        return val * rate;
    };

    const handleSave = async () => {
        if (!amount || !selectedCategory) return alert('Preencha valor e categoria');
        if (!session?.user?.id) return;

        const baseValue = getConvertedValue();
        const valuePerInstallment = isInstallment ? (baseValue / installments) : baseValue;

        try {
            const rowsToInsert = [];
            const startDate = new Date(date);

            for (let i = 0; i < (isInstallment ? installments : 1); i++) {
                const currentDate = new Date(startDate);
                // Simple monthly increment logic (can be refined)
                if (isInstallment) currentDate.setMonth(startDate.getMonth() + i);

                const currentDesc = isInstallment
                    ? `${description} (${i + 1}/${installments})`
                    : description;

                rowsToInsert.push({
                    valor: valuePerInstallment, // Store BRL Value
                    data_operacao: new Date().toISOString(),
                    data_competencia: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
                    descricao: currentDesc,
                    id_categoria_dre: selectedCategory.id,
                    tipo_operacao: selectedCategory.tipo === 'R' ? 'E' : 'S', // E=Entrada(Revenue), S=Saida(Expense)
                    status: 'Realizado', // Default
                    modalidade: {
                        original_currency: currency,
                        original_amount: amount,
                        exchange_rate: currency !== 'BRL' ? exchangeRate : null,
                        installment_index: isInstallment ? i + 1 : null,
                        total_installments: isInstallment ? installments : null
                    },
                    id_usuario_aprovador: session.user.id
                    // other fields like id_conta, id_responsavel would go here
                });
            }

            const { error } = await supabase.from('lancamentos').insert(rowsToInsert);
            if (error) throw error;

            navigate('/financial/dashboard');
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar lançamento');
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#020617] text-[#EDEDED] flex flex-col items-center py-10 px-4 font-sans relative overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#0E0069]/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#0098F6]/10 blur-[100px] rounded-full pointer-events-none" />

            {/* Header / Nav */}
            <div className="max-w-[1000px] w-full flex justify-between items-end mb-8 px-4 z-10">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-1">Novo Lançamento</h1>
                    <p className="text-gray-400">Preencha os dados e gerencie parcelamentos.</p>
                </div>
                <button
                    onClick={() => navigate('/financial')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] border border-[#1E293B] hover:bg-[#1E293B] transition-colors text-sm font-bold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </button>
            </div>

            {/* Main Card */}
            <div className="max-w-[1000px] w-full bg-[#0F172A]/70 backdrop-blur-xl border border-[#1E293B] rounded-2xl p-8 grid grid-cols-1 md:grid-cols-12 gap-10 shadow-2xl z-10">

                {/* Left Column: Input Form */}
                <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">

                    {/* Amount & Currency Section */}
                    <div className="bg-[#020617]/40 p-6 rounded-2xl border border-[#1E293B] shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-secondary/50 group-hover:bg-secondary transition-colors"></div>
                        <label className="text-[10px] tracking-widest text-slate-400 font-bold uppercase mb-4 block flex items-center gap-2">
                            <DollarSign className="w-3 h-3 text-secondary" />
                            Valor da Transação
                        </label>

                        <div className="flex items-stretch bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden focus-within:border-secondary transition-colors shadow-inner">
                            <div className="pl-4 flex items-center justify-center text-slate-400">
                                <span className="text-lg font-light">{currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : '€'}</span>
                            </div>
                            <input
                                type="text"
                                value={amount ? Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    if (value === '') {
                                        setAmount('');
                                    } else {
                                        setAmount((parseInt(value) / 100).toFixed(2));
                                    }
                                }}
                                placeholder="0,00"
                                className="flex-1 bg-transparent border-none outline-none focus:outline-none text-2xl font-bold text-white placeholder-slate-700 px-3 py-4 focus:ring-0 shadow-none appearance-none"
                            />
                            <div className="border-l border-[#1E293B] bg-[#1E293B]/30">
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="h-full bg-transparent text-sm font-bold text-secondary px-4 py-2 cursor-pointer focus:outline-none hover:text-white transition-colors appearance-none text-center"
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="BRL">BRL</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>

                        {/* Live Conversion Display */}
                        {currency !== 'BRL' && (
                            <div className="mt-4 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                                <div className="p-3 bg-secondary/5 border border-secondary/20 rounded-lg flex items-center justify-between group/rate">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-secondary/10 p-1.5 rounded-md text-secondary">
                                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRate ? 'animate-spin' : ''}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] uppercase font-bold text-slate-500">Taxa de Câmbio</label>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-slate-400">1 {currency} = R$</span>
                                                <input
                                                    type="number"
                                                    value={exchangeRate}
                                                    onChange={(e) => setExchangeRate(e.target.value)}
                                                    className="w-16 bg-transparent border-b border-secondary/30 text-sm font-bold text-white focus:outline-none focus:border-secondary p-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => fetchExchangeRate(currency)}
                                        className="text-xs text-secondary hover:text-white opacity-0 group-hover/rate:opacity-100 transition-opacity"
                                    >
                                        Atualizar
                                    </button>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide mr-2">Valor Convertido</span>
                                    <span className="text-lg font-bold text-secondary">
                                        R$ {getConvertedValue().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Meta Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date Input */}
                        <div className="bg-[#020617]/40 p-4 rounded-xl border border-[#1E293B] focus-within:border-slate-500 transition-colors group">
                            <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2 mb-2 group-focus-within:text-secondary transition-colors">
                                <Calendar className="w-3.5 h-3.5" /> Data
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-transparent border-none outline-none focus:outline-none text-white text-sm font-medium focus:ring-0 p-0 [color-scheme:dark] cursor-pointer"
                            />
                        </div>

                        {/* Description Input */}
                        <div className="col-span-1 md:col-span-2 bg-[#020617]/40 p-4 rounded-xl border border-[#1E293B] focus-within:border-slate-500 transition-colors group">
                            <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2 mb-2 group-focus-within:text-white transition-colors">
                                <span className="bg-slate-800 text-slate-400 p-0.5 rounded text-[8px] px-1">Aa</span> Descrição
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: Licença de Software Mensal"
                                className="w-full bg-transparent border-none outline-none focus:outline-none text-white text-sm focus:ring-0 p-0 placeholder-slate-700"
                            />
                        </div>
                    </div>

                    {/* Installments Toggle - Minimalist */}
                    <div className={`
                        p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none
                        ${isInstallment ? 'bg-[#1E293B]/40 border-secondary/50' : 'bg-[#020617]/40 border-[#1E293B] hover:border-slate-600'}
                    `} onClick={() => setIsInstallment(!isInstallment)}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-colors ${isInstallment ? 'bg-secondary text-white' : 'bg-slate-800 text-slate-400'}`}>
                                    <ChevronsUpDown className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${isInstallment ? 'text-white' : 'text-slate-400'}`}>Repetir / Parcelar</p>
                                    <p className="text-[10px] text-slate-500">Criar lançamentos futuros automaticamente</p>
                                </div>
                            </div>

                            {/* Switch Widget */}
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${isInstallment ? 'bg-secondary' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${isInstallment ? 'left-6' : 'left-1'}`}></div>
                            </div>
                        </div>

                        {/* Expanded Installment Options */}
                        <div className={`
                            grid grid-cols-2 gap-4 overflow-hidden transition-all duration-300
                            ${isInstallment ? 'mt-4 max-h-40 opacity-100' : 'max-h-0 opacity-0'}
                        `}>
                            <div className="bg-[#0F172A] p-2 rounded-lg border border-[#334155]">
                                <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Parcelas</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setInstallments(Math.max(1, installments - 1)) }} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center">-</button>
                                    <span className="flex-1 text-center text-sm font-bold text-white">{installments}x</span>
                                    <button onClick={(e) => { e.stopPropagation(); setInstallments(installments + 1) }} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center">+</button>
                                </div>
                            </div>

                            <div className="bg-[#0F172A] p-2 rounded-lg border border-[#334155]">
                                <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Intervalo</label>
                                <select
                                    value={interval}
                                    onChange={(e) => setInterval(e.target.value)}
                                    className="w-full bg-transparent text-sm text-white font-bold focus:outline-none p-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="monthly">Mensal</option>
                                    <option value="weekly">Semanal</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Col: Category Selector */}
                <div className="md:col-span-12 lg:col-span-5 flex flex-col h-full border-l border-[#1E293B] pl-0 lg:pl-10">
                    <div className="flex items-center justify-between border-b border-[#1E293B] pb-4 mb-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-secondary" />
                            Categoria
                        </h3>
                        <span className="bg-secondary/10 text-secondary text-[10px] font-black px-2 py-1 rounded border border-secondary/20 uppercase">Plano de Contas</span>
                    </div>

                    {/* Search Category */}
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Buscar categoria..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="w-full bg-[#020617] border border-[#1E293B] rounded-lg h-10 pl-10 pr-4 text-sm focus:border-secondary outline-none transition-colors"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    </div>

                    {/* Category List */}
                    {/* Category List - Tree View */}
                    <div className="flex flex-col bg-[#020617]/30 rounded-xl border border-[#1E293B] overflow-hidden h-[600px] shadow-inner">
                        <div className="overflow-y-auto flex-1 p-3 space-y-1 custom-scrollbar">
                            {categories.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
                                    <p className="text-xs">Carregando plano de contas...</p>
                                </div>
                            ) : (
                                (() => {
                                    // Helper: Check if a category has children
                                    const hasChildren = (id: number) => categories.some(c => c.id_pai === id);

                                    // Filter Logic
                                    const displayedCategories = categorySearch
                                        ? categories.filter(c =>
                                            c.nome.toLowerCase().includes(categorySearch.toLowerCase()) ||
                                            c.codigo?.includes(categorySearch)
                                        )
                                        : categories.filter(cat => {
                                            // Root always visible
                                            if (!cat.id_pai) return true;
                                            // Recursive visibility check
                                            let current = cat;
                                            while (current.id_pai) {
                                                if (!expandedIds.has(current.id_pai)) return false;
                                                const parent = categories.find(p => p.id === current.id_pai);
                                                if (!parent) return false; // Should not happen
                                                current = parent;
                                            }
                                            return true;
                                        });

                                    return displayedCategories.map(cat => {
                                        const depth = cat.codigo ? cat.codigo.split('.').length - 1 : 0;
                                        const isRevenue = cat.tipo === 'R';
                                        const isSelected = selectedCategory?.id === cat.id;
                                        const isExpanded = expandedIds.has(cat.id);
                                        const parentHasChildren = hasChildren(cat.id);

                                        return (
                                            <div
                                                key={cat.id}
                                                style={{ paddingLeft: `${depth * 14}px` }}
                                                className="w-full"
                                            >
                                                <div
                                                    onClick={() => setSelectedCategory(cat)}
                                                    className={`
                                                    relative flex items-center gap-3 w-full text-left px-3 py-2.5 my-0.5 rounded-md transition-all duration-200 cursor-pointer group
                                                    ${isSelected
                                                            ? 'bg-[#1E293B] border-l-2 border-secondary shadow-sm'
                                                            : 'border-l-2 border-transparent hover:bg-[#1E293B]/50'
                                                        }
                                                `}
                                                >
                                                    {/* Expansion Toggle */}
                                                    <div
                                                        onClick={(e) => parentHasChildren && toggleExpand(e, cat.id)}
                                                        className={`
                                                        w-4 h-4 flex items-center justify-center rounded transition-colors
                                                        ${parentHasChildren ? 'hover:bg-white/10 cursor-pointer text-slate-500 hover:text-white' : 'opacity-0 pointer-events-none'}
                                                    `}
                                                    >
                                                        {parentHasChildren && (
                                                            isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                                                        )}
                                                    </div>

                                                    {/* Status Indicator (Minimalist) */}
                                                    <div className={`
                                                    w-1.5 h-1.5 rounded-full
                                                    ${isRevenue ? 'bg-emerald-500' : 'bg-red-500'}
                                                    ${isSelected ? 'shadow-[0_0_8px_rgba(var(--color-secondary),0.5)]' : 'opacity-50'}
                                                `}></div>

                                                    {/* Content */}
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className={`text-sm truncate leading-tight ${isSelected ? 'font-medium text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                            {cat.nome}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-slate-600">
                                                            {cat.codigo}
                                                        </span>
                                                    </div>

                                                    {/* Selection Check */}
                                                    {isSelected && <Check className="w-3 h-3 text-secondary flex-shrink-0 animate-in zoom-in" />}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="p-3 bg-[#020617]/80 backdrop-blur border-t border-[#1E293B] flex justify-between items-center text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            <span>{categories.length} Categorias Disponíveis</span>
                            {selectedCategory && (
                                <span className={selectedCategory.tipo === 'R' ? 'text-emerald-500' : 'text-red-500'}>
                                    {selectedCategory.tipo === 'R' ? 'Receita' : 'Despesa'} Selecionada
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="col-span-12 flex justify-end items-center gap-4 pt-6 border-t border-[#1E293B] mt-2">
                    <button
                        onClick={() => navigate('/financial')}
                        className="px-6 py-3 rounded-lg text-gray-400 font-bold hover:bg-white/5 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-[#0E0069] hover:bg-[#0A0050] text-white font-bold rounded-lg shadow-lg shadow-[#0E0069]/40 flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                        <Save className="w-5 h-5" />
                        Confirmar Lançamento
                    </button>
                </div>
            </div>


        </div>
    );
};

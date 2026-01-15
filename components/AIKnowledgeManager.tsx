
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Brain, Check, Loader2, AlertCircle } from 'lucide-react';

interface AIKnowledgeManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface KnowledgeItem {
    id: number;
    type: string;
    content: string;
    metadata: any;
    created_at: string;
}

export const AIKnowledgeManager: React.FC<AIKnowledgeManagerProps> = ({ isOpen, onClose }) => {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItemContent, setNewItemContent] = useState('');
    const [activeType, setActiveType] = useState<'supplier' | 'instruction'>('supplier');
    const [isAdding, setIsAdding] = useState(false);
    const [addingLoader, setAddingLoader] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchKnowledge();
            setDeletingId(null);
        }
    }, [isOpen, activeType]);

    const fetchKnowledge = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ai_knowledge_base')
                .select('*')
                .eq('type', activeType)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching knowledge:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemContent.trim()) return;

        setAddingLoader(true);
        try {
            const metadata = activeType === 'supplier'
                ? { category_id: 69, category_name: "Fornecedores" }
                : { description: "Regra geral de processamento" };

            const { error } = await supabase
                .from('ai_knowledge_base')
                .insert({
                    type: activeType,
                    content: newItemContent.trim(),
                    metadata: metadata
                });

            if (error) throw error;

            setNewItemContent('');
            setIsAdding(false);
            fetchKnowledge(); // Refresh list
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Erro ao adicionar conhecimento.');
        } finally {
            setAddingLoader(false);
        }
    };

    const executeDelete = async (id: number) => {
        try {
            const { error } = await supabase
                .from('ai_knowledge_base')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setItems(items.filter(item => item.id !== id));
            setDeletingId(null);
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Erro ao deletar item.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                <Brain className="size-6 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Memória da IA</h2>
                                <p className="text-slate-400 text-sm">Ensine a IA sobre sua empresa</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
                        <button
                            onClick={() => { setActiveType('supplier'); setDeletingId(null); }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeType === 'supplier'
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            Fornecedores
                        </button>
                        <button
                            onClick={() => { setActiveType('instruction'); setDeletingId(null); }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeType === 'instruction'
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            Instruções Gerais
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Intro Alert */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 text-sm text-indigo-200 show">
                        <AlertCircle className="size-5 text-indigo-400 shrink-0" />
                        {activeType === 'supplier' ? (
                            <p>
                                Fornecedores listados aqui serão <strong>automaticamente</strong> categorizados como "Fornecedores" (ID 69).
                            </p>
                        ) : (
                            <p>
                                Adicione regras gerais, como "Sempre classifique Uber como Transporte" ou "Notas da Kalunga são Material de Escritório".
                            </p>
                        )}
                    </div>

                    {/* Add New Section */}
                    {isAdding ? (
                        <form onSubmit={handleAdd} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-200">
                                    {activeType === 'supplier' ? 'Novo Fornecedor' : 'Nova Instrução'}
                                </span>
                                <button type="button" onClick={() => setIsAdding(false)} className="text-xs text-slate-400 hover:text-white">Cancelar</button>
                            </div>

                            {activeType === 'supplier' ? (
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="Ex: Nome da Empresa LTDA"
                                    value={newItemContent}
                                    onChange={(e) => setNewItemContent(e.target.value)}
                                />
                            ) : (
                                <textarea
                                    autoFocus
                                    rows={3}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                                    placeholder="Ex: Se a descrição contiver 'Uber', categorize como Transporte."
                                    value={newItemContent}
                                    onChange={(e) => setNewItemContent(e.target.value)}
                                />
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={addingLoader || !newItemContent.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    {addingLoader ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                    Salvar Conhecimento
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50 rounded-xl text-slate-400 hover:text-indigo-400 font-medium transition-all duration-300 flex items-center justify-center gap-2 group"
                        >
                            <div className="p-1.5 bg-slate-800 group-hover:bg-indigo-500/20 rounded-lg transition-colors">
                                <Plus className="size-5" />
                            </div>
                            Adicionar {activeType === 'supplier' ? 'Fornecedor' : 'Instrução'}
                        </button>
                    )}

                    {/* List */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="size-8 text-indigo-500 animate-spin" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                Nenhum {activeType === 'supplier' ? 'fornecedor' : 'regra'} cadastrado.
                            </div>
                        ) : (
                            <div className={`grid gap-3 ${activeType === 'supplier' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                {items.map((item) => (
                                    <div key={item.id} className="group bg-slate-800/30 hover:bg-slate-800 hover:border-slate-600 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between transition-all duration-200">
                                        <div className="flex-1 min-w-0 pr-3">
                                            {activeType === 'supplier' ? (
                                                <p className="text-sm text-slate-200 font-medium truncate">{item.content}</p>
                                            ) : (
                                                <p className="text-sm text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">"{item.content}"</p>
                                            )}
                                            <p className="text-[10px] text-slate-500 mt-1">Adicionado em {new Date(item.created_at).toLocaleDateString()}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center">
                                            {deletingId === item.id ? (
                                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 bg-slate-900 border border-red-500/30 px-2 py-1 rounded-lg">
                                                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Excluir?</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => executeDelete(item.id)}
                                                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors shadow-sm"
                                                            title="Sim, Excluir"
                                                        >
                                                            <Check className="size-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingId(null)}
                                                            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-md transition-colors"
                                                            title="Não, Cancelar"
                                                        >
                                                            <X className="size-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeletingId(item.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Remover"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import {
    ShieldBan,
    Plus,
    Trash2,
    Search,
    AlertTriangle,
    Loader2,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { getCurrentUserProfile } from '../lib/auth';
import { ConfirmDialog } from './ConfirmDialog';

interface BlacklistItem {
    id: string;
    phone: string;
    name?: string | null;
    reason: string | null;
    created_at: string;
}

export const BlacklistSettings: React.FC = () => {
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<BlacklistItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Form states
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [newName, setNewName] = useState('');
    const [newReason, setNewReason] = useState('');
    const [adding, setAdding] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        itemId: string | null;
    }>({
        isOpen: false,
        itemId: null
    });

    const [countryCode, setCountryCode] = useState('+55'); // Default Brazil

    const countries = [
        { code: '+55', name: 'Brasil', flag: '🇧🇷', format: '(XX) XXXXX-XXXX' },
        { code: '+1', name: 'EUA', flag: '🇺🇸', format: '(XXX) XXX-XXXX' },
        { code: '+44', name: 'Reino Unido', flag: '🇬🇧', format: 'XXXX XXXXXX' },
        { code: '+351', name: 'Portugal', flag: '🇵🇹', format: 'XXX XXX XXX' },
        { code: '+34', name: 'Espanha', flag: '🇪🇸', format: 'XXX XXX XXX' },
        { code: '+54', name: 'Argentina', flag: '🇦🇷', format: 'XX XXXX-XXXX' },
        { code: '+56', name: 'Chile', flag: '🇨🇱', format: 'X XXXX XXXX' },
        { code: '+52', name: 'México', flag: '🇲🇽', format: 'XX XXXX XXXX' }
    ];

    useEffect(() => {
        fetchBlacklist();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchBlacklist = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blacklist')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching blacklist:', err);
            toastError('Erro ao carregar lista negra');
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneChange = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        let formatted = numbers;

        if (countryCode === '+55') {
            // Brazil: (XX) XXXXX-XXXX
            formatted = numbers.slice(0, 11);
            if (formatted.length > 0) {
                formatted = formatted
                    .replace(/(\d{2})(\d)/, '($1) $2')
                    .replace(/(\d{5})(\d)/, '$1-$2');
            }
        } else if (countryCode === '+1') {
            // USA: (XXX) XXX-XXXX
            formatted = numbers.slice(0, 10);
            if (formatted.length > 0) {
                formatted = formatted
                    .replace(/(\d{3})(\d)/, '($1) $2')
                    .replace(/(\d{3})(\d)/, '$1-$2');
            }
        } else {
            // Other countries: flexible formatting with spaces
            formatted = numbers.slice(0, 15);
            if (formatted.length > 3) {
                formatted = formatted.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
            }
        }
        setNewPhone(formatted);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPhone.trim()) return;

        try {
            setAdding(true);
            const user = await getCurrentUserProfile();

            // Clean phone number for storage (remove formatting)
            const cleanedPhone = newPhone.replace(/\D/g, '');

            if (cleanedPhone.length < 4) {
                toastError('Número de telefone inválido');
                return;
            }

            // Combine country code and phone number
            const fullPhoneNumber = `${countryCode}${cleanedPhone}`;

            const { data, error } = await supabase
                .from('blacklist')
                .insert({
                    phone: fullPhoneNumber,
                    name: newName.trim() || null,
                    reason: newReason.trim() || null,
                    created_by: user?.id
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toastError('Este número já está na lista negra.');
                } else {
                    throw error;
                }
                return;
            }

            setItems([data, ...items]);
            setNewPhone('');
            setNewName('');
            setNewReason('');
            setShowAddForm(false);
            success('Número adicionado à lista negra com sucesso!');
        } catch (err) {
            console.error('Error adding to blacklist:', err);
            toastError('Erro ao adicionar número');
        } finally {
            setAdding(false);
        }
    };

    const confirmDelete = (id: string) => {
        setConfirmDialog({ isOpen: true, itemId: id });
    };

    const handleDelete = async () => {
        if (!confirmDialog.itemId) return;
        const id = confirmDialog.itemId;

        try {
            const { error } = await supabase
                .from('blacklist')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setItems(items.filter(item => item.id !== id));
            success('Número removido com sucesso!');
        } catch (err) {
            console.error('Error deleting from blacklist:', err);
            toastError('Erro ao remover número');
        } finally {
            setConfirmDialog({ isOpen: false, itemId: null });
        }
    };

    const filteredItems = items.filter(item =>
        item.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
            <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldBan className="w-5 h-5 text-red-500" />
                        Lista Negra (Blacklist)
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Gerencie os números bloqueados que a IA não deve responder.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Número
                </button>
            </div>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ isOpen: false, itemId: null })}
                title="Remover da Lista Negra"
                message="Tem certeza que deseja remover este número da lista negra? A IA voltará a responder mensagens deste número."
                confirmText="Remover"
                type="delete"
                onConfirm={handleDelete}
            />

            {/* Add Form */}
            {showAddForm && (
                <div className="p-6 bg-gray-50 dark:bg-muted-dark/30 border-b border-border-light dark:border-border-dark animate-in slide-in-from-top-2">
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                                    Nome (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-red-500 focus:border-red-500 px-3 py-2.5 sm:text-sm"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                                    Número de Telefone
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={countryCode}
                                        onChange={(e) => {
                                            setCountryCode(e.target.value);
                                            setNewPhone(''); // Reset phone on country change to avoid format mismatch
                                        }}
                                        className="rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-red-500 focus:border-red-500 px-2 py-2.5 sm:text-sm"
                                    >
                                        {countries.map((country) => (
                                            <option key={country.code} value={country.code}>
                                                {country.flag} {country.code}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="tel"
                                        value={newPhone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        placeholder={countries.find(c => c.code === countryCode)?.format || ''}
                                        className="flex-1 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-red-500 focus:border-red-500 px-3 py-2.5 sm:text-sm"
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                                    Motivo (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={newReason}
                                    onChange={(e) => setNewReason(e.target.value)}
                                    placeholder="Ex: Spam, Cliente bloqueado..."
                                    className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-red-500 focus:border-red-500 px-3 py-2.5 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-card-dark border border-gray-300 dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={adding || !newPhone}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 shadow-sm transition-colors disabled:opacity-70"
                            >
                                {adding ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Adicionando...
                                    </>
                                ) : (
                                    'Adicionar à Lista'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search and List */}
            <div className="p-6 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por número, nome ou motivo..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-muted-dark/30 rounded-xl border border-dashed border-gray-300 dark:border-border-dark">
                        <ShieldBan className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p>Nenhum número na lista negra.</p>
                        {searchTerm && <p className="text-xs mt-1">Tente buscar com outros termos.</p>}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-border-dark">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-border-dark">
                            <thead className="bg-gray-50 dark:bg-muted-dark">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Nome
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Número
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Motivo
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Data de Inclusão
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-card-dark divide-y divide-gray-200 dark:divide-border-dark">
                                {currentItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-muted-dark/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-white font-medium">
                                                {item.name || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                                {item.phone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {item.reason || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => confirmDelete(item.id)}
                                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                title="Remover da lista"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {filteredItems.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark px-4 py-3 sm:px-6 rounded-b-lg">
                        <div className="flex flex-1 justify-between sm:hidden">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-border-dark bg-white dark:bg-card-dark px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted-dark disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-border-dark bg-white dark:bg-card-dark px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted-dark disabled:opacity-50"
                            >
                                Próxima
                            </button>
                        </div>
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700 dark:text-gray-400">
                                    Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)}</span> de <span className="font-medium">{filteredItems.length}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-border-dark hover:bg-gray-50 dark:hover:bg-muted-dark focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Anterior</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-border-dark focus:outline-offset-0">
                                        {currentPage} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-border-dark hover:bg-gray-50 dark:hover:bg-muted-dark focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Próxima</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

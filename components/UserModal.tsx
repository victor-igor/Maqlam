import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { UserProfile, UserRole } from '../lib/auth';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userData: any) => Promise<void>;
    user?: UserProfile; // If provided, we are editing
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, user }) => {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        password: '',
        role: 'vendedor' as UserRole,
        cargo: '',
        especialidade: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                nome: user.nome,
                email: user.email,
                password: '', // Password not editable here directly usually
                role: user.role,
                cargo: user.cargo || '',
                especialidade: user.especialidade || ''
            });
        } else {
            setFormData({
                nome: '',
                email: '',
                password: '',
                role: 'vendedor',
                cargo: '',
                especialidade: ''
            });
        }
        setError(null);
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.nome || !formData.email || !formData.role) {
            setError('Preencha os campos obrigatórios');
            return;
        }

        if (!user && !formData.password) {
            setError('Senha é obrigatória para novos usuários');
            return;
        }

        if (!user && formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        try {
            setLoading(true);
            await onSave(formData);
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Erro ao salvar usuário');
        } finally {
            setLoading(false);
        }
    };

    const roles: { value: UserRole; label: string }[] = [
        { value: 'admin', label: 'Administrador' },
        { value: 'gestor', label: 'Gestor' },
        { value: 'vendedor', label: 'Vendedor' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-border-dark">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {user ? 'Editar Usuário' : 'Novo Usuário'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm border border-red-200 dark:border-red-900/50">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nome Completo *
                        </label>
                        <input
                            type="text"
                            value={formData.nome}
                            onChange={e => setFormData({ ...formData, nome: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="Ex: João Silva"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            disabled={!!user} // Email usually immutable in edit or harder to change
                            className="w-full rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Ex: joao@email.com"
                        />
                    </div>

                    {!user && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Senha *
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all pr-10"
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Função (Role) *
                            </label>
                            <select
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                className="w-full rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                {roles.map(role => (
                                    <option key={role.value} value={role.value}>
                                        {role.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cargo
                            </label>
                            <input
                                type="text"
                                value={formData.cargo}
                                onChange={e => setFormData({ ...formData, cargo: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                placeholder="Ex: Vendedor"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-border-dark">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-black hover:bg-primary-hover transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

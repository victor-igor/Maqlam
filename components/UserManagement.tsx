import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Power, PowerOff, Shield, Trash2 } from 'lucide-react';
import { listUsers, toggleUserStatus, UserProfile, updateUser } from '../lib/auth';
import { getRoleName, getRoleColor } from '../lib/permissions';
import { usePermissions } from '../hooks/usePermissions';
import { UserModal } from './UserModal';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const UserManagement = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | undefined>(undefined);
    const [deletingUser, setDeletingUser] = useState<UserProfile | undefined>(undefined);
    const { isAdminOrGestor } = usePermissions();
    const { success, error: toastError } = useToast();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await listUsers();
            setUsers(data);
        } catch (err: any) {
            console.error('Error loading users:', err);
            toastError('Erro ao carregar usuários: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        try {
            await toggleUserStatus(userId, !currentStatus);
            await loadUsers();
            success(`Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
        } catch (err: any) {
            toastError('Erro ao alterar status: ' + err.message);
        }
    };

    const handleSaveUser = async (userData: any) => {
        try {
            if (editingUser) {
                // Update existing user
                await updateUser(editingUser.id, {
                    nome: userData.nome,
                    role: userData.role,
                    cargo: userData.cargo,
                    especialidade: userData.especialidade
                });
                success('Usuário atualizado com sucesso!');
            } else {
                // Create new user via RPC
                const { error } = await supabase.rpc('create_user_by_admin', {
                    new_email: userData.email,
                    new_password: userData.password,
                    new_name: userData.nome,
                    new_role: userData.role,
                    new_cargo: userData.cargo,
                    new_especialidade: userData.especialidade || null
                });

                if (error) throw error;
                success('Usuário criado com sucesso!');
            }

            setIsAddModalOpen(false);
            setEditingUser(undefined);
            loadUsers();
        } catch (err: any) {
            console.error('Error saving user:', err);
            throw new Error(err.message || 'Erro ao salvar usuário');
        }
    };

    const openEditModal = (user: UserProfile) => {
        setEditingUser(user);
        setIsAddModalOpen(true);
    };

    const openNewUserModal = () => {
        setEditingUser(undefined);
        setIsAddModalOpen(true);
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) return;

        try {
            // Delete user via RPC (deletes from both auth.users and public.usuarios)
            const { error } = await supabase.rpc('delete_user_by_admin', {
                target_user_id: deletingUser.id
            });

            if (error) throw error;

            success('Usuário excluído com sucesso!');
            setDeletingUser(undefined);
            loadUsers();
        } catch (err: any) {
            console.error('Error deleting user:', err);
            toastError('Erro ao excluir usuário: ' + err.message);
        }
    };

    // Filter users by search term, handling null/undefined fields
    const filteredUsers = users.filter(user =>
        user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.cargo?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    if (!isAdminOrGestor) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Acesso Negado
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Você não tem permissão para acessar esta página.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Search and Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-grow w-full lg:max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl leading-5 bg-white dark:bg-input-dark text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out shadow-sm"
                        placeholder="Buscar por nome, email ou cargo..."
                    />
                </div>

                <button
                    onClick={openNewUserModal}
                    className="flex items-center justify-center gap-2 bg-primary text-black px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-sm whitespace-nowrap text-sm"
                >
                    <UserPlus className="h-5 w-5" />
                    Novo Usuário
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-border-dark">
                    <thead className="bg-gray-50 dark:bg-background-dark">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Usuário
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Cargo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-card-dark divide-y divide-gray-200 dark:divide-border-dark">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Carregando...
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Nenhum usuário encontrado
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-background-dark/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <span className="text-sm font-bold text-primary">
                                                    {user.nome.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {user.nome}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white">{user.cargo || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getRoleColor(user.role)}`}>
                                            {getRoleName(user.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${user.ativo
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                            }`}>
                                            {user.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleToggleStatus(user.id, user.ativo)}
                                                className={`p-2 rounded-lg transition-colors ${user.ativo
                                                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                    : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                    }`}
                                                title={user.ativo ? 'Desativar' : 'Ativar'}
                                            >
                                                {user.ativo ? <PowerOff className="h-5 w-5" /> : <Power className="h-5 w-5" />}
                                            </button>
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingUser(user)}
                                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>


            {/* Add/Edit User Modal */}
            <UserModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingUser(undefined);
                }}
                onSave={handleSaveUser}
                user={editingUser}
            />

            {/* Delete Confirmation Dialog */}
            {
                deletingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-border-dark">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Excluir Usuário
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Esta ação não pode ser desfeita
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                                Tem certeza que deseja excluir o usuário <strong>{deletingUser.nome}</strong>?
                                Todos os dados relacionados serão permanentemente removidos.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeletingUser(undefined)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

import { supabase } from './supabase';

export type UserRole = 'admin' | 'gestor' | 'vendedor';

export interface UserProfile {
    id: string;
    auth_id: string;
    email: string;
    nome: string;
    cargo: string | null;
    role: UserRole;
    especialidade?: string | null;
    crmv?: string | null;
    ativo: boolean;
    created_at: string;
    telefone?: string | null;
    foto_perfil_url?: string | null;
}

/**
 * Realiza o login do usuário com email e senha
 */
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Realiza o cadastro de um novo usuário (Self-signup - deprecated/unused in UI)
 */
export async function signUp(email: string, password: string, nome: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        throw error;
    }

    if (data.user) {
        // Criar perfil do usuário
        const { error: profileError } = await supabase
            .from('usuarios')
            .insert({
                auth_id: data.user.id,
                email: email,
                nome: nome,
                role: 'admin', // Primeiro usuário como admin para facilitar
                ativo: true
            });

        if (profileError) {
            console.error('Erro ao criar perfil:', profileError);
        }
    }

    return data;
}

/**
 * Busca o perfil do usuário logado na tabela usuarios
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('No authenticated user');
            return null;
        }

        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('auth_id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }

        return data as UserProfile;
    } catch (err) {
        console.error('Error in getCurrentUserProfile:', err);
        return null;
    }
}

/**
 * Verifica se o usuário tem uma role específica
 */
export async function hasRole(role: UserRole | UserRole[]): Promise<boolean> {
    const profile = await getCurrentUserProfile();
    if (!profile) return false;

    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(profile.role);
}

/**
 * Verifica se o usuário é admin
 */
export async function isAdmin(): Promise<boolean> {
    return hasRole('admin');
}

/**
 * Verifica se o usuário é admin ou gestor
 */
export async function isAdminOrGestor(): Promise<boolean> {
    return hasRole(['admin', 'gestor']);
}

/**
 * Lista todos os usuários (apenas admin/gestor)
 */
export async function listUsers(): Promise<UserProfile[]> {
    const canView = await isAdminOrGestor();
    if (!canView) {
        throw new Error('Sem permissão para listar usuários');
    }

    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome');

    if (error) {
        console.error('Error listing users:', error);
        throw error;
    }

    return data as UserProfile[];
}

/**
 * Atualiza um usuário (admin/gestor ou próprio usuário)
 */
export async function updateUser(userId: string, updates: Partial<UserProfile>) {
    const currentProfile = await getCurrentUserProfile();
    if (!currentProfile) {
        throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin/gestor ou está atualizando próprio perfil
    const isOwnProfile = currentProfile.id === userId;
    const canUpdate = await isAdminOrGestor();

    if (!isOwnProfile && !canUpdate) {
        throw new Error('Sem permissão para atualizar este usuário');
    }

    // Usuários comuns não podem alterar a própria role
    if (isOwnProfile && !canUpdate && updates.role) {
        delete updates.role;
    }

    const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user:', error);
        throw error;
    }

    return data as UserProfile;
}

/**
 * Ativa/desativa um usuário (apenas admin/gestor)
 */
export async function toggleUserStatus(userId: string, ativo: boolean) {
    const canUpdate = await isAdminOrGestor();
    if (!canUpdate) {
        throw new Error('Sem permissão para alterar status de usuários');
    }

    try {
        // Get user's auth_id
        const { data: userProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('auth_id')
            .eq('id', userId)
            .single();

        if (profileError || !userProfile) {
            throw new Error('Usuário não encontrado');
        }

        // Update status in public.usuarios
        const { error: updateError } = await supabase
            .from('usuarios')
            .update({ ativo })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Block/unblock access in auth.users via RPC
        const { error: banError } = await supabase.rpc('toggle_user_ban', {
            target_auth_id: userProfile.auth_id,
            should_ban: !ativo
        });

        if (banError) throw banError;

        return { success: true };
    } catch (err) {
        console.error('Error toggling user status:', err);
        throw err;
    }
}


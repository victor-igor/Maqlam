import { UserRole } from './auth';

/**
 * Definição de permissões por role
 */
export const PERMISSIONS = {
    // Gerenciamento de usuários
    MANAGE_USERS: ['admin', 'gestor'],
    VIEW_ALL_USERS: ['admin', 'gestor'],

    // Acesso ao painel
    ACCESS_PANEL: ['admin', 'gestor', 'vendedor'],

    // Gerenciamento de contatos
    MANAGE_CONTACTS: ['admin', 'gestor', 'vendedor'],
    VIEW_CONTACTS: ['admin', 'gestor', 'vendedor'],

    // Gerenciamento de campanhas
    MANAGE_CAMPAIGNS: ['admin', 'gestor'],
    VIEW_CAMPAIGNS: ['admin', 'gestor', 'vendedor'],

    // Configurações do sistema
    MANAGE_SETTINGS: ['admin'],

    // Dashboard e relatórios
    VIEW_DASHBOARD: ['admin', 'gestor', 'vendedor'],
    VIEW_REPORTS: ['admin', 'gestor'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Verifica se uma role tem uma permissão específica
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
    const allowedRoles = PERMISSIONS[permission] as readonly string[];
    return allowedRoles.includes(role);
}

/**
 * Verifica se uma role pode acessar uma view específica
 */
export function canAccessView(role: UserRole, view: string): boolean {
    switch (view) {
        case 'dashboard':
            return roleHasPermission(role, 'VIEW_DASHBOARD');

        case 'contacts':
        case 'contact-details':
            return roleHasPermission(role, 'VIEW_CONTACTS');

        case 'campaigns':
            return roleHasPermission(role, 'VIEW_CAMPAIGNS');

        case 'settings':
            return roleHasPermission(role, 'MANAGE_SETTINGS');

        case 'users':
            return roleHasPermission(role, 'VIEW_ALL_USERS');

        default:
            return false;
    }
}

/**
 * Retorna as views disponíveis para uma role
 */
export function getAvailableViews(role: UserRole): string[] {
    const views: string[] = [];

    if (roleHasPermission(role, 'VIEW_DASHBOARD')) {
        views.push('dashboard');
    }

    if (roleHasPermission(role, 'VIEW_CONTACTS')) {
        views.push('contacts');
    }

    if (roleHasPermission(role, 'VIEW_CAMPAIGNS')) {
        views.push('campaigns');
    }

    if (roleHasPermission(role, 'VIEW_ALL_USERS')) {
        views.push('users');
    }

    if (roleHasPermission(role, 'MANAGE_SETTINGS')) {
        views.push('settings');
    }

    return views;
}

/**
 * Retorna o nome amigável de uma role
 */
export function getRoleName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
        admin: 'Administrador',
        gestor: 'Gestor',
        vendedor: 'Vendedor',
    };

    return roleNames[role] || role;
}

/**
 * Retorna a cor da badge para uma role
 */
export function getRoleColor(role: UserRole): string {
    const roleColors: Record<UserRole, string> = {
        admin: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        gestor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        vendedor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    };

    return roleColors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
}

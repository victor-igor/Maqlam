import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Permission, roleHasPermission, canAccessView } from '../lib/permissions';

/**
 * Hook para verificar permissões do usuário logado
 */
export function usePermissions() {
    const { userProfile, loading } = useAuth();

    const hasPermission = useMemo(() => {
        return (permission: Permission): boolean => {
            if (!userProfile) return false;
            return roleHasPermission(userProfile.role, permission);
        };
    }, [userProfile]);

    const canAccess = useMemo(() => {
        return (view: string): boolean => {
            if (!userProfile) return false;
            return canAccessView(userProfile.role, view);
        };
    }, [userProfile]);

    const isAdmin = useMemo(() => {
        return userProfile?.role === 'admin';
    }, [userProfile]);

    const isAdminOrGestor = useMemo(() => {
        return userProfile?.role === 'admin' || userProfile?.role === 'gestor';
    }, [userProfile]);

    return {
        hasPermission,
        canAccess,
        isAdmin,
        isAdminOrGestor,
        role: userProfile?.role,
        loading,
    };
}

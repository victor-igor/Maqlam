import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile, getCurrentUserProfile } from '../lib/auth';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    userProfile: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const loadUserProfile = async () => {
        try {
            console.log('Loading user profile...');
            const profile = await getCurrentUserProfile();
            console.log('Profile loaded:', profile);
            setUserProfile(profile);
        } catch (err) {
            console.error('Error loading profile:', err);
            setUserProfile(null);
        }
    };

    const refreshProfile = async () => {
        await loadUserProfile();
    };

    useEffect(() => {
        console.log('AuthContext: Initializing...');
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('Session:', session);
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadUserProfile().finally(() => {
                    console.log('Setting loading to false');
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadUserProfile();
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUserProfile(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, userProfile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

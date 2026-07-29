import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthProfile {
  id: string;
  full_name: string | null;
  role: string;
  is_mentor: boolean;
  membership_level: 'rise' | 'legacy' | 'elite' | null;
  membership_status: string;
}

interface AuthValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: AuthProfile | null;
  profileLoading: boolean;
  canAccessAdmin: boolean;
  canAccessMentor: boolean;
  defaultDashboardPath: '/admin' | '/mentor-dashboard' | '/dashboard';
  refreshProfile: () => Promise<AuthProfile | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function readProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,role,is_mentor,membership_level,membership_status')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as AuthProfile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;

    if (loading) {
      return () => {
        active = false;
      };
    }

    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return () => {
        active = false;
      };
    }

    setProfileLoading(true);
    void readProfile(userId)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loading, session?.user.id]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }

    setProfileLoading(true);
    try {
      const nextProfile = await readProfile(userId);
      setProfile(nextProfile);
      return nextProfile;
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user.id]);

  const canAccessAdmin = Boolean(
    profile && ['admin', 'content_manager', 'donation_manager'].includes(profile.role)
  );
  const canAccessMentor = Boolean(
    profile && (profile.is_mentor || profile.role === 'mentor' || profile.role === 'admin')
  );
  const defaultDashboardPath: '/admin' | '/mentor-dashboard' | '/dashboard' = canAccessAdmin
    ? '/admin'
    : canAccessMentor
      ? '/mentor-dashboard'
      : '/dashboard';

  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    profile,
    profileLoading,
    canAccessAdmin,
    canAccessMentor,
    defaultDashboardPath,
    refreshProfile,
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setSession(data.session);
    },
    signUp: async (fullName, email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/workspace`
        }
      });
      if (error) throw error;
      if (data.session) setSession(data.session);
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setProfile(null);
      setProfileLoading(false);
    },
    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    }
  }), [
    session,
    loading,
    profile,
    profileLoading,
    canAccessAdmin,
    canAccessMentor,
    defaultDashboardPath,
    refreshProfile
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

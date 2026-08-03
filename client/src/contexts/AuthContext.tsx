import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AccessState {
  isStaff: boolean;
  isSuperAdmin: boolean;
  staffStatus: 'invited'|'active'|'suspended'|'deactivated'|null;
  roleKey: string|null;
  permissionMode: 'additive'|'replace'|null;
  permissions: string[];
  mentorStatus: string|null;
  mentorActive: boolean;
}

interface AuthValue {
  user: User | null; session: Session | null; loading: boolean; accessLoading:boolean;
  access: AccessState|null;
  isStaff:boolean;
  hasPermission:(permission:string)=>boolean;
  refreshAccess:()=>Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email:string)=>Promise<void>;
  updatePassword: (password:string)=>Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
const API_URL = ((import.meta.env.VITE_API_URL as string) || 'http://localhost:5050/api').replace(/\/$/,'');
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading,setAccessLoading]=useState(false);
  const [access,setAccess]=useState<AccessState|null>(null);

  const refreshAccess=useCallback(async()=>{
    const current=(await supabase.auth.getSession()).data.session;
    if(!current){setAccess(null);return}
    setAccessLoading(true);
    try{
      const response=await fetch(`${API_URL}/access/me`,{headers:{Authorization:`Bearer ${current.access_token}`,'X-Supabase-Publishable-Key':PUBLISHABLE_KEY}});
      if(!response.ok){setAccess(null);return}
      const payload=await response.json() as {access:AccessState};
      setAccess(payload.access);
    }finally{setAccessLoading(false)}
  },[]);

  useEffect(() => {
    supabase.auth.getSession().then(async({ data }) => { setSession(data.session); setLoading(false); if(data.session)await refreshAccess(); });
    const { data } = supabase.auth.onAuthStateChange(async(_event, next) => {setSession(next);if(next)await refreshAccess();else setAccess(null)});
    return () => data.subscription.unsubscribe();
  }, [refreshAccess]);

  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null, session, loading, accessLoading, access,
    isStaff:Boolean(access?.isStaff&&access.staffStatus==='active'),
    hasPermission:(permission)=>Boolean(access?.staffStatus==='active'&&(access.isSuperAdmin||access.permissions.includes('*')||access.permissions.includes(permission))),
    refreshAccess,
    signIn: async (email, password) => { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; },
    signUp: async (fullName, email, password) => { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/dashboard` } }); if (error) throw error; },
    signOut: async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; },
    requestPasswordReset: async (email)=>{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});if(error)throw error;},
    updatePassword: async(password)=>{const {error}=await supabase.auth.updateUser({password});if(error)throw error;}
  }), [session, loading, accessLoading, access, refreshAccess]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }

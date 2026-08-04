import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
const BACKGROUND_ACCESS_REFRESH_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading,setAccessLoading]=useState(false);
  const [access,setAccess]=useState<AccessState|null>(null);

  const sessionRef=useRef<Session|null>(null);
  const accessRef=useRef<AccessState|null>(null);
  const refreshInFlightRef=useRef<Promise<void>|null>(null);
  const lastAccessRefreshRef=useRef(0);

  const updateSession=useCallback((next:Session|null)=>{
    sessionRef.current=next;
    setSession(next);
  },[]);

  const updateAccess=useCallback((next:AccessState|null)=>{
    accessRef.current=next;
    setAccess(next);
  },[]);

  const refreshAccess=useCallback(async()=>{
    if(refreshInFlightRef.current)return refreshInFlightRef.current;

    const task=(async()=>{
      const current=sessionRef.current ?? (await supabase.auth.getSession()).data.session;
      if(!current){updateAccess(null);return;}

      const initialLookup=accessRef.current===null;
      if(initialLookup)setAccessLoading(true);

      try{
        const response=await fetch(`${API_URL}/access/me`,{
          headers:{Authorization:`Bearer ${current.access_token}`,'X-Supabase-Publishable-Key':PUBLISHABLE_KEY}
        });

        if(response.status===401){
          const refreshed=(await supabase.auth.refreshSession()).data.session;
          if(!refreshed){updateSession(null);updateAccess(null);return;}
          updateSession(refreshed);
          const retry=await fetch(`${API_URL}/access/me`,{
            headers:{Authorization:`Bearer ${refreshed.access_token}`,'X-Supabase-Publishable-Key':PUBLISHABLE_KEY}
          });
          if(retry.ok){
            const payload=await retry.json() as {access:AccessState};
            updateAccess(payload.access);
            lastAccessRefreshRef.current=Date.now();
          }else if(retry.status===401||retry.status===403){
            updateAccess(null);
          }
          return;
        }

        if(response.ok){
          const payload=await response.json() as {access:AccessState};
          updateAccess(payload.access);
          lastAccessRefreshRef.current=Date.now();
        }else if(response.status===403){
          updateAccess(null);
        }
      }finally{
        if(initialLookup)setAccessLoading(false);
      }
    })();

    refreshInFlightRef.current=task;
    try{await task;}finally{refreshInFlightRef.current=null;}
  },[updateAccess,updateSession]);

  useEffect(() => {
    let active=true;

    const initialize=async()=>{
      try{
        const {data}=await supabase.auth.getSession();
        if(!active)return;
        updateSession(data.session);
        if(data.session)await refreshAccess();
      }finally{
        if(active)setLoading(false);
      }
    };

    void initialize();

    const { data } = supabase.auth.onAuthStateChange((event,next) => {
      if(!active)return;
      updateSession(next);

      if(!next){
        updateAccess(null);
        setAccessLoading(false);
        return;
      }

      // TOKEN_REFRESHED commonly fires when a browser tab becomes active.
      // Keep the current page mounted and refresh access only when it is missing.
      if(event==='SIGNED_IN'||event==='USER_UPDATED'||event==='PASSWORD_RECOVERY'){
        queueMicrotask(()=>{void refreshAccess();});
      }else if(event==='TOKEN_REFRESHED'&&accessRef.current===null){
        queueMicrotask(()=>{void refreshAccess();});
      }
    });

    const onVisibilityChange=()=>{
      if(
        document.visibilityState==='visible' &&
        sessionRef.current &&
        Date.now()-lastAccessRefreshRef.current>=BACKGROUND_ACCESS_REFRESH_MS
      ){
        void refreshAccess();
      }
    };

    document.addEventListener('visibilitychange',onVisibilityChange);
    return () => {
      active=false;
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange',onVisibilityChange);
    };
  }, [refreshAccess,updateAccess,updateSession]);

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

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

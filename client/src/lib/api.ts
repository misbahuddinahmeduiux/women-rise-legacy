import { supabase } from './supabase';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5050/api';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let session = (await supabase.auth.getSession()).data.session;

  if (session?.expires_at && session.expires_at * 1000 <= Date.now() + 30_000) {
    session = (await supabase.auth.refreshSession()).data.session;
  }

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // The publishable key is already public in the browser bundle. Forwarding it
  // guarantees that the API validates the token with the same project/key pair
  // that successfully created the browser session.
  if (SUPABASE_PUBLISHABLE_KEY) {
    headers.set('X-Supabase-Publishable-Key', SUPABASE_PUBLISHABLE_KEY);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed.');
  }

  return payload as T;
}

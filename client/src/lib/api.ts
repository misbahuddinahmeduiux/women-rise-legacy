import { supabase } from './supabase';

const API_URL = ((import.meta.env.VITE_API_URL as string) || 'http://localhost:5050/api').replace(/\/$/,'');
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let session = (await supabase.auth.getSession()).data.session;
  if (session?.expires_at && session.expires_at * 1000 <= Date.now() + 30_000) session = (await supabase.auth.refreshSession()).data.session;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  headers.set('X-Request-Id', crypto.randomUUID());
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  if (SUPABASE_PUBLISHABLE_KEY) headers.set('X-Supabase-Publishable-Key', SUPABASE_PUBLISHABLE_KEY);

  const controller = new AbortController();
  const timer = window.setTimeout(()=>controller.abort(), 25000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: options.signal || controller.signal });
    const contentType=response.headers.get('content-type')||'';
    const payload = response.status === 204 ? null : contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(()=>null);
    if (!response.ok) {
      const message=typeof payload==='object'&&payload?payload.error:typeof payload==='string'?payload:'Request failed.';
      const requestId=typeof payload==='object'&&payload?payload.requestId:response.headers.get('x-request-id');
      throw new Error(requestId?`${message} Reference: ${requestId}`:message);
    }
    return payload as T;
  } catch(error) {
    if(error instanceof DOMException&&error.name==='AbortError') throw new Error('The secure service took too long to respond. Please try again.');
    if(error instanceof TypeError) throw new Error('Unable to reach the secure service. Confirm the API is running and the VITE_API_URL is correct.');
    throw error;
  } finally { window.clearTimeout(timer); }
}

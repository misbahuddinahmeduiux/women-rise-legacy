import type { User } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function getPublishableKey(req: Request): string {
  const incoming = req.header('x-supabase-publishable-key')?.trim();
  return incoming || env.SUPABASE_ANON_KEY;
}

async function verifySupabaseUser(token: string, publishableKey: string): Promise<User | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; msg?: string; error_description?: string } | null;
    const reason = body?.message || body?.msg || body?.error_description || response.statusText;
    console.error(`Supabase session validation failed (${response.status}): ${reason}`);
    return null;
  }

  return await response.json() as User;
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const user = await verifySupabaseUser(token, getPublishableKey(req));

    if (!user?.id) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup failed:', profileError?.message ?? 'No profile returned.');
      return res.status(403).json({ error: 'User profile is not configured.' });
    }

    req.user = user;
    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.profile || !['admin', 'content_manager', 'donation_manager'].includes(req.profile.role)) {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  next();
}

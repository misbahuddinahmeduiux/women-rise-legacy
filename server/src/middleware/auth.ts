import type { User } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { can, loadAccessContext, type Permission } from '../lib/access.js';
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
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  if (!response.ok) return null;
  return await response.json() as User;
}

async function attachIdentity(req: Request, user: User) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id,role,full_name,account_status')
    .eq('id', user.id)
    .single();
  if (error || !profile) return false;
  req.user = user;
  req.profile = profile;
  req.access = await loadAccessContext(user.id);
  return true;
}

export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) return next();
    const user = await verifySupabaseUser(token, getPublishableKey(req));
    if (user?.id) await attachIdentity(req, user);
    next();
  } catch (error) { next(error); }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const user = await verifySupabaseUser(token, getPublishableKey(req));
    if (!user?.id) return res.status(401).json({ error: 'Invalid or expired session.' });
    if (!await attachIdentity(req, user)) return res.status(403).json({ error: 'User profile is not configured.' });
    if (req.profile?.account_status && req.profile.account_status !== 'active') {
      return res.status(403).json({ error: 'This account is suspended or deactivated.' });
    }
    next();
  } catch (error) { next(error); }
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.access?.isStaff || req.access.staffStatus !== 'active') {
    return res.status(403).json({ error: 'Active staff access required.' });
  }
  next();
}

// Compatibility alias. New routes must also use explicit requirePermission checks.
export const requireAdmin = requireStaff;

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!can(req.access, permission)) {
      return res.status(403).json({ error: `Permission required: ${permission}.` });
    }
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!permissions.some((permission) => can(req.access, permission))) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

export async function requireDirectoryMembership(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.profile) return res.status(401).json({ error: 'Authentication required.' });
    if (can(req.access, 'view_members') || can(req.access, 'view_mentors')) return next();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('membership_status,membership_expires_at,plan:membership_plans!profiles_membership_plan_id_fkey(directory_access)')
      .eq('id', req.user.id)
      .single();
    if (error || !data) return res.status(403).json({ error: 'Membership access could not be verified.' });
    const expiry = data.membership_expires_at ? new Date(data.membership_expires_at).getTime() : null;
    const active = ['active', 'trialing'].includes(String(data.membership_status)) && (expiry === null || expiry > Date.now());
    const directoryAccess = Boolean((data.plan as { directory_access?: boolean } | null)?.directory_access);
    if (!active || !directoryAccess) return res.status(403).json({ error: 'An active eligible membership is required.' });
    next();
  } catch (error) { next(error); }
}

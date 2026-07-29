import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';
function getBearerToken(req) {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
}
function getPublishableKey(req) {
    const incoming = req.header('x-supabase-publishable-key')?.trim();
    return incoming || env.SUPABASE_ANON_KEY;
}
async function verifySupabaseUser(token, publishableKey) {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: publishableKey,
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        }
    });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const reason = body?.message || body?.msg || body?.error_description || response.statusText;
        console.error(`Supabase session validation failed (${response.status}): ${reason}`);
        return null;
    }
    return await response.json();
}
export async function optionalUser(req, _res, next) {
    try {
        const token = getBearerToken(req);
        if (!token)
            return next();
        const user = await verifySupabaseUser(token, getPublishableKey(req));
        if (!user?.id)
            return next();
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, role, full_name')
            .eq('id', user.id)
            .maybeSingle();
        req.user = user;
        if (profile)
            req.profile = profile;
        next();
    }
    catch (error) {
        next(error);
    }
}
export async function requireUser(req, res, next) {
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
    }
    catch (error) {
        next(error);
    }
}
export function requireAdmin(req, res, next) {
    if (!req.profile || !['admin', 'content_manager', 'donation_manager'].includes(req.profile.role)) {
        return res.status(403).json({ error: 'Administrator access required.' });
    }
    next();
}
export async function requireDirectoryMembership(req, res, next) {
    try {
        if (!req.user || !req.profile)
            return res.status(401).json({ error: 'Authentication required.' });
        if (['admin', 'content_manager'].includes(req.profile.role))
            return next();
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('membership_status,membership_expires_at,plan:membership_plans!profiles_membership_plan_id_fkey(directory_access)')
            .eq('id', req.user.id)
            .single();
        if (error || !data)
            return res.status(403).json({ error: 'Membership access could not be verified.' });
        const expiry = data.membership_expires_at ? new Date(data.membership_expires_at).getTime() : null;
        const active = ['active', 'trialing'].includes(String(data.membership_status)) && (expiry === null || expiry > Date.now());
        const directoryAccess = Boolean(data.plan?.directory_access);
        if (!active || !directoryAccess)
            return res.status(403).json({ error: 'An active Rise, Legacy, or Elite membership is required to access this directory.' });
        next();
    }
    catch (error) {
        next(error);
    }
}

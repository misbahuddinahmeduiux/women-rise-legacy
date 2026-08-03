import { supabaseAdmin } from './supabase.js';

export const SAFE_PROFILE_FIELDS = new Set([
  'full_name','phone','country','city','avatar_url','headline','bio','skills',
  'linkedin_url','website_url','business_name','timezone','languages'
]);

export function allowlistedPayload(input: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => allowed.has(key) && value !== undefined));
}

export async function updateMembership(userId: string, changes: {
  membership_status?: string;
  membership_level?: string | null;
  membership_plan_id?: string | null;
  membership_expires_at?: string | null;
  membership_billing_cycle?: string | null;
}) {
  const { data: before, error: beforeError } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
  if (beforeError) throw beforeError;
  const safeChanges = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
  if (!Object.keys(safeChanges).length) throw new Error('No membership changes were supplied.');
  const { data, error } = await supabaseAdmin.from('profiles').update(safeChanges).eq('id', userId).select().single();
  if (error) throw error;
  return { before, after: data };
}

export async function assertApprovedActiveMentor(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('mentor_profiles')
    .select('user_id,profile_status,is_active,directory_visible,maximum_mentees')
    .eq('user_id', userId)
    .single();
  if (error || !data || data.profile_status !== 'approved' || !data.is_active) {
    throw new Error('Selected profile is not an approved active mentor.');
  }
  return data;
}

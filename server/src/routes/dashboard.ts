import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireUser);

dashboardRouter.get('/me', async (req, res, next) => {
  try {
    const email = req.user!.email ?? '';
    const profileResult = await supabaseAdmin.from('profiles').select('*').eq('id', req.user!.id).single();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    const levels: Record<string,string[]> = { rise:['all','rise'], legacy:['all','rise','legacy'], elite:['all','rise','legacy','elite'] };
    const allowed = levels[profile.membership_level ?? ''] ?? ['all'];
    const [donations, volunteer, partner, assistance, memberships, mentors, registrations, resources] = await Promise.all([
      supabaseAdmin.from('donations').select('*').eq('donor_email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('volunteer_applications').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('partner_applications').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('assistance_requests').select('id, public_alias, status, created_at').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('membership_applications').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('mentor_requests').select('*,mentor:profiles!mentor_requests_mentor_id_fkey(full_name)').eq('requester_email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('event_registrations').select('*,event:network_events(title,start_at,location)').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('resources').select('*').eq('is_published', true).in('membership_level', allowed).order('title')
    ]);
    res.json({ profile, donations: donations.data ?? [], volunteerApplications: volunteer.data ?? [], partnerApplications: partner.data ?? [], assistanceRequests: assistance.data ?? [], membershipApplications: memberships.data ?? [], mentorRequests: mentors.data ?? [], eventRegistrations: registrations.data ?? [], resources: resources.data ?? [] });
  } catch (error) { next(error); }
});

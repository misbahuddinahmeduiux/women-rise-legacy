import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { reconcileExpiredMembership } from '../lib/memberships.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireUser);

dashboardRouter.get('/me', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email ?? '';
    await reconcileExpiredMembership(userId);
    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('*,plan:membership_plans!profiles_membership_plan_id_fkey(*)')
      .eq('id', userId)
      .single();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    const levels: Record<string, string[]> = { rise: ['all', 'rise'], legacy: ['all', 'rise', 'legacy'], elite: ['all', 'rise', 'legacy', 'elite'] };
    const expiry = profile.membership_expires_at ? new Date(profile.membership_expires_at).getTime() : null;
    const accessStatus = ['active', 'trialing'].includes(String(profile.membership_status)) || (profile.membership_status === 'past_due' && (expiry === null || expiry > Date.now()));
    const allowed = accessStatus ? (levels[profile.membership_level ?? ''] ?? ['all']) : ['all'];

    const [donations, recurring, volunteer, partner, assistance, applications, mentorRequests, registrations, resources, preferences, membershipPayments, membershipSubscriptions, mentorshipMatches] = await Promise.all([
      supabaseAdmin.from('donations').select('*').or(`user_id.eq.${userId},donor_email.eq.${email}`).order('created_at', { ascending: false }),
      supabaseAdmin.from('recurring_donations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('volunteer_applications').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('partner_applications').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('assistance_requests').select('id, public_alias, status, created_at').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('membership_applications').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('mentor_requests').select('id,mentor_id,requester_name,requester_email,goals,preferred_topics,availability,status,created_at,updated_at,mentor:profiles!mentor_requests_mentor_id_fkey(full_name)').eq('requester_email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('event_registrations').select('*,event:network_events(title,start_at,location)').eq('email', email).order('created_at', { ascending: false }),
      supabaseAdmin.from('resources').select('*').eq('is_published', true).in('membership_level', allowed).order('title'),
      supabaseAdmin.from('notification_preferences').select('*').eq('profile_id', userId).maybeSingle(),
      supabaseAdmin.from('membership_payments').select('*,plan:membership_plans!membership_payments_plan_id_fkey(name,slug,access_level)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('membership_subscriptions').select('*,plan:membership_plans!membership_subscriptions_plan_id_fkey(name,slug,access_level,mentorship_access)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('mentorship_matches').select('id,request_id,member_id,mentor_id,goals,status,priority,starts_at,ended_at,member_notes,created_at,updated_at,member:profiles!mentorship_matches_member_id_fkey(id,full_name,headline,avatar_url),mentor:profiles!mentorship_matches_mentor_id_fkey(id,full_name,headline,avatar_url)').or(`member_id.eq.${userId},mentor_id.eq.${userId}`).order('created_at', { ascending: false })
    ]);

    let notificationPreferences = preferences.data;
    if (!notificationPreferences) {
      const created = await supabaseAdmin.from('notification_preferences').insert({ profile_id: userId }).select().single();
      notificationPreferences = created.data;
    }

    const matchIds = (mentorshipMatches.data ?? []).map((match) => match.id);
    const mentorSessions = matchIds.length
      ? await supabaseAdmin.from('mentor_sessions').select('id,match_id,scheduled_at,duration_minutes,meeting_url,location,agenda,member_notes,status,created_at,updated_at').in('match_id', matchIds).order('scheduled_at', { ascending: true })
      : { data: [], error: null };
    if (mentorSessions.error) throw mentorSessions.error;

    res.json({
      profile,
      donations: donations.data ?? [],
      recurringDonations: recurring.data ?? [],
      volunteerApplications: volunteer.data ?? [],
      partnerApplications: partner.data ?? [],
      assistanceRequests: assistance.data ?? [],
      membershipApplications: applications.data ?? [],
      mentorRequests: mentorRequests.data ?? [],
      eventRegistrations: registrations.data ?? [],
      resources: resources.data ?? [],
      membershipPayments: membershipPayments.data ?? [],
      membershipSubscriptions: membershipSubscriptions.data ?? [],
      mentorshipMatches: mentorshipMatches.data ?? [],
      mentorSessions: mentorSessions.data ?? [],
      notificationPreferences
    });
  } catch (error) { next(error); }
});

dashboardRouter.put('/notification-preferences', async (req, res, next) => {
  try {
    const input = z.object({
      transactionalEmail: z.boolean(),
      donationUpdates: z.boolean(),
      applicationUpdates: z.boolean(),
      eventReminders: z.boolean(),
      newsletter: z.boolean()
    }).parse(req.body);
    const { data, error } = await supabaseAdmin.from('notification_preferences').upsert({
      profile_id: req.user!.id,
      transactional_email: input.transactionalEmail,
      donation_updates: input.donationUpdates,
      application_updates: input.applicationUpdates,
      event_reminders: input.eventReminders,
      newsletter: input.newsletter
    }, { onConflict: 'profile_id' }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

dashboardRouter.post('/event-registrations/:id/cancel', async (req, res, next) => {
  try {
    const email = req.user!.email ?? '';
    const { data, error } = await supabaseAdmin.from('event_registrations')
      .update({ status: 'cancelled' }).eq('id', req.params.id).eq('email', email).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

dashboardRouter.post('/mentor-requests/:id/cancel', async (req, res, next) => {
  try {
    const email = req.user!.email ?? '';
    const { data, error } = await supabaseAdmin.from('mentor_requests')
      .update({ status: 'rejected', admin_notes: 'Cancelled by requester.' }).eq('id', req.params.id).eq('requester_email', email).in('status', ['new', 'under_review', 'matched']).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

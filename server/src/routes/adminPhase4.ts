import crypto from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { writeAudit } from '../lib/audit.js';
import { completeMembershipPayment, priceForCycle, type MembershipPlanRow } from '../lib/memberships.js';
import { queueEmail } from '../lib/email.js';
import { slugify } from '../lib/helpers.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';

export const adminPhase4Router = Router();
adminPhase4Router.use(requireUser, requireAdmin);

const optionalUrl = z.string().url().or(z.literal('')).optional().default('');
const optionalText = z.string().optional().default('');

const planSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(100).optional(),
  accessLevel: z.enum(['rise', 'legacy', 'elite']),
  tagline: optionalText,
  description: z.string().min(10).max(2000),
  features: z.union([z.array(z.string()), z.string()]).transform((value) => Array.isArray(value) ? value.filter(Boolean) : value.split('\n').map((item) => item.trim()).filter(Boolean)),
  currency: z.string().length(3).transform((value) => value.toLowerCase()),
  monthlyEnabled: z.boolean().default(false),
  monthlyPrice: z.coerce.number().min(0).nullable().optional(),
  yearlyEnabled: z.boolean().default(false),
  yearlyPrice: z.coerce.number().min(0).nullable().optional(),
  oneTimeEnabled: z.boolean().default(false),
  oneTimePrice: z.coerce.number().min(0).nullable().optional(),
  oneTimeDurationMonths: z.coerce.number().int().min(1).max(1200).nullable().optional(),
  oneTimeLifetime: z.boolean().default(false),
  autoRenew: z.boolean().default(true),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  gracePeriodDays: z.coerce.number().int().min(0).max(90).default(7),
  mentorshipAccess: z.enum(['browse', 'request', 'priority']).default('browse'),
  directoryAccess: z.boolean().default(true),
  businessListing: z.boolean().default(false),
  featuredVisibility: z.boolean().default(false),
  badgeText: optionalText,
  isFeatured: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true)
}).superRefine((input, context) => {
  if (!input.monthlyEnabled && !input.yearlyEnabled && !input.oneTimeEnabled) context.addIssue({ code: 'custom', message: 'Enable at least one billing option.', path: ['monthlyEnabled'] });
  if (input.monthlyEnabled && input.monthlyPrice == null) context.addIssue({ code: 'custom', message: 'Monthly price is required.', path: ['monthlyPrice'] });
  if (input.yearlyEnabled && input.yearlyPrice == null) context.addIssue({ code: 'custom', message: 'Yearly price is required.', path: ['yearlyPrice'] });
  if (input.oneTimeEnabled && input.oneTimePrice == null) context.addIssue({ code: 'custom', message: 'One-time price is required.', path: ['oneTimePrice'] });
});

function mapPlan(input: z.infer<typeof planSchema>, actorId: string) {
  return {
    name: input.name,
    slug: slugify(input.slug || input.name),
    access_level: input.accessLevel,
    tagline: input.tagline || null,
    description: input.description,
    features: input.features,
    currency: input.currency,
    monthly_enabled: input.monthlyEnabled,
    monthly_price: input.monthlyEnabled ? input.monthlyPrice : null,
    yearly_enabled: input.yearlyEnabled,
    yearly_price: input.yearlyEnabled ? input.yearlyPrice : null,
    one_time_enabled: input.oneTimeEnabled,
    one_time_price: input.oneTimeEnabled ? input.oneTimePrice : null,
    one_time_duration_months: input.oneTimeEnabled && !input.oneTimeLifetime ? (input.oneTimeDurationMonths || 12) : null,
    one_time_lifetime: input.oneTimeEnabled && input.oneTimeLifetime,
    auto_renew: input.autoRenew,
    trial_days: input.trialDays,
    grace_period_days: input.gracePeriodDays,
    mentorship_access: input.mentorshipAccess,
    directory_access: input.directoryAccess,
    business_listing: input.businessListing,
    featured_visibility: input.featuredVisibility,
    badge_text: input.badgeText || null,
    is_featured: input.isFeatured,
    display_order: input.displayOrder,
    is_active: input.isActive,
    updated_by: actorId
  };
}

adminPhase4Router.get('/overview', async (_req, res, next) => {
  try {
    const tables = ['membership_plans', 'membership_payments', 'membership_subscriptions', 'mentorship_matches', 'mentor_sessions', 'podcast_episodes', 'website_content', 'media_assets'] as const;
    const results = await Promise.all(tables.map((table) => supabaseAdmin.from(table).select('*', { count: 'exact', head: true })));
    res.json(Object.fromEntries(tables.map((table, index) => [table, results[index]?.count ?? 0])));
  } catch (error) { next(error); }
});

adminPhase4Router.get('/membership-plans', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('membership_plans').select('*').order('display_order').order('created_at');
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

adminPhase4Router.post('/membership-plans', async (req, res, next) => {
  try {
    const input = planSchema.parse(req.body);
    const payload = { ...mapPlan(input, req.profile!.id), created_by: req.profile!.id };
    const { data, error } = await supabaseAdmin.from('membership_plans').insert(payload).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'create', entityType: 'membership_plans', entityId: data.id, summary: `Created membership plan ${data.name}`, afterData: data });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.put('/membership-plans/:id', async (req, res, next) => {
  try {
    const input = planSchema.parse(req.body);
    const before = await supabaseAdmin.from('membership_plans').select('*').eq('id', req.params.id).single();
    const { data, error } = await supabaseAdmin.from('membership_plans').update(mapPlan(input, req.profile!.id)).eq('id', req.params.id).select().single();
    if (error) throw error;
    await supabaseAdmin.from('membership_provider_prices').delete().eq('plan_id', req.params.id);
    await writeAudit(req, { action: 'update', entityType: 'membership_plans', entityId: data.id, summary: `Updated membership plan ${data.name}`, beforeData: before.data, afterData: data });
    res.json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.delete('/membership-plans/:id', async (req, res, next) => {
  try {
    const activeSubscriptions = await supabaseAdmin.from('membership_subscriptions').select('*', { count: 'exact', head: true }).eq('plan_id', req.params.id).in('status', ['trialing', 'active', 'past_due', 'paused']);
    if ((activeSubscriptions.count ?? 0) > 0) return res.status(409).json({ error: 'This plan has active subscriptions. Disable it instead of deleting it.' });
    const before = await supabaseAdmin.from('membership_plans').select('*').eq('id', req.params.id).single();
    const { error } = await supabaseAdmin.from('membership_plans').delete().eq('id', req.params.id);
    if (error) throw error;
    await writeAudit(req, { action: 'delete', entityType: 'membership_plans', entityId: req.params.id, summary: 'Deleted membership plan', beforeData: before.data });
    res.status(204).send();
  } catch (error) { next(error); }
});

adminPhase4Router.get('/members', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    let query = supabaseAdmin.from('profiles').select('*,plan:membership_plans!profiles_membership_plan_id_fkey(name,slug,mentorship_access),subscription:membership_subscriptions!membership_subscriptions_user_id_fkey(id,status,billing_cycle,provider,current_period_end,cancel_at_period_end)').order('created_at', { ascending: false }).limit(500);
    if (search) query = query.or(`full_name.ilike.%${search}%,business_name.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    const usersResult = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map(usersResult.data.users.map((user) => [user.id, user.email]));
    res.json((data ?? []).map((profile: any) => ({ ...profile, email: emailMap.get(profile.id) || '' })));
  } catch (error) { next(error); }
});

const inviteMemberSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(['member', 'mentor']).default('member'),
  planId: z.string().uuid().or(z.literal('')).optional(),
  complimentaryBillingCycle: z.enum(['monthly', 'yearly', 'one_time']).optional(),
  phone: optionalText,
  country: optionalText,
  city: optionalText,
  headline: optionalText,
  bio: optionalText,
  mentorTitle: optionalText,
  mentorExpertise: z.union([z.array(z.string()), z.string()]).optional().transform((value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean)),
  mentorAvailability: optionalText,
  mentorSessionType: optionalText,
  mentorFeatured: z.boolean().default(false)
});

adminPhase4Router.post('/members/invite', async (req, res, next) => {
  try {
    const input = inviteMemberSchema.parse(req.body);
    const invitation = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: `${env.APP_URL}/reset-password`,
      data: { full_name: input.fullName, invited_role: input.role }
    });
    if (invitation.error || !invitation.data.user) throw invitation.error || new Error('Invitation could not be created.');
    const userId = invitation.data.user.id;
    const profilePayload = {
      id: userId,
      full_name: input.fullName,
      role: input.role,
      phone: input.phone || null,
      country: input.country || null,
      city: input.city || null,
      headline: input.headline || null,
      bio: input.bio || null,
      is_mentor: input.role === 'mentor',
      mentor_title: input.mentorTitle || null,
      mentor_expertise: input.mentorExpertise || [],
      mentor_availability: input.mentorAvailability || null,
      mentor_session_type: input.mentorSessionType || null,
      mentor_featured: input.mentorFeatured,
      is_directory_visible: input.role === 'mentor',
      membership_status: input.planId ? 'pending' : 'inactive'
    };
    const { data: profile, error } = await supabaseAdmin.from('profiles').upsert(profilePayload, { onConflict: 'id' }).select().single();
    if (error) throw error;

    if (input.planId) {
      const planResult = await supabaseAdmin.from('membership_plans').select('*').eq('id', input.planId).single();
      if (planResult.error) throw planResult.error;
      const cycle = input.complimentaryBillingCycle || (planResult.data.one_time_enabled ? 'one_time' : planResult.data.yearly_enabled ? 'yearly' : 'monthly');
      priceForCycle(planResult.data as MembershipPlanRow, cycle);
      const payment = await supabaseAdmin.from('membership_payments').insert({
        user_id: userId,
        plan_id: input.planId,
        billing_cycle: cycle,
        provider: 'complimentary',
        amount: 0,
        currency: planResult.data.currency,
        status: 'pending',
        provider_session_id: `complimentary_${crypto.randomUUID()}`,
        provider_payload: { assignedBy: req.profile!.id }
      }).select().single();
      if (payment.error) throw payment.error;
      await completeMembershipPayment({ paymentId: payment.data.id, providerPayload: { complimentary: true } });
    }

    if (input.role === 'mentor') {
      await queueEmail({ to: input.email, name: input.fullName, templateKey: 'mentor_invitation', subject: 'You are invited to mentor with Women Rise Legacy', payload: { mentorName: input.fullName, inviteUrl: `${env.APP_URL}/reset-password` } });
    }
    await writeAudit(req, { action: 'invite', entityType: 'profiles', entityId: userId, summary: `Invited ${input.role} ${input.email}`, afterData: profile });
    res.status(201).json({ message: 'Invitation sent.', profile });
  } catch (error) { next(error); }
});

const memberUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['member', 'mentor', 'volunteer', 'partner_representative', 'chapter_leader', 'donation_manager', 'content_manager', 'admin']).optional(),
  membershipStatus: z.enum(['inactive', 'pending', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired']).optional(),
  isDirectoryVisible: z.boolean().optional(),
  isMentor: z.boolean().optional(),
  headline: z.string().max(180).optional(),
  bio: z.string().max(3000).optional(),
  mentorTitle: z.string().max(180).optional(),
  mentorExpertise: z.array(z.string()).optional(),
  mentorAvailability: z.string().max(1000).optional(),
  mentorSessionType: z.string().max(120).optional(),
  mentorFeatured: z.boolean().optional()
});

adminPhase4Router.put('/members/:id', async (req, res, next) => {
  try {
    const input = memberUpdateSchema.parse(req.body);
    const payload: Record<string, unknown> = {};
    const map: Record<string, string> = { fullName: 'full_name', role: 'role', membershipStatus: 'membership_status', isDirectoryVisible: 'is_directory_visible', isMentor: 'is_mentor', headline: 'headline', bio: 'bio', mentorTitle: 'mentor_title', mentorExpertise: 'mentor_expertise', mentorAvailability: 'mentor_availability', mentorSessionType: 'mentor_session_type', mentorFeatured: 'mentor_featured' };
    for (const [key, column] of Object.entries(map)) if ((input as any)[key] !== undefined) payload[column] = (input as any)[key];
    if (input.role === 'mentor') payload.is_mentor = true;
    const before = await supabaseAdmin.from('profiles').select('*').eq('id', req.params.id).single();
    const { data, error } = await supabaseAdmin.from('profiles').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'update', entityType: 'profiles', entityId: req.params.id, summary: 'Updated member or mentor profile', beforeData: before.data, afterData: data });
    res.json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.post('/members/:id/complimentary-membership', async (req, res, next) => {
  try {
    const input = z.object({ planId: z.string().uuid(), billingCycle: z.enum(['monthly', 'yearly', 'one_time']) }).parse(req.body);
    const planResult = await supabaseAdmin.from('membership_plans').select('*').eq('id', input.planId).single();
    if (planResult.error) throw planResult.error;
    priceForCycle(planResult.data as MembershipPlanRow, input.billingCycle);
    const payment = await supabaseAdmin.from('membership_payments').insert({ user_id: req.params.id, plan_id: input.planId, billing_cycle: input.billingCycle, provider: 'complimentary', amount: 0, currency: planResult.data.currency, status: 'pending', provider_session_id: `complimentary_${crypto.randomUUID()}`, provider_payload: { assignedBy: req.profile!.id } }).select().single();
    if (payment.error) throw payment.error;
    const completed = await completeMembershipPayment({ paymentId: payment.data.id, providerPayload: { complimentary: true } });
    await writeAudit(req, { action: 'assign_membership', entityType: 'profiles', entityId: req.params.id, summary: `Assigned complimentary ${planResult.data.name} membership`, afterData: completed });
    res.json(completed);
  } catch (error) { next(error); }
});

adminPhase4Router.get('/membership-payments', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('membership_payments').select('*,plan:membership_plans!membership_payments_plan_id_fkey(name,slug),profile:profiles!membership_payments_user_id_fkey(full_name)').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

adminPhase4Router.post('/membership-payments/:id/mark-paid', async (req, res, next) => {
  try {
    const payment = await supabaseAdmin.from('membership_payments').select('*').eq('id', req.params.id).single();
    if (payment.error) throw payment.error;
    if (!['bank_transfer', 'complimentary'].includes(payment.data.provider)) return res.status(400).json({ error: 'Only bank-transfer or complimentary records can be marked paid manually.' });
    const completed = await completeMembershipPayment({ paymentId: payment.data.id, providerPaymentId: String(req.body.reference || payment.data.provider_session_id), providerPayload: { approvedBy: req.profile!.id, adminNote: req.body.note || null } });
    await writeAudit(req, { action: 'mark_paid', entityType: 'membership_payments', entityId: req.params.id, summary: 'Marked membership payment as paid', afterData: completed });
    res.json(completed);
  } catch (error) { next(error); }
});

adminPhase4Router.get('/subscriptions', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('membership_subscriptions').select('*,plan:membership_plans!membership_subscriptions_plan_id_fkey(name,slug),profile:profiles!membership_subscriptions_user_id_fkey(full_name)').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

adminPhase4Router.get('/mentorship', async (_req, res, next) => {
  try {
    const [requests, matches, sessions, mentors, members] = await Promise.all([
      supabaseAdmin.from('mentor_requests').select('*,mentor:profiles!mentor_requests_mentor_id_fkey(id,full_name,headline)').order('created_at', { ascending: false }),
      supabaseAdmin.from('mentorship_matches').select('*,member:profiles!mentorship_matches_member_id_fkey(id,full_name,headline),mentor:profiles!mentorship_matches_mentor_id_fkey(id,full_name,headline)').order('created_at', { ascending: false }),
      supabaseAdmin.from('mentor_sessions').select('*,match:mentorship_matches(member:profiles!mentorship_matches_member_id_fkey(full_name),mentor:profiles!mentorship_matches_mentor_id_fkey(full_name))').order('scheduled_at', { ascending: false }),
      supabaseAdmin.from('profiles').select('id,full_name,headline,mentor_expertise,mentor_availability,mentor_featured').eq('is_mentor', true).order('full_name'),
      supabaseAdmin.from('profiles').select('id,full_name,headline,membership_level,membership_status').in('membership_status', ['active', 'trialing']).order('full_name')
    ]);
    res.json({ requests: requests.data ?? [], matches: matches.data ?? [], sessions: sessions.data ?? [], mentors: mentors.data ?? [], members: members.data ?? [] });
  } catch (error) { next(error); }
});

adminPhase4Router.post('/mentorship/matches', async (req, res, next) => {
  try {
    const input = z.object({ requestId: z.string().uuid().or(z.literal('')).optional(), memberId: z.string().uuid(), mentorId: z.string().uuid(), goals: optionalText, priority: z.enum(['standard', 'priority', 'private']).default('standard'), startsAt: z.string().datetime().or(z.literal('')).optional(), adminNotes: optionalText }).parse(req.body);
    const mentor = await supabaseAdmin.from('profiles').select('id,full_name,is_mentor').eq('id', input.mentorId).single();
    if (mentor.error || !mentor.data.is_mentor) return res.status(400).json({ error: 'Selected profile is not an active mentor.' });
    const { data, error } = await supabaseAdmin.from('mentorship_matches').insert({ request_id: input.requestId || null, member_id: input.memberId, mentor_id: input.mentorId, assigned_by: req.profile!.id, goals: input.goals || null, priority: input.priority, starts_at: input.startsAt || null, admin_notes: input.adminNotes || null, status: 'pending_mentor' }).select('*,member:profiles!mentorship_matches_member_id_fkey(full_name),mentor:profiles!mentorship_matches_mentor_id_fkey(full_name)').single();
    if (error) throw error;
    if (input.requestId) await supabaseAdmin.from('mentor_requests').update({ mentor_id: input.mentorId, status: 'matched' }).eq('id', input.requestId);
    const user = await supabaseAdmin.auth.admin.getUserById(input.memberId);
    if (user.data.user?.email) await queueEmail({ to: user.data.user.email, name: data.member?.full_name, templateKey: 'mentor_match', subject: 'Your Women Rise Legacy mentorship match', payload: { memberName: data.member?.full_name, mentorName: data.mentor?.full_name } });
    await writeAudit(req, { action: 'create', entityType: 'mentorship_matches', entityId: data.id, summary: `Matched ${data.member?.full_name} with ${data.mentor?.full_name}`, afterData: data });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.patch('/mentorship/matches/:id/status', async (req, res, next) => {
  try {
    const status = z.enum(['pending_mentor', 'active', 'paused', 'completed', 'declined', 'cancelled']).parse(req.body.status);
    const { data, error } = await supabaseAdmin.from('mentorship_matches').update({ status, starts_at: status === 'active' ? new Date().toISOString() : undefined, ended_at: ['completed', 'cancelled', 'declined'].includes(status) ? new Date().toISOString() : null }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'status_change', entityType: 'mentorship_matches', entityId: req.params.id, summary: `Changed mentorship match to ${status}`, afterData: data });
    res.json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.post('/mentorship/sessions', async (req, res, next) => {
  try {
    const input = z.object({ matchId: z.string().uuid(), scheduledAt: z.string().datetime(), durationMinutes: z.coerce.number().int().min(15).max(480).default(60), meetingUrl: optionalUrl, location: optionalText, agenda: optionalText }).parse(req.body);
    const { data, error } = await supabaseAdmin.from('mentor_sessions').insert({ match_id: input.matchId, scheduled_at: input.scheduledAt, duration_minutes: input.durationMinutes, meeting_url: input.meetingUrl || null, location: input.location || null, agenda: input.agenda || null, created_by: req.profile!.id }).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'create', entityType: 'mentor_sessions', entityId: data.id, summary: 'Scheduled mentorship session', afterData: data });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.patch('/mentorship/sessions/:id/status', async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']), mentorPrivateNotes: optionalText, memberNotes: optionalText }).parse(req.body);
    const { data, error } = await supabaseAdmin.from('mentor_sessions').update({ status: input.status, mentor_private_notes: input.mentorPrivateNotes || null, member_notes: input.memberNotes || null }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

const podcastCategorySchema = z.object({ name: z.string().min(2), slug: z.string().optional(), description: optionalText, displayOrder: z.coerce.number().int().min(0).default(0), isActive: z.boolean().default(true) });
const podcastGuestSchema = z.object({ name: z.string().min(2), designation: optionalText, bio: optionalText, imageUrl: optionalText, mentorId: z.string().uuid().or(z.literal('')).optional(), websiteUrl: optionalUrl, linkedinUrl: optionalUrl, isActive: z.boolean().default(true) });
const podcastEpisodeSchema = z.object({ title: z.string().min(3), slug: z.string().optional(), episodeNumber: z.coerce.number().int().min(1).nullable().optional(), categoryId: z.string().uuid().or(z.literal('')).optional(), guestId: z.string().uuid().or(z.literal('')).optional(), guestName: optionalText, guestDesignation: optionalText, shortDescription: z.string().min(10).max(1000), showNotes: z.string().min(10), coverImageUrl: optionalText, audioUrl: optionalText, youtubeUrl: optionalText, spotifyUrl: optionalText, applePodcastsUrl: optionalText, durationMinutes: z.coerce.number().int().min(1).nullable().optional(), publishAt: z.string().datetime().or(z.literal('')).optional(), status: z.enum(['draft', 'scheduled', 'published', 'archived']).default('draft'), isFeatured: z.boolean().default(false), seoTitle: optionalText, seoDescription: optionalText });

function podcastCrud(path: string, table: string, schema: z.ZodTypeAny, map: (input: any) => Record<string, unknown>) {
  adminPhase4Router.get(`/podcast/${path}`, async (_req, res, next) => { try { const { data, error } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: false }); if (error) throw error; res.json(data ?? []); } catch (error) { next(error); } });
  adminPhase4Router.post(`/podcast/${path}`, async (req, res, next) => { try { const input = schema.parse(req.body); const { data, error } = await supabaseAdmin.from(table).insert(map(input)).select().single(); if (error) throw error; await writeAudit(req, { action: 'create', entityType: table, entityId: data.id, summary: `Created ${table} record`, afterData: data }); res.status(201).json(data); } catch (error) { next(error); } });
  adminPhase4Router.put(`/podcast/${path}/:id`, async (req, res, next) => { try { const input = schema.parse(req.body); const before = await supabaseAdmin.from(table).select('*').eq('id', req.params.id).single(); const { data, error } = await supabaseAdmin.from(table).update(map(input)).eq('id', req.params.id).select().single(); if (error) throw error; await writeAudit(req, { action: 'update', entityType: table, entityId: data.id, summary: `Updated ${table} record`, beforeData: before.data, afterData: data }); res.json(data); } catch (error) { next(error); } });
  adminPhase4Router.delete(`/podcast/${path}/:id`, async (req, res, next) => { try { const before = await supabaseAdmin.from(table).select('*').eq('id', req.params.id).single(); const { error } = await supabaseAdmin.from(table).delete().eq('id', req.params.id); if (error) throw error; await writeAudit(req, { action: 'delete', entityType: table, entityId: req.params.id, summary: `Deleted ${table} record`, beforeData: before.data }); res.status(204).send(); } catch (error) { next(error); } });
}

podcastCrud('categories', 'podcast_categories', podcastCategorySchema, (input) => ({ name: input.name, slug: slugify(input.slug || input.name), description: input.description || null, display_order: input.displayOrder, is_active: input.isActive }));
podcastCrud('guests', 'podcast_guests', podcastGuestSchema, (input) => ({ name: input.name, designation: input.designation || null, bio: input.bio || null, image_url: input.imageUrl || null, mentor_id: input.mentorId || null, website_url: input.websiteUrl || null, linkedin_url: input.linkedinUrl || null, is_active: input.isActive }));
podcastCrud('episodes', 'podcast_episodes', podcastEpisodeSchema, (input) => ({ title: input.title, slug: slugify(input.slug || input.title), episode_number: input.episodeNumber || null, category_id: input.categoryId || null, guest_id: input.guestId || null, guest_name: input.guestName || null, guest_designation: input.guestDesignation || null, short_description: input.shortDescription, show_notes: input.showNotes, cover_image_url: input.coverImageUrl || null, audio_url: input.audioUrl || null, youtube_url: input.youtubeUrl || null, spotify_url: input.spotifyUrl || null, apple_podcasts_url: input.applePodcastsUrl || null, duration_minutes: input.durationMinutes || null, publish_at: input.publishAt || null, status: input.status, is_featured: input.isFeatured, seo_title: input.seoTitle || null, seo_description: input.seoDescription || null }));

const websiteContentSchema = z.object({
  contentKey: z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Use lowercase letters, numbers, dots, underscores, or hyphens.'),
  label: z.string().trim().min(2).max(160),
  contentType: z.enum(['section', 'page', 'navigation', 'footer', 'announcement', 'seo']),
  value: z.record(z.string(), z.unknown()),
  isPublished: z.boolean().default(true)
});

adminPhase4Router.get('/website-content', async (_req, res, next) => {
  try { const { data, error } = await supabaseAdmin.from('website_content').select('*').order('content_key'); if (error) throw error; res.json(data ?? []); } catch (error) { next(error); }
});

adminPhase4Router.post('/website-content', async (req, res, next) => {
  try {
    const input = websiteContentSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('website_content').insert({ content_key: input.contentKey, label: input.label, content_type: input.contentType, value: input.value, is_published: input.isPublished, updated_by: req.profile!.id }).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'create', entityType: 'website_content', entityId: input.contentKey, summary: `Created website content ${input.contentKey}`, afterData: data });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.put('/website-content/:key', async (req, res, next) => {
  try {
    const input = websiteContentSchema.omit({ contentKey: true }).parse(req.body);
    const before = await supabaseAdmin.from('website_content').select('*').eq('content_key', req.params.key).maybeSingle();
    if (!before.data) return res.status(404).json({ error: 'Website content record not found.' });
    const { data, error } = await supabaseAdmin.from('website_content').update({ label: input.label, content_type: input.contentType, value: input.value, is_published: input.isPublished, updated_by: req.profile!.id }).eq('content_key', req.params.key).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'update', entityType: 'website_content', entityId: req.params.key, summary: `Updated website content ${req.params.key}`, beforeData: before.data, afterData: data });
    res.json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.delete('/website-content/:key', async (req, res, next) => {
  try {
    const before = await supabaseAdmin.from('website_content').select('*').eq('content_key', req.params.key).maybeSingle();
    if (!before.data) return res.status(404).json({ error: 'Website content record not found.' });
    const { error } = await supabaseAdmin.from('website_content').delete().eq('content_key', req.params.key);
    if (error) throw error;
    await writeAudit(req, { action: 'delete', entityType: 'website_content', entityId: req.params.key, summary: `Deleted website content ${req.params.key}`, beforeData: before.data });
    res.status(204).send();
  } catch (error) { next(error); }
});

adminPhase4Router.get('/content-options', async (_req, res, next) => {
  try { const { data, error } = await supabaseAdmin.from('content_options').select('*').order('group_key').order('display_order'); if (error) throw error; res.json(data ?? []); } catch (error) { next(error); }
});

adminPhase4Router.post('/content-options', async (req, res, next) => {
  try {
    const input = z.object({ groupKey: z.string().min(2), label: z.string().min(1), value: z.string().min(1), displayOrder: z.coerce.number().int().min(0).default(0), isActive: z.boolean().default(true) }).parse(req.body);
    const { data, error } = await supabaseAdmin.from('content_options').insert({ group_key: input.groupKey, label: input.label, value: input.value, display_order: input.displayOrder, is_active: input.isActive }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.put('/content-options/:id', async (req, res, next) => {
  try {
    const input = z.object({ groupKey: z.string().min(2), label: z.string().min(1), value: z.string().min(1), displayOrder: z.coerce.number().int().min(0).default(0), isActive: z.boolean().default(true) }).parse(req.body);
    const { data, error } = await supabaseAdmin.from('content_options').update({ group_key: input.groupKey, label: input.label, value: input.value, display_order: input.displayOrder, is_active: input.isActive }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.delete('/content-options/:id', async (req, res, next) => {
  try { const { error } = await supabaseAdmin.from('content_options').delete().eq('id', req.params.id); if (error) throw error; res.status(204).send(); } catch (error) { next(error); }
});

adminPhase4Router.get('/media', async (_req, res, next) => {
  try { const { data, error } = await supabaseAdmin.from('media_assets').select('*').order('created_at', { ascending: false }).limit(500); if (error) throw error; res.json(data ?? []); } catch (error) { next(error); }
});

adminPhase4Router.post('/media/upload', express.raw({ type: ['application/octet-stream', 'image/*', 'audio/*', 'application/pdf'], limit: '15mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Select a file to upload.' });
    const originalName = decodeURIComponent(String(req.header('x-file-name') || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '-');
    const mimeType = String(req.header('content-type') || 'application/octet-stream').split(';')[0] || 'application/octet-stream';
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'audio/mpeg', 'audio/mp4', 'audio/wav'];
    if (!allowed.includes(mimeType)) return res.status(400).json({ error: 'Unsupported media type.' });
    const storagePath = `${new Date().getUTCFullYear()}/${new Date().getUTCMonth() + 1}/${crypto.randomUUID()}-${originalName}`;
    const upload = await supabaseAdmin.storage.from('wrl-media').upload(storagePath, req.body, { contentType: mimeType, upsert: false });
    if (upload.error) throw upload.error;
    const publicUrl = supabaseAdmin.storage.from('wrl-media').getPublicUrl(storagePath).data.publicUrl;
    const { data, error } = await supabaseAdmin.from('media_assets').insert({ file_name: originalName, storage_path: storagePath, public_url: publicUrl, mime_type: mimeType, file_size: req.body.length, alt_text: req.header('x-alt-text') || null, title: req.header('x-media-title') || originalName, uploaded_by: req.profile!.id }).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'upload', entityType: 'media_assets', entityId: data.id, summary: `Uploaded media ${originalName}`, afterData: data });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.delete('/media/:id', async (req, res, next) => {
  try {
    const asset = await supabaseAdmin.from('media_assets').select('*').eq('id', req.params.id).single();
    if (asset.error) throw asset.error;
    const remove = await supabaseAdmin.storage.from('wrl-media').remove([asset.data.storage_path]);
    if (remove.error) throw remove.error;
    const { error } = await supabaseAdmin.from('media_assets').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) { next(error); }
});

const emailTemplateSchema = z.object({
  templateKey: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, 'Use lowercase snake_case for the template key.'),
  name: z.string().trim().min(2).max(160),
  subject: z.string().min(2).max(300),
  htmlBody: z.string().min(2),
  textBody: optionalText,
  availableVariables: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true)
});

adminPhase4Router.get('/email-templates', async (_req, res, next) => {
  try { const { data, error } = await supabaseAdmin.from('email_templates').select('*').order('name'); if (error) throw error; res.json(data ?? []); } catch (error) { next(error); }
});

adminPhase4Router.post('/email-templates', async (req, res, next) => {
  try {
    const input = emailTemplateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('email_templates').insert({ template_key: input.templateKey, name: input.name, subject: input.subject, html_body: input.htmlBody, text_body: input.textBody || null, available_variables: input.availableVariables, is_active: input.isActive, updated_by: req.profile!.id }).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'create', entityType: 'email_templates', entityId: input.templateKey, summary: `Created email template ${input.templateKey}`, afterData: data });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.put('/email-templates/:key', async (req, res, next) => {
  try {
    const input = emailTemplateSchema.omit({ templateKey: true }).parse(req.body);
    const before = await supabaseAdmin.from('email_templates').select('*').eq('template_key', req.params.key).maybeSingle();
    if (!before.data) return res.status(404).json({ error: 'Email template not found.' });
    const { data, error } = await supabaseAdmin.from('email_templates').update({ name: input.name, subject: input.subject, html_body: input.htmlBody, text_body: input.textBody || null, available_variables: input.availableVariables, is_active: input.isActive, updated_by: req.profile!.id }).eq('template_key', req.params.key).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'update', entityType: 'email_templates', entityId: req.params.key, summary: `Updated email template ${req.params.key}`, beforeData: before.data, afterData: data });
    res.json(data);
  } catch (error) { next(error); }
});

adminPhase4Router.delete('/email-templates/:key', async (req, res, next) => {
  try {
    const before = await supabaseAdmin.from('email_templates').select('*').eq('template_key', req.params.key).maybeSingle();
    if (!before.data) return res.status(404).json({ error: 'Email template not found.' });
    const { error } = await supabaseAdmin.from('email_templates').delete().eq('template_key', req.params.key);
    if (error) throw error;
    await writeAudit(req, { action: 'delete', entityType: 'email_templates', entityId: req.params.key, summary: `Deleted email template ${req.params.key}`, beforeData: before.data });
    res.status(204).send();
  } catch (error) { next(error); }
});

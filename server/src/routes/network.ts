import { Router } from 'express';
import { z } from 'zod';
import { queueEmail } from '../lib/email.js';
import { assertMentorshipAccess } from '../lib/memberships.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireUser } from '../middleware/auth.js';

export const networkRouter = Router();

// Retained for organizations that still want an application-only membership path.
// Paid checkout in Phase 4 activates membership automatically after verified payment.
networkRouter.post('/membership-applications', async (req, res, next) => {
  try {
    const input = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      requestedLevel: z.enum(['rise', 'legacy', 'elite']),
      currentRole: z.string().min(2),
      professionalGoal: z.string().min(10),
      communityInterest: z.string().min(10),
      consentConfirmed: z.union([z.boolean(), z.literal('true')]).transform((value) => value === true || value === 'true')
    }).parse(req.body);
    const users = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = users.data.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());
    const { error } = await supabaseAdmin.from('membership_applications').insert({
      user_id: matched?.id ?? null,
      full_name: input.fullName,
      email: input.email,
      requested_level: input.requestedLevel,
      current_role: input.currentRole,
      professional_goal: input.professionalGoal,
      community_interest: input.communityInterest,
      consent_confirmed: input.consentConfirmed
    });
    if (error) throw error;
    await queueEmail({ to: input.email, name: input.fullName, templateKey: 'membership_application_received', subject: 'Membership application received', payload: { requestedLevel: input.requestedLevel } });
    res.status(201).json({ message: 'Membership application submitted.' });
  } catch (error) { next(error); }
});

networkRouter.post('/mentor-requests', requireUser, async (req, res, next) => {
  try {
    const access = await assertMentorshipAccess(req.user!.id, 'request');
    const input = z.object({
      mentorId: z.string().uuid().or(z.literal('')).optional(),
      preferredTopics: z.string().min(2),
      goals: z.string().min(10),
      availability: z.string().min(2)
    }).parse(req.body);
    const profile = await supabaseAdmin.from('profiles').select('full_name').eq('id', req.user!.id).single();
    if (profile.error) throw profile.error;
    const requesterEmail = req.user!.email || '';
    const { data, error } = await supabaseAdmin.from('mentor_requests').insert({
      requester_id: req.user!.id,
      mentor_id: input.mentorId || null,
      requester_name: profile.data.full_name || requesterEmail.split('@')[0],
      requester_email: requesterEmail,
      goals: input.goals,
      preferred_topics: input.preferredTopics,
      availability: input.availability,
      admin_notes: access === 'priority' ? 'Elite priority request.' : null
    }).select().single();
    if (error) throw error;
    await queueEmail({ to: requesterEmail, name: profile.data.full_name || undefined, templateKey: 'mentor_request_received', subject: 'Mentorship request received', payload: { preferredTopics: input.preferredTopics, priority: access === 'priority' } });
    res.status(201).json({ message: access === 'priority' ? 'Priority mentorship request submitted.' : 'Mentorship request submitted.', request: data });
  } catch (error) { next(error); }
});

networkRouter.post('/event-registrations', async (req, res, next) => {
  try {
    const input = z.object({ eventId: z.string().uuid(), fullName: z.string().min(2), email: z.string().email(), phone: z.string().optional().default('') }).parse(req.body);
    const users = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = users.data.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());
    const { error } = await supabaseAdmin.from('event_registrations').upsert({ event_id: input.eventId, user_id: matched?.id ?? null, full_name: input.fullName, email: input.email, phone: input.phone }, { onConflict: 'event_id,email' });
    if (error) throw error;
    await queueEmail({ to: input.email, name: input.fullName, templateKey: 'event_registration', subject: 'Event registration confirmed', payload: { eventId: input.eventId } });
    res.status(201).json({ message: 'Event registration completed.' });
  } catch (error) { next(error); }
});

networkRouter.put('/profile', requireUser, async (req, res, next) => {
  try {
    const input = z.object({
      fullName: z.string().min(2), phone: z.string().optional().default(''), country: z.string().optional().default(''), city: z.string().optional().default(''),
      avatarUrl: z.string().url().or(z.literal('')).optional(), headline: z.string().max(180).optional().default(''), bio: z.string().max(3000).optional().default(''),
      skills: z.union([z.array(z.string()), z.string()]).transform((value) => Array.isArray(value) ? value : value.split(',').map((item) => item.trim()).filter(Boolean)),
      linkedinUrl: z.string().url().or(z.literal('')).optional(), websiteUrl: z.string().url().or(z.literal('')).optional(), businessName: z.string().optional().default(''),
      isDirectoryVisible: z.boolean().default(false), timezone: z.string().optional().default(''),
      languages: z.union([z.array(z.string()), z.string()]).optional().transform((value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean))
    }).parse(req.body);
    const { data, error } = await supabaseAdmin.from('profiles').update({
      full_name: input.fullName, phone: input.phone || null, country: input.country || null, city: input.city || null, avatar_url: input.avatarUrl || null,
      headline: input.headline || null, bio: input.bio || null, skills: input.skills, linkedin_url: input.linkedinUrl || null, website_url: input.websiteUrl || null,
      business_name: input.businessName || null, is_directory_visible: input.isDirectoryVisible, timezone: input.timezone || null, languages: input.languages || []
    }).eq('id', req.user!.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

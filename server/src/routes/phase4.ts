import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { queueEmail } from '../lib/email.js';
import { writeAudit } from '../lib/audit.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireUser } from '../middleware/auth.js';

export const phase4Router = Router();

phase4Router.get('/content', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('website_content').select('content_key,label,content_type,value').eq('is_published', true).order('content_key');
    if (error) throw error;
    res.json(Object.fromEntries((data ?? []).map((row) => [row.content_key, row.value])));
  } catch (error) { next(error); }
});

phase4Router.get('/content/:key', async (req, res, next) => {
  try {
    const key = z.string().min(2).max(120).parse(req.params.key);
    const { data, error } = await supabaseAdmin.from('website_content').select('content_key,label,content_type,value').eq('content_key', key).eq('is_published', true).single();
    if (error || !data) return res.status(404).json({ error: 'Website content was not found.' });
    res.json(data);
  } catch (error) { next(error); }
});

phase4Router.get('/options/:group', async (req, res, next) => {
  try {
    const group = z.string().min(2).max(80).parse(req.params.group);
    const { data, error } = await supabaseAdmin.from('content_options').select('id,label,value,display_order').eq('group_key', group).eq('is_active', true).order('display_order').order('label');
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

phase4Router.get('/podcast', async (req, res, next) => {
  try {
    const featured = req.query.featured === 'true';
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    let query = supabaseAdmin
      .from('podcast_episodes')
      .select('*,category:podcast_categories(*),guest:podcast_guests(*)')
      .eq('status', 'published')
      .lte('publish_at', new Date().toISOString())
      .order('publish_at', { ascending: false })
      .limit(limit);
    if (featured) query = query.eq('is_featured', true);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

phase4Router.get('/podcast/:slug', async (req, res, next) => {
  try {
    const slug = z.string().min(2).max(160).parse(req.params.slug);
    const { data, error } = await supabaseAdmin
      .from('podcast_episodes')
      .select('*,category:podcast_categories(*),guest:podcast_guests(*,mentor:profiles(id,full_name,headline,avatar_url,mentor_expertise))')
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('publish_at', new Date().toISOString())
      .single();
    if (error || !data) return res.status(404).json({ error: 'Podcast episode was not found.' });
    res.json(data);
  } catch (error) { next(error); }
});

phase4Router.post('/mentor-invitations/accept', requireUser, async (req, res, next) => {
  try {
    const token = z.string().min(20).max(500).parse(req.body.token);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();
    const invitation = await supabaseAdmin
      .from('mentor_invitations')
      .select('*')
      .eq('token_hash', hash)
      .maybeSingle();
    if (invitation.error) throw invitation.error;
    if (!invitation.data) return res.status(404).json({ error: 'Invitation is invalid.' });
    if (invitation.data.status === 'revoked') return res.status(410).json({ error: 'Invitation was revoked.' });
    if (new Date(invitation.data.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from('mentor_invitations').update({ status: 'expired' }).eq('id', invitation.data.id);
      return res.status(410).json({ error: 'Invitation has expired.' });
    }
    if (invitation.data.user_id && invitation.data.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'This invitation belongs to another account.' });
    }
    if (invitation.data.email_normalized !== String(req.user!.email || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Sign in with the email address that received this invitation.' });
    }
    if (!['invited', 'accepted', 'profile_incomplete'].includes(invitation.data.status)) {
      return res.status(409).json({ error: 'Invitation has already been used.' });
    }
    const { data: mentorProfile, error: mentorError } = await supabaseAdmin.from('mentor_profiles').upsert({
      user_id: req.user!.id,
      profile_status: 'profile_incomplete',
      directory_visible: false,
      is_active: false
    }, { onConflict: 'user_id' }).select().single();
    if (mentorError) throw mentorError;
    await supabaseAdmin.from('mentor_invitations').update({ status: 'profile_incomplete', user_id: req.user!.id, accepted_at: invitation.data.accepted_at || now }).eq('id', invitation.data.id);
    res.json({ message: 'Mentor invitation accepted. Complete your mentor profile.', mentorProfile });
  } catch (error) { next(error); }
});

phase4Router.get('/mentor-profile', requireUser, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('mentor_profiles').select('*').eq('user_id', req.user!.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'No mentor profile is linked to this account.' });
    res.json(data);
  } catch (error) { next(error); }
});

phase4Router.put('/mentor-profile', requireUser, async (req, res, next) => {
  try {
    const input = z.object({
      professionalTitle: z.string().trim().max(180).optional().default(''),
      biography: z.string().trim().max(5000).optional().default(''),
      expertise: z.array(z.string().trim().min(1)).max(30).default([]),
      skills: z.array(z.string().trim().min(1)).max(50).default([]),
      industry: z.string().trim().max(180).optional().default(''),
      yearsExperience: z.coerce.number().int().min(0).max(80).nullable().optional(),
      languages: z.array(z.string().trim().min(1)).max(20).default([]),
      availability: z.string().trim().max(2000).optional().default(''),
      timezone: z.string().trim().max(120).optional().default(''),
      maximumMentees: z.coerce.number().int().min(1).max(100).default(3),
      sessionFormat: z.string().trim().max(180).optional().default(''),
      consentAccepted: z.boolean().default(false)
    }).parse(req.body);
    const before = await supabaseAdmin.from('mentor_profiles').select('*').eq('user_id', req.user!.id).single();
    if (before.error) throw before.error;
    const reviewSensitiveValues: Record<string, unknown> = {
      professional_title: input.professionalTitle || null,
      biography: input.biography || null,
      expertise: input.expertise,
      mentor_skills: input.skills,
      industry: input.industry || null,
      years_experience: input.yearsExperience ?? null,
      languages: input.languages,
      session_format: input.sessionFormat || null
    };
    const importantChange = Object.entries(reviewSensitiveValues).some(([key,value]) => JSON.stringify(before.data[key]) !== JSON.stringify(value));
    const update: Record<string, unknown> = {
      professional_title: input.professionalTitle || null,
      biography: input.biography || null,
      expertise: input.expertise,
      mentor_skills: input.skills,
      industry: input.industry || null,
      years_experience: input.yearsExperience ?? null,
      languages: input.languages,
      availability: input.availability || null,
      timezone: input.timezone || null,
      maximum_mentees: input.maximumMentees,
      session_format: input.sessionFormat || null,
      consent_accepted_at: input.consentAccepted ? (before.data.consent_accepted_at || new Date().toISOString()) : before.data.consent_accepted_at
    };
    if (before.data.profile_status === 'approved' && importantChange) {
      Object.assign(update, { profile_status: 'pending_approval', directory_visible: false, is_active: false, submitted_at: new Date().toISOString() });
    }
    const { data, error } = await supabaseAdmin.from('mentor_profiles').update(update).eq('user_id', req.user!.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

phase4Router.post('/mentor-profile/submit', requireUser, async (req, res, next) => {
  try {
    const profile = await supabaseAdmin.from('mentor_profiles').select('*').eq('user_id', req.user!.id).single();
    if (profile.error) throw profile.error;
    const missing = [
      !profile.data.professional_title && 'professional title',
      !profile.data.biography && 'biography',
      !(profile.data.expertise?.length) && 'expertise',
      !profile.data.availability && 'availability',
      !profile.data.timezone && 'timezone',
      !profile.data.session_format && 'session format',
      !profile.data.consent_accepted_at && 'consent acceptance'
    ].filter(Boolean);
    if (missing.length) return res.status(400).json({ error: `Complete these fields first: ${missing.join(', ')}.` });
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('mentor_profiles').update({ profile_status: 'pending_approval', profile_completed_at: now, submitted_at: now, directory_visible: false, is_active: false }).eq('user_id', req.user!.id).select().single();
    if (error) throw error;
    await supabaseAdmin.from('mentor_invitations').update({ status: 'pending_approval' }).eq('user_id', req.user!.id).in('status', ['accepted','profile_incomplete']);
    res.json({ message: 'Mentor profile submitted for admin approval.', mentorProfile: data });
  } catch (error) { next(error); }
});

phase4Router.get('/mentor-dashboard', requireUser, async (req, res, next) => {
  try {
    const mentorProfile = await supabaseAdmin.from('mentor_profiles').select('*').eq('user_id', req.user!.id).maybeSingle();
    if (mentorProfile.error) throw mentorProfile.error;
    if (!mentorProfile.data) return res.status(403).json({ error: 'Mentor profile required.' });
    const [profile, matches, sessions] = await Promise.all([
      supabaseAdmin.from('profiles').select('id,full_name,headline,avatar_url,account_status').eq('id', req.user!.id).single(),
      supabaseAdmin.from('mentorship_matches').select('id,request_id,member_id,mentor_id,goals,status,priority,starts_at,ended_at,proposed_at,mentor_notified_at,mentor_accepted_at,mentor_declined_at,activated_at,closed_at,member_notes,mentor_private_notes,created_at,updated_at,member:profiles!mentorship_matches_member_id_fkey(id,full_name,headline,avatar_url,membership_level)').eq('mentor_id', req.user!.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('mentor_sessions').select('id,match_id,scheduled_at,duration_minutes,meeting_url,location,agenda,member_notes,mentor_private_notes,status,created_at,updated_at,match:mentorship_matches!inner(mentor_id,member:profiles!mentorship_matches_member_id_fkey(id,full_name))').eq('match.mentor_id', req.user!.id).order('scheduled_at', { ascending: true })
    ]);
    if (profile.error) throw profile.error;
    res.json({ profile: profile.data, mentorProfile: mentorProfile.data, matches: matches.data ?? [], sessions: sessions.data ?? [] });
  } catch (error) { next(error); }
});

phase4Router.patch('/mentor-matches/:id/status', requireUser, async (req, res, next) => {
  try {
    const matchId = z.string().uuid().parse(req.params.id);
    const status = z.enum(['active', 'declined']).parse(req.body.status);
    const now = new Date().toISOString();
    const match = await supabaseAdmin.from('mentorship_matches').select('*,member:profiles!mentorship_matches_member_id_fkey(full_name,email_normalized)').eq('id', matchId).eq('mentor_id', req.user!.id).eq('status', 'pending_mentor').single();
    if (match.error || !match.data) return res.status(404).json({ error: 'Pending mentor match was not found.' });
    const mentor = await supabaseAdmin.from('mentor_profiles').select('profile_status,is_active').eq('user_id', req.user!.id).single();
    if (mentor.error || mentor.data.profile_status !== 'approved' || !mentor.data.is_active) return res.status(403).json({ error: 'Only an approved active mentor can accept matches.' });
    const updates = status === 'active'
      ? { status, starts_at: now, mentor_accepted_at: now, activated_at: now, mentor_declined_at: null, ended_at: null }
      : { status, mentor_declined_at: now, ended_at: now, closed_at: now };
    const { data, error } = await supabaseAdmin.from('mentorship_matches').update(updates).eq('id', matchId).select().single();
    if (error) throw error;
    if (status === 'active' && match.data.member?.email_normalized) {
      await queueEmail({ to: match.data.member.email_normalized, name: match.data.member.full_name || undefined, templateKey: 'mentor_match_accepted', subject: 'Your mentorship match is confirmed', payload: { mentorAccepted: true } });
    }
    await writeAudit(req, { action: status === 'active' ? 'match_accepted' : 'match_declined', entityType: 'mentorship_matches', entityId: matchId, summary: status === 'active' ? 'Mentor accepted proposed match.' : 'Mentor declined proposed match.', beforeData: match.data, afterData: data });
    res.json(data);
  } catch (error) { next(error); }
});

phase4Router.patch('/mentor-sessions/:id', requireUser, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']), mentorPrivateNotes: z.string().max(5000).optional().default('') }).parse(req.body);
    const session = await supabaseAdmin.from('mentor_sessions').select('id,match:mentorship_matches!inner(mentor_id,status,mentor_accepted_at)').eq('id', req.params.id).eq('match.mentor_id', req.user!.id).single();
    if (session.error || !session.data) return res.status(404).json({ error: 'Mentor session was not found.' });
    const match = session.data.match as unknown as { status: string; mentor_accepted_at: string | null };
    if (match.status !== 'active' || !match.mentor_accepted_at) return res.status(409).json({ error: 'Session updates require an active accepted match.' });
    const { data, error } = await supabaseAdmin.from('mentor_sessions').update({ status: input.status, mentor_private_notes: input.mentorPrivateNotes || null }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

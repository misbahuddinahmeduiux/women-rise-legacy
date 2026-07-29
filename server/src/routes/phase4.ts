import { Router } from 'express';
import { z } from 'zod';
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

phase4Router.get('/mentor-dashboard', requireUser, async (req, res, next) => {
  try {
    const profile = await supabaseAdmin.from('profiles').select('id,role,is_mentor,full_name').eq('id', req.user!.id).single();
    if (profile.error) throw profile.error;
    if (!profile.data.is_mentor && profile.data.role !== 'admin') return res.status(403).json({ error: 'Mentor access required.' });
    const [matches, sessions] = await Promise.all([
      supabaseAdmin.from('mentorship_matches').select('id,request_id,member_id,mentor_id,goals,status,priority,starts_at,ended_at,member_notes,mentor_private_notes,created_at,updated_at,member:profiles!mentorship_matches_member_id_fkey(id,full_name,headline,avatar_url,membership_level)').eq('mentor_id', req.user!.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('mentor_sessions').select('id,match_id,scheduled_at,duration_minutes,meeting_url,location,agenda,member_notes,mentor_private_notes,status,created_at,updated_at,match:mentorship_matches!inner(mentor_id,member:profiles!mentorship_matches_member_id_fkey(id,full_name))').eq('match.mentor_id', req.user!.id).order('scheduled_at', { ascending: true })
    ]);
    res.json({ profile: profile.data, matches: matches.data ?? [], sessions: sessions.data ?? [] });
  } catch (error) { next(error); }
});

phase4Router.patch('/mentor-matches/:id/status', requireUser, async (req, res, next) => {
  try {
    const status = z.enum(['active', 'declined']).parse(req.body.status);
    const { data, error } = await supabaseAdmin.from('mentorship_matches').update({ status, starts_at: status === 'active' ? new Date().toISOString() : null, ended_at: status === 'declined' ? new Date().toISOString() : null }).eq('id', req.params.id).eq('mentor_id', req.user!.id).eq('status', 'pending_mentor').select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

phase4Router.patch('/mentor-sessions/:id', requireUser, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']), mentorPrivateNotes: z.string().max(5000).optional().default('') }).parse(req.body);
    const session = await supabaseAdmin.from('mentor_sessions').select('id,match:mentorship_matches!inner(mentor_id)').eq('id', req.params.id).eq('match.mentor_id', req.user!.id).single();
    if (session.error || !session.data) return res.status(404).json({ error: 'Mentor session was not found.' });
    const { data, error } = await supabaseAdmin.from('mentor_sessions').update({ status: input.status, mentor_private_notes: input.mentorPrivateNotes || null }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});

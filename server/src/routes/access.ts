import { Router } from 'express';
import { writeAudit } from '../lib/audit.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { rotateUserAuthVersion } from '../lib/sessionSecurity.js';
import { requireUser } from '../middleware/auth.js';

export const accessRouter = Router();

accessRouter.get('/me', requireUser, async (req, res) => {
  res.json({ profile: req.profile, access: req.access });
});

accessRouter.post('/staff-invitation/accept', requireUser, async (req, res, next) => {
  try {
    const before = await supabaseAdmin.from('staff_memberships').select('*').eq('user_id', req.user!.id).maybeSingle();
    if (before.error) throw before.error;
    if (!before.data) return res.status(404).json({ error: 'No staff invitation is linked to this account.' });
    if (before.data.status === 'active') return res.json({ message: 'Staff invitation was already accepted.', staff: before.data });
    if (before.data.status !== 'invited') return res.status(409).json({ error: 'This staff invitation cannot be accepted in its current state.' });
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('staff_memberships').update({ status:'active', accepted_at:now, activated_at:now, status_reason:null }).eq('user_id', req.user!.id).eq('status','invited').select().single();
    if (error) throw error;
    try {
      await rotateUserAuthVersion(req.user!.id);
    } catch (sessionError) {
      await supabaseAdmin.from('staff_memberships').update({ status:before.data.status, accepted_at:before.data.accepted_at, activated_at:before.data.activated_at, status_reason:before.data.status_reason }).eq('user_id',req.user!.id);
      throw sessionError;
    }
    await writeAudit(req, { action:'staff_invitation_accepted', entityType:'staff_memberships', entityId:req.user!.id, summary:'Staff member accepted team invitation.', beforeData:before.data, afterData:data });
    res.json({ message:'Team invitation accepted. Your assigned permissions are now active.', staff:data });
  } catch (error) { next(error); }
});

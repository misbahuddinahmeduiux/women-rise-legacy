import type { Request } from 'express';
import { supabaseAdmin } from './supabase.js';

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  beforeData?: unknown;
  afterData?: unknown;
}

export async function writeAudit(req: Request, input: AuditInput) {
  const actorEmail = req.user?.email ?? null;
  const ip = req.ip || req.socket.remoteAddress || null;
  const requestId = resRequestId(req);
  const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
    actor_id: req.profile?.id ?? null,
    actor_email: actorEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    request_id: requestId,
    ip_address: ip
  });
  if (error) console.error('Audit log write failed:', error.message);
}

function resRequestId(req: Request) {
  return String(req.headers['x-request-id'] || req.requestId || '');
}

/**
 * Audit log writer — every meaningful action goes through here.
 *
 * The audit log is the change log + service history. It is the primary
 * recovery + accountability tool. All fields are nullable except action;
 * provide as much context as you have.
 */

import { serverClient } from './supabase';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'content_edit'
  | 'content_publish_request'
  | 'publish_succeeded'
  | 'publish_failed'
  | 'snapshot_created'
  | 'snapshot_restored'
  | 'role_changed'
  | 'user_invited'
  | 'user_removed'
  | 'code_edit'
  | 'code_published'
  | 'zoho_sync_run'
  | 'zoho_sync_failed'
  | 'media_added'
  | 'media_removed';

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetTable?: string;
  targetId?: string;
  targetLabel?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  notes?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const sb = serverClient();
    const { error } = await sb.from('audit_log').insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      target_label: entry.targetLabel ?? null,
      before_value: entry.beforeValue ?? null,
      after_value: entry.afterValue ?? null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      request_id: entry.requestId ?? null,
      notes: entry.notes ?? null,
    });
    if (error) {
      console.error('[audit] failed to write audit log:', error);
    }
  } catch (err) {
    // Audit log failures must NEVER block the main action. Log to console
    // (which Netlify captures) and move on.
    console.error('[audit] threw exception:', err);
  }
}

/** Helper: extract IP + user agent from a Request for audit logging. */
export function requestContext(req: Request): Pick<AuditEntry, 'ipAddress' | 'userAgent'> {
  return {
    ipAddress: req.headers.get('x-nf-client-connection-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  };
}

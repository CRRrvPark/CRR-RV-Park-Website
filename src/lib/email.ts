/**
 * Email sender — uses Supabase's email service (via the Admin API) for
 * transactional emails. No separate SMTP provider needed.
 *
 * If Supabase's email is unavailable (or rate-limited), we fall back to
 * console logging so the main flow never breaks.
 *
 * For production-grade email at scale, swap in Resend / Postmark / etc. by
 * replacing the `sendRaw` function.
 */

import { serverClient } from './supabase';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  body: string;      // HTML
  textBody?: string; // plain text fallback
  from?: string;
}

async function sendRaw(message: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  // Supabase doesn't expose a generic send-email endpoint for non-auth flows,
  // so for admin notifications we use a minimal approach:
  // - In production: invoke a Supabase Edge Function named 'send-email' that
  //   uses Resend (or similar) on the server side
  // - Until that is provisioned, we log to console so the flow doesn't break
  //
  // The Edge Function can be added later without code changes here — just
  // deploy it and set SUPABASE_EMAIL_FUNCTION_URL.

  const fnUrl = process.env.SUPABASE_EMAIL_FUNCTION_URL;
  const fnKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!fnUrl || !fnKey) {
    console.log('[email] (NOT SENT — SUPABASE_EMAIL_FUNCTION_URL not configured)');
    console.log(`  to: ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`);
    console.log(`  subject: ${message.subject}`);
    console.log(`  body: ${message.body.slice(0, 200)}...`);
    return { ok: false, error: 'Email function not configured' };
  }

  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fnKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[email] send failed:', text);
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[email] threw:', err);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Templates — all in one place for easy review and consistent voice
// ---------------------------------------------------------------------------

async function ownerEmails(): Promise<string[]> {
  const sb = serverClient();
  const { data } = await sb
    .from('app_users')
    .select('email')
    .eq('role', 'owner')
    .eq('is_active', true);
  return (data ?? []).map(r => r.email);
}

async function editorAndOwnerEmails(): Promise<string[]> {
  const sb = serverClient();
  const { data } = await sb
    .from('app_users')
    .select('email')
    .in('role', ['owner', 'editor'])
    .eq('is_active', true);
  return (data ?? []).map(r => r.email);
}

export async function notifyBuildFailed(publishId: string, errorMessage: string): Promise<void> {
  const to = await ownerEmails();
  if (to.length === 0) return;

  await sendRaw({
    to,
    subject: '⚠ CRR website build FAILED',
    body: `
      <div style="font-family:system-ui;max-width:600px;">
        <h2 style="color:#c0392b;">Build failed</h2>
        <p>A publish attempt to the production website failed.</p>
        <p><strong>Error:</strong><br><code>${escapeHtml(errorMessage)}</code></p>
        <p><strong>Publish ID:</strong> ${publishId}</p>
        <p>The site has been automatically rolled back to the previous version (if available). Check the admin for details:</p>
        <p><a href="https://www.crookedriverranchrv.com/admin/audit">View change log →</a></p>
      </div>
    `,
  });
}

export async function notifyZohoSyncFailed(service: string, errorMessage: string): Promise<void> {
  const to = await ownerEmails();
  if (to.length === 0) return;

  await sendRaw({
    to,
    subject: `⚠ Zoho ${service} sync failed`,
    body: `
      <div style="font-family:system-ui;max-width:600px;">
        <h2 style="color:#e67e22;">Zoho ${service} sync failed</h2>
        <p>The scheduled Zoho ${service} sync encountered an error.</p>
        <p><strong>Error:</strong><br><code>${escapeHtml(errorMessage)}</code></p>
        <p>Common causes:</p>
        <ul>
          <li>Zoho OAuth token expired — reconnect in Settings</li>
          <li>Designated folder/calendar ID changed</li>
          <li>Zoho API rate limit</li>
        </ul>
        <p><a href="https://www.crookedriverranchrv.com/admin/settings">Open Settings →</a></p>
      </div>
    `,
  });
}

export async function notifyDraftPending(draftId: string, authorEmail: string, pageLabel: string): Promise<void> {
  const to = await editorAndOwnerEmails();
  if (to.length === 0) return;

  await sendRaw({
    to,
    subject: `Draft awaiting approval: ${pageLabel}`,
    body: `
      <div style="font-family:system-ui;max-width:600px;">
        <h2>Draft awaiting approval</h2>
        <p><strong>${escapeHtml(authorEmail)}</strong> submitted a draft edit to the <strong>${escapeHtml(pageLabel)}</strong> page.</p>
        <p>As an editor or owner, you can review and approve (or reject) it.</p>
        <p><a href="https://www.crookedriverranchrv.com/admin/editor">Open admin editor →</a></p>
      </div>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

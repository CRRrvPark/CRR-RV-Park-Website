/**
 * POST /api/forms/monthly-application
 *
 * Netlify Forms outgoing webhook. Guest submit path is unchanged
 * (browser still POSTs to /__forms.html; conversion tracking still fires
 * after that 200). This endpoint runs after Netlify has already stored
 * the application: build a formatted PDF and email it to the office.
 *
 * The production build also creates this webhook via the Netlify API and
 * drains stored submissions, so the dashboard click is not required.
 *
 * Manual replay (staff / scripts): POST the same JSON with header
 *   x-cron-secret: <SCHEDULED_FN_SECRET or FORM_WEBHOOK_SECRET>
 */

import type { APIRoute } from 'astro';
import { json, handleError, UnauthenticatedError } from '@lib/api';
import { verifyNetlifyJws } from '@lib/netlify-jws';
import { dispatchMonthlyApplication } from '@lib/monthly-application-dispatch';
import { MailNotConfiguredError } from '@lib/send-attachment-email';
import type { NetlifyFormSubmission } from '@lib/monthly-application';

export const prerender = false;

function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  if (fromProcess) return fromProcess;
  try {
    return (import.meta.env as Record<string, string | undefined>)[name];
  } catch {
    return undefined;
  }
}

function webhookSecret(): string | undefined {
  return env('FORM_WEBHOOK_SECRET') || env('SCHEDULED_FN_SECRET');
}

function authorize(request: Request, raw: string): void {
  const secret = webhookSecret();
  const sig = request.headers.get('x-webhook-signature');
  if (sig && secret && verifyNetlifyJws(sig, secret, raw)) return;

  const cron = request.headers.get('x-cron-secret');
  const expectedCron = env('SCHEDULED_FN_SECRET') || env('FORM_WEBHOOK_SECRET');
  if (cron && expectedCron && cron === expectedCron) return;

  throw new UnauthenticatedError('Missing or invalid webhook signature');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const raw = await request.text();
    authorize(request, raw);

    let payload: NetlifyFormSubmission;
    try {
      payload = JSON.parse(raw) as NetlifyFormSubmission;
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const result = await dispatchMonthlyApplication(payload);
    if (result.status === 'skipped') {
      return json({ ignored: true, reason: result.reason });
    }
    return json({ ok: true, provider: result.provider, filename: result.filename });
  } catch (err) {
    if (err instanceof MailNotConfiguredError) {
      console.error('[monthly-application] mailer not configured — set RESEND_API_KEY or SMTP_* before enabling the Netlify form webhook');
      return json({ error: err.message }, 503);
    }
    return handleError(err);
  }
};

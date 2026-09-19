/**
 * POST /api/forms/monthly-application
 *
 * Netlify Forms outgoing webhook. Guest submit path is unchanged
 * (browser still POSTs to /__forms.html; conversion tracking still fires
 * after that 200). This endpoint runs after Netlify has already stored
 * the application: build a formatted PDF and email it to the office.
 *
 * Configure AFTER mail env vars are set, or Netlify will disable the hook
 * on repeated 5xx. In Netlify:
 *   Project configuration → Notifications → Form submission notifications
 *   Event: New form submission  ·  Form: monthly-application
 *   URL: https://www.crookedriverranchrv.com/api/forms/monthly-application
 *   JWS secret: same value as FORM_WEBHOOK_SECRET (or SCHEDULED_FN_SECRET)
 *
 * Manual replay (staff / scripts): POST the same JSON with header
 *   x-cron-secret: <SCHEDULED_FN_SECRET>
 */

import type { APIRoute } from 'astro';
import { json, handleError, UnauthenticatedError } from '@lib/api';
import { verifyNetlifyJws } from '@lib/netlify-jws';
import {
  formatIsoDate,
  formatPhone,
  fullName,
  isHoneypot,
  isMonthlyApplication,
  parseMonthlyApplication,
  pdfFilename,
  type NetlifyFormSubmission,
} from '@lib/monthly-application';
import { buildMonthlyApplicationPdf } from '@lib/monthly-application-pdf';
import { MailNotConfiguredError, mailFrom, officeInbox, sendPdfEmail } from '@lib/send-attachment-email';

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
  const expectedCron = env('SCHEDULED_FN_SECRET');
  if (cron && expectedCron && cron === expectedCron) return;

  throw new UnauthenticatedError('Missing or invalid webhook signature');
}

function applicationEmail(app: ReturnType<typeof parseMonthlyApplication>, filename: string) {
  const name = fullName(app);
  const moveIn = formatIsoDate(app.moveInDate);
  const moveOut = formatIsoDate(app.moveOutDate);
  const subject = `Monthly application — ${name} — ${moveIn}`;
  const text = [
    `New winter monthly stay application from ${name}.`,
    `Phone: ${formatPhone(app.phone)}`,
    `Email: ${app.email}`,
    `Move-in: ${moveIn}`,
    `Move-out: ${moveOut}`,
    `RV: ${[app.rvYear, app.rvMake, app.rvModel, app.rvLength ? `${app.rvLength}'` : ''].filter(Boolean).join(' ')}`,
    '',
    `The formatted application is attached (${filename}).`,
    'Reply to this email to reach the applicant.',
  ].join('\n');
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;color:#2C1810;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#C4622D;">Crooked River Ranch RV Park</p>
      <h1 style="margin:0 0 16px;font-size:22px;">Winter monthly application</h1>
      <p style="margin:0 0 16px;">${escapeHtml(name)} submitted an extended-stay application. The formatted PDF is attached — no need to open Netlify.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#665040;">Phone</td><td>${escapeHtml(formatPhone(app.phone))}</td></tr>
        <tr><td style="padding:6px 0;color:#665040;">Email</td><td>${escapeHtml(app.email)}</td></tr>
        <tr><td style="padding:6px 0;color:#665040;">Move-in</td><td>${escapeHtml(moveIn)}</td></tr>
        <tr><td style="padding:6px 0;color:#665040;">Move-out</td><td>${escapeHtml(moveOut)}</td></tr>
        <tr><td style="padding:6px 0;color:#665040;">RV</td><td>${escapeHtml([app.rvYear, app.rvMake, app.rvModel, app.rvLength ? `${app.rvLength} ft` : ''].filter(Boolean).join(' '))}</td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#665040;">Reply to this message to email the applicant. Call 541-923-1441 if you would rather phone.</p>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

    if (!isMonthlyApplication(payload)) {
      return json({ ignored: true, reason: 'not monthly-application' });
    }
    if (isHoneypot(payload)) {
      return json({ ignored: true, reason: 'honeypot' });
    }

    const to = officeInbox();
    if (!to) {
      throw new MailNotConfiguredError();
    }

    const app = parseMonthlyApplication(payload);
    const pdf = await buildMonthlyApplicationPdf(app);
    const filename = pdfFilename(app);
    const letter = applicationEmail(app, filename);

    const { provider } = await sendPdfEmail({
      to,
      from: mailFrom(),
      replyTo: app.email || undefined,
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
      filename,
      pdf,
    });

    console.log(`[monthly-application] emailed PDF via ${provider} submission=${app.id || 'none'} number=${app.number || 'none'}`);
    return json({ ok: true, provider, filename });
  } catch (err) {
    if (err instanceof MailNotConfiguredError) {
      console.error('[monthly-application] mailer not configured — set RESEND_API_KEY or SMTP_* before enabling the Netlify form webhook');
      return json({ error: err.message }, 503);
    }
    return handleError(err);
  }
};

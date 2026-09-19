/**
 * Build the formatted monthly-application PDF and send it to the office.
 * Used by the Netlify form webhook, the production-build drain, and the
 * scheduled drain. Guest POST + conversion tracking stay on /__forms.html.
 */

import {
  formatIsoDate,
  formatPhone,
  fullName,
  isHoneypot,
  isMonthlyApplication,
  parseMonthlyApplication,
  pdfFilename,
  type MonthlyApplication,
  type NetlifyFormSubmission,
} from './monthly-application';
import { buildMonthlyApplicationPdf } from './monthly-application-pdf';
import { MailNotConfiguredError, mailFrom, officeInbox, sendPdfEmail } from './send-attachment-email';
import { alreadyEmailed, markEmailed, sentKey } from './monthly-application-sent';

export type DispatchResult =
  | { status: 'emailed'; provider: string; filename: string; key: string }
  | { status: 'skipped'; reason: string; key?: string };

export function normalizeSubmission(raw: NetlifyFormSubmission): NetlifyFormSubmission {
  if (raw.data && typeof raw.data === 'object') return raw;
  const human = (raw as { human_fields?: Record<string, unknown> }).human_fields;
  if (human && typeof human === 'object') return { ...raw, data: human };
  return raw;
}

export async function dispatchMonthlyApplication(raw: NetlifyFormSubmission): Promise<DispatchResult> {
  const payload = normalizeSubmission(raw);
  const key = sentKey(payload);

  if (!isMonthlyApplication(payload)) {
    return { status: 'skipped', reason: 'not monthly-application' };
  }
  if (isHoneypot(payload)) {
    return { status: 'skipped', reason: 'honeypot', key };
  }
  if (await alreadyEmailed(key)) {
    return { status: 'skipped', reason: 'already-emailed', key };
  }

  const to = officeInbox();
  if (!to) throw new MailNotConfiguredError();

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
  await markEmailed(key);
  console.log(
    `[monthly-application] emailed PDF via ${provider} submission=${app.id || 'none'} number=${app.number || 'none'}`,
  );
  return { status: 'emailed', provider, filename, key };
}

function applicationEmail(app: MonthlyApplication, filename: string) {
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

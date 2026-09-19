/**
 * Send an office email with a PDF attachment.
 *
 * Prefers Resend (RESEND_API_KEY). Falls back to SMTP when SMTP_HOST +
 * SMTP_USER + SMTP_PASS are set (Zoho / Google / Microsoft app passwords).
 */

import nodemailer from 'nodemailer';

export class MailNotConfiguredError extends Error {
  constructor() {
    super('No mailer configured. Set RESEND_API_KEY, or SMTP_HOST + SMTP_USER + SMTP_PASS.');
    this.name = 'MailNotConfiguredError';
  }
}

function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  if (fromProcess) return fromProcess;
  try {
    return (import.meta.env as Record<string, string | undefined>)[name];
  } catch {
    return undefined;
  }
}

export interface PdfEmail {
  to: string | string[];
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  filename: string;
  pdf: Uint8Array;
}

export async function sendPdfEmail(msg: PdfEmail): Promise<{ provider: 'resend' | 'smtp' }> {
  const resendKey = env('RESEND_API_KEY');
  if (resendKey) {
    await sendViaResend(resendKey, msg);
    return { provider: 'resend' };
  }
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  if (host && user && pass) {
    await sendViaSmtp(msg, host, user, pass);
    return { provider: 'smtp' };
  }
  throw new MailNotConfiguredError();
}

async function sendViaResend(apiKey: string, msg: PdfEmail): Promise<void> {
  const to = Array.isArray(msg.to) ? msg.to : [msg.to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from.includes('<') ? msg.from : `CRR RV Park <${msg.from}>`,
      to,
      reply_to: msg.replyTo || undefined,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: [
        {
          filename: msg.filename,
          content: Buffer.from(msg.pdf).toString('base64'),
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 400)}`);
  }
}

async function sendViaSmtp(msg: PdfEmail, host: string, user: string, pass: string): Promise<void> {
  const port = Number(env('SMTP_PORT') || '465');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: msg.from.includes('<') ? msg.from : `CRR RV Park <${msg.from}>`,
    to: msg.to,
    replyTo: msg.replyTo,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    attachments: [{ filename: msg.filename, content: Buffer.from(msg.pdf) }],
  });
}

export function officeInbox(): string {
  return env('APPLICATIONS_EMAIL_TO') || env('ADMIN_EMAIL_FROM') || '';
}

export function mailFrom(): string {
  return env('MAIL_FROM') || env('ADMIN_EMAIL_FROM') || 'rvpark@crookedriverranch.com';
}

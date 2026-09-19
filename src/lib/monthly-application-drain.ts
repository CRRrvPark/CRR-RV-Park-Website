/**
 * Pull stored monthly-application submissions from the Netlify Forms API
 * and email any that do not yet have a PDF in the office inbox.
 */

import { dispatchMonthlyApplication, normalizeSubmission, type DispatchResult } from './monthly-application-dispatch';
import { MONTHLY_APPLICATION_FORM_ID } from './monthly-application-webhook';
import type { NetlifyFormSubmission } from './monthly-application';

export type DrainResult = {
  emailed: number;
  skipped: number;
  considered: number;
  error?: string;
  results: DispatchResult[];
};

function siteId(): string | undefined {
  return process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
}

async function resolveFormId(token: string): Promise<string> {
  const site = siteId();
  if (!site) return MONTHLY_APPLICATION_FORM_ID;
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${site}/forms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return MONTHLY_APPLICATION_FORM_ID;
  const forms = (await res.json()) as Array<{ id?: string; name?: string }>;
  return forms.find(f => f.name === 'monthly-application')?.id || MONTHLY_APPLICATION_FORM_ID;
}

export async function drainMonthlyApplications(opts: { limit?: number } = {}): Promise<DrainResult> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const limit = opts.limit ?? 5;
  if (!token) {
    console.warn('[monthly-application] drain skipped — NETLIFY_AUTH_TOKEN missing');
    return { emailed: 0, skipped: 0, considered: 0, error: 'no-token', results: [] };
  }

  const formId = await resolveFormId(token);
  const res = await fetch(
    `https://api.netlify.com/api/v1/forms/${formId}/submissions?per_page=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`list submissions ${res.status}: ${text.slice(0, 300)}`);
  }

  const submissions = (await res.json()) as NetlifyFormSubmission[];
  const newestFirst = [...submissions].sort((a, b) =>
    String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  );

  const results: DispatchResult[] = [];
  let emailed = 0;
  let skipped = 0;

  for (const raw of newestFirst) {
    const payload = normalizeSubmission(raw);
    try {
      const result = await dispatchMonthlyApplication(payload);
      results.push(result);
      if (result.status === 'emailed') {
        emailed++;
        if (emailed >= limit) break;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error('[monthly-application] drain item failed', err);
      results.push({ status: 'skipped', reason: 'error' });
      skipped++;
    }
  }

  return { emailed, skipped, considered: newestFirst.length, results };
}

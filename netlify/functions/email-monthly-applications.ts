/**
 * Scheduled drain (every 5 minutes on production publishes).
 *
 * Astro's adapter emits SSR into .netlify/v1/functions, which is the
 * functions directory in netlify.toml, so this file is bundled there by
 * scripts/ensure-monthly-application-mail.ts after `astro build`.
 */

import { drainMonthlyApplications } from '../../src/lib/monthly-application-drain';
import { ensureMonthlyApplicationWebhook } from '../../src/lib/monthly-application-webhook';

export default async () => {
  const hook = await ensureMonthlyApplicationWebhook();
  const drain = await drainMonthlyApplications({ limit: 3 });
  const body = { ok: true, hook, emailed: drain.emailed, skipped: drain.skipped };
  console.log('[email-monthly-applications]', JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  schedule: '*/5 * * * *',
};

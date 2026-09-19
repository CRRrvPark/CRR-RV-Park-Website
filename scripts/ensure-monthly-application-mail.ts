/**
 * Production-build follow-up for monthly-application PDFs:
 *   1. Bundle the 5-minute drain into .netlify/v1/functions (Astro's
 *      functions directory), so it actually ships.
 *   2. On production deploys, create the signed form webhook and email
 *      any stored applications that do not yet have a PDF in the inbox.
 *
 * Guest submit path and conversion tracking are not touched.
 *
 * Failures here must not fail the deploy — applications stay in Netlify Forms.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drainMonthlyApplications } from '../src/lib/monthly-application-drain';
import { ensureMonthlyApplicationWebhook } from '../src/lib/monthly-application-webhook';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function bundleScheduledDrain(): void {
  const outDir = resolve(root, '.netlify/v1/functions');
  mkdirSync(outDir, { recursive: true });
  const esbuild = resolve(root, 'node_modules/esbuild/bin/esbuild');
  const entry = resolve(root, 'netlify/functions/email-monthly-applications.ts');
  const outfile = resolve(outDir, 'email-monthly-applications.mjs');
  const result = spawnSync(
    process.execPath,
    [
      esbuild,
      entry,
      '--bundle',
      '--platform=node',
      '--format=esm',
      `--outfile=${outfile}`,
      '--external:@netlify/blobs',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error('[monthly-application] scheduled-drain bundle failed; webhook/drain still attempted');
  } else {
    console.log('[monthly-application] bundled scheduled drain to', outfile);
  }
}

async function main(): Promise<void> {
  if (process.env.NETLIFY === 'true') {
    bundleScheduledDrain();
  }

  const production = process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production';
  if (!production) {
    console.log('[monthly-application] skip webhook/drain (not a production Netlify build)');
    return;
  }

  const hook = await ensureMonthlyApplicationWebhook();
  console.log('[monthly-application] webhook ensure', hook);
  const drain = await drainMonthlyApplications({ limit: 10 });
  console.log('[monthly-application] drain', {
    emailed: drain.emailed,
    skipped: drain.skipped,
    considered: drain.considered,
    error: drain.error,
  });
}

main().catch(err => {
  console.error('[monthly-application] postbuild failed (not blocking deploy)', err);
  process.exit(0);
});

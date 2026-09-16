import { EXTENDED_STAYS as stay } from './availability';

/**
 * Public-site copy that used to live only in the CMS. We still *read*
 * homepage / book-now from the database, but we no longer need the admin
 * dashboard to correct known-stale strings — this layer owns those fixes
 * at render time, same idea as src/lib/availability.ts.
 */

function monthlyRatesReplacement(): string {
  const now = `${stay.sitesAvailableNow} sites open today`;
  const later =
    stay.additionalSites > 0
      ? `; ${stay.additionalSites} more ${stay.additionalSitesDate}`
      : '';
  return `Monthly rates available now through ${stay.seasonEndLabel}. ${now}${later}.`;
}

export function fixPublicCopy(input: string): string {
  if (!input) return input;

  let s = input;
  // SQL-escaped apostrophes that were written into stored content (don''t).
  s = s.replace(/(\w)''(\w)/g, "$1'$2");
  s = s.replace(/(\w)(?:&#39;){2}(\w)/g, "$1'$2");
  s = s.replace(
    /Monthly rates available October 1\s*[–—-]\s*April 30\./g,
    monthlyRatesReplacement()
  );
  s = s.replace(
    /While other parks in Central Oregon parks close in October/g,
    'While other parks in Central Oregon close in October'
  );
  return s;
}

export function fixPublicCopyDeep<T>(value: T): T {
  if (typeof value === 'string') return fixPublicCopy(value) as T;
  if (Array.isArray(value)) return value.map((item) => fixPublicCopyDeep(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = fixPublicCopyDeep(child);
    }
    return out as T;
  }
  return value;
}

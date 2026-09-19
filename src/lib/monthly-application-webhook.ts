/**
 * Create (or re-enable) the monthly-application outgoing webhook so Netlify
 * POSTs new submissions to /api/forms/monthly-application with a JWS secret.
 */

export const MONTHLY_APPLICATION_WEBHOOK_URL =
  'https://www.crookedriverranchrv.com/api/forms/monthly-application';
export const MONTHLY_APPLICATION_FORM_ID = '69db5241e723eb000869fdee';

const NETLIFY_API = 'https://api.netlify.com/api/v1';

type HookRecord = {
  id?: string;
  type?: string;
  event?: string;
  disabled?: boolean;
  form_id?: string | null;
  data?: Record<string, unknown>;
};

type HookType = {
  name?: string;
  fields?: Array<{ name?: string }>;
};

export type WebhookEnsureResult = {
  created: boolean;
  enabled?: boolean;
  id?: string;
  skipped?: string;
};

function siteId(): string | undefined {
  return process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
}

function webhookSecret(): string | undefined {
  return process.env.FORM_WEBHOOK_SECRET || process.env.SCHEDULED_FN_SECRET;
}

async function netlifyApi(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: string }> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN is not set');
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

function isOurHook(hook: HookRecord): boolean {
  if (hook.event !== 'submission_created' || hook.type !== 'url') return false;
  const url = String(hook.data?.url ?? '');
  if (url.includes('/api/forms/monthly-application')) return true;
  return hook.form_id === MONTHLY_APPLICATION_FORM_ID;
}

function secretFieldNames(types: HookType[]): string[] {
  const urlType = types.find(t => t.name === 'url');
  const fromDocs = (urlType?.fields ?? [])
    .map(f => f.name)
    .filter((n): n is string => Boolean(n))
    .filter(n => /secret|jws|jwt|signature/i.test(n));
  return [...new Set([...fromDocs, 'secret', 'jws_secret', 'signature_secret'])];
}

async function createHook(site: string, data: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: string }> {
  return netlifyApi(`/hooks?site_id=${encodeURIComponent(site)}`, {
    method: 'POST',
    body: JSON.stringify({
      site_id: site,
      form_id: MONTHLY_APPLICATION_FORM_ID,
      form_name: 'monthly-application',
      type: 'url',
      event: 'submission_created',
      data,
    }),
  });
}

export async function ensureMonthlyApplicationWebhook(): Promise<WebhookEnsureResult> {
  const site = siteId();
  const secret = webhookSecret();
  if (!process.env.NETLIFY_AUTH_TOKEN) return { created: false, skipped: 'no-token' };
  if (!site) return { created: false, skipped: 'no-site' };
  if (!secret) return { created: false, skipped: 'no-secret' };

  const listed = await netlifyApi(`/hooks?site_id=${encodeURIComponent(site)}`);
  if (!listed.ok) {
    console.error('[monthly-application] list hooks failed', listed.status, listed.body.slice(0, 300));
    return { created: false, skipped: `list-${listed.status}` };
  }
  const hooks = parseJson<HookRecord[]>(listed.body);
  const existing = hooks.find(isOurHook);
  if (existing?.id) {
    if (existing.disabled) {
      const enabled = await netlifyApi(`/hooks/${existing.id}/enable`, { method: 'POST' });
      console.log('[monthly-application] re-enabled form webhook', existing.id, enabled.status);
      return { created: false, enabled: enabled.ok, id: existing.id };
    }
    return { created: false, id: existing.id, skipped: 'already-exists' };
  }

  let fieldNames = ['secret', 'jws_secret', 'signature_secret'];
  const typesRes = await netlifyApi('/hooks/types');
  if (typesRes.ok) {
    try {
      fieldNames = secretFieldNames(parseJson<HookType[]>(typesRes.body));
    } catch {
      /* keep fallbacks */
    }
  }

  const attempts: Array<Record<string, unknown>> = [
    { url: MONTHLY_APPLICATION_WEBHOOK_URL, ...Object.fromEntries(fieldNames.map(n => [n, secret])) },
    ...fieldNames.map(name => ({ url: MONTHLY_APPLICATION_WEBHOOK_URL, [name]: secret })),
  ];

  for (const data of attempts) {
    const created = await createHook(site, data);
    if (created.ok) {
      const hook = parseJson<HookRecord>(created.body);
      console.log('[monthly-application] created form webhook', hook.id);
      return { created: true, id: hook.id };
    }
    console.warn('[monthly-application] create hook attempt failed', created.status, created.body.slice(0, 200));
  }

  return { created: false, skipped: 'create-failed' };
}

/**
 * Trigger the configured Netlify build hook after synchronized event content
 * changes. Public-page source changes use Git branches and Deploy Previews.
 */

export async function triggerBuildHook(): Promise<{ ok: boolean; statusCode: number }> {
  const hook = process.env.NETLIFY_BUILD_HOOK;
  if (!hook) throw new Error('NETLIFY_BUILD_HOOK env var is not set');
  const res = await fetch(hook, { method: 'POST' });
  return { ok: res.ok, statusCode: res.status };
}

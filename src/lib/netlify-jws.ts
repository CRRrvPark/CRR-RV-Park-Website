/**
 * Verify Netlify outgoing-webhook JWS (X-Webhook-Signature).
 *
 * When a hook is created with a JWS secret, Netlify sends an HS256 JWT
 * whose payload is `{ iss: "netlify", sha256: "<hex of raw body>" }`.
 * Hash the exact raw request bytes — never re-serialized JSON.
 *
 * https://docs.netlify.com/deploy/deploy-notifications/#payload
 */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export function verifyNetlifyJws(token: string | null, secret: string, rawBody: string): boolean {
  if (!token || !secret) return false;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;
  const signed = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', secret).update(signed).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(fromB64Url(sigB64));
  } catch {
    return false;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  let payload: { iss?: string; sha256?: string };
  try {
    payload = JSON.parse(Buffer.from(fromB64Url(payloadB64)).toString('utf8'));
  } catch {
    return false;
  }
  if (payload.iss !== 'netlify' || typeof payload.sha256 !== 'string') return false;
  const bodyHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  if (payload.sha256.length !== bodyHash.length) return false;
  return timingSafeEqual(Buffer.from(payload.sha256, 'utf8'), Buffer.from(bodyHash, 'utf8'));
}

function fromB64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

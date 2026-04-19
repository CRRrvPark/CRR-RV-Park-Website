/**
 * GET /api/zoho/calendars
 *
 * Lists the Zoho calendars available to the connected account — surfaces
 * each calendar's `uid`, which is what ZOHO_CALENDAR_PUBLIC_EVENTS_ID
 * needs to be set to. Users frequently confuse the long `zz08...` embed /
 * public-share key with the API UID; this endpoint makes the correct
 * value visible in the admin UI.
 */

import type { APIRoute } from 'astro';
import { requireAuth, handleError, json } from '@lib/api';
import { listCalendars } from '@lib/zoho';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const calendars = await listCalendars();
    return json({ calendars });
  } catch (err) {
    return handleError(err);
  }
};

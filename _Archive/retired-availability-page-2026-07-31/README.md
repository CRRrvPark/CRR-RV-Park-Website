# Retired — guest Check Availability page (2026-07-31)

Archived at Mathew's direction: the live availability map creates guest
friction because the park cannot keep the snapshot reliably current.

## What moved here

| File | Former path |
|---|---|
| `pages/availability.astro` | `src/pages/availability.astro` |
| `pages/api/availability.ts` | `src/pages/api/availability.ts` |
| `components/AvailabilityMap.astro` | `src/components/AvailabilityMap.astro` |

## Live behavior after retirement

- Nav link removed.
- `/availability` and `/availability/*` redirect (302) to Firefly Reservations
  via `netlify.toml`.
- Booking remains Firefly-first (`/book-now` + Reservations CTA).

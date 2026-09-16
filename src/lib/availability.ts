/**
 * Extended-stay availability — single source of truth for the monthly /
 * extended-stay offer as advertised across the public site.
 *
 * Every public surface that mentions monthly availability reads from here:
 *   - src/pages/extended-stays.astro  (the page itself)
 *   - src/components/AvailabilityBanner.astro  (site-wide announcement bar)
 *   - src/components/Nav.astro + Footer.astro  ("Available Now" flag)
 *
 * To update availability, edit this file and redeploy. Nothing else needs
 * touching, and no dashboard/DB edit is involved — this content is owned by
 * code on purpose.
 *
 * Season note (2026/27): the extended-stay season opened EARLY. The $850
 * monthly rate applies to any arrival date, not just from October 1. A
 * second wave of 13 sites opens October 1 and is already taking bookings.
 *
 * When those 13 sites come online, set:
 *   sitesAvailableNow: 18   (or the real remaining count)
 *   additionalSites: 0      → every "N more open <date>" sentence drops out
 *
 * Setting `applicationsOpen: false` removes the announcement bar and the
 * nav/footer flags site-wide, and reverts the nav to the top of the viewport.
 */
export const EXTENDED_STAYS = {
  /** Master switch for the banner + nav/footer flags. */
  applicationsOpen: true,
  /** Monthly sites bookable right now. */
  sitesAvailableNow: 5,
  /** Second wave opening on `additionalSitesDate`. Set to 0 to hide. */
  additionalSites: 13,
  additionalSitesDate: 'October 1',
  /** Full-hookup monthly rate. Applies to ANY arrival date this season. */
  monthlyRate: '$850',
  /** Discounted monthly rate for Crooked River Ranch property owners. */
  ownerMonthlyRate: '$800',
  /** Hard end of the monthly season — all monthly guests vacate by this date. */
  seasonEndLabel: 'April 30',
  /** Short label used in the nav/footer flag. Intentionally not a count: a
   *  number baked into every page's nav goes stale the moment one site fills
   *  and would require a deploy to correct. */
  flagLabel: 'Available Now',
} as const;

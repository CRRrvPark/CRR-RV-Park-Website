-- ==========================================================================
-- 015_conversion_events.sql — track public-site conversion clicks
-- ==========================================================================
-- Book Now / Reserve button clicks are the highest-signal business event on
-- the site. Clarity's Data Export API can't reliably filter custom events
-- for a specific tag, so we record them ourselves. Intentionally minimal:
-- no PII, no session IDs, no fingerprints. Just "something was clicked."
--
-- Dashboard queries this for daily counts, top CTA pages, and conversion
-- trend charts. Public POST is allowed (rate-limited at the API layer).
-- ==========================================================================

create table if not exists conversion_events (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  event          text not null,                   -- 'book_now_click', 'reserve_click', etc.
  source_path    text,                            -- which page the click happened on
  referrer_host  text,                            -- external referrer host only (no path/query)
  utm_source     text,
  utm_campaign   text,
  ip_hash        text                             -- SHA-256 of IP, truncated; not reversible
);

create index if not exists idx_conversion_events_occurred on conversion_events (occurred_at desc);
create index if not exists idx_conversion_events_event on conversion_events (event, occurred_at desc);

-- Quick rollup helper so the dashboard API doesn't have to compute daily
-- aggregates in SQL each request. We don't denormalize into a counts table
-- yet — row volume is trivially low (maybe hundreds/day at peak).

# Area Guide Setup — what you (the owner) need to do

This doc is everything that can't be done in code. Work through it in order
after you deploy the area-guide release. Nothing here is blocking the
deploy itself — the site will work; some features just won't be fully lit
up until you complete these steps.

---

## 1 · Run the database migrations

The area-guide release adds four new tables (`trails`, `things_to_do`,
`local_places`, `park_sites`) plus seed data. You need to apply the
migrations against your Supabase project.

```bash
npm run db:migrate
```

This runs every migration in `supabase/migrations/` that hasn't already
been applied. The relevant new ones:

- `011_area_guide_tables.sql` — creates the 4 tables + RLS policies
- `012_seed_area_guide.sql` — seeds 6 trails, 60 things-to-do, 5 place
  placeholders, and 109 park-site placeholders (1 per real site)

After running, confirm in Supabase dashboard → Table Editor that the tables
exist and have rows.

---

## 2 · Google Cloud API keys (maps + places)

The interactive maps and Google Places integration both need Google Cloud
API keys. You need **two** keys: one public (for the browser) and one
private (for the server).

### Create the project

1. Go to https://console.cloud.google.com
2. Create a project called "CRR Website"
3. Billing → enable billing (Google requires this, but you stay in the
   free tier — $200/month credit covers WAY more than your traffic)

### Enable the APIs

APIs & Services → Library → enable all three:

- **Maps JavaScript API** (for the browser maps)
- **Places API (New)** (for restaurant/brewery info)
- **Geocoding API** (for converting addresses to coordinates)

### Create the public key (browser-safe, referrer-restricted)

1. APIs & Services → Credentials → Create credentials → API key
2. Name it `CRR Website — Browser`
3. Click it → **Application restrictions** → HTTP referrers →
   add these entries:
   - `https://www.crookedriverranchrv.com/*`
   - `https://*.netlify.app/*` (for deploy previews)
   - `http://localhost:4321/*` (for local dev)
4. **API restrictions** → restrict to: Maps JavaScript API, Places API (New)
5. Copy the key
6. Netlify dashboard → Site configuration → Environment variables →
   add `PUBLIC_GOOGLE_MAPS_API_KEY` = [the key]

### Create the server key (for Place lookups, IP-restricted)

1. Same Credentials screen → Create another API key
2. Name it `CRR Website — Server`
3. Application restrictions → **IP addresses** → leave unrestricted for
   now (Netlify's IPs change). Later, switch to a restricted list of
   Netlify's egress ranges if you want belt-and-suspenders.
4. API restrictions → restrict to: Places API (New)
5. Copy the key
6. Netlify dashboard → Environment variables → add
   `GOOGLE_MAPS_SERVER_KEY` = [the key] (**not** prefixed with `PUBLIC_`
   — this one must stay server-side)

**Why two keys:** the browser key is visible in your HTML bundle. Referrer
restrictions prevent someone stealing it and using it from their own
domain. The server key never leaves the server, so it needs different
restrictions (IP-based or unrestricted).

---

## 3 · Fill in Google place_ids

The seed migration creates 5 placeholder places with `google_place_id`
values like `TODO_PLACE_ID_terrebonne_depot`. These need to be replaced
with real Google place IDs.

For each place:

1. Open https://www.google.com/maps
2. Search for the business (e.g. "Terrebonne Depot")
3. Click the business → Share → copy the Google Maps URL
4. Paste the URL into https://developers.google.com/maps/documentation/places/web-service/place-id
   ("Place ID Finder" tool); copy the place_id it returns
5. In the CRR admin → Area Guide → Local Places → click the row →
   paste the real place_id → Save
6. Click **Refresh** in the admin to pull the current Google data
   (name, photos, rating, hours)

After that, the /dining page auto-shows the live Google data for each
place. It refreshes every 24 hours on its own.

---

## 4 · (Optional) Firefly per-site deep links

The park map on `/park-map` has a "Book this site" button on each site.
By default it points to the generic Firefly booking page:
`https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK`
— users pick the site again on Firefly's screen.

If Firefly supports per-site deep links (a URL that pre-selects a specific
site), we can skip that step:

1. Log in to your Firefly admin
2. Try to find a URL that pre-selects a specific site. Look for a
   "shareable link" or "embed" button on a site's detail page, OR check
   Firefly's docs for URL parameters like `?site=A12`
3. If you find one: send me two examples from different sites so I can
   confirm the URL pattern and update the default behavior
4. Alternatively, admins can paste the per-site URL into each
   `park_sites` row manually in the admin (Area Guide → Park Sites → edit
   row → "Firefly deep link")

If Firefly doesn't support per-site URLs, leave this as-is. The generic
link still works fine.

---

## 5 · Populate real park-site data

The seed migration creates 109 placeholder park sites with:
- Site number: A-01 through D-27
- Type: "standard" for all
- Rate: $42/night for all
- Map position: evenly distributed (not matching your actual park layout)
- All marked Available

You'll want to replace the placeholders with real data. In the admin
(Area Guide → Park Sites tab), edit each site:

- Correct dimensions (length × width in feet)
- Pull-through vs back-in
- Amp service (30 / 50)
- Site type (standard / premium / etc.)
- Correct nightly rate
- Photo URL (upload to Media Library first, paste the URL)
- `map_position_x` / `map_position_y` — percentage (0–100) of the park
  map image where this site sits

For the map positions, once you upload a park map image (step 6 below),
you can eyeball the percentages or I can build a drag-to-position UI in
a later iteration.

---

## 6 · Upload the park map image

The clickable park map on `/park-map` needs a background image — a
visual plan of your park showing all four loops. You probably have one
as a PDF or image from your park layout.

1. Admin → Media Library → Upload → select the image
   (JPG or PNG, ideally ~1600px wide)
2. Copy the image URL from the Media Library
3. For now, paste the URL into a "park_map_config" row in Supabase.
   (A dedicated config UI for this is one of the small follow-up
   tasks — see "deferred to next iteration" below.)

---

## 7 · Populate trail content

The seed migration has 6 trails with generic descriptions. The **difficulty
ratings and hazards in particular should be verified before going live**
— they're a liability concern if they don't match reality.

For each trail (Area Guide → Trails → edit), verify or replace:

- Distance, elevation gain, difficulty
- Hazards (as a comma-separated list)
- Description (HTML; can include `<p>`, `<strong>`, `<em>`, `<ul>/<li>`)
- Pet-friendly, kid-friendly flags
- Parking info
- Season (e.g. "Year-round" or "April–October")
- Drive time from the park
- Hero image URL (upload to Media Library first)

The on-property **CRR Canyon Trail** is your unique content. Consider
having someone walk it with a phone app like CalTopo or Gaia and save
the GPS track — that's the one trail no one else can document.

---

## 8 · Populate things-to-do details

60 activities are seeded with one-line summaries. Over time, fill in the
`description` field (HTML) and `hero_image_url` for each, especially the
higher-priority ones (Smith Rock hikes, Cove Palisades, etc.). Activities
with photos and longer descriptions rank better on search.

Tip: this is the ideal work for a writer or for Kendra during slow
office hours — 2 activities a day for a month = done.

---

## 9 · Verify after deploy

Run through this after the first deploy:

- [ ] Visit `/area-guide` — the big map should show pins for trails + things
- [ ] Visit `/trails` — 6 trail cards + map with pins
- [ ] Visit `/things-to-do` — 60 cards with filter buttons
- [ ] Click a filter (e.g. "Families") — cards should filter; URL shows `?filter=families`
- [ ] Visit `/trails/crr-canyon-trail` — detail page renders
- [ ] Visit `/dining` — 5 placeholder cards OR empty state + instructions
  (depends on whether you filled in real place_ids yet)
- [ ] Visit `/park-map` — 109 colored pins spread across the map; click one → modal opens
- [ ] Click "Book this site" on the modal — opens Firefly in a new tab
- [ ] Admin → Area Guide — all 4 tabs load and show data

If the maps don't show (blank area with "Map will appear here"): the
`PUBLIC_GOOGLE_MAPS_API_KEY` env var isn't set. Check Netlify → Environment
variables and trigger a fresh deploy.

If restaurants are missing in /dining: place_ids are still placeholders.
Fill them in per step 3.

---

## Deferred to a future iteration (not blocking this deploy)

- Drag-to-position UI for park-site map positions (currently numeric inputs)
- Dedicated config UI for the park-map background image (currently manual DB row)
- Auto-scheduled Places cache refresh (currently on-demand via admin "Refresh" button or 24-hour lazy refresh on page load)
- Writer-friendly rich-text editor for trail + activity descriptions
  (currently plain textarea that accepts HTML)
- GPX track upload + rendering on trail detail pages (for the on-property
  canyon trail primarily — only use data you recorded yourself, never
  scraped from AllTrails / Strava / Gaia)

---

## TL;DR checklist

Minimum to light up every feature:

- [ ] `npm run db:migrate` (adds the tables + seed data)
- [ ] Create Google Cloud project, enable 3 APIs, create 2 keys
- [ ] Add `PUBLIC_GOOGLE_MAPS_API_KEY` + `GOOGLE_MAPS_SERVER_KEY` to Netlify env vars
- [ ] Replace 5 placeholder `google_place_id` values in admin
- [ ] Click "Refresh" on each place in admin
- [ ] (Later) Replace 109 placeholder park-sites with real data
- [ ] (Later) Upload park map image + set the config URL
- [ ] (Later) Verify + edit trail descriptions, especially difficulty + hazards

Total hands-on time: ~1 hour for the Google Cloud + place_id work. The
content refinement is ongoing and best handled by Kendra or a writer.

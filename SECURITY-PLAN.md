# CRR Website — Security Plan (code/project scope)

> **Scope:** This document covers ONLY code, configuration, schema, and security controls implemented in the website and R&PMS platform itself. Anything operational (insurance, staff training, physical device policy, legal documents, vendor management) is out of scope here and lives in `SECURITY-ANCILLARY-NOTES.md` for reference only.
>
> **Owner:** Mathew Birchard
> **Review cadence:** Semi-annual minimum + after every incident or major deploy
> **Status:** Active plan. Informs every future development session.

---

## 1 · Drivers

Three facts shape every code/architecture choice in this plan:

1. **Phone-first business resilience.** The real business runs on phone, staff, and on-premises ops. The site is a convenience layer. Therefore code is designed so the site can be disconnected at any moment without breaking the business. "Disconnect-as-defense" is a first-class capability.
2. **Ransomware-survivor posture.** The HOA has already survived one catastrophic ransomware attack. Code + schema must be designed so full recovery from a ransomware event is possible from data + systems we control. Immutable offsite data copies are built in.
3. **Secure-by-design, before-the-feature.** Every security control is implemented in code BEFORE the feature that depends on it. Encryption primitive before PMS data. WebAuthn before sensitive admin features. Audit-chain before the first audited action. No retrofitting.

---

## 2 · Code-level defense architecture

Six layers implemented in code/config. Each is a specific deliverable with a specific location in the repo.

### 2.1 Perimeter (edge + headers)
**Location:** `netlify.toml`, `src/middleware.ts`, `public/__forms.html`

- Strict CSP with per-response nonces (no `'unsafe-inline'`, no `'unsafe-eval'`). Monaco/Puck admin loads via nonce. Target: Session N+6.
- HSTS with preload directive + browser preload-list submission.
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (present; reviewed each plan update).
- Subresource Integrity on every third-party `<script>` (Clarity and anything future). Target: Session N+6.
- Honeypot routes in code: `/admin-old`, `/.env`, `/wp-login` — trigger IP ban on touch.
- Tarpit middleware: configurable delay on known-scanner patterns.
- Middleware-level redirect on `/admin/*` for unauthenticated requests (implemented).

### 2.2 Identity & access
**Location:** `src/lib/auth.ts`, `src/lib/rbac.ts`, Supabase Auth config

- WebAuthn/passkey enrollment + enforcement for owner and editor roles. Target: Session N+1.
- Viewer and contributor stay password-only initially; passwords hashed by Supabase (Argon2id) and checked against HIBP pwned-passwords on set.
- ECDSA-signed JWTs (Supabase config, not HS256).
- Short-lived access tokens (15 min) + rotating refresh tokens.
- Capability matrix in `src/lib/rbac.ts` is the sole enforcement surface — endpoints check capabilities, not roles.
- Capability expansion for future PMS/R&PMS roles (staff, accountant, board_member, contractor). Target: Session N+2.
- New-device login detection → forced re-auth on sensitive actions.
- Impossible-travel detection flags session for review.

### 2.3 Application security
**Location:** `src/pages/api/**/*`, `src/lib/puck-sanitize.ts`, `src/pages/api/content/blocks.ts`

- Every API endpoint gated by `requireAuth` or `requireRole` at the top of the handler — or explicitly annotated as public.
- Runtime shape validation on every mutating endpoint (type, size, allow-list). Zod schemas standardized.
- Body-size caps on every mutating endpoint (500KB default, implemented on builder/save).
- HTML sanitization via DOMPurify (replacing current regex sanitizer in Session N+6). Applied on save, not on render.
- URL allow-list validator on every stored URL (`isSafeUrl` in `src/lib/puck-sanitize.ts`).
- Parameterized queries only. No raw SQL from user input.
- JSON-LD output escaped against `</script>` breakout (implemented).

### 2.4 Data protection
**Location:** `src/lib/crypto.ts` (new), schema design in Supabase migrations

- **Application-layer envelope encryption** via `src/lib/crypto.ts`. AES-256-GCM with context as AAD. Target: **Session N** (first priority).
- **Key-ID byte prefix** on ciphertext enables incremental key rotation.
- **Master key in cloud KMS** (AWS KMS or GCP KMS). Migration from env-var master key to KMS in Session N+3.
- **Data classification tags** applied to every sensitive column in migrations (`-- classification: public|internal|confidential|restricted`).
- **Data retention enforcement in code** via scheduled cleanup jobs — runs per classification policy.
- **Data-plane segregation:** Three separate Supabase projects.
  - Project A (current): marketing CMS + audit + runbook.
  - Project B: PMS — employee data, ops docs, training, files. Target: Session N+2 design, N+5 implementation.
  - Project C: Reservations — guest PII, bookings, payment tokens. Target: with R&PMS build.
  - Cross-project access happens via authenticated service-to-service API only. No JOINs cross the boundary. Separate master keys per project.
- **Supabase disk encryption** (automatic AES-256) remains in place as baseline.
- **Private file storage** via Supabase Storage bucket `ops-docs` with RLS. Target: Session N+5.

### 2.5 Backup + recovery (the code components)
**Location:** `scripts/backup-*.mjs`, Netlify scheduled functions or pg_cron

- **Automated daily export** of critical tables to immutable object storage. Target: Session N+4.
- **Weekly full-schema export** with longer retention.
- **Monthly archive** for long-term retention.
- Backup-write credentials stored separately from production credentials. Backup target (Backblaze B2 or S3) uses Object Lock — even the backup writer cannot delete existing backups.
- **Test-restore runner** as a scheduled job: weekly, restores to staging project, verifies row counts + sample integrity.
- **Recovery API endpoint** `/api/incident/restore-from-backup` (owner WebAuthn-gated).
- RTO target: 4 hours. RPO target: 24 hours (daily cadence).

The ops discipline around this — monthly test-restore verification, runbook, etc. — lives in `SECURITY-ANCILLARY-NOTES.md`.

### 2.6 Monitoring, detection, response (the code components)
**Location:** `src/lib/audit.ts`, `src/pages/api/incident/**/*`

- **Hash-chained audit log:** each `audit_log` insert computes `this_hash = SHA256(previous_hash || row_content)`. Stored alongside the row. Tamper-evident from row 1. Target: **Session N** (first priority, alongside crypto.ts).
- **Anomaly scoring job** (scheduled function): scans audit_log + sync_runs for failed-login spikes, geo-jumps, mass reads, off-hours activity. Writes to `anomaly_events` table.
- **AI triage endpoint** `/api/incident/triage`: when scoring threshold exceeded, reads event context + recent logs → calls Claude API → writes plain-English incident summary → pages owner via Twilio/email. Target: Session N+7.
- **One-tap lockdown endpoint** `/api/incident/lockdown`: owner WebAuthn-gated. Flips Netlify to pre-built `maintenance.html` deploy, revokes all Supabase sessions, rotates JWT signing secret + service-role key, rotates Zoho tokens, disables build hook, sets `incident_active` flag. Target: Session N+7.
- **One-tap unlock endpoint** `/api/incident/unlock`: owner WebAuthn-gated. Reverses the above in controlled order after triage is complete.
- **Maintenance mode page** (`public/maintenance.html`): pre-built static page shown during lockdown. Target: Session N+7.
- Logs retained in database ≥7 years for audit/authentication events. Retention enforced by code.

### 2.7 Incident response — code interfaces
**Location:** `src/pages/api/incident/**/*`, `RUNBOOK.md`

Code-level response capabilities exposed as API endpoints, each WebAuthn-gated for the owner:

- `POST /api/incident/lockdown` — full site disconnect (~60 sec total).
- `POST /api/incident/revoke-all-sessions` — kicks everyone out without full disconnect.
- `POST /api/incident/rotate-secrets` — rotates JWT secret, service-role key, integration tokens.
- `POST /api/incident/restore-from-backup` — triggers restore of specified tables from specified backup point.
- `POST /api/incident/unlock` — inverse of lockdown.
- `GET /api/incident/status` — returns current `incident_active` flag + last-incident timestamp.

Each endpoint logs an audit row before acting. Each requires owner WebAuthn re-auth even if session is live.

---

## 3 · R&PMS-specific code requirements

When the R&PMS build starts, these code/architecture commitments hold:

1. **Offline-first staff PWA.** Staff-facing app with service worker + IndexedDB cache. Holds last-known availability + accepts phone-in bookings during lockdown. Replays queue to server when connectivity returns. This is the code component that preserves "disconnect is free" post-R&PMS.
2. **Payment minimization by design.** Tokenized via processor iframe (Stripe Elements or equivalent). Server never sees a PAN. PCI scope stays SAQ-A. This is architectural, not ops.
3. **"Reserve now, pay-link later" during lockdown.** Staff PWA creates reservation immediately; server queues "send payment link" action. Fires when connectivity returns. No PAN capture over phone.
4. **Replay-staging mode on recovery.** When coming out of lockdown, R&PMS boots in staging mode first. Offline-queue replays against staging for verification. Staff confirms. Promotes to live.
5. **Separate Supabase project + separate master key.** Guest PII isolated from marketing + from PMS.
6. **Client-side encryption for high-sensitivity guest fields** (to be scoped when R&PMS schema is designed). Server stores ciphertext only; decryption requires user's password-derived key.

---

## 4 · Implementation roadmap (code sessions only)

Ordered by prerequisite + value. Operational/ops work (device policy, insurance, legal docs) is tracked separately in ancillary notes and is not on this list.

### Session N — Encryption primitive + hash-chained audit log
**Deliverables:**
- `src/lib/crypto.ts` — AES-256-GCM envelope encryption. Master key from env initially. Key-ID prefix.
- Migrate `zoho_tokens` rows to encrypted form.
- Update `src/lib/audit.ts` to hash-chain every new row. Add `previous_hash` + `this_hash` columns via migration.
- Unit tests covering encrypt/decrypt roundtrip and chain-verification.

**Effort:** ~3 hrs. Foundation — everything below depends on this.

### Session N+1 — WebAuthn for owner + editor
**Deliverables:**
- Enrollment UI in admin: "Add passkey" flow.
- Enforcement in Supabase Auth config: WebAuthn required for owner and editor roles.
- Account-recovery flow documented in `RUNBOOK.md` (single-point-of-failure mitigation).

**Effort:** ~4 hrs. Kills credential-phishing as an attack class.

### Session N+2 — RBAC expansion + data-plane boundaries (in code)
**Deliverables:**
- New roles added to `src/lib/rbac.ts`: `staff`, `accountant`, `board_member`, `contractor`.
- New capabilities declared (not implemented): `view_financial_reports`, `edit_training_materials`, etc.
- `src/lib/data-planes.ts` — exports constants + helpers defining which client talks to which Supabase project. Single import boundary; prevents accidental cross-plane JOINs.
- Second Supabase project provisioned (PMS). Schema + migrations initialized.

**Effort:** ~3 hrs.

### Session N+3 — KMS migration
**Deliverables:**
- AWS KMS (or GCP KMS) Customer Master Key created.
- `src/lib/crypto.ts` refactored to use KMS Data Key API (envelope pattern).
- Existing encrypted rows re-encrypted under new scheme; old key retired.
- Key rotation via KMS console documented in `RUNBOOK.md`.

**Effort:** ~3 hrs. Ongoing cost ~$1–3/month.

### Session N+4 — Immutable backup pipeline
**Deliverables:**
- `scripts/backup-daily.mjs` — exports critical tables, writes to Backblaze B2 / S3 with Object Lock.
- `scripts/backup-weekly.mjs` — full schema + data export.
- Scheduled via pg_cron or Netlify scheduled functions.
- `scripts/restore-verify.mjs` — restores a specified backup to staging project, compares row counts + sample integrity, writes result to `restore_tests` table.
- Backup-write IAM role with NO delete permissions.

**Effort:** ~4 hrs. This is the ransomware-recovery code.

### Session N+5 — Private file storage + crypto for PMS
**Deliverables:**
- Supabase Storage bucket `ops-docs` with RLS (authenticated staff+ read, editor+ write).
- `src/lib/storage.ts` — `uploadOpsDoc()`, `signedDownloadUrl(path, ttl)`.
- Optional client-side encryption helper for very-sensitive uploads.
- Audit-log hooks on every upload/download.

**Effort:** ~3 hrs.

### Session N+6 — DOMPurify + CSP nonces + SRI
**Deliverables:**
- Replace regex `sanitizeRichHtml` with `isomorphic-dompurify` in `src/lib/puck-sanitize.ts` and `src/pages/api/content/blocks.ts`.
- Re-run pen-test sanitizer bypass suite; verify all pass.
- CSP nonce middleware generates per-request nonce; all inline `<script>` + `<style>` tags in Astro/React output carry the nonce. Drop `'unsafe-inline'` + `'unsafe-eval'` from `netlify.toml` CSP.
- Add SRI hashes to Clarity script tag (the only current third-party).

**Effort:** ~4 hrs.

### Session N+7 — Lockdown + anomaly + triage
**Deliverables:**
- `public/maintenance.html` (pre-built static page for lockdown).
- `src/pages/api/incident/lockdown.ts` — WebAuthn-gated. Full disconnect sequence.
- `src/pages/api/incident/unlock.ts` — inverse.
- `src/pages/api/incident/triage.ts` — pulls suspicious session context, calls Claude, pages owner.
- Scheduled anomaly scorer: `scripts/anomaly-scan.mjs` or Supabase scheduled function.
- Twilio / email notification integration.

**Effort:** ~6 hrs across one or two sessions.

### Session N+8 — First R&PMS feature (validation session)
**Deliverables:**
- Build ONE real PMS feature (proposed: ops-doc file upload) on top of everything above.
- Verify encryption, audit-chain, RBAC, private storage, backup inclusion all work end-to-end.
- Pen-test the new feature before merging.

**Effort:** ~4 hrs.

From that point forward, every subsequent R&PMS feature follows the same pattern: declare capability, pick data plane, use existing crypto/storage/audit primitives, ship.

---

## 5 · Ongoing code-level cadence

| Activity | Frequency | Automation |
|---|---|---|
| Dep + CVE scan | Weekly | Dependabot PRs |
| Anomaly scorer | Continuous | Scheduled function |
| Test restore | Weekly | `scripts/restore-verify.mjs` |
| Key rotation | Quarterly | KMS schedule |
| Pen-test sweep | Quarterly | Claude-assisted, scripted |
| Sanitizer regression suite | Each deploy | CI |
| Security plan review | Semi-annual | Manual |

Operational/admin cadences (tabletop exercises, vendor reviews, insurance renewals, etc.) are tracked in ancillary notes, not here.

---

## 6 · Framework alignment (code-relevant portions)

- **NIST CSF 2.0:** Protect (§2.1–2.4), Detect (§2.6), Respond (§2.7) — all code-implemented. Govern/Identify/Recover have code components (inventory via schema, audit trail, restore endpoints) plus ops components tracked elsewhere.
- **CIS Controls v8:** Data Protection (#3), Secure Configuration (#4), Account Management (#5), Access Control (#6), Audit Log Management (#8), Data Recovery (#11), Incident Response (#17), Application Software Security (#16), Penetration Testing (#18) — all code-implemented. Remainder (#1 asset inventory, #14 awareness training, #15 service providers, etc.) are ops.
- **OWASP ASVS Level 2:** target for code controls. Level 3 deferred until post-R&PMS if pursued.
- **NIST Zero Trust (SP 800-207):** Verify every request (auth), least privilege (RBAC capabilities), assume breach (lockdown + backup + segregation), continuous verification (re-auth on sensitive actions) — all code-implemented.

---

## 7 · Context this plan inherits (for future Claude threads)

### The vision (owner)

> R&PMS launch within 12 months. In-house, full-suite, competing with Firefly/Staylist. Sensitive data pre-that (PMS features: employee data, ops docs, reporting, training). Guests should know their data is as secure as possible. Board + admin should be able to use the system with more confidence than they've ever had.

### The history

HOA survived one catastrophic ransomware attack. Refused the $80k ransom. Lost years of systems. This is why backup + recovery lead this plan.

### The philosophy (owner-originated)

- **Disconnect as defense.** The site is a convenience layer. Phone + staff is the business. Lockdown costs ~zero and brand-positively positions security diligence to guests who call in.
- **Secure-by-design, before-the-feature.** Every control goes in before the thing that needs it.
- **Offline-first staff ops.** Staff PWA keeps the park booking phone-in guests even during lockdown. No R&PMS feature is acceptable if it breaks this property.

### What code explicitly does NOT do

- No "hack back" / counter-attack code. CFAA, illegal, not our business.
- No security-through-obscurity. Plan is documented.
- No availability-above-all. Disconnect is always a live option.
- No compliance certifications pursued in code unless a buyer demands them.

---

## 8 · Next action

**Begin Session N.** Build `src/lib/crypto.ts` + hash-chained audit log. Everything in the roadmap above depends on it. All R&PMS feature work is blocked on Sessions N through N+8 being complete.

Signed,
Mathew Birchard (owner)

Plan prepared by Claude, 2026-04-17. Supersedes prior security guidance.

---

*Related code/project files: `SECURITY-AND-BUGS-REPORT.md`, `PEN-TEST-REPORT.md`, `PATCHES-APPLIED.md`, `HANDOFF-V1-TO-NEW-THREAD.md`, `PROJECT-DETAILS.md`. Non-project reference: `SECURITY-ANCILLARY-NOTES.md`.*

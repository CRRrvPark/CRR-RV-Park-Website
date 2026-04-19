# CRR — Security Ancillary Notes (owner/admin reference)

> **This is NOT a development roadmap.** Nothing in this document is a task for Claude, a sprint item, or a code deliverable. These are operational, business, legal, and physical-security considerations that exist outside the website's codebase but that may inform how it gets used, deployed, or extended over time.
>
> Treat this as a reference file. Read on plan-review cycles. Call its items to admin attention when relevant. Do not let it displace code priorities.
>
> **For code/website security, see `SECURITY-PLAN.md`.**

---

## Purpose

The code-level security plan does not stand alone. A hardened website in the hands of a staff member using a compromised laptop, or hosted by a vendor with a lax security posture, or unprotected by cyber insurance when a breach happens anyway, is a website whose technical security does not cash out into real protection of the business.

These notes enumerate the non-code factors that complement the code plan. Each item is a separate domain of responsibility — typically owner or admin-level decision-making, vendor negotiations, purchase decisions, or HR policy. None of it is something to ask Claude to implement.

---

## 1 · Cyber liability insurance (admin action)

At ~$500–600k revenue with a history of a $80k ransomware event, cyber insurance is operationally essential and financially trivial.

**Target coverage:**
- $1M primary with $500k sublimit for ransomware extortion
- First-party: business interruption, data recovery, forensic investigation, legal/notification costs
- Third-party: guest lawsuits, regulatory fine coverage where insurable
- Riders: ransomware response, BEC/wire-fraud, social engineering

**Expected premium:** ~$2,000–3,500/year at CRR's profile.

**Providers to quote:** Coalition, At-Bay, Chubb, Travelers.

**Renewal cadence:** Annually. Shop at each renewal; premiums drift quickly in this market.

**Do not pursue until:** After initial PMS features land, since insurers will want to see the security posture. The code plan provides most answers to the security questionnaire.

---

## 2 · Endpoint + device security (admin action, affects all admin users)

The code-level security assumes admin devices are themselves secure. If an admin laptop is stolen unlocked, or infected with keylogger malware via a phishing email attachment, the encryption and WebAuthn are bypassed at the endpoint.

**Required controls on every admin device:**
- Full-disk encryption (BitLocker on Windows, FileVault on macOS) — verify and document
- Endpoint Detection & Response (EDR) installed and running: Microsoft Defender for Business ($3/user/month) or Sentinel One (~$5–7/user/month)
- Screen-lock auto-activates after 10 min idle; password/biometric to unlock
- Phishing-resistant MFA via YubiKey 5 NFC (~$55 each) — issue primary + backup (in safe-deposit box) per admin
- OS + browser auto-updates enforced
- Separate user account for admin work vs. personal browsing (reduces cross-contamination surface)

**Optional (when headcount > 5):** MDM enrollment (Microsoft Intune or Jamf) for centralized policy enforcement.

**Home office considerations:**
- Locking storage for hardware keys + recovery codes
- No shared devices with family members
- Separate wifi SSID / guest network for non-admin traffic if possible

---

## 3 · Staff training + awareness (ongoing ops)

Code can't stop a staff member from giving an attacker their WebAuthn-unlocked laptop over the phone. Human factors matter.

**Annual minimums:**
- Phishing awareness training (short, ~30 min, services like KnowBe4 or free NIST materials)
- Incident response tabletop exercise (what do you do if the site disconnects autonomously at 2am)
- Password-manager usage (1Password, Bitwarden) — mandatory for anyone with admin access
- Social engineering recognition (the "IT support" / "vendor" phone-call variety)

**At each new hire with admin access:**
- Security onboarding walkthrough
- Acceptable-use policy signed
- Hardware key issued
- First incident tabletop within 30 days

**Tabletop cadence:** Quarterly, scenarios rotated. Examples: "site disconnects at 2am, what do you do?" / "a guest calls saying we sent them a strange invoice, what do you do?" / "an ex-employee's account is still active 60 days after departure, what do you do?"

---

## 4 · Third-party vendor management (ops, annual review)

Every vendor in the stack is a trust extension. Current vendors + status:

| Vendor | Holds what | SOC 2 / equiv | DPA on file | Notes |
|---|---|---|---|---|
| Supabase | DB, auth, storage | SOC 2 Type II | Available, execute | Reviewed annually |
| Netlify | Hosting, functions | SOC 2 Type II | Available, execute | Reviewed annually |
| Zoho | Media + calendar source | ISO 27001 + SOC 2 | Available, execute | Reviewed annually |
| Microsoft Clarity | Analytics | Microsoft umbrella | N/A (product DPA) | Reviewed annually |
| Firefly Reservations | Bookings (external) | TBD — request | Need to execute | Request at next renewal |
| Future payment processor | Card tokens | PCI Level 1 required | Required | Select with this criterion |

**Annual review (every January):**
- Pull latest SOC 2 report for each vendor
- Check trade press for reported breaches at each vendor
- Review sub-processor disclosures for any new entities
- Replace any vendor with unresolved security concerns

**New vendor onboarding checklist:**
- [ ] SOC 2 Type II available?
- [ ] Data Processing Agreement available?
- [ ] Breach notification SLA acceptable (<72 hrs)?
- [ ] Data residency acceptable for compliance (US-based if CCPA matters)?
- [ ] Encryption at rest + in transit?
- [ ] Deletion / termination procedure documented?
- [ ] Sub-processor list reviewed?

---

## 5 · Legal + compliance (ops, counsel engagement)

These are legal/regulatory items that impact site operation but are not code deliverables. Counsel engagement required for most.

**Current obligations (today):**
- Oregon SB 684 (Oregon Consumer Privacy Act) — applies to staff data; privacy policy updates needed
- CCPA/CPRA — any CA resident who books → obligations attach
- ADA Title III website accessibility — WCAG 2.1 AA is de-facto standard

**Obligations that attach with PMS:**
- Employee data handling under Oregon ORS 659A
- 1099 contractor data (tax IDs treated as SSN-equivalent)
- 7-year financial record retention (IRS)
- 3-year HR record retention (Oregon)

**Obligations that attach with R&PMS + payments:**
- PCI-DSS SAQ-A (keep scope minimized by never touching a PAN)
- Breach notification statutes (most restrictive among Oregon, CA, any other resident states where applicable)
- GDPR if ever marketing to EU residents

**Documents to produce/update (counsel-reviewed):**
- Privacy Policy (legal review before R&PMS launch)
- Terms of Use (legal review before R&PMS launch)
- Data Processing Agreement template for vendors
- Data retention schedule by classification
- Cookie consent banner (Cookiebot, Osano, Iubenda — all have free tiers)
- Accessibility statement
- Acceptable Use Policy for staff
- Incident Response Policy (the code-level lockdown flow is one input; the full org policy lives here)

**Budget estimate:** ~$1,500–3,000 one-time for counsel review of privacy policy + ToS. Annual refresh ~$500.

---

## 6 · Backup + recovery — operational discipline

The code plan builds automated immutable backups (Session N+4). The ops side is:

- **Monthly test-restore verification:** Results logged in runbook. If a restore test fails, treat as P0 until resolved.
- **Quarterly recovery drill:** Simulate a ransomware event on staging. Measure actual RTO. Document what broke.
- **Annual full-disaster drill:** As if production were encrypted. Walk the full recovery sequence end-to-end with a stopwatch.
- **Backup credentials stored in a physically separate vault** from production credentials. Password manager with a different master + hardware key.
- **Recovery runbook kept current:** Who has what keys, what order to bring systems back, how to communicate with guests/staff during recovery.

**RTO/RPO targets** (reiterated from code plan):
- RTO: 4 hours
- RPO: 24 hours

---

## 7 · Key management operations

Code plan builds the key infrastructure (Session N, then KMS migration in N+3). Ops side is:

- **Key ceremony documented:** How master key is initially generated, by whom, with witnesses.
- **Key escrow via Shamir's Secret Sharing** (3-of-5): shares distributed among owners + safe-deposit box share.
- **Rotation schedule:** Quarterly + immediately on staff turnover + immediately on suspected compromise.
- **Rotation runbook:** Step-by-step, human-executable procedure in `RUNBOOK.md`.
- **"What if owner is incapacitated" procedure:** Second owner can recover with the shares. Documented.
- **Audit of KMS access:** Who at KMS provider could theoretically access our keys? (Answer: no one, with Customer Managed Keys — but documented.)

---

## 8 · Physical security

Small-business-scale; not a server-room problem, but not zero either:

- Admin workstations never left logged-in and unattended in public spaces
- Home-office doors lockable where practical
- Hardware keys + recovery codes in locked storage when not in use
- Office / on-premises WiFi separated from guest WiFi (SSID minimum, VLAN if network is managed)
- Printed/paper records (reservations, check-ins) shredded when no longer needed
- Visitor policy for any physical access to HOA administrative space

---

## 9 · Incident response — ops side

The code plan implements the one-tap lockdown and the notification integration. The ops side:

**Who gets called at 3am:**
- Primary: owner (Mathew)
- Backup: [TO BE DESIGNATED — document second owner + contact method]
- Escalation: external IR firm on retainer (relationship established BEFORE incident) — budget for retainer or identify pay-as-you-go firm

**Notification obligations:**
- Oregon SB 684: affected residents "without unreasonable delay"
- CCPA: 45 days if CA residents
- GDPR: 72 hours to supervisory authority if EU residents
- PCI-DSS: immediate to card brand + processor if cardholder data touched
- Cyber insurer: immediate per policy terms
- Counsel: immediate

**Communications templates (drafted in advance, refined by counsel):**
- Guest notification letter
- Internal staff notification
- Vendor notification (if their system was the entry point)
- Regulator notification letters per applicable regime
- Public statement (if needed)

**Post-incident:**
- Root cause analysis
- Runbook updates
- Tabletop exercise to verify learnings absorbed
- Insurance claim documentation
- Any required regulator follow-ups

---

## 10 · Review cadence (ops)

Separate from the code-level review cadence:

| Activity | Frequency |
|---|---|
| Backup restore verification | Monthly |
| Vendor security review | Annual |
| Insurance renewal review | Annual |
| Counsel review of privacy/ToS/retention | Annual |
| Tabletop exercise | Quarterly |
| Full disaster-recovery drill | Annual |
| Staff security training | Annual per staff, plus onboarding |
| Endpoint inventory + policy audit | Semi-annual |
| Physical security walk-through | Annual |
| This document (review + update) | Semi-annual |

---

## 11 · Conversation context (background)

Captured so any future admin or successor reading this file understands why decisions were made:

**Owner's vision:** In-house R&PMS launching within 12 months that rivals Firefly/Staylist. Current site is the foundation. Sensitive PMS features (employee data, ops docs, reporting, training) land in the months between now and R&PMS launch. Guest promise: your data is as secure as it can be. Staff promise: you can use this with more confidence than you've ever had.

**HOA history:** Already survived one catastrophic ransomware attack. Refused $80k ransom. Lost years of systems. This shapes everything — backup/recovery is the hill to die on.

**Philosophy established in design conversations:**
- *Disconnect as defense:* site is convenience, phone + staff is the business. Lockdown is free and brand-positive.
- *Secure-by-design before features:* every control in place before the feature that needs it.
- *Offline-first staff ops:* staff PWA keeps the business running even during site lockdown. Every R&PMS feature respects this property.

**Threats we do not design against:**
- Nation-state / DoD-level adversaries: not realistic for the business. Acknowledged intellectually but not a primary driver.
- Hack-back / counter-attack: illegal (CFAA), not our business.

**Trust relationships being built:**
- Guests should feel their data is protected; the "site down for security review" experience is converted into a trust-building phone conversation, not a negative.
- Board + admins should feel more confident in the system than they've ever been — both because of its capability and its resilience.

---

## 12 · What lives where

- `SECURITY-PLAN.md` — code, architecture, controls implemented in the repo.
- `SECURITY-ANCILLARY-NOTES.md` (this file) — everything non-code. Reference, not roadmap.
- `SECURITY-AND-BUGS-REPORT.md` — static audit findings.
- `PEN-TEST-REPORT.md` — adversarial testing findings + PoCs.
- `PATCHES-APPLIED.md` — running log of code fixes.
- `RUNBOOK.md` — operational procedures (key rotation, recovery, incident response).
- `HANDOFF-V1-TO-NEW-THREAD.md` — platform handoff for future Claude threads.
- `PROJECT-DETAILS.md` — architecture reference.

---

*End of ancillary notes. Update on semi-annual review cycle or when any significant ops change occurs.*

# Around You — Rep Commissions, Billing & Reps Analytics — Design Spec

**Status:** design draft for approval (no code yet). Drafted 2026-08-11, grounded in the current schema (`users` with `Rep` role, partner tables with rep code / tier / audience, existing `bookings`, `RepActivityReport`). Money logic — every rule below should be signed off before we build.

Currency is **ZAR (R)**. Region: South Africa.

---

## 1. Confirmed business rules

### 1.1 Partner pricing (monthly)

| Plan | Audience | Monthly price |
|---|---|---|
| Tier 1 | Guest-only or Local-only | **Free (R0)** |
| Tier 2 | Guest-only or Local-only | **R100** |
| Tier 3 | Guest-only or Local-only | **R200** |
| Tier 4 | Guest-only or Local-only | **R300** |
| Tier 4 (forced) | **Both** Guests + Locals | **R450** |
| Booking plan | any | **R200/month + 10% of every booking** |

Rules: choosing audience **Both** auto-selects Tier 4 and bills **R450** (not R300). A partner is on **either** a Tier subscription **or** the Booking plan — not both.

### 1.2 Commission model

- Every rep (including Team Leaders) earns **30% of their own sales** — i.e. 30% of the **full amount each partner they signed pays that month**. For a Tier partner that's the tier fee; for a **Booking-plan** partner that's the whole R200 + 10%-of-bookings they're billed.
- A **Team Leader** earns an **additional 10%** of that same full monthly amount from partners signed by the reps **directly** under them (one level down).
- **Recurring monthly** (confirmed): commission recurs every month for as long as the partner keeps paying, which produces the "accumulating" / compounding effect in your example. Tier 1 (Free) generates **R0** commission.

### 1.3 Worked example (your scenario)

A Team Leader signs 10 partners in Month 1, then 5 more in Month 2 (say all Tier 3 @ R200).

- **Month 1:** own commission = 30% × (10 × R200) = **R600**.
- **Month 2:** the first 10 are still active + 5 new = 15 partners → own commission = 30% × (15 × R200) = **R900**. (This is the "compounding" — it grows because earlier partners keep paying, not because the rate changes.)
- If reps under this Team Leader also sold partners, the Team Leader additionally earns 10% of those reps' partner fees each month.

---

## 2. Data model (new)

Grounded in existing tables; all new tables get RLS enabled per the repo gotcha (accessed only via the Go API).

**`rep_hierarchy`** — the multi-level structure (today `users` has reps but no upline).
`rep_code` (FK → users.rep_code), `upline_rep_code` (nullable; the Team Leader above), `is_team_leader` bool, `region`, `province`, `status` ('Active'/'Inactive'), `date_joined`.
*Alternative:* add `upline_rep_code` + `is_team_leader` columns directly to `users`. Recommended if a rep only ever has one upline.

**`partner_subscription`** — one active billing arrangement per partner.
`id`, `partner_type` ('accommodation'|'restaurant'|'service'|'attraction'), `partner_id`, `plan` ('tier'|'booking'), `tier` (1–4, null for booking), `audience` ('Guest'|'Local'|'Both'), `monthly_price`, `rep_code`, `status` ('Active'|'Paused'|'Cancelled'), `auto_renew` bool, `started_at`, `next_bill_date`, `cancelled_at`.

**`invoice`** — one per partner per billing period.
`id`, `invoice_number` (sequential, e.g. `AY-2026-000123`), `partner_type`, `partner_id`, `subscription_id`, `period_start`, `period_end`, `subtotal`, `vat_amount` (0 until Around You is VAT-registered — column kept so VAT can switch on later), `total`, `status` ('Issued'|'Paid'|'Overdue'|'Void'), `issued_at`, `due_at`, `paid_at`, `pdf_url`. Snapshots the Official-Use billing details (holding company, name, address, contact, reg no, VAT no, country/province/postal, tier, rep name/code) so invoices stay correct even if the partner record changes later.

**`invoice_line_item`** — `invoice_id`, `description`, `qty`, `unit_price`, `line_total` (subscription fee line; booking-commission line; etc.).

**`commission`** — the ledger reps get paid from.
`id`, `rep_code`, `type` ('own'|'override'|'booking'), `source_partner_type`, `source_partner_id`, `source_rep_code` (for override: the downline rep), `invoice_id` (or booking_id), `period`, `base_amount`, `rate`, `amount`, `status` ('Accrued'|'Paid'), `created_at`.

**Bookings** already exist → booking commission is derived into the `commission` ledger (no new booking table).

---

## 3. Resolved decisions

1. **Accounting = Option A (in-app).** Invoices are generated inside Around You as PDFs and emailed via the existing **Resend** mailer. No external accounting product. Commission logic lives in the app (no tool does multi-level commissions anyway).
2. **VAT = none for now.** Around You is **not VAT-registered yet**, so invoices carry **no VAT** (`vat_amount = 0`, no VAT line). Prices in §1.1 are the full amount charged. **Revisit when Around You registers for VAT** (SA 15%): invoices will then need Around You's VAT number and a VAT breakdown.
3. **Commission base = full monthly amount the partner pays.** 30% (own) and 10% (Team-Leader override) are both calculated on the **total** a partner is billed that month — the tier fee, or for Booking partners the R200 + 10%-of-bookings combined.
4. **Recurring monthly** — commissions recur every month while the partner stays active (not one-time).
5. **Tier 1 (Free) partners** — still get a subscription record and an R0 invoice, for history/analytics.
6. **Payout timing** — commissions Accrue through the month and are marked Paid on a monthly payout run ("calculated and paid monthly").

*Still worth confirming later, not blockers:* exact SARS-compliant invoice fields to include now (even pre-VAT), and whether Booking partners also receive a monthly invoice for the variable 10% booking portion or a separate booking statement.

---

## 4. Billing workflow

1. **On onboarding** (Rep Onboarding app *or* Admin Dashboard): create a `partner_subscription` from the Official-Use + tier/audience data, and issue the **first `invoice`** immediately (email PDF to the partner). Record the rep's `commission` accrual for the period.
2. **Monthly billing run** (auto-billing / auto-renewal): for every `Active` subscription whose `next_bill_date` ≤ today, generate the next `invoice`, advance `next_bill_date` by one month, email the PDF, and accrue commissions (own 30% + Team-Leader 10% override; plus booking commissions for the month).
3. **Monthly statements:** per partner (invoice history) and per rep (commission statement). Emailed and available in the dashboard.
4. **Scheduling on your stack (Go + Fly + Supabase):** expose an admin-only `POST /billing/run` endpoint (idempotent per period — never double-bills), triggered on the 1st of each month by an external scheduler. Recommended: a **GitHub Actions scheduled workflow** (or a Fly scheduled machine / Supabase `pg_cron`) calling that endpoint. Idempotency via a unique `(subscription_id, period_start)` constraint on `invoice`.

---

## 5. Commission engine (rules)

For each billing period, per partner with an active subscription, first compute the **full amount the partner is billed**:

```
partner_monthly_total = tier_fee                                   (Tier plan: R0/100/200/300, or R450 for Both)
                      = 200 + 0.10 × bookings_total_for_period     (Booking plan)

own_commission      = 0.30 × partner_monthly_total   -> rep_code (the signing rep)
teamleader_override = 0.10 × partner_monthly_total   -> upline_rep_code, if the signing rep has one
```

- Tier 1 (Free): `partner_monthly_total = 0`, so both commissions are R0.
- Commission is on the **full amount the partner pays** (confirmed) — for Booking partners that includes the 10%-of-bookings portion, so a booking-driven month raises both the invoice and the rep's commission automatically.
- Each accrual is one `commission` row (`type` = own / override), traceable to a partner, period, and invoice.
- "Accumulating monthly" is automatic: every active subscription bills every month, so commissions recur every month.

---

## 6. Reps Analytics — metric → source

Each requested metric maps to the new tables (dashboard section: Admin → Analytics → **Reps**):

- **Totals / hierarchy:** Total Active Reps, Total Team Leaders, Rep→Team Leader→Upline tree — from `rep_hierarchy` / `users`.
- **Rep profile:** name, code, status, date joined, region/province — `rep_hierarchy`.
- **Sales & onboarding:** total partners signed, per month, by tier, by partner type, conversion rate (submissions→onboardings) — from `partner_subscription` + onboarding submissions.
- **Commission tracking:** monthly earned, per partner, by tier, by audience, TL 30%/10% splits, downline count/sales/commission — from `commission` + `rep_hierarchy`.
- **Recurring revenue & billing:** auto-billing status, auto-renewal dates, MRR by rep, outstanding invoices, invoice history per partner — from `partner_subscription` + `invoice`.
- **Booking commission:** total bookings by a rep's partners, commission earned, monthly booking commission — `bookings` + `commission (type=booking)`.
- **Performance insights:** MoM growth, best reps / team leaders, top downlines, leaderboards — aggregations over the above.
- **Compliance & activity:** last login (`sessions`), last submission (`partner_subscription.started_at`), activity score (derived).

---

## 7. Proposed build phases

**Status (2026-08-11): Phases 1–5 built and being deployed. Phases 6–7 remain.**


1. **Rep hierarchy** — upline/Team-Leader structure + admin UI to assign it.
2. **Subscriptions + pricing** — create `partner_subscription` on onboarding (Rep app + Admin), with the pricing rules.
3. **Invoicing** — invoice generation, numbering, VAT, PDF (via the pdf skill) + Resend email, first invoice on signup.
4. **Monthly billing run** — the scheduled auto-bill/auto-renew job + idempotency.
5. **Commission engine** — own 30% + TL 10% override + booking commission, as a per-period accrual.
6. **Reps Analytics dashboard** — the full section in §6.
7. **Statements** — monthly partner + rep statements.

---

## 8. Integration notes / gotchas

- Reps currently live in `users` (role `Rep`, `rep_code`, `full_name`); no upline column exists — Phase 1 adds it.
- Partner tables already store `rep_code`, tier, and audience — the subscription is derived from these at onboarding.
- Every new table must enable + force RLS and revoke anon/authenticated (per the repo's RLS gotcha), since all access is via the Go API.
- Keep money math in integer cents (or `numeric`) to avoid floating-point rounding on invoices/commissions.

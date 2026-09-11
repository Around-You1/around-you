# Around You — Project Handoff

This document brings a new chat/session fully up to speed on the **Around You** app: what it is, how it's built, the exact deploy workflow, the business/pricing rules, everything changed recently, and what's still outstanding. Attach or paste this at the start of a new chat.

---

## 0. First thing to do in a new chat (READ ME)

Ask the assistant to request **full access to all folders and files** in the project so it can read and edit them directly (that's how all the recent work was done):

> "Please request access to my `D:\1au` folder (and the Around You Architecture knowledge) so you can read and edit the files directly."

In Cowork, grant/select the **`D:\1au`** folder when prompted. Once the assistant has folder access it can use Read/Write/Edit on the real files, run `tsc`, regenerate the PDFs, etc. Without it, it can only work in a temporary scratch space.

**Hard rule for this project:** we use **Supabase only — never Encore** for any coding or data. (The Go backend module is *named* `backend_encore` for historical reasons, but Encore is not used; see §3.)

---

## 1. What the app is

**Around You** is a location-based directory + booking platform for South African tourism/local businesses ("partners"). Two audiences:
- **Guests** — holiday visitors staying at an accommodation; see partners near that accommodation.
- **Locals** ("LocalGuest" role) — signed-in residents; see partners in their area (up to ~150 km).

Partner categories: **Accommodations, Restaurants, Services, Attractions, Real Estate & Rentals** (estate agencies + standalone agents + property listings).

There is also a **Rep** system: field reps onboard partners and earn commission; **Team Leaders** have downline reps. Plus **Accountant** and **SuperAdmin** roles.

- Production frontend: **https://aroundyou.co.za**
- Live domain also serves generated PDFs at `https://aroundyou.co.za/onboarding/<name>.pdf`

---

## 2. Tech stack & hosting

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js 14 (React, TypeScript, Tailwind, shadcn/ui) | **Vercel** (auto-deploys on push to `main`) |
| Backend | Go `net/http` (module `backend_encore`) via `lib/pq` | **Fly.io** app `around-you-backend` (deploys via **GitHub Actions "Fly Deploy"** on push) |
| Database | **Supabase** Postgres | Supabase |

Repo lives locally at **`D:\1au`** (Windows). Subfolders:
- `D:\1au\frontend` — Next.js app (`components/`, `lib/`, `app/`, `backend/` = thin client, `scripts/` = PDF generators, `public/onboarding/` = generated PDFs).
- `D:\1au\backend` — Go backend (`app/<domain>/`, `internal/`, `store/`, `migrations/`, `cmd/server/main.go`).

---

## 3. Backend architecture intricacies (important)

- **`//encore:api` comments are decorative** — Encore is NOT used. The real HTTP routes are registered in **`backend/cmd/server/main.go`** using helpers `r.public(...)`, `r.login(...)`, `r.auth(...)` with request wrappers `httpx.Body(...)`, `httpx.Query(...)`, `httpx.Empty(...)`. When you add a handler, you MUST also wire it in `main.go`.
- **Migrations:** `backend/migrations/000NNN_*.sql`, applied automatically on backend startup in filename order. Each is guarded (`add column if not exists ... default ...`). To add schema, add the next-numbered migration file; it runs on the next Fly deploy.
- **Stores:** `backend/store/*_store.go` hold the SQL. When adding a column, update the column list, the `scan*` function (in the same order), the INSERT ($N placeholders), and the `*Patch` SET clauses — keep ordering aligned or scans break.
- **Data model values are NOT the same as display labels** (see §6). `accessLevel` is stored as `"Tier 1"` / `"Tier 2"` / `"Booking"`; `guestType` as `"Guest Only"` / `"Local"` / `"Both"`.
- **Email:** `mailer.Send` always writes an `email_log` row (status `sent`/`skipped`/`error`) — use that table to diagnose "email not received".
- **Frontend ↔ backend:** the frontend calls a thin generated-ish client at `frontend/backend/client.ts` (default export `backend`, methods typed loosely). New endpoints need a method there + types.

---

## 4. Deploy workflow — EXACTLY how we ship

The assistant edits files under `D:\1au`. **You** (the user) then commit & push from **Windows PowerShell**. Paste these into PowerShell (from the repo root):

```powershell
cd D:\1au
git add -A
git commit -m "Your message here"
git push
```

### Which push triggers which deploy
- **Any change under `D:\1au\frontend`** → **Vercel** auto-builds and deploys the site (aroundyou.co.za). Watch the Vercel dashboard for the deployment to go green.
- **Any change under `D:\1au\backend`** → **GitHub Actions → "Fly Deploy"** builds and deploys the Go backend to Fly (`around-you-backend`). Watch the Actions tab for the "Fly Deploy" run to go green.
- A commit that touches both deploys both.

### Verifying a deploy actually happened (do this when "it's not working")
1. Confirm the commit reached GitHub:
   ```powershell
   git ls-remote origin -h refs/heads/main
   ```
   The hash should match your latest local commit (`git rev-parse HEAD`).
2. Confirm the platform finished:
   - Backend: GitHub **Actions → Fly Deploy** run for that commit is **green**.
   - Frontend: **Vercel** deployment for that commit is **Ready**.
3. **Hard refresh** the browser: **Ctrl+F5** (Vercel/CDN caching often makes it look like nothing changed).

> Deploys can lag a few minutes. Most "the change didn't work" reports in this project were just deploy lag or a not-yet-green Fly deploy — verify before re-editing.

### Git lock error fix (Windows)
If `git add`/`commit` fails with `index.lock`/`HEAD.lock` "File exists", run in PowerShell then retry:
```powershell
Remove-Item -Force D:\1au\.git\index.lock
Remove-Item -Force D:\1au\.git\HEAD.lock
```

---

## 5. Verification before shipping

- **Frontend:** the assistant runs `npx tsc --noEmit` in `frontend` — must pass (EXIT 0) before you push.
- **Backend (Go):** the assistant's sandbox **cannot compile Go** (no toolchain, no network to fetch it). So after any backend `.go` change, **you should run `go build ./...` in `D:\1au\backend` locally** before pushing (or accept that the Fly deploy will surface a compile error). Changes are usually small/mechanical, but a local build is the safety net.
- **PDFs:** regenerated with Python (see §8).

---

## 6. Pricing & business rules (current, authoritative)

**Display labels vs stored values:** the app shows **"Basic"** and **"Premium"**, but the database still stores `"Tier 1"` and `"Tier 2"` as `accessLevel`. The rename was **labels only** — never change the stored values or billing/pricing logic (`pricing.go tierNumber`, migrations, `accessLevel` comparisons) or existing data and invoices break.

| Plan (label) | Stored accessLevel | Audience | Monthly | Usage |
|---|---|---|---|---|
| **Basic** | `Tier 1` | Guest only *or* Local only | **R200** | — |
| **Premium** | `Tier 2` | Guest only *or* Local only | **R300** | — |
| **Premium** | `Tier 2` | Both | **R400** | — |
| **Booking** | `Booking` | Both (auto) | **R300** base | Restaurants R10/cover · Services 10%/service · Attractions 10%/person |
| **Pre-Orders** (restaurants) | `Booking` under the hood | chosen audience | **R300** base | **5%** of each pre-order |

Other rules:
- "Both" audience is always Premium (R400); you can't pick Basic with Both.
- **Commission:** signing rep earns **25%** of what the partner pays each month; a **Team Leader** (upline) earns an extra **10%** override on each downline rep's sales. (`backend/internal/billing/commission.go`, rate_bps 2500 / 1000.)
- **Pre-orders** = 5% (confirmed). Stored as `bookings` rows with `party_size = 0` (that's how they're distinguished from table bookings in the ledger), commission = 5% of total; this flows into monthly billing, the accountant ledger, and rep commission automatically.
- **Collection/Delivery:** a restaurant sets Dine-in / Takeaway / Delivery. Pre-orders only appear (and guests can only pick a fulfilment) that the restaurant actually offers. All three surfaces respect this (rep app, admin form, guest page).
- **Free vs billable rep codes:** rep code **`Rep00000001`** is the internal/test rep → gets a **complimentary onboarding email** (access/edit codes + QR) on activation but is **NOT invoiced / not recurring-billed**. A **blank** rep code is still **billable** (only `Rep00000001` / `TEST_REP_CODES` are treated as free). Never make blank default to free.
- **Activation fires billing:** flipping a partner's **row Active toggle** in Admin routes through `admin.bulkSetActive` → enables codes + `billing.OnPartnerActivated` (issues first invoice, or complimentary email for the test rep). Editing via the Edit form uses a plain update and does NOT fire billing — use the row toggle to trigger invoices/emails.

---

## 7. What we changed recently (this + prior sessions)

**Pre-Orders feature (restaurants, takeaway/delivery):**
- Guest form `RestaurantPreOrder.tsx` (gated on Takeaway/Delivery; "Preferred date"/"Preferred time" labels; stacks on mobile).
- Backend `app/preorder/preorder.go` — validates items, emails the restaurant's Bookings email, **and stores a `bookings` row** (5% commission, `party_size=0`).
- Admin + rep-app pre-order editors; the rep-app Pre-Orders editor is a collapsible dropdown; adding a pre-order item auto-selects Premium.

**Billing / pricing:**
- Booking & Pre-Order monthly base **R200 → R300** (constant `BookingBase` in `pricing.go`, plus all display text/PDFs).
- Rep commission **30% → 25%** own (+10% TL override) across engine + statements + dashboards.
- "Services: 10% **per order**" → "per **service**" wording everywhere.
- Bookings Ledger (Billing tab) shows a **Kind** column ("Pre-Order" / "Table Booking" / "Booking") and an **Items** column.

**Labels:** "Tier 1" → **Basic**, "Tier 2" → **Premium** in all user-facing labels, fields, docs, and the organogram — **stored values unchanged** (`onboard.go` parses both new "Basic/Premium" and old "Tier 1/2" apply-form text).

**Rep tooling / docs:**
- **Rep guide PDF** `frontend/public/onboarding/rep-guide.pdf` (generated by `scripts/gen_rep_guide.py`), including an embedded **pricing organogram** (from `scripts/pricing-organogram.svg` via `svglib`) that replaced the old Section 2 table; "4. Pre-Orders" starts at the top of its own page.
- Onboarding PDFs per category (`scripts/gen_onboarding.py`).
- **QR codes:** partner login QR (`ProfileQRCode.tsx`, wording "scan → Log In → Sign In") and a **Rep Application QR** component `RepQRCode.tsx` (neon style; points to `/rep-login`; on the RO page under "Recruit a new rep"). Standalone PNGs were also generated for advertising.
- **Tutorial videos:** the "Rep Application" and "Rep Sign In" YouTube-short links now live at the **bottom of the rep sign-in page** (`RepLoginPage.tsx`) under the Sign In button; the tutorial block was removed from the onboarding page.
- **GPS capture:** "📍 Use my current location" button (uses `lib/geolocation.ts`) on the rep onboarding app and admin `RestaurantForm` — fills Latitude/Longitude from the device.

**Pre-order visibility:** a pre-order-only restaurant keeps its chosen audience (not forced to "Both") and does **not** show a "Book a table" button (guest page gates that on having table `bookingItems`), while still billing on the R300 Booking plan.

---

## 8. Regenerating the PDFs

The PDFs are built by Python scripts and output to `frontend/public/onboarding/`:
```
cd D:\1au\frontend
python scripts/gen_rep_guide.py        # -> public/onboarding/rep-guide.pdf
python scripts/gen_onboarding.py       # -> restaurant/service/attraction/accommodation/real-estate PDFs
```
- Requires Python packages **`reportlab`** and **`svglib`** (svglib embeds the organogram SVG). Install: `pip install reportlab svglib`.
- If `python` is "not recognized" on your PC, install Python (and tick "Add to PATH") or have the assistant regenerate them (it has Python in its sandbox).
- After regenerating, the PDFs are frontend files → **push to deploy via Vercel** (they're served at `aroundyou.co.za/onboarding/<name>.pdf`).
- Rep guide content is **inline markdown inside `gen_rep_guide.py`** (the `MD = r"""..."""` block) with directives `@@ORGANOGRAM@@` and `@@PAGEBREAK@@`. Edit the text there, then regenerate.

---

## 9. Key files quick-reference

- Billing/pricing: `backend/internal/billing/pricing.go` (rates, `PriceForUnits`, `InvoiceItem`), `run.go` (monthly billing), `commission.go` (25%/10%), `invoice.go`, `statement.go`, `accounts.go` (ledger).
- Onboarding from application: `backend/app/partnerapp/onboard.go` (+ `restaurant.go`/`service.go`/`attraction.go`/`accommodation.go` Create/Update).
- Pre-orders: `backend/app/preorder/preorder.go`.
- Routes: `backend/cmd/server/main.go`.
- Rep app (field onboarding, "Tap Based Onboarding"): `frontend/components/RepOnboardingApp.tsx`.
- Admin forms: `frontend/components/RestaurantForm.tsx`, `ServiceForm.tsx`, `AttractionForm.tsx`, `AccommodationForm.tsx`, `OfficialUseSection.tsx` (Access Level / Guest Type radios + Basic/Premium labels).
- Public apply form: `frontend/components/PartnerApplyForm.tsx` (`/apply?rep=...`).
- Rep sign-in / application: `frontend/components/RepLoginPage.tsx` (`/rep-login`, `?mode=apply`).
- Guest/Local app: `frontend/components/GuestDashboard.tsx`, `RestaurantPreOrder.tsx`.
- Admin/billing UI: `frontend/components/AdminDashboard.tsx`, `BillingTab.tsx`, `AnalyticsDashboard.tsx`.
- QR: `frontend/components/ProfileQRCode.tsx`, `RepQRCode.tsx`.
- PDF generators + organogram: `frontend/scripts/gen_rep_guide.py`, `gen_onboarding.py`, `pricing-organogram.svg`.

---

## 10. Outstanding / not-yet-done (pick up here)

1. **"Neither / one / both" billing rule** (the corrected model): a restaurant may tick **neither, one, or both** of Bookings and Pre-Orders. Ticking neither → normal Basic/Premium display pricing. Ticking either or both → flat **R300/month + usage** (R10/cover for bookings **and/or** 5% for pre-orders, stacking on one R300 base). Current code still routes pre-orders through the single "Booking" plan and has leftover either/or handling — this needs a careful billing pass (and a local `go build`).
2. **Downloadable pricing table** — an Excel (.xlsx) version of the pricing schedule was requested but not yet produced.
3. **Local `go build`** of the recent backend changes (commission 25%, `restaurant.go` pre-order logic, `pricing.go` R300 + Basic/Premium invoice wording, `onboard.go` parsing) before the next deploy.
4. **Historical docs** intentionally left stale: `REP_BILLING_COMMISSIONS_SPEC.md` (still says 30% / R200 / tiers) and `backend/migrations/000048_collapse_to_two_tiers.sql` (SQL values). Update only if you want them current.

---

## 11. Working style that worked well

- Assistant edits files in `D:\1au`; verifies frontend with `npx tsc --noEmit`; regenerates PDFs; then hands you the exact PowerShell `git` block to push.
- Keep sessions focused per topic — long single chats get expensive because the whole history is re-read each turn. Start a fresh chat (with this handoff attached) for a new batch of work.
- When something "doesn't work" after a change: check commit on origin → Fly/Vercel green → Ctrl+F5 before assuming a code bug.

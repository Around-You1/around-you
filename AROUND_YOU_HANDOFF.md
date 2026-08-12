# Around You — Project Handoff & Current State

**Purpose:** authoritative, code-verified snapshot of the project so any new chat/session can pick up without re-deriving context. Reconstructed on **2026-08-11** from the repository, its git history (103 commits), the master spec PDF, and live checks against the production database. Where something is an assumption rather than a verified fact, it is marked *(assumption)*.

Keep this file in the repo root and update it at the end of each work session.

---

## 1. What Around You is

A hospitality app for short-term holiday guests (and "Locals"). A guest signs in with a code/QR issued by their accommodation and gets verified accommodation info plus a curated, location-aware directory of nearby **Restaurants, Services, and Attractions** ("Partners"), with discounts and one-tap navigation. Region focus: South Africa (primary region `jnb` / Johannesburg). Brand look: true-black dark theme with lumo-green (`#39FF14`) accent.

Full product spec lives in the project-knowledge PDF (12 pages: landing copy, roles, tier model, all profile fields, rep onboarding, analytics module).

---

## 2. Architecture (verified from code)

**One database, fronted by one API.**

- **Database — Supabase Postgres.** The single source of truth. Confirmed in `backend/internal/appdb/db.go`: the Go backend connects via `DATABASE_URL` to Supabase's **Session Pooler** (`aws-0-<region>.pooler.supabase.com:5432`). Use the *Session* pooler (`:5432`), **not** the Transaction pooler (`:6543`) — the latter breaks `lib/pq` prepared statements.
- **API — pure-Go backend** ("around-you-backend") deployed on **Fly.io**, region `jnb`, internal port `4000`. Uses `database/sql` + `lib/pq`. **Encore has been fully removed** and replaced with hand-written HTTP handlers (per the project rule: Supabase only, no Encore). Note: the Go module is still named `backend_encore` — legacy name only.
- **Frontend — Next.js 14** (React 18, TypeScript, Tailwind 4) in `frontend/`. Talks to the Go API through `frontend/backend/client.ts` (hand-written replacement for the old Encore client). Deployed *(assumption: Vercel or similar — confirm)*.
- **Auth/identity — Supabase Auth.** Used **only** for Local OTP email login (`supabase.auth.signInWithOtp` / `verifyOtp` / `getSession`). The frontend does **not** read data tables via supabase-js (verified: no `.from()` table queries exist).

**Data flow:** Frontend → Go API (Bearer token) → Supabase Postgres. The Go backend connects as the `postgres` role, which has `rolbypassrls = true`.

**Auth model (two tokens, see `frontend/backend/client.ts`):**
- `Authorization: Bearer <go-token>` — the authorization/routing token issued by the access-code / secondary / local-guest login, stored in `localStorage("token")`. This is what the Go API validates today.
- `X-Supabase-Token: <supabase-jwt>` — the identity layer, forwarded so the Go backend can additionally verify the Supabase session *once wired to* (not yet the primary bearer).

---

## 3. Tech stack & versions

| Layer | Tech |
|---|---|
| Frontend | Next.js ^14.2.15, React ^18.3.1, TypeScript ^5.6.2, Tailwind ^4.0.0, Radix UI, lucide-react |
| API | Go 1.22, net/http (Go 1.22 routing), `lib/pq`, `golang.org/x/crypto` |
| DB | Supabase Postgres (free tier, Session Pooler / Supavisor) |
| Auth | Supabase Auth (email OTP) + custom code-based logins in Go |
| Email | Resend (`backend/internal/mailer`) |
| Hosting | Backend on Fly.io (`jnb`); CI via GitHub Actions (`fly-deploy.yml`, `ci.yml` runs Go build/tests against postgres:16) |

---

## 4. Data model (from `backend/migrations/`, 23 migrations)

Core tables in `public`: **accommodations, attractions, restaurants, services, users, sessions, ratings** (plus `schema_migrations`, booking/edit-code tables). Migrations are applied by the Go app's own runner (`internal/appdb/migrate.go`), tracked in `schema_migrations`, idempotent on restart.

Migration highlights: users+sessions (002), password_hash on users (005), superadmin seed (006), rep fields+role (007–008), restaurants/services/attractions (010), partner fields (011), image URL arrays (012), official-use fields (013/016), attraction-specific fields (014), ratings (015), booking items for restaurant/service/attraction (017–019), edit codes (020), restaurant menu PDFs (021), accountant role (022), restaurant type (023).

**Mid-migration note:** `db.go` states the SQL store backs *"accommodation today; restaurant/service/attraction as they move over."* Entities are being moved into the pure-SQL store incrementally — confirm which are fully cut over before schema-level work.

---

## 5. API surface (from `backend/cmd/server/main.go`)

**Public (no token):** `GET /ping`, `POST /auth/access-code-login`, `/auth/secondary-login`, `/auth/local-guest-login`, `/auth/login`, `/auth/rep-login`, `/auth/acc-login`, `GET /storage/logo`, `GET /storage/profile-settings`.

**Authenticated (Bearer token via `requireAuth`):** everything else — including all data reads. Per entity (accommodation / restaurant / service / attraction): `GET` list, `/by-municipality`, `/nearby`, `/get`, `POST` create, partner-code get/regenerate/toggle, CSV `template`/`export`/`import`. Plus bookings (`/booking`, `/booking/mine`, `/booking/for-partner`, `/booking/cancel`), edit codes, ratings, stats, analytics (`/analytics/rep-activity`), rep management.

**Key point:** all data endpoints are auth-gated, so the API is not anonymously scrapable. Proximity endpoints (`/nearby`) already exist per entity.

---

## 6. Roles & access model (from spec + code)

- **Guest** — signs in via 12-char Access Code or QR (or accommodation name/address/province/postal). Sees their accommodation + nearby Partners within a radius slider (10km default, up to 150km).
- **Local** — email + OTP; capped at 5 sign-ins/month (10 if "Super Local"); radius up to 50km.
- **Partner** — signs in via QR or 12-char **Edit Code** (view/edit own profile).
- **Rep** — email + Rep Code (created by Super Admin); can Add/Edit profiles; has a tap-based mobile onboarding flow.
- **Admin (Super Admin)** — full Add/Edit/Delete; analytics; CSV bulk tools. Accountant role also exists (migration 022).

**Tier visibility (1–4):** Partners choose a tier; viewers see only fields up to that tier, with higher-tier headings shown but gated. Partners also choose audience: Guest / Local / Both. Accommodations are Tier 4 only.

---

## 7. Progress timeline (from git history)

103 commits, **2026-07-23 → 2026-08-07**. Arc: initial platform → Encore-to-Go migration → CSV import/export → partner/edit codes → ratings → bookings (create/my-bookings/cancel/reschedule, partner-side view, email alerts via Resend) → accountant portal → restaurant type multi-select → multi-image carousels. Security-relevant: **`760f9cf` (2026-08-06) "Anti-scraping: strip sensitive fields from guest-facing read endpoints"** — the first anti-scraping pass, in the Go handlers.

---

## 8. Security posture

**FIXED TODAY (2026-08-11) — the critical hole.** The public anon key (shipped in the frontend) could read every `public` table directly via Supabase REST (`/rest/v1/<table>`), bypassing the Go API. Verified live: `accommodations` leaked `wifi_password` and `company_vat_number` to an anonymous caller; `users` (with `password_hash`) was similarly at risk. **Fix applied:** enabled + forced RLS on all `public` tables and revoked `anon`/`authenticated` privileges (`20260811_close_supabase_rest_backdoor.sql`). Post-fix probe returns `permission denied (42501)`; app unaffected because `postgres` bypasses RLS. **Back door closed.**

**Already done:**
- Commit `760f9cf` strips sensitive fields from guest-facing Go reads (restaurant/service/attraction). All Go data endpoints require a bearer token.
- **Per-token rate limiting** on all authenticated routes (`internal/ratelimit`, wired in `main.go`): 180 req/min/token default, HTTP 429 over limit. Deployed 2026-08-11.
- **Per-IP brute-force protection on the public login routes** (`limitByIP` + `clientIP` in `main.go`, keyed on Fly-Client-IP): 30 attempts/min/IP default (`LOGIN_RATE_LIMIT_PER_MIN`), HTTP 429 over limit. Slows access/edit-code guessing.

**Remaining layers (priority order):**
1. **Cloudflare** in front of the Go backend — edge IP-level rate limiting + bot protection + Turnstile on login. Backstops the in-app login limiter at the network layer.
2. **Confirm accommodation field-stripping** — `760f9cf` did NOT cover `accommodation.go` (wifi/emergency/official fields). Verify nothing sensitive is over-shared to the wrong audience.
3. **Verify password hashing strength** — `users.password_hash` + `golang.org/x/crypto` (likely bcrypt); confirm strong, salted.
4. **Coordinate fuzzing** — *decided against* for this app: navigation to venues is core to the product, so partner coordinates must stay exact.
5. **App attestation** *(later)* — verify genuine app instances (mobile).

---

## 9. Environment & config

Backend env (Fly secrets): `DATABASE_URL` (Supabase Session Pooler), `PORT=4000`, Resend key, CORS origins. Frontend env (`frontend/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design), `NEXT_PUBLIC_BACKEND_URL`. Deploy: push to `main` → GitHub Action `flyctl deploy` (working dir `backend`).

---

## 10. Gotchas for whoever picks this up

- Use the Supabase **Session** pooler (`:5432`), never the Transaction pooler (`:6543`) — breaks `lib/pq`.
- RLS is now ON for all `public` tables. The Go `postgres` role bypasses it; **any new direct-REST or supabase-js table access will return empty/denied** unless you add explicit policies. Keep data access flowing through the Go API.
- **New tables need RLS enabled explicitly.** Migration `000024` enabled RLS on every table that existed when it ran; it does NOT re-run (recorded as applied). Any table created by a *later* migration starts with RLS OFF (Postgres default), which will trip Supabase's `rls_disabled_in_public` advisor. So every new-table migration must include `alter table public.<t> enable row level security; alter table public.<t> force row level security; revoke all on public.<t> from anon, authenticated;`. (Supabase's periodic advisor emails are dated as-of the scan date — cross-check against the live Advisors → Security page before acting.)
- Go module name `backend_encore` is legacy; Encore is gone. Don't reintroduce it.
- Keep sensitive fields (`wifi_password`, `wifi_credentials`, `emergency_contacts`, `official_*`, `company_reg_number`, `company_vat_number`, `password_hash`) out of any guest/local-facing response.
- The written Part 1–4 summaries were never stored in the repo/project knowledge; this file replaces them as the canonical source going forward.

---

## 11. Immediate next step

Go API hardening (item 8.1): review the field-stripping in `backend/app/{accommodation,restaurant,service,attraction}/*.go` against `760f9cf`, then add result caps + rate limiting. Read those handlers before editing.

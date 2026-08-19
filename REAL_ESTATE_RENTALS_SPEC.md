# Around You — Real Estate & Rentals subsystem (design spec)

A self-contained category, fully isolated from normal Services: its own tables,
Go/Supabase API, admin flow, rep flow, guest/local display, and billing. Nothing
here reuses the `services` table or the standard service onboarding fields.

Stack note: Go (net/http) on Fly + Supabase Postgres. No Encore runtime (the
`//encore:api` comments in the codebase are decorative). Money is integer ZAR
cents. Billing reuses the existing `partner_subscription` → `invoice` →
`commission` machinery by adding two new `partner_type` values, so invoices,
statements, rep commissions and the billing run all "just work".

---

## 1. Billing model (confirmed)

- **Flat R300 / month per PAGE.** A page = the Estate Agency profile, or an
  individual Estate Agent profile.
- Agency profile created → **R300/mo**.
- Each Estate Agent page created → **+R300/mo** each.
- Agency + 3 agents → **R300 × 4 = R1 200/mo**.
- **No tiers** for real estate (tiers remain for normal partners only).
- Each page's billing is attributed to the entity named in **its own "Official
  Use"** block; rep commission uses the agency's `official_rep_code`.
- Deactivating / deleting a page cancels its subscription (no further billing).

Implementation: one `partner_subscription` row per page.
- Agency: `partner_type='estate_agency'`, `partner_id=<agency.id>`, `plan='RealEstate'`, `monthly_cents=30000`.
- Agent:  `partner_type='estate_agent'`,  `partner_id=<agent.id>`,  `plan='RealEstate'`, `monthly_cents=30000`.

The existing daily billing run then issues R300 invoices per page and accrues rep
commission exactly as it does today.

---

## 2. Data model (new Supabase tables)

### `estate_agencies` — the agency profile (a "partner-like" entity)
```
id                      bigserial pk
name                    text not null
description             text
address                 text
province                text
country                 text
postal_code             text
contact_number          text
email                   text
latitude                double precision
longitude               double precision
image_url               text            -- primary
image_urls              text[]          -- up to 10
create_agent_pages      boolean not null default false  -- the in-profile checkbox
profile_reference_code  text unique     -- guest "Profile Access Code"
profile_reference_code_active boolean not null default true
edit_code               text            -- partner edit code
-- Official Use (billing attribution + rep commission)
official_holding_company text
official_contact_name    text
official_contact_number  text
official_email           text
official_rep_code        text
official_rep_name        text
company_reg_number       text
company_vat_number       text
is_active               boolean not null default true
is_duplicate            boolean not null default false
duplicate_reason        text
created_at, updated_at  timestamptz
```

### `estate_agents` — agents under an agency
```
id             bigserial pk
agency_id      bigint not null references estate_agencies(id) on delete cascade
name           text not null
photo_url      text
contact_number text
email          text
bio            text
profile_reference_code text unique      -- agent's own guest page code
profile_reference_code_active boolean default true
edit_code      text
-- Official Use (per-agent billing attribution; falls back to agency rep code)
official_rep_code text
official_rep_name text
is_active      boolean not null default true
created_at, updated_at
```

### `estate_properties` — listings under an agency, optionally assigned to an agent
```
id             bigserial pk
agency_id      bigint not null references estate_agencies(id) on delete cascade
agent_id       bigint references estate_agents(id) on delete set null  -- optional
title          text not null
property_type  text            -- House | Apartment | Plot | Farm | Commercial | ...
plot_size_m2   numeric
house_size_m2  numeric
bedrooms       int
bathrooms      int
garages        int
features       text[]          -- pool, tennis court, garden, security estate, ...
price_cents    bigint          -- ZAR cents (handles millions)
listing_type   text            -- 'sale' | 'rent'
address        text
province       text
country        text
postal_code    text
latitude       double precision
longitude      double precision
description    text
image_url      text
image_urls     text[]          -- up to 10 (min 10 recommended)
is_active      boolean not null default true
created_at, updated_at
```

All three tables get the standard RLS lockdown (enable + force RLS, revoke
anon/authenticated) guarded for CI, matching every other table.

### Relationships
```
estate_agencies 1───* estate_agents      (agents.agency_id)
estate_agencies 1───* estate_properties  (properties.agency_id)
estate_agents   1───* estate_properties  (properties.agent_id, nullable)
partner_subscription  1 per agency page + 1 per agent page
```

---

## 3. API endpoints (Go, SuperAdmin/Rep protected unless noted)

Internal (admin/rep):
```
POST   /estate/agency            create agency (+ subscription, +moderation scan, +dedupe)
PUT    /estate/agency            update agency
GET    /estate/agencies          list agencies (admin)
GET    /estate/agency/get?id     one agency (full)
DELETE /estate/agency            archive agency (+ its agents/properties)

POST   /estate/agent             create agent (+ R300 subscription)
PUT    /estate/agent             update agent
DELETE /estate/agent             delete/deactivate agent (cancel subscription)
GET    /estate/agents?agencyId   list agents for an agency

POST   /estate/property          create property
PUT    /estate/property          update property
DELETE /estate/property          delete property
GET    /estate/properties?agencyId|agentId   list properties
```

Public (guest/local — sanitized, no Official Use / codes):
```
GET /estate/public/agencies                list agencies for browse
GET /estate/public/agency?code             agency page + its agents + properties
GET /estate/public/agent?code              agent page + assigned properties
GET /estate/public/property?id             full property page
```

Reuses existing `storage/upload` for images and the events pipeline for
listing-view / QR analytics.

---

## 4. Frontend

### Routing
```
Admin:  Admin Dashboard → Services tab → top checkbox "Real Estate & Rentals"
        → switches to the Estate flow (EstateAgencyForm with nested Agents + Properties)
        (or a dedicated "Real Estate" tab — see UX rec)
Rep:    RO app → partner type / top toggle "Real Estate & Rentals" → Estate flow
Guest:  /estate/agency/[code]   Agency page (info + agent cards + property cards)
        /estate/agent/[code]    Agent page (photo, bio, contact, assigned properties)
        /estate/property/[id]   Property page (gallery, specs, price, map, contact)
        Guest Services view gains a "Real Estate & Rentals" filter/tab
```

### New components
- `EstateAgencyForm` (admin) — agency fields + 10 images + Official Use + the
  "Create individual Estate Agent pages" checkbox; when checked, an inline
  repeatable **Agents** editor; always an inline repeatable **Properties** editor
  (each property = full field set + 10 images + optional agent assignment).
- `EstatePropertyEditor` / `EstateAgentEditor` — repeatable sub-forms.
- `EstateAgencyPage`, `EstateAgentPage`, `EstatePropertyPage` (guest display).
- `PropertyCard`, `AgentCard` (real-estate styled, not service styled).
- Rep app: an `EstateFlow` screen mirroring the admin editors in the RO UI.

### Category checkbox change
- Remove **"Real Estate & Rentals"** from the Services **Home & Property**
  subcategory list (in the service `CATEGORY_GROUPS` used by `ServiceForm` and
  `RepOnboardingApp`).
- Add a top-level **"Real Estate & Rentals"** toggle at the top of the Services
  onboarding (admin + rep) that switches the whole form to the Estate flow.
- Add a **"Real Estate & Rentals"** filter on the guest Services browse view.

---

## 5. Validation
- Agency: name required.
- Property: title, property_type, listing_type ('sale'|'rent'), price required;
  numeric guards on sizes/beds/baths/garages/price.
- Agent: name required; email format when present.
- Images: up to 10 each (agency, property); agent single photo.
- Moderation (hate/threats hard-block, profanity/AI flag) + duplicate detection
  run on agency create, reusing the existing pipelines.

## 6. Image upload
Reuse `MultiImageUpload` (10-image, drag-drop) for agency + each property, and a
single `ImageUpload` for the agent photo. Stored via the existing storage bucket.

## 7. UX / UI recommendations
- Give Real Estate its **own Admin tab** ("Real Estate") rather than hiding it
  behind the Services checkbox — cleaner given its very different data. (The
  Services-page checkbox still exists per your request, but the admin management
  surface is easier as its own tab.)
- Property cards: photo, price (formatted `R x xxx xxx`), For Sale/Rent badge,
  beds/baths/garages icons, area — a real listing look.
- Property page: full-width gallery carousel, spec grid, map/Directions button,
  "Contact agent" (routes to the assigned agent or the agency).
- Agent page: portrait photo header, bio, contact + WhatsApp/Directions, their
  property grid.
- A billing summary on the agency admin page: "1 agency + N agents = R(300×(N+1))/mo".

---

## 8. Isolation guarantees
Separate tables (`estate_*`), separate API routes (`/estate/*`), separate
frontend components/pages, separate onboarding flow. The only shared machinery is
deliberate and low-risk: billing (via new `partner_type`s), image storage,
moderation, and dedupe — all opt-in per call.

---

## 9. Phased build plan (each phase deploys green before the next)
1. **Schema + stores** — migrations for the three tables (+RLS), Go store types,
   `partner_type` billing wiring for `estate_agency` / `estate_agent`.
2. **Backend API** — agency/agent/property CRUD + public reads + billing hooks +
   routes + `client.ts` methods + moderation/dedupe on agency create.
3. **Admin Dashboard** — Real Estate tab + `EstateAgencyForm` with nested agents
   & properties, activate/deactivate, images, billing summary.
4. **Rep Onboarding app** — Estate flow (agency + multiple properties + multiple
   agents in one session), rep code/name, R300 lines.
5. **Guest + Local display** — agency / agent / property pages + cards + Services
   filter, with listing-view analytics.
6. **Category cleanup + billing reconcile + verification** — remove RE from Home
   & Property, wire the top toggle, typecheck + CI, end-to-end check.
```
```

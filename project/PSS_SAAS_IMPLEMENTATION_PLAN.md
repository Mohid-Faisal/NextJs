# PSS → SaaS Implementation Plan

Start **tomorrow with Phase 1, Day 1**. Everything below maps to your real codebase: **~86 API routes**, single Prisma DB, JWT auth (no tenant yet), deep shipments/accounts logic you keep and scope by org.

---

## Goal

Turn PSS from **one courier's ERP** into **many isolated courier workspaces** on one platform, then add billing and public signup.

**MVP definition (when you can charge):**
- New courier signs up → gets own org
- Their data never mixes with yours or another courier's
- You can suspend orgs manually
- Stripe or manual payment marks them active

---

## Architecture decisions (lock these on Day 1)

| Decision | Choice | Why |
|----------|--------|-----|
| Tenancy model | **Shared DB + `organizationId` on rows** | Fastest with Prisma/Supabase; matches your stack |
| Tenant resolution | **JWT claims** (`organizationId`, `role`) | You already use JWT cookies |
| Existing PSS data | **Migrate into org `pss-default`** | One migration, zero data loss |
| Subdomain | **Phase 3** — start with slug in JWT only | Don't block Week 1 |
| Billing v1 | **Manual + SaaS Admin** → Stripe in Phase 2 | Ship tenancy first |
| Super admin | **`User.platformRole = SUPER_ADMIN`** | Separate from org roles |

---

## New Prisma models (add on Day 1)

```prisma
model Organization {
  id            Int      @id @default(autoincrement())
  name          String
  slug          String   @unique
  status        String   @default("active") // active | trial | suspended
  logoUrl       String?
  currency      String   @default("PKR")
  invoicePrefix String?
  createdAt     DateTime @default(now())
  members       OrganizationMember[]
  subscription  Subscription?
}

model OrganizationMember {
  id             Int          @id @default(autoincrement())
  organizationId Int
  userId         Int
  role           String       // OWNER | ADMIN | STAFF | ACCOUNTANT
  organization   Organization @relation(...)
  user           User         @relation(...)
  @@unique([organizationId, userId])
}

model Plan {
  id                  Int    @id @default(autoincrement())
  code                String @unique // starter | business | pro
  name                String
  priceMonthlyUsd     Float
  maxUsers            Int
  maxShipmentsPerMonth Int
  features            Json   // { accounts: true, bulkUpload: true }
}

model Subscription {
  id             Int          @id @default(autoincrement())
  organizationId Int          @unique
  planId         Int
  status         String       // trialing | active | past_due | canceled
  trialEndsAt    DateTime?
  currentPeriodEnd DateTime?
  stripeCustomerId String?
  stripeSubscriptionId String?
  organization   Organization @relation(...)
  plan           Plan         @relation(...)
}
```

**Add `organizationId Int` + index** to every tenant-owned table. Priority order:

1. `Shipment`, `Customers`, `Vendors`, `Recipients`, `Invoice`, `Payment`
2. `CustomerTransaction`, `VendorTransaction`, `CreditNote`, `DebitNote`
3. `JournalEntry`, `ChartOfAccount` (or shared template + org override — decide Week 2)
4. Settings-ish: `Rate`, `RemoteArea`, `Zone`, `Agency`, `Office`, etc.

**Keep global (no orgId):** `User`, `Plan`, platform settings.

**Rename mentally:** app "Customers" = courier's clients (still `Customers` table, just scoped).

---

## Implementation phases & calendar

### Phase 1 — Multi-tenancy foundation (Weeks 1–3)

| Week | Focus | Deliverable |
|------|--------|-------------|
| **Week 1** | Schema + migration + auth | Org models, `organizationId` on core tables, default org migration |
| **Week 2** | API scoping | All read/write APIs filter by `organizationId` |
| **Week 3** | Signup + guards | Org signup, invite users, middleware, isolation tests |

### Phase 2 — Billing (Weeks 4–5)

Plans CRUD, subscription status, usage counters, Stripe checkout + webhooks, block dashboard if suspended.

### Phase 3 — Go-to-market (Weeks 6–7)

Public pricing page, trial flow, SaaS Admin UI, emails (trial ending, payment failed).

### Phase 4 — Scale (later)

API keys, white-label, wallets, subdomain branding.

---

## Day-by-day: start tomorrow

### Day 1 (Tomorrow) — Schema & migration skeleton

**Morning**
1. Add `Organization`, `OrganizationMember`, `Plan`, `Subscription` to `schema.prisma`.
2. Add `organizationId` to **Tier 1 tables only:** `Shipment`, `Customers`, `Vendors`, `Recipients`, `Invoice`, `Payment`, `CustomerTransaction`, `VendorTransaction`.
3. Add `platformRole` to `User` (nullable; `SUPER_ADMIN` for you).
4. Seed 3 plans (Starter / Business / Pro) with limits from pricing table.

**Afternoon**
5. Write migration script:
   - Create org `PSS Default` slug `pss-default`
   - Set all existing rows' `organizationId = 1`
   - Link all existing users as `OWNER` of org 1
6. Run migration on **Supabase staging** (not production first).
7. Verify counts: shipments/invoices before = after.

**End of Day 1 done when:** DB has org #1 and all legacy data attached; app may still work without scoping (temporary).

---

### Day 2 — Auth & session context

1. Create `src/lib/auth/session.ts`:
   - `getSession(req)` → `{ userId, organizationId, orgRole, platformRole, plan }`
   - Centralize JWT sign/verify (replace scattered `decodeToken` copies over time).
2. Update `login/route.ts` → JWT includes `organizationId`, `orgRole`.
3. Update `middleware.ts` → pass org context; block dashboard if org `suspended`.
4. Update `signup/route.ts` → **new flow:** create Organization + User + OrganizationMember (OWNER).

**Done when:** Login returns org-scoped JWT; new signup creates a new org.

---

### Day 3 — Tenant helper + first API slice

1. Create `src/lib/tenant/prismaScope.ts`:
   ```ts
   export function orgWhere(session, extra = {}) {
     return { organizationId: session.organizationId, ...extra };
   }
   ```
2. Scope **highest-traffic routes first:**
   - `api/shipments/route.tsx`
   - `api/add-shipment/route.ts`
   - `api/customers/route.ts`
   - `api/dashboard/route.ts`
3. Every `create` must set `organizationId` from session (never from client body).

**Done when:** Shipments/customers/dashboard only show org 1 data in dev; second test org sees empty lists.

---

### Day 4–5 — Accounts & payments scoping

Scope in order (matches your bug-prone ledger):
- `api/accounts/invoices/*`
- `api/accounts/payments/*`
- `api/accounts/transactions/customer/[id]`
- `api/accounts/transactions/vendor/[id]`
- `api/credit-notes/*`, `api/debit-notes/*`
- `api/journal-entries`, `api/chart-of-accounts`

**Rule:** Every `findMany`, `findFirst`, `update`, `delete` gets `organizationId` in `where`.

---

### Day 6–7 — Settings & reference data

Scope: zones, rates, remote areas, agencies, offices, vendor services, fixed charges.

**Decision:** Per-org copies vs shared global rates. **Recommend:** per-org (each courier has own rate cards).

---

### Week 2 — Remaining APIs + hardening

- Remaining ~40 routes (search, bulk upload, cron, email).
- **Cron jobs** must iterate orgs or filter by org.
- **Unique constraints:** change `CompanyName @unique` on `Customers` → `@@unique([organizationId, CompanyName])` (same for vendors, recipients, invoice numbers per org).
- Fix shipment DELETE scoping (already patched globally — ensure delete only touches same org).

---

### Week 3 — Signup UX + isolation tests

**UI**
- `/auth/signup` → company name + admin user + plan selection (trial)
- `/dashboard/settings/organization` → name, logo, currency
- `/dashboard/settings/team` → invite users, roles

**Tests (manual script)**
1. Create org A and org B.
2. Add shipment in A → must not appear in B.
3. Try API with org A token + org B shipment id → 404.

**SaaS Admin v0 (super admin only)**
- `/dashboard/saas/organizations` — list orgs, suspend/activate
- No billing yet — manual status toggle

---

## Phase 2 billing (Week 4–5) — what to build

| Task | Detail |
|------|--------|
| Plans admin | CRUD plans, feature flags JSON |
| Usage meter | Count shipments created this month per org |
| Limit enforcement | Block `add-shipment` if over plan; show upgrade modal |
| Stripe | Checkout session, webhook → update `Subscription.status` |
| SaaS invoices | Optional: `SaasInvoice` table for your records |
| Pakistan fallback | "Mark paid" button in SaaS Admin |

**Plans to seed:**

| Code | USD/mo | Shipments/mo | Users | Accounts |
|------|--------|--------------|-------|----------|
| starter | 49 | 500 | 2 | no |
| business | 99 | 2000 | 5 | yes |
| pro | 199 | 10000 | 15 | yes |

---

## Phase 3 — Public sales (Week 6–7)

- Landing page `/` — features, pricing, demo video
- `/pricing` — 3 tiers + "Start trial"
- List on G2/Capterra after trial works
- Email: Resend (you already have `RESEND_API_KEY`)

---

## File / folder structure to add

```
src/lib/auth/session.ts          # JWT + org context
src/lib/tenant/prismaScope.ts    # orgWhere(), requireOrg()
src/lib/tenant/requirePlan.ts    # feature gates (Phase 2)
src/app/api/org/signup/route.ts  # optional split from auth signup
src/app/dashboard/saas/          # super admin only
  organizations/page.tsx
  plans/page.tsx
  subscriptions/page.tsx
src/app/auth/signup-org/page.tsx # new courier signup
```

---

## API scoping checklist (print this)

For **each** of ~86 routes, verify:

- [ ] `GET` lists filter `organizationId`
- [ ] `GET` by id verifies row belongs to org
- [ ] `POST` sets `organizationId` from session
- [ ] `PUT/PATCH/DELETE` same org check
- [ ] No `findMany({})` without org filter on tenant data
- [ ] Search/autocomplete endpoints scoped

**Batch order:** shipments → customers/vendors → invoices/payments → transactions → settings → misc.

---

## Migration script outline (run once)

```ts
// scripts/migrate-to-default-org.ts
// 1. Create Organization { name: "PSS", slug: "pss-default" }
// 2. For each table with organizationId: UPDATE SET organizationId = 1
// 3. For each User: INSERT OrganizationMember OWNER
// 4. Create Subscription { plan: business, status: active } for org 1
```

Run on Supabase with backup first.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Missing `organizationId` filter leaks data | Isolation test script; code review checklist |
| `@unique` on names breaks second org | Composite unique `[organizationId, CompanyName]` |
| 86 routes = long refactor | Tier order + shared `orgWhere` helper |
| Production downtime | Migrate on staging; maintenance window for prod |
| Invoice numbers collide across orgs | `invoiceNumber` unique per org, not global |

---

## What NOT to do in Week 1

- Stripe integration
- Wallets
- Subdomains
- Rebuilding shipments/accounts logic
- Separate database per tenant
- Full SaaS Admin dashboard (list + suspend is enough)

---

## Tomorrow morning — your literal checklist

1. Create branch: `feature/saas-multitenancy`
2. Edit `schema.prisma` (org models + `organizationId` on Tier 1 tables)
3. `npx prisma migrate dev --name add-organizations`
4. Write + run `scripts/migrate-to-default-org.ts` on staging DB
5. Create `src/lib/auth/session.ts` and `src/lib/tenant/prismaScope.ts`
6. Update login JWT payload
7. Scope `api/shipments` + `api/dashboard` as proof of concept
8. Create org B in DB manually → confirm empty shipment list

**Time estimate Day 1:** 6–8 hours focused work.

---

## Success metrics by phase

| Phase | Metric |
|-------|--------|
| Phase 1 | 2 test orgs, zero cross-tenant data leaks |
| Phase 2 | 1 paying org via Stripe or manual |
| Phase 3 | Public signup + 14-day trial live |
| Phase 4 | 10+ orgs on platform |

---

When you start tomorrow, say **"start Day 1 SaaS"** and we can implement the Prisma schema + migration script + session helper in the repo directly.

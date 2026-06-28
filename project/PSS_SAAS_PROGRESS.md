# PSS → SaaS — Progress Summary

Status snapshot of the multi-tenant SaaS conversion. Companion to `PSS_SAAS_IMPLEMENTATION_PLAN.md`.

**Last updated:** 2026-06-29

---

## TL;DR

**Phase 1 (Multi-tenancy foundation — Weeks 1–3) is complete.**
The app is now a multi-tenant SaaS: data is isolated per `organizationId`, auth carries org context, self-serve org signup works, super-admin can manage orgs and approve/reject new accounts.

**Phase 2 (Billing) core is implemented** — plan limits + usage metering, enforcement on shipment creation, Stripe checkout + webhooks, manual "mark paid", and suspend-on-unpaid. Remaining: configure Stripe keys/prices and test end-to-end.

**Next up: Phase 3 — Go-to-market** (public landing/pricing, lifecycle emails, expanded SaaS admin).

---

## Done

### Week 1 — Schema, migration & auth foundation
- Added `Organization`, `OrganizationMember`, `Plan`, `Subscription` models to Prisma.
- Added `organizationId` (+ `@@index`) to tenant-owned tables (shipments, customers, vendors, recipients, invoices, payments, transactions, credit/debit notes, journal entries, chart of accounts, rates, zones, remote areas, agencies, offices, etc.).
- Added `platformRole` (`SUPER_ADMIN`) to `User`, separate from org roles (`OWNER | ADMIN | STAFF | ACCOUNTANT`).
- Migration: legacy data attached to default org (`pss-default`, id 1); all existing users linked as `OWNER`.
- Seed scripts for plans and test orgs/users.
- Centralized auth/session:
  - `src/lib/auth/session.ts` — JWT sign/verify + `getSession`, `isSuperAdmin`.
  - `src/lib/auth/requireApiSession.ts` — per-request auth guard for API routes.
  - `src/lib/auth/requireSuperAdmin.ts` — platform super-admin guard.
  - `src/lib/auth/membership.ts` — org creation + membership helpers.
- `login` JWT now carries `organizationId`, `orgRole`, `platformRole`.
- `middleware.ts` enforces org context and blocks suspended orgs.

### Week 2 — API scoping (all tiers)
- Tenant scoping helpers: `src/lib/tenant/prismaScope.ts` (`orgWhere`, `orgData`) plus per-entity `findOrg*` helpers (invoice, payment, credit/debit note, journal entry, chart account).
- **Batch A — master data:** customers, vendors, recipients (incl. `[id]`, add-*, search/autocomplete, filenames).
- **Batch B — shipments:** `shipments/[id]/*` (tracking-status, send-2fa, ensure-initial-tracking), bulk-upload-shipments.
- **Batch C — schema uniques:** composite uniques `@@unique([organizationId, …])` for customers/vendors/recipients names and `Shipment.trackingId`. (`Invoice.invoiceNumber` intentionally kept **globally unique** to avoid ledger join-key refactor.)
- **Batch D — cron & stats:** company stats scoped per org; cron auth fixed (`CRON_SECRET` bearer check) and made org-safe.
- Accounts/payments/transactions, credit/debit notes, journal entries, chart of accounts all scoped by org.
- Internal server-to-server `fetch` calls (e.g. bulk upload → invoices) now forward `Authorization`/`Cookie` so session/org context is preserved.
- Every `create` sets `organizationId` from session (never from client body).

### Week 3 — Signup, team & SaaS admin
- **Self-serve org signup:** `/auth/signup-org` (company + admin user + plan/trial selection) with email verification; `GET /api/plans`; `createOrganizationForSignup` accepts `planCode`.
- **Org settings:** `/dashboard/settings/organization` + `GET/PATCH /api/org/current` (name, logo, currency; OWNER/ADMIN only).
- **Team management:** `/dashboard/settings/team` + `/api/org/members` (list/add) and `/api/org/members/[id]` (change role / remove), with last-OWNER protection.
- **SaaS Admin (super-admin only):**
  - `/dashboard/saas/organizations` + `GET /api/saas/organizations`, `PATCH /api/saas/organizations/[id]` — list all orgs (members, plan, shipment volume), activate/suspend (can't suspend own org).
  - **Pending-approvals queue:** `/dashboard/saas/pending-approvals` + `GET /api/saas/pending-approvals` and `DELETE /api/saas/pending-approvals/[id]` — review accounts awaiting approval with their org context; **Approve** (reuses secured `POST /api/users/approve/[id]`) / **Reject** (deletes account; cleans up a sole-owner brand-new trial org with zero shipments).
  - `/api/users/approve/[id]` secured with `requireSuperAdmin`; records real `approvedBy`.
  - Sidebar shows "SaaS Admin" + "Approvals" links to super-admins only.
- **Isolation tests:** `scripts/test-isolation-week3.ts` (and day2/day3 scripts) — two orgs see only their own data; cross-org fetch by id → 404; super-admin endpoints 200 vs 403 for regular admin.

### Phase 2 — Billing (core implemented)
- **Billing lib** (`src/lib/billing/`):
  - `usage.ts` — `getOrgPlan`, `getOrgUsage`, `checkShipmentLimit`, feature-flag helpers. Monthly shipment count vs `maxShipmentsPerMonth`; treats `<= 0` / `features.unlimited` as unlimited; the platform's own org (id 1) is never limited.
  - `stripe.ts` — lazy Stripe client (`STRIPE_SECRET_KEY`), price-id resolution, Stripe→internal status mapping, and `applySubscriptionStatus` (suspend-on-unpaid; never suspends org 1).
- **Limit enforcement:** `add-shipment` and `bulk-upload-shipments` return HTTP 402 with a reason (`limit_reached` / `trial_expired` / `subscription_inactive`) when over quota, trial-expired, or past due. Bulk upload also blocks a batch that would exceed the remaining monthly allowance.
- **Usage API:** `GET /api/org/usage` — plan, limits, this-month usage, subscription status/trial end.
- **Stripe checkout:** `POST /api/billing/checkout` (OWNER/ADMIN) — creates/reuses a Stripe customer and returns a Checkout Session URL for a plan.
- **Stripe webhook:** `POST /api/billing/webhook` — raw-body signature verify; handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`; syncs `Subscription.status` + org status (suspend on past_due/canceled/unpaid).
- **Manual mark-paid:** `POST /api/saas/organizations/[id]/billing` (super-admin) — activates a subscription for N months without Stripe (Pakistan/manual fallback).
- **UI:** `/dashboard/settings/billing` — usage bars, current plan/status/trial, plan cards with upgrade buttons (OWNER/ADMIN). "Billing & Plan" added to settings nav. SaaS Organizations page gets a "Mark paid" action + shows subscription status.
- **No schema migration needed** — reused existing `Subscription` fields (`status`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `trialEndsAt`).

### Approval workflow (decided & implemented)
New self-serve owners sign up → verify email → land in `PENDING_APPROVAL` → **we (super-admin)** approve or reject from the queue. Manual approval is intentional (no auto-activate).

---

## What's next

### Immediate / loose ends
- Run `scripts/test-isolation-week3.ts` against staging and confirm zero cross-tenant leaks.
- Audit any remaining un-scoped routes against the "API scoping checklist" in the plan (search, misc, email, any new routes).
- Decide reject-cleanup policy (currently only deletes empty trial orgs with one member) — confirm or loosen/tighten.
- Confirm the per-org invoice numbering decision is acceptable long-term (currently global).

### Phase 2 — Billing: remaining setup & polish
- **Stripe configuration (required to go live):**
  - Set env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
  - Set a Stripe Price per plan via either `Plan.features.stripePriceId` or env `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_BUSINESS` / `STRIPE_PRICE_PRO`.
  - Add the webhook endpoint `/api/billing/webhook` in the Stripe dashboard (events: checkout.session.completed, customer.subscription.*, invoice.payment_failed).
  - Test checkout → webhook → org activates; test payment-failed → org suspends.
- **Optional polish:** client-side handling of 402 in the shipments UI (show an upgrade modal); plans CRUD admin page; feature-gating the accounting module by `plan.features.accounts`.

### Phase 3 — Go-to-market (Weeks 6–7)
- Public landing `/` + `/pricing` (3 tiers, start trial).
- Lifecycle emails (trial ending, payment failed) via Resend.
- Expand SaaS Admin (subscriptions view, plans page).

### Phase 4 — Scale (later)
- API keys, white-label / subdomain branding, wallets.

---

## Key decisions locked
- Tenancy: shared DB + `organizationId` per row; tenant resolved from JWT claims.
- Legacy data lives in org `pss-default` (id 1).
- `Invoice.invoiceNumber` stays globally unique (ledger join key); `trackingId` is org-scoped.
- Manual super-admin approval for new accounts (no auto-activate).
- Billing: Stripe Checkout + webhooks, with a manual "mark paid" fallback for non-card markets.
- The platform's own workspace (org id 1) is exempt from plan limits and never auto-suspended.

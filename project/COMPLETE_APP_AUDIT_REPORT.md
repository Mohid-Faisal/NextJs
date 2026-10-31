# Complete Multi-Domain Application Audit & Next-Level Blueprint

**Target Codebase:** `c:\NextJs\project`  
**Audit Date:** 2026-10-18  
**Scope:** Security & Multi-Tenancy · Business Logic & Double-Entry Accounting · Database & Prisma Schema · UI/UX & Design System · Accessibility (a11y) · Frontend & Backend Performance · Next-Level Product Blueprint

---

## Table of Contents

1. [Executive Scorecard & Top Systemic Findings](#1-executive-scorecard--top-systemic-findings)
2. [Domain 1: Security, Authentication, Multi-Tenancy & API Hardening](#2-domain-1-security-authentication-multi-tenancy--api-hardening)
   - [1.1 Critical Security Vulnerabilities](#11-critical-security-vulnerabilities)
   - [1.2 High-Severity Security Vulnerabilities](#12-high-severity-security-vulnerabilities)
   - [1.3 Medium-Severity Security Vulnerabilities](#13-medium-severity-security-vulnerabilities)
   - [1.4 Low-Severity Security Findings](#14-low-severity-security-findings)
3. [Domain 2: Business Logic, Double-Entry Accounting, Ledger & Database Architecture](#3-domain-2-business-logic-double-entry-accounting-ledger--database-architecture)
   - [2.1 Database Architecture & Prisma Schema (`prisma/schema.prisma`)](#21-database-architecture--prisma-schema-prismaschemaprisma)
   - [2.2 Double-Entry Accounting & General Ledger Bugs](#22-double-entry-accounting--general-ledger-bugs)
   - [2.3 Payment Processing, Allocation, Edit & Delete Bugs](#23-payment-processing-allocation-edit--delete-bugs)
   - [2.4 Shipment & Invoice Lifecycle Bugs](#24-shipment--invoice-lifecycle-bugs)
   - [2.5 Sequence Generation, Concurrency & SaaS Billing Bugs](#25-sequence-generation-concurrency--saas-billing-bugs)
4. [Domain 3: UI/UX, Design System, Frontend Architecture & Accessibility](#4-domain-3-uiux-design-system-frontend-architecture--accessibility)
   - [3.1 Design System, Typography, Color Tokens & Dark/Light Mode](#31-design-system-typography-color-tokens--darklight-mode)
   - [3.2 Navigation, Layout & Mobile Responsiveness](#32-navigation-layout--mobile-responsiveness)
   - [3.3 Core Operational Workflows: Fake Controls, Bugs & UX Traps](#33-core-operational-workflows-fake-controls-bugs--ux-traps)
   - [3.4 Accessibility (a11y) Audit](#34-accessibility-a11y-audit)
5. [Domain 4: Performance, Runtime Architecture, DevOps & Testing](#5-domain-4-performance-runtime-architecture-devops--testing)
   - [4.1 Backend Session & Permission Query Amplification (6–7 DB Queries per Request)](#41-backend-session--permission-query-amplification-67-db-queries-per-request)
   - [4.2 Client-Side Fetching Waterfalls & Monolithic Client Components](#42-client-side-fetching-waterfalls--monolithic-client-components)
   - [4.3 Client Bundle Bloat & Global `window.fetch` Monkey-Patching](#43-client-bundle-bloat--global-windowfetch-monkey-patching)
6. [How to Make This App Bulletproof & World-Class (The Next-Level Blueprint)](#6-how-to-make-this-app-bulletproof--world-class-the-next-level-blueprint)
   - [Part A: Making the Backend, Multi-Tenancy & Accounting Engine Bulletproof](#part-a-making-the-backend-multi-tenancy--accounting-engine-bulletproof)
   - [Part B: Elevating UI/UX to Linear / Stripe / Flexport Grade](#part-b-elevating-uiux-to-linear--stripe--flexport-grade)
   - [Part C: Prioritized Execution Roadmap](#part-c-prioritized-execution-roadmap)

---

## 1. Executive Scorecard & Top Systemic Findings

| Domain | Current Score | Key Strengths | Primary Risks |
| :--- | :---: | :--- | :--- |
| **Security & Multi-Tenancy** | **4.5 / 10** | Server-backed `AuthSession` table, `orgWhere`/`orgData` helpers, signed tracking tokens, strict TS/ESLint builds. | Fired employees & Google signups auto-promote to `OWNER` of `pss-default`; cross-tenant `User` takeover; dead CSRF middleware matcher; HTML invoice XSS. |
| **Accounting & Business Logic** | **4.0 / 10** | Full sub-ledger + General Ledger + `PaymentAllocation` data model; `OrgSequence` counters. | Customer/vendor invoice numbers collide on every 3rd shipment (`N` vs `N+2`); `Decimal` string concatenation (`+`); broken period-close & credit application logic. |
| **Database & Schema Design** | **5.5 / 10** | Monetary columns migrated to `Decimal(19, 4)`; `AuditLog` table present. | `relationMode = "prisma"` disables DB foreign keys; global `@unique` on `CreditNote`/`DebitNote` numbers breaks multi-tenancy; double-encoded JSON columns. |
| **UI/UX & Design System** | **4.5 / 10** | Rich feature set, dark mode support, interactive maps, thermal & A4 print templates. | Mobile layout crushed to `119px` (`ml-64`); 20+ non-existent Tailwind shade classes (`bg-gray-105`, `text-indigo-655`); fake CSV import modals; dead buttons. |
| **Frontend & API Performance** | **3.5 / 10** | Virtualization dependency installed; Turbopack dev server. | 100% `"use client"` monoliths (up to 2,306 lines); 12-request sequential waterfall in Settings; `6–7` DB queries per API call just for session/permission checks. |

---

## 2. Domain 1: Security, Authentication, Multi-Tenancy & API Hardening

### 1.1 Critical Security Vulnerabilities

#### [SEC-CRIT-1] Automatic Privilege Escalation to `OWNER` of Default Organization (`pss-default`) for Removed Employees, Google Signups, and Empty-Company Signups
- **Locations:**
  - `src/lib/auth/membership.ts` (lines 36–82)
  - `src/app/api/auth/google/callback/route.ts` (lines 95–144)
  - `src/app/api/org/members/[id]/route.ts` (line 128)
  - `src/app/api/users/[id]/route.ts` (line 180)
  - `src/app/api/signup/route.ts` (lines 96–114)
- **Root Cause:**
  In `src/lib/auth/membership.ts:46-74`, `resolveMembership(userId)` contains a legacy migration fallback: whenever a `User` has zero `OrganizationMember` rows, it looks up the organization with `slug: "pss-default"` (Organization 1 — the platform owner's workspace) and **automatically inserts an `OrganizationMember` row with `role: "OWNER"`**:
  ```ts
  const created = await prisma.organizationMember.create({
    data: {
      userId,
      organizationId: defaultOrg.id,
      role: "OWNER",
    },
    ...
  });
  ```
  This is reachable in three live user flows:
  1. **Removed / Fired Employees (`src/app/api/org/members/[id]/route.ts:128` & `src/app/api/users/[id]/route.ts:180`):** Removing a member from an organization only deletes their `OrganizationMember` row (leaving `User.isApproved = true` and `User.status = "ACTIVE"`). On their very next `POST /api/login` (`src/app/api/login/route.ts:105`), `resolveMembership(user.id)` sees 0 memberships and **promotes the fired employee to `OWNER` of `pss-default`**!
  2. **New Google OAuth Signups (`src/app/api/auth/google/callback/route.ts:123-144`):** When a brand-new user signs up via Google (`isNewUser = true`), line 123 calls `let membership = await resolveMembership(user.id)` **before** line 125 (`if (!membership && isNewUser)`). Because `resolveMembership` finds `pss-default` and makes the new user `OWNER` of `pss-default`, `membership` is non-null, line 125 is skipped, and **every new Google OAuth user becomes `OWNER` of `pss-default`** instead of getting their own isolated tenant!
  3. **Standard Signup without `companyName` (`src/app/api/signup/route.ts:96`):** `if (companyName && companyName.trim())` is optional. Signing up without `companyName` creates a `User` with no organization; once approved, `resolveMembership` makes them `OWNER` of `pss-default`.
- **Remediation:**
  1. Remove the auto-creation of `OrganizationMember` in `resolveMembership(userId)` (`src/lib/auth/membership.ts:57-81`) and return `null` when no membership exists.
  2. In `GET /api/auth/google/callback`, call `createOrganizationForSignup` first when `isNewUser === true` before calling `resolveMembership`.
  3. In `POST /api/signup`, require `companyName` (non-empty string) via Zod validation.
  4. When removing a user's last `OrganizationMember` row in `DELETE /api/org/members/[id]` and `DELETE /api/users/[id]`, call `revokeAllUserSessions(userId)` and deactivate the user if they have no other memberships.

---

#### [SEC-CRIT-2] Cross-Tenant Account Takeover (ATO) & Super-Admin Privilege Escalation via Unconsented Org Membership + Global `User` Mutation
- **Locations:**
  - `src/app/api/org/members/route.ts` (lines 101–146, 212)
  - `src/app/api/users/[id]/route.ts` (lines 38–83)
  - `src/lib/auth/session.ts` (lines 194–206)
- **Root Cause:**
  1. In `POST /api/org/members` (`src/app/api/org/members/route.ts:101-146`), any tenant `OWNER` or `ADMIN` can supply the email address of **any existing `User` on the platform** (including another tenant's `OWNER` or a platform `SUPER_ADMIN`). Instead of sending an invite token requiring user consent, the endpoint immediately creates an `OrganizationMember` row linking that existing `User` into the caller's organization and returns `member.user.id` in the response (`line 212`).
  2. In `PUT /api/users/[id]` (`src/app/api/users/[id]/route.ts:38-47`), tenant authorization only checks:
     ```ts
     const target = await prisma.user.findFirst({
       where: {
         id: userId,
         memberships: { some: { organizationId: session.organizationId } },
       },
     });
     ```
  3. Once that check passes, `PUT /api/users/[id]` (`lines 57-64`) mutates the **global `User` record**:
     ```ts
     const updatedUser = await prisma.user.update({
       where: { id: userId },
       data: { name, email, role, status },
     });
     ```
  4. Because `User` is a global identity shared across memberships (and `User.platformRole === "SUPER_ADMIN"` lives on `User`, while `getSession()` resolves the user's primary workspace via `orderBy: { id: "asc" }` at `src/lib/auth/session.ts:196`), an attacker who is `OWNER`/`ADMIN` of any tenant org can:
     - Add a victim (`SUPER_ADMIN` or another tenant's `OWNER`) to the attacker's org by email via `POST /api/org/members`.
     - Call `PUT /api/users/[victimId]` to overwrite the victim's global `email` with an attacker-controlled email address.
     - Trigger `POST /api/reset-password` + `PATCH /api/reset-password` on that email to set a new password and take over the victim's account (including their primary organization and `SUPER_ADMIN` privileges).
     - Alternatively, set `status: "SUSPENDED"` via `PUT /api/users/[victimId]` (`lines 75-83`), which calls `revokeAllUserSessions(userId)` and globally locks the victim out of their own organization.
- **Remediation:**
  1. Never allow `PUT /api/users/[id]` to mutate global `User` fields (`email`, `name`, `status`, `role`) for a user who belongs to another organization or who is a `SUPER_ADMIN`, or restrict `email`/`name` changes to `/api/profile/me` (self-service with password re-authentication and email verification).
  2. Scope `PUT /api/users/[id]` and `DELETE /api/users/[id]` to only mutate the caller org's `OrganizationMember` row (like `/api/org/members/[id]`), not global `User.status` or `User.email`.
  3. In `POST /api/org/members`, if `user` already exists in another organization, require an email invitation + confirmation flow rather than silently attaching `OrganizationMember`.

---

### 1.2 High-Severity Security Vulnerabilities

#### [SEC-HIGH-1] CSRF Middleware Protection Is 100% Dead Code Due to `config.matcher` Exclusion
- **Location:** `src/middleware.ts` (lines 27–51 and 114–127)
- **Root Cause:**
  Lines 27–51 implement CSRF `Origin` validation for state-changing requests where `pathname.startsWith("/api")`. However, `config.matcher` at line 125 is:
  ```ts
  "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*$).*)"
  ```
  The negative lookahead `(?!api|...)` prevents Next.js from ever invoking `middleware()` on any `/api/*` route! As a result, the entire CSRF check in `src/middleware.ts` never executes.
- **Remediation:**
  Remove `api|` from the negative lookahead in `src/middleware.ts:125` (so `middleware` runs on `/api/*`, executes the CSRF check on lines 31–51, and then returns `NextResponse.next()` on line 64 because `isApiRoute` is true).

---

#### [SEC-HIGH-2] Cross-Tenant Shipment Tampering (IDOR) in `PUT /api/accounts/invoices/[id]/edit`
- **Location:** `src/app/api/accounts/invoices/[id]/edit/route.ts` (lines 74–97, 130–203)
- **Root Cause:**
  Unlike `GET /api/accounts/invoices/[id]/edit` (which passes `{ shipmentId: parseInt(shipmentId) }` to `findOrgInvoice` at line 32), `PUT /api/accounts/invoices/[id]/edit` calls `findOrgInvoice(session, invoiceId, {}, ...)` at line 89 without verifying `shipmentId`. Then at lines 131–132 and 197–200:
  ```ts
  const parsedShipmentId = Number.isFinite(shipmentId) && shipmentId > 0 ? shipmentId : null;
  const targetShipmentId = parsedShipmentId || currentInvoice.shipmentId || currentInvoice.shipment?.id || null;
  if (targetShipmentId) {
    ...
    await tx.shipment.update({
      where: { id: targetShipmentId },
      data: shipmentUpdateData
    });
  }
  ```
  An authenticated user in Tenant B can pass their own `invID` in the query string and **any other tenant's `shipmentId` in the `[id]` path parameter** (`PUT /api/accounts/invoices/<victimShipmentId>/edit?invID=<ownInvoiceId>`) to overwrite the victim tenant's `Shipment` fields (`trackingId`, `destination`, `referenceNumber`, `discount`, `fuelSurcharge`, `packages`, `calculatedValues`, `totalCost`, `price`, `cos`).
- **Remediation:**
  Verify that `targetShipmentId` belongs to `session.organizationId` (via `tx.shipment.findFirst({ where: orgWhere(session, { id: targetShipmentId }) })`) and matches `currentInvoice.shipmentId` before calling `tx.shipment.update`.

---

#### [SEC-HIGH-3] Cross-Tenant `ChartOfAccount` & `Customers`/`Vendors` IDOR Across Payment, Credit Note, Debit Note & Vendor-Excel Endpoints
- **Locations:**
  1. `src/app/api/accounts/payments/route.ts` (`POST`, lines 296–310, 446–469)
  2. `src/app/api/accounts/payments/[id]/route.ts` (`PUT`, lines 120–135, 266–289)
  3. `src/app/api/accounts/payments/vendor-excel/route.ts` (`POST`, lines 182–189, 246–250) & `src/lib/accounts/vendorPaymentAccounts.ts` (lines 95–112)
  4. `src/app/api/accounts/payments/backfill-journal-entries/route.ts` (`POST`, lines 209–212)
  5. `src/app/api/credit-notes/[id]/route.ts` (`PUT`, lines 192–200 vs. 273–285)
  6. `src/app/api/debit-notes/[id]/route.ts` (`PUT`, lines 190–198 vs. 271–283)
  7. `src/lib/accounts/skynetVendorAutoPay.ts` (lines 24–46)
- **Root Causes:**
  1. **Unvalidated `debitAccountId` / `creditAccountId` in `POST /api/accounts/payments` & `PUT /api/accounts/payments/[id]`:** Neither route checks `findOrgChartAccount(session, ...)`. Any tenant can pass another tenant's `ChartOfAccount.id` as `debitAccountId` or `creditAccountId`. When `GET /api/account-books` or `GET /api/journal-entries` runs (`include: { lines: { include: { account: true } } }`), the other tenant's `ChartOfAccount` details (`accountName`, `code`, `category`) are leaked in the response.
  2. **Unvalidated `fromCustomerId` / `toVendorId` in `PUT /api/accounts/payments/[id]` (`lines 128-130`):** Directly writes `body.fromCustomerId` and `body.toVendorId` onto `prisma.payment.update` without checking tenant ownership.
  3. **Unscoped `chartOfAccount.findMany` in `POST /api/accounts/payments/vendor-excel` (`lines 182-184`):**
     ```ts
     const coaRows = await prisma.chartOfAccount.findMany({
       where: { isActive: true },
     });
     ```
     Missing `orgWhere(session)`! Every Excel vendor payment import resolves `Accounts Payable` and `Cash`/`Bank` from the first active `ChartOfAccount` rows in the database (Organization 1), posting Tenant B's journal entry lines against Organization 1's accounts.
  4. **Hardcoded Fallback Account IDs in `backfill-journal-entries` (`lines 209-212`):** Falls back to `{ id: 1 }` and `{ id: 2 }` (Organization 1's accounts) if the caller's org has no matching accounts.
  5. **Partial Account Validation Bypass in `PUT /api/credit-notes/[id]` (`line 192`) and `PUT /api/debit-notes/[id]` (`line 190`):**
     Ownership is only checked when **both** `debitAccountId !== null && creditAccountId !== null`, but lines 273–285 (`credit-notes/[id]`) and lines 271–283 (`debit-notes/[id]`) update `journalEntryLine.accountId` whenever **either** `debitAccountId !== null` or `creditAccountId !== null`. Passing only `debitAccountId` (and omitting `creditAccountId`) bypasses `findOrgChartAccount` and links the journal line to another tenant's `ChartOfAccount`.
  6. **Unscoped `payment.groupBy` in `skynetVendorAutoPay.ts` (`lines 31-38`):** `vendorExpensePaidTotalsByInvoice` sums payments by `invoice: { in: invoiceNumbers }` without `organizationId`, causing cross-tenant invoice number collisions (`600002`, etc.) to skip unpaid vendor bills.
- **Remediation:**
  - Validate `debitAccountId` and `creditAccountId` via `findOrgChartAccount(session, ...)` in `POST /api/accounts/payments` and `PUT /api/accounts/payments/[id]`.
  - Validate `fromCustomerId` and `toVendorId` against `orgWhere(session)` in `PUT /api/accounts/payments/[id]`.
  - Add `orgWhere(session, { isActive: true })` to `prisma.chartOfAccount.findMany` in `src/app/api/accounts/payments/vendor-excel/route.ts:182` and pass `organizationId` into `findLatestVendorInvoiceBeforePaymentDate`.
  - Remove hardcoded `{ id: 1 }` / `{ id: 2 }` fallbacks in `backfill-journal-entries/route.ts:210-211`.
  - In `PUT /api/credit-notes/[id]` and `PUT /api/debit-notes/[id]`, validate `debitAccountId` and `creditAccountId` independently whenever either is non-null.
  - Add `organizationId` to `vendorExpensePaidTotalsByInvoice` and `getJournalEntryBase` in `src/lib/accounts/skynetVendorAutoPay.ts`.

---

#### [SEC-HIGH-4] Self-Unban / Account Status Bypass via Password Reset Flow & Missing Session Revocation on Password Change
- **Locations:**
  - `src/app/api/reset-password/route.ts` (lines 28–68, 99–152)
  - `src/app/api/profile/change-password/route.ts` (lines 68–80)
  - `src/app/api/users/[id]/route.ts` (lines 57–83)
- **Root Cause:**
  1. When an admin suspends or deactivates a user (`status: "SUSPENDED"` or `"INACTIVE"`), `user.isApproved` remains `true`.
  2. `POST /api/reset-password` (`lines 36-54`) does not check `user.status` or `user.isApproved` before overwriting `user.status` with `PENDING_PASSWORD_RESET_<code>_<expiry>` (and if email delivery fails at `line 63`, it unconditionally resets `status: "ACTIVE"`!).
  3. `PATCH /api/reset-password` sets `status: "ACTIVE"` both when a valid code is submitted (`line 146`) **and** when an expired code is submitted (`line 135`)!
  4. Consequently, any suspended/deactivated user (or an unapproved user in `PENDING_VERIFICATION` / `PENDING_PLAN_SELECTION`) can reset their own `user.status` back to `"ACTIVE"`.
  5. Additionally, neither `PATCH /api/reset-password` (`line 143`) nor `POST /api/profile/change-password` (`line 72`) calls `revokeAllUserSessions(user.id)` after changing the password, leaving compromised sessions active.
- **Remediation:**
  1. Stop storing password reset tokens in `User.status` (use dedicated `resetTokenHash`/`resetTokenExpiresAt` columns, or only allow `POST /api/reset-password` when `user.status === "ACTIVE"` or `"PENDING_PASSWORD_RESET_..."`).
  2. Call `await revokeAllUserSessions(user.id)` in `PATCH /api/reset-password` and `POST /api/profile/change-password` after updating `password`.

---

#### [SEC-HIGH-5] Cross-Tenant `AppSetting` Read (IDOR) via Legacy Fallback in `GET /api/settings/custom`
- **Location:** `src/app/api/settings/custom/route.ts` (lines 22–46)
- **Root Cause:**
  `readSetting(session, key)` first looks up `org${session.organizationId}:${key}`, and if not found, falls back to querying the raw `key` directly (`line 33`):
  ```ts
  const legacy = await prisma.appSetting.findUnique({ where: { key } });
  ```
  Because `keySchema` (`z.string().min(1).max(120)`) does not block keys starting with `org`, any authenticated user (including `Customer` or `Vendor` roles, since `GET` only requires a basic session) can request `GET /api/settings/custom?key=org1:settings_billing` or `GET /api/settings/custom?key=org2:settings_role_permissions` and read any other tenant's `AppSetting` row via the legacy fallback.
- **Remediation:**
  Reject keys matching `/^org\d+:/i` in `keySchema` (e.g., `.refine(k => !/^org\d+:/i.test(k))`) and restrict the unscoped legacy fallback to `session.organizationId === 1` (or migrate `AppSetting` to include an `organizationId` column).

---

#### [SEC-HIGH-6] Reflected & Stored XSS in HTML Invoice & PDF Endpoints (`/api/accounts/invoices/[id]/invoice` & `/pdf`)
- **Locations:**
  - `src/app/api/accounts/invoices/[id]/invoice/route.ts` (lines 22, 36–44, 122–140, 147–154, 251–259, 281, 393, 412–423, 462–470, 492–500, 631–673)
  - `src/app/api/accounts/invoices/[id]/pdf/route.ts` (lines 14–16, 25–62)
- **Root Cause:**
  `GET /api/accounts/invoices/[id]/invoice` serves a full HTML document with `Content-Type: text/html` (`line 152`). It accepts arbitrary JSON in the query parameter `?data=` (`line 38: invoice = JSON.parse(formData)`) as well as `?support_email=`, `?support_phone=`, and `?support_address=`. It interpolates `invoice.invoiceNumber`, `supportAddress`, `supportPhone`, `supportEmail`, `item.description`, `pkg.packageDescription`, and customer/vendor fields directly into HTML markup and `<script>` blocks without HTML/JS escaping (for example, `JsBarcode(canvas, "${invoice.invoiceNumber}", ...)` at line 652).
- **Remediation:**
  HTML-escape all dynamic values before interpolating into HTML templates, JSON-encode (`JSON.stringify`) any values interpolated into `<script>` blocks, and add a strict `Content-Security-Policy` header on the HTML invoice response.

---

#### [SEC-HIGH-7] Missing Role/Permission & Subscription Gating on Destructive Configuration, Rate, Zone, Office, Recipient & Shipment Endpoints
- **Locations:**
  - `src/app/api/settings/vendorService/route.ts` (`POST` line 27, `DELETE` line 68 — `DELETE` cascade-deletes all `rate` and `filename` records for that vendor+service)
  - `src/app/api/rates/route.tsx` (`POST` line 8, `DELETE` line 327 — overwrites/deletes org pricing rates)
  - `src/app/api/remote-areas/route.ts` (`POST` line 442, `DELETE` line 693 — calling `DELETE /api/remote-areas` without `?company=` deletes **all** remote areas for the organization at line 701!)
  - `src/app/api/zones/route.ts` (`POST` line 8, `DELETE` line 279 — overwrites/deletes all org zones)
  - `src/app/api/offices/route.ts` (`POST` line 23) & `src/app/api/offices/[id]/route.ts` (`PUT` line 6, `DELETE` line 45)
  - `src/app/api/agencies/route.ts` (`POST` line 23)
  - `src/app/api/recipients/route.ts` (`GET` line 8), `src/app/api/add-recipients/route.ts` (`POST` line 7), `src/app/api/recipients/[id]/route.ts` (`GET`/`PUT`/`DELETE`/`PATCH`)
  - `src/app/api/search/customers/route.ts` (`GET` line 7 — only `requireApiSession`, bypassing `view_customers` required on `/api/customers`)
  - `src/app/api/shipments/[id]/ensure-initial-tracking/route.ts` (`POST` line 32)
  - `src/app/api/shipments/[id]/send-2fa/route.ts` (`POST` line 9 — only `requireApiSession`, no `delete_shipment` permission check)
- **Root Cause:**
  All of the routes above call `requireApiSession(req)` instead of `requirePermission(req, ...)`. As documented in `src/lib/auth/requireApiSession.ts:10-12`, `requireApiSession` **does not check RBAC permissions and does not check subscription status (`isSubscriptionActive`)**. Low-privilege roles (`Customer`, `Vendor`, `Employee`) or expired-trial orgs can wipe or overwrite an organization's entire rate sheets, zones, remote areas, vendor services, offices, and recipients.
- **Remediation:**
  Replace `requireApiSession` with `requirePermission` (or `withAuth({ permission: ... })`) using appropriate permissions (`manage_rates`, `manage_services`, `view_customers`, `manage_customers`, `edit_shipment`, `delete_shipment`).

---

### 1.3 Medium-Severity Security Vulnerabilities

#### [SEC-MED-1] Unused `orgPrisma` & `withAuth` Defensive Wrappers
- **Locations:**
  - `src/lib/tenant/orgPrisma.ts` (lines 1–127 — **0 imports** across `src/`)
  - `src/lib/api/withAuth.ts` (lines 1–194 — only imported in 4 of ~89 API routes)
- **Remediation:** Migrate route handlers to `withAuth` + `orgPrisma(session.organizationId)` so tenant scoping and RBAC enforcement are automatic by construction.

#### [SEC-MED-2] Google OAuth Missing `state` Parameter (Login CSRF), Missing `verified_email` Check, and Missing `user.status` Check
- **Locations:** `src/app/api/auth/google/route.ts` (lines 3–20), `src/app/api/auth/google/callback/route.ts` (lines 11–65, 95–115, 168–191)
- **Root Cause:**
  1. `GET /api/auth/google` redirects to Google without generating a cryptographic `state` parameter or storing it in an `httpOnly` cookie, and `GET /api/auth/google/callback` never validates `state` (enabling Login CSRF).
  2. `callback/route.ts` does not check `profile.verified_email === true` before linking by email (`line 95`).
  3. For existing users (`lines 109-115`), `callback/route.ts` checks `if (!user.isApproved)` when `!hasOrg`, **but never checks `if (user.status !== "ACTIVE")` or `if (!user.isApproved)` when `hasOrg` is true**! A `SUSPENDED` or `INACTIVE` user who belongs to an org can bypass `POST /api/login` restrictions simply by signing in with Google.

#### [SEC-MED-3] Missing Brute-Force Rate Limiting on Password Re-Auth & 6-Digit 2FA Verification Endpoints
- **Locations:**
  - `src/app/api/shipments/[id]/send-2fa/route.ts` (lines 55–91)
  - `src/app/api/shipments/[id]/route.ts` (`DELETE`, lines 165–222)
  - `src/app/api/saas/organizations/[id]/send-2fa/route.ts` (lines 41–73)
  - `src/app/api/saas/organizations/[id]/route.ts` (`DELETE`, lines 122–158)
  - `src/app/api/accounts/payments/[id]/route.ts` (`DELETE`, lines 344–362)
  - `src/app/api/customers/[id]/route.ts` (`DELETE`, lines 176–195)
  - `src/app/api/vendors/[id]/route.ts` (`DELETE`, lines 148–167)
  - `src/app/api/recipients/[id]/route.ts` (`DELETE`, lines 169–188)
- **Root Cause:** None of these endpoints apply `rateLimit()` before verifying `bcrypt.compare(password, user.password)` or checking the 6-digit `twoFactorCode`, and failed 2FA attempts do not increment an attempt counter or invalidate the code.

#### [SEC-MED-4] Public Shipment Tracking Endpoint Allows Global Sequential `bookingId` Enumeration Across All Tenants
- **Location:** `src/app/api/track/route.ts` (lines 49–67)
- **Root Cause:** Unauthenticated callers can omit the signed token `?t=` and pass sequential `?bookingId=600001` (`lines 49-67`), executing an unscoped query across all organizations (`where: { OR: [{ invoiceNumber: cleanId }, { trackingId: cleanId }] }`).

#### [SEC-MED-5] Rate-Limiter IP Spoofing (`x-real-ip` / `x-forwarded-for`) & In-Memory Store Limitations
- **Location:** `src/lib/rateLimit.ts` (lines 13, 67–74)
- **Root Cause:** `getClientIp(req)` trusts `x-real-ip` and the first entry of `x-forwarded-for`. Also rate-limit authentication endpoints by normalized email (`email.toLowerCase()`) in addition to IP.

#### [SEC-MED-6] Content-Security-Policy Is Report-Only (Not Enforced) & Allows `'unsafe-inline'` / `'unsafe-eval'`
- **Location:** `next.config.ts` (lines 11–46)
- **Remediation:** Promote `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and omit `'unsafe-eval'` in production.

#### [SEC-MED-7] Unbounded Queries & Uncapped File Upload Buffers (DoS Vectors)
- **Locations:**
  - `src/app/api/account-books/route.ts` (lines 20, 70: `?limit=all` or `?limit=none` bypasses pagination)
  - `src/app/api/remote-areas/route.ts` (lines 484, 670: no file size limit before `file.arrayBuffer()` / `pdfParse`; `GET` at line 670 returns all `remoteArea` rows unpaginated)
  - `src/app/api/rates/route.tsx` (line 41), `src/app/api/zones/route.ts` (line 40), `src/app/api/accounts/payments/bulk-import/route.ts` (line 304), `src/app/api/accounts/payments/vendor-excel/route.ts` (line 169), `src/app/api/bulk-upload-shipments/route.ts` (line 58): no file size cap before buffering into memory.

---

### 1.4 Low-Severity Security Findings

- **[SEC-LOW-1] Unauthenticated Information Disclosure & Log-Spam Endpoints:**
  - `src/app/api/user-activity/route.ts` (`GET`, lines 43–68): Unauthenticated `GET` returns global active user count.
  - `src/app/api/dashboard/route.ts` (`GET`, lines 172, 176, 952, 999): Queries `prisma.user.count()` globally without scoping to `organizationId`.
  - `src/app/api/plans/route.ts` (`GET`, lines 10–71): Unauthenticated `GET` exposes `activeSubscribers: plan._count.subscriptions`.
  - `src/app/api/client-error/route.ts` (`POST`, lines 5–19): Unauthenticated `POST` has no `rateLimit()` or schema cap.
- **[SEC-LOW-2] Raw Error Message Leakage in API 500 Responses:**
  - `src/app/api/add-customers/route.ts:189`, `src/app/api/agencies/route.ts:51`, `src/app/api/accounts/invoices/[id]/route.ts:319`, `src/app/api/accounts/invoices/[id]/edit/route.ts:252`, `src/app/api/accounts/payments/backfill-journal-entries/route.ts:261`, `src/app/api/accounts/reconcile/route.ts:36`, `src/app/api/chart-of-accounts/route.ts:232`.

---

## 3. Domain 2: Business Logic, Double-Entry Accounting, Ledger & Database Architecture

### 2.1 Database Architecture & Prisma Schema (`prisma/schema.prisma`)

#### [LOGIC-CRIT-1] Global `@unique` on `DebitNote.debitNoteNumber` and `CreditNote.creditNoteNumber` Breaks Multi-Tenant Sequence Generation
- **Locations:**
  - `prisma/schema.prisma:549-550` (`DebitNote.organizationId Int?`, `debitNoteNumber String @unique`)
  - `prisma/schema.prisma:567-568` (`CreditNote.organizationId Int?`, `creditNoteNumber String @unique`)
  - `src/app/api/credit-notes/route.ts:262`
  - `src/app/api/debit-notes/route.ts:258`
- **Root Cause:** `credit-notes/route.ts:262` and `debit-notes/route.ts:258` generate note numbers per organization using `nextSequenceNumber(prisma, session.organizationId, seqKey)`, which starts at `#CR0001` / `#DR0001` for **every** tenant. However, `creditNoteNumber` and `debitNoteNumber` have a **global** `@unique` constraint in `schema.prisma` instead of a composite `@@unique([organizationId, creditNoteNumber])` / `@@unique([organizationId, debitNoteNumber])`.
- **Impact:** As soon as Organization B creates its first Credit Note (`#CR0001`) or Debit Note (`#DR0001`), Prisma throws a `P2002` unique constraint violation against Organization A's `#CR0001` / `#DR0001`.
- **Fix:**
  1. Make `organizationId` non-nullable (`Int`) on `DebitNote`, `CreditNote`, and `JournalEntryLine` (`prisma/schema.prisma:549, 567, 623`) after backfilling `NULL` rows.
  2. Replace `@unique` on `debitNoteNumber` and `creditNoteNumber` with `@@unique([organizationId, debitNoteNumber])` and `@@unique([organizationId, creditNoteNumber])`.

---

#### [LOGIC-CRIT-2] Prisma `Decimal` String-Concatenation Bugs (`+` Operator on `Prisma.Decimal`)
- **Locations:**
  - `src/lib/prisma.ts:16-32` & `scripts/patch-prisma-decimal-types.js:14-15`
  - `src/app/api/update-shipment/route.tsx:140, 174`
  - `src/app/api/accounts/payments/[id]/route.ts:94, 166`
  - `src/app/api/accounts/invoices/[id]/route.ts:356, 386`
  - `src/app/api/credit-notes/[id]/route.ts:171, 220`
  - `src/app/api/debit-notes/[id]/route.ts:171, 218`
  - `src/app/api/accounts/payments/allocate/route.ts:160-161, 194-195`
  - `src/lib/accounts/skynetVendorAutoPay.ts:42, 219`
  - `src/app/api/accounts/close-period/route.ts:111, 115`
- **Root Cause:** `scripts/patch-prisma-decimal-types.js` rewrites Prisma's generated `.d.ts` files (`export type Decimal = number`) so TypeScript assumes every `Decimal` field is a JS `number`. At runtime, `src/lib/prisma.ts:18` checks `if (value instanceof Decimal) return value.toNumber()`. Whenever `instanceof Decimal` fails across bundler module realms or unhydrated objects, `Decimal` instances remain objects whose binary `+` operator calls `.toString()` and performs **string concatenation** (`"1500.0000" + 250 === "1500.0000250"`).
- **Fix:**
  1. In `src/lib/prisma.ts:18`, replace `if (value instanceof Decimal)` with duck-typing:
     ```ts
     if (
       typeof value === "object" &&
       value !== null &&
       "toNumber" in value &&
       typeof (value as { toNumber: unknown }).toNumber === "function"
     ) {
       return (value as { toNumber: () => number }).toNumber();
     }
     ```
  2. Wrap all arithmetic operands in `money()` (`src/lib/money.ts`) and use Prisma atomic `{ increment: money(delta) }` / `{ decrement: money(delta) }` for all balance updates.

---

#### [LOGIC-HIGH-1] `relationMode = "prisma"` Disables Database-Level Foreign Keys & Leaves Orphaned Records
- **Locations:**
  - `prisma/schema.prisma:8` (`relationMode = "prisma"`)
  - Missing `@relation` on `Payment.fromCustomerId` (`L472`) and `Payment.toVendorId` (`L475`)
  - Missing `@relation` to `Organization` on tenant models (`Shipment`, `Customers`, `Vendors`, `Recipients`, `Rate`, `CustomerTransaction`, `VendorTransaction`, `Payment`, `PaymentAllocation`, `Invoice`, `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`, `FixedCharge`).
- **Root Cause:** With `relationMode = "prisma"`, MySQL creates zero foreign key constraints. Any `deleteMany` or direct `delete` that forgets to manually clean up child tables leaves permanent orphan records (e.g., `src/app/api/accounts/invoices/[id]/route.ts:418` deletes `Invoice` without deleting `PaymentAllocation`, `CreditNote`, or `DebitNote`).

---

#### [LOGIC-HIGH-2] Schema Data Type Mismatches (`Int`, `Float`, Double-Encoded `Json`, Semantic Collision on `discount`)
- **Locations:**
  - `prisma/schema.prisma:374`: `Rate.price Int` — shipping rate table cannot store decimal prices (e.g., `12.50`).
  - `prisma/schema.prisma:370, 644, 125-129, 140, 146-147, 518`: `weight`, `length`, `width`, `height`, `weightVol`, `profitPercentage` use `Float` (IEEE 754 binary float), causing precision mismatches in rate tier equality/comparison queries (`add-shipment/route.ts:217`).
  - `prisma/schema.prisma:133` vs `521`: `Shipment.discount` stores a **percentage** (`add-shipment/route.ts:486`), whereas `Invoice.discount` stores a **monetary amount** (`add-shipment/route.ts:527`). However, `src/app/api/accounts/invoices/[id]/edit/route.ts:147, 155` writes `body.discount` (a monetary amount) into **both** `invoice.discount` and `shipment.discount`, corrupting `shipment.discount`!
  - `prisma/schema.prisma:150-152`: `Shipment.packages`, `packageTotals`, and `calculatedValues` are typed as `Json?`, but `src/app/api/add-shipment/route.ts:501-503`, `src/app/api/update-shipment/route.tsx:456-458`, and `src/app/api/bulk-upload-shipments/route.ts:492-493` pass `JSON.stringify(...)`, storing a **double-encoded JSON string** inside a JSON column (whereas `src/app/api/accounts/invoices/[id]/edit/route.ts:178` stores an object directly).

---

#### [LOGIC-MED-1] Missing Composite Indexes for Hot Ledger & Accounting Queries
- **Location:** `prisma/schema.prisma:394-431, 464-489, 509-546, 602-620`
- **Fix:** Add composite indexes:
  - `CustomerTransaction`: `@@index([organizationId, customerId, createdAt])`, `@@index([organizationId, invoice])`, `@@index([organizationId, reference])`
  - `VendorTransaction`: `@@index([organizationId, vendorId, createdAt])`, `@@index([organizationId, invoice])`, `@@index([organizationId, reference])`
  - `Payment`: `@@index([organizationId, fromCustomerId])`, `@@index([organizationId, toVendorId])`
  - `Invoice`: `@@index([organizationId, status])`, `@@index([organizationId, profile, status])`
  - `JournalEntry`: `@@index([organizationId, reference])`, `@@index([organizationId, date])`

---

### 2.2 Double-Entry Accounting & General Ledger Bugs

#### [LOGIC-CRIT-3] Period Close (`POST /api/accounts/close-period`) Corrupts the General Ledger
- **Location:** `src/app/api/accounts/close-period/route.ts:12, 78-231`
- **Root Causes:**
  1. **Broken Accounting Entry (`L166-231`):** A period-end closing entry must debit **each** Revenue account by its credit balance and credit **each** Expense account by its debit balance, transferring the net difference to Retained Earnings / Current Year Earnings so all temporary accounts reset to `0`. Instead, `close-period/route.ts` creates only **two lines total**: one line on `Current Year Earnings` for `Math.abs(netIncome)` and one balancing line for `Math.abs(netIncome)` on **only `revenueAccounts[0]`** (when `netIncome > 0`, `L187-197`) or **only `expenseAccounts[0]`** (when `netIncome < 0`, `L218-229`)!
     - Every other revenue and expense account is **never closed**.
     - `revenueAccounts[0]` is debited by `netIncome` (`totalRevenue - totalExpenses`) instead of its own balance, leaving it with an arbitrary residual balance!
  2. **Ignores `startDate` (`L78-84`):** Queries all posted journal entries with `date: { lte: endDate }` from the beginning of time without `gte: startDate`. Since temporary accounts aren't zeroed out properly, closing a second period re-includes all prior periods' revenue and expenses!
  3. **Ignores Contra-Balances (`L124-130`):** Only adds `if (balance > 0)` to `totalRevenue` / `totalExpenses`, ignoring refunds/reversals that gave an account a negative balance.
  4. **One-Sided Unbalanced Journal Entry (`L185, 217`):** If `netIncome < 0` and `expenseAccounts.length === 0` (or vice versa), the `if` condition skips the second line and inserts a 1-line unbalanced `JournalEntry`.
  5. **Wrong Permission (`L12`):** Uses `requirePermission(req, "view_revenue")` (a read-only permission) for an irreversible period-closing mutation.
- **Fix:**
  - Require `"manage_billing"` / `"manage_accounts"` permission.
  - Filter journal entries by `date: { gte: startDate, lte: endDate }` (or compute true unclosed balances of all `Revenue` and `Expense` accounts as of `endDate`).
  - Create one `JournalEntryLine` per non-zero Revenue and Expense account to zero each account out, plus one balancing line to `Current Year Earnings` (`3100`), wrapped in `prisma.$transaction`, and set `organizationId: session.organizationId` on every `JournalEntryLine`.

---

#### [LOGIC-CRIT-4] Automatic Customer & Vendor Balance Application on Shipment Creation Inverts Balances & Fabricates Cash GL Entries
- **Locations:**
  - `src/app/api/add-shipment/route.ts:412-446, 511-536, 570-681`
  - `src/app/api/bulk-upload-shipments/route.ts:512-723`
- **Root Causes:**
  1. **Customer Balance Inversion in `add-shipment/route.ts:416-428, 570-624`:**
     - Sign convention (`ledger.ts:95`): `DEBIT` (invoice) **decreases** `customers.currentBalance`; `CREDIT` (payment) **increases** `customers.currentBalance`. A customer with prepaid credit has `currentBalance = +100`.
     - When creating a shipment with `customerTotalCost = 150`:
       - `appliedBalance = 100`, `remainingAmount = 50`.
       - Line 571 calls `addCustomerTransaction(tx, customerId, "DEBIT", remainingAmount = 50)` -> `currentBalance` goes from `+100` to `+50`.
       - Line 603 calls `addCustomerTransaction(tx, customerId, "CREDIT", appliedBalance = 100)` -> `currentBalance` goes from `+50` to **`+150`**!
       - Instead of consuming the `+100` credit to leave the customer owing `-50` (`+100 - 150 = -50`), it **credits the customer an extra +100 and only debits 50**, leaving them with `+150` credit!
     - Furthermore, Line 615 calls `createJournalEntryForTransaction(..., "CUSTOMER_CREDIT", 100)`, which posts **Debit Cash 100, Credit AR 100** (`ledger.ts:682-706`) — fabricating a fake cash receipt when the credit was already recorded when they originally overpaid!
     - And Line 535 sets `customerInvoice.status = "Partial"` **without creating any `Payment` or `PaymentAllocation` row**, so the next time `calculateInvoicePaymentStatus` runs, it sees `0` payments and resets the invoice to `"Unpaid"`!
  2. **Vendor Balance Inversion in `add-shipment/route.ts:430-446, 627-681`:**
     - Sign convention (`ledger.ts:135`): `DEBIT` (vendor bill) **increases** `vendors.currentBalance` (we owe vendor); `CREDIT` (payment) **decreases** `vendors.currentBalance` (negative means vendor owes us / prepaid credit).
     - When `vendorBalance = -100` and `vendorTotalCost = 150`:
       - `vendorAppliedBalance = 100`, `vendorRemainingAmount = 50`.
       - Line 628 calls `addVendorTransaction(tx, vendorId, "DEBIT", 50)` -> `currentBalance` goes from `-100` to `-50`.
       - Line 660 calls `addVendorTransaction(tx, vendorId, "CREDIT", 100)` -> `currentBalance` goes from `-50` to **`-150`**! And posts a fake `VENDOR_CREDIT` (Debit AP 100, Credit Cash 100)!
  3. **Compound Bugs in `bulk-upload-shipments/route.ts:512-723`:**
     - **Stale in-memory map across rows (`L256-267, 513-514`):** `customer.currentBalance` and `vendor.currentBalance` are loaded once into `customerMap`/`vendorMap` before the loop and **never updated in the map** after each row! A customer with `+100` credit has that same `+100` applied to **every single shipment** in the Excel file!
     - **Inverted vendor sign check (`L531`):** Checks `if (vendorBalance > 0)` (which means we **owe** the vendor money!) and treats our debt to the vendor as a prepaid credit to mark the new vendor bill `"Paid"`!
     - **Duplicate `Payment` reference collision (`L649, 694`):** Creates a `Payment` with `reference: invoiceNumber`, which collides with `@@unique([organizationId, reference])` if another payment uses `invoiceNumber`.
- **Fix:**
  - When a shipment is created for `customerTotalCost = 150`, **only** record a single `DEBIT` transaction for the full `customerTotalCost` (`150`) and a single `CUSTOMER_DEBIT` journal entry for `150`.
  - If the customer had `+100` credit, a single `DEBIT` of `150` automatically moves `currentBalance` from `+100` to `-50` (and AR in GL already had a `-100` credit from the original overpayment, so `Dr AR 150` moves AR net balance to `+50`). Do **not** record a second `CREDIT` transaction or a second `CUSTOMER_CREDIT` (Dr Cash, Cr AR) journal entry!

---

#### [LOGIC-HIGH-3] `createJournalEntryForTransaction` Silently Overwrites Existing Journal Entries Sharing a Reference
- **Location:** `src/lib/server/ledger.ts:605-638`
- **Root Cause:** Before creating a `JournalEntry`, `createJournalEntryForTransaction` checks `tx.journalEntry.findFirst({ where: { ...orgFilter, reference } })`. If found, it **overwrites** `totalDebit`, `totalCredit`, and all `journalEntryLine` amounts with the new transaction's `amount`! Because multiple code paths set `Payment.reference = invoice.invoiceNumber`, querying `journalEntry` by `reference: invoiceNumber` can match a Payment's JE instead of the Invoice's JE (or vice versa) and overwrite it!
- **Fix:** Namespace journal entry references by event type (e.g., `INV-${invoiceNumber}` for invoice debits, `Payment-${payment.id}` for payments, `CN-${creditNoteNumber}` for credit notes, `DN-${debitNoteNumber}` for debit notes).

---

#### [LOGIC-HIGH-4] Credit Notes & Debit Notes Create Fake Cash `Payment` Rows & Wrong GL Entries, and Corrupt Party Balances on Delete
- **Locations:**
  - `src/app/api/credit-notes/route.ts:308-370, 430-492`
  - `src/app/api/debit-notes/route.ts:302-365, 423-485`
  - `src/app/api/credit-notes/[id]/route.ts:220, 320-392`
  - `src/app/api/debit-notes/[id]/route.ts:218, 317-383`
- **Root Causes:**
  1. **Wrong Accounting & Fake Cash Payments on Creation:**
     - `POST /api/credit-notes` (`type = "CREDIT"`, `L308-370`): Creates a `Payment` row (`transactionType: "EXPENSE", mode: "CASH"`) and defaults its GL entry to **Debit Other Expense, Credit Cash** (`L343-344`) instead of **Debit Sales Returns / Revenue, Credit Accounts Receivable**!
     - `POST /api/credit-notes` (`type = "DEBIT"`, `L430-492`): Creates an `INCOME` Cash payment and defaults GL to **Debit Cash, Credit Revenue** (`L465-466`) instead of **Debit Accounts Receivable, Credit Revenue**!
     - `POST /api/debit-notes` (`type = "DEBIT"`, `L302-365`): Creates an `EXPENSE` Cash payment with literal `toVendor: "Vendor"`, defaults GL to **Debit Vendor Expense, Credit Cash** (`L338-339`), AND calls `addVendorTransaction(prisma, vendorId, "DEBIT", ...)` (`L368`) which **increases** `vendor.currentBalance` (meaning we owe the vendor *more*)!
     - `debit-notes/route.ts:315, 375`: Stores `invoice: billId ? "Bill ${billId}" : null` (using internal database `id` instead of `bill.invoiceNumber`), breaking all invoice number lookups.
  2. **Deleting a Credit Note or Debit Note Never Updates `currentBalance`:**
     - `DELETE /api/credit-notes/[id]` (`src/app/api/credit-notes/[id]/route.ts:374`) deletes the `CustomerTransaction` row **without** reversing `customers.currentBalance`!
     - `DELETE /api/debit-notes/[id]` (`src/app/api/debit-notes/[id]/route.ts:366`) deletes the `VendorTransaction` row **without** reversing `vendors.currentBalance`!

---

#### [LOGIC-HIGH-5] Starting Balance Updates (`POST /api/accounts/transactions/{customer,vendor}/[id]`) Fail to Update `currentBalance` and Post Revenue/Expense Instead of Equity
- **Locations:**
  - `src/app/api/accounts/transactions/customer/[id]/route.ts:1688-1816`
  - `src/app/api/accounts/transactions/vendor/[id]/route.ts:1390-1518`
- **Root Causes:**
  1. When updating an existing `STARTING-BALANCE` transaction (`customer/[id]/route.ts:1721-1762`, `vendor/[id]/route.ts:1423-1464`), it updates the transaction row and returns early with comment `// Recalculate balances (this will be done on next GET request)` — **never updating `customers.currentBalance` or `vendors.currentBalance`**! Because `GET` only recalculates DB balances when `?recalc=true` is explicitly passed (`L88`), `currentBalance` remains permanently stale!
  2. For `type === "DEBIT"`, it calls `createJournalEntryForTransaction(..., "CUSTOMER_DEBIT" / "VENDOR_DEBIT", ...)`, which posts opening balances to **Shipping Revenue (`4000`)** and **Courier Expense (`5100`)** instead of **Opening Balance Equity / Retained Earnings (`3000`)**, inflating current-period P&L! And for `type === "CREDIT"`, it skips creating a journal entry completely (`L1734, 1801`).

---

### 2.3 Payment Processing, Allocation, Edit & Delete Bugs

#### [LOGIC-CRIT-5] `DELETE /api/accounts/payments/[id]` Corrupts Customer/Vendor Balances and Leaves Secondary FIFO Invoices in `"Paid"` Status
- **Location:** `src/app/api/accounts/payments/[id]/route.ts:315-542`
- **Root Causes:**
  1. **Never Updates `customers.currentBalance` or `vendors.currentBalance` (`L374-447`):** Deletes the `CustomerTransaction` and `VendorTransaction` `CREDIT` rows, but **never decrements `customers.currentBalance` or increments `vendors.currentBalance`**!
  2. **Over-broad `startsWith: CREDIT-${payment.invoice}` Deletion (`L394-408, 430-446`):** Deletes **all** customer/vendor transactions whose reference starts with `CREDIT-${payment.invoice}`, wiping out unrelated partial payments on the same invoice!
  3. **Orphans Secondary Allocated Invoices' Status (`L454-483`):** When a payment that was split across multiple invoices via `PaymentAllocation` is deleted, its `PaymentAllocation` rows cascade-delete (`schema.prisma:499`), but `DELETE` only recalculates status for `payment.invoice` (`L454`). All other invoices that received allocations from this payment remain falsely marked `"Paid"` or `"Partial"`!
  4. **Non-Atomic Operations (`L374-510`):** Deletes ledger transactions and updates invoice status *before* the `prisma.$transaction` at `L496`.

---

#### [LOGIC-HIGH-6] `PUT` and `PATCH /api/accounts/payments/[id]` Desynchronize Allocations, Invoice Statuses, and Sub-Ledgers
- **Location:** `src/app/api/accounts/payments/[id]/route.ts:71-313, 544-684`
- **Root Causes:**
  1. **`PATCH` (`L544-683`):** Updates `payment.amount` and the `JournalEntry`, but **never updates `CustomerTransaction`, `VendorTransaction`, `customers.currentBalance`, `vendors.currentBalance`, `PaymentAllocation`, or `Invoice.status`**!
  2. **`PUT` (`L71-313`):** Concatenates `Prisma.Decimal` strings on `L166` (`cust.currentBalance + amountDelta`), never updates `PaymentAllocation` or recalculates `Invoice.status` when `amount` or `invoice` changes, and fails to update `CustomerTransaction.reference` / `VendorTransaction.reference` when `body.reference` changes.

---

#### [LOGIC-HIGH-7] Payment Allocation Discrepancies (`allocateExcessPayment`, `calculateInvoicePaymentStatus`, `GET /api/accounts/payments/allocate`)
- **Locations:**
  - `src/lib/accounts/invoicePayments.ts:179-245, 451-505`
  - `src/app/api/accounts/payments/allocate/route.ts:80-94, 151-202`
- **Root Causes:**
  1. **`calculateInvoicePaymentStatus` Legacy Payment Drop (`invoicePayments.ts:469-479`):** Counts legacy direct payments only where `allocations: { none: {} }`. If an existing payment (created without a `PaymentAllocation` row for its primary `originalInvoiceNumber`) later has its excess allocated to a secondary invoice via `allocateExcessPayment` (`invoicePayments.ts:226`), that payment now has an allocation row for the secondary invoice — so `allocations: { none: {} }` becomes `false` for the primary invoice, and the primary invoice **loses the entire payment amount** and reverts to `"Unpaid"`!
  2. **`GET /api/accounts/payments/allocate` Ignores `PaymentAllocation` (`allocate/route.ts:152-161, 186-195`):** Uses `prisma.payment.aggregate({ where: { invoice: invoice.invoiceNumber } })` instead of `calculateInvoicePaymentStatus`.

---

### 2.4 Shipment & Invoice Lifecycle Bugs

#### [LOGIC-CRIT-6] `generateInvoiceNumber` Collides With Vendor Invoice Numbers (`N + 2`) on Every 3rd Shipment
- **Locations:**
  - `src/lib/server/ledger.ts:20-85` (`generateInvoiceNumber`, `generateVendorInvoiceNumber`)
  - `src/app/api/add-shipment/route.ts:372-380, 520, 549`
  - `src/app/api/bulk-upload-shipments/route.ts:424, 540, 562`
- **Root Cause:**
  1. `generateInvoiceNumber` increments `OrgSequence("invoice")` by `+1` (`600000`, `600001`, `600002`, `600003`, ...).
  2. For each shipment, `add-shipment` and `bulk-upload-shipments` create a Customer Invoice with `invoiceNumber = N` **and** a Vendor Invoice with `vendorInvoiceNumber = N + 2` (`generateVendorInvoiceNumber`). Both are stored in the same `Invoice` table (`@@unique([organizationId, invoiceNumber])`).
  3. Trace consecutive shipments:
     - **Shipment 1:** `generateInvoiceNumber` -> `600000`. Creates Customer Invoice `600000` and Vendor Invoice **`600002`**.
     - **Shipment 2:** `generateInvoiceNumber` -> `600001`. Creates Customer Invoice `600001` and Vendor Invoice **`600003`**.
     - **Shipment 3:** `generateInvoiceNumber` -> **`600002`**. Tries to insert Customer Invoice `600002` -> **CRASHES with `P2002` unique constraint violation against Shipment 1's Vendor Invoice `600002`!**
     - In `bulk-upload-shipments/route.ts:424`, there is **no `withUniqueRetry`**, so every 3rd shipment in an Excel bulk upload fails!
     - In `add-shipment/route.ts:372`, `withUniqueRetry` only retries 2 times (`retries: 2`); if `600002` and `600003` are both taken by Shipment 1 and Shipment 2's vendor invoices, attempt 1 (`600002`) fails and attempt 2 (`600003`) **also fails**!
- **Fix:** Use a distinct prefix or sequence for vendor bills (e.g., `VB-${invoiceNumber}` or `V-${invoiceNumber}`) so vendor invoice numbers never share the same numeric keyspace as customer invoice numbers.

---

#### [LOGIC-CRIT-7] `update-shipment` Party Reassignment Corrupts Old & New Customer/Vendor Balances
- **Locations:**
  - `src/app/api/update-shipment/route.tsx:666-793`
  - `src/lib/server/ledger.ts:254-516` (`updateInvoiceBalance`)
- **Root Causes:**
  1. In `update-shipment/route.tsx:666-674`, `tx.invoice.update` first overwrites `invoice.vendorId = resolvedVendorId` and `invoice.customerId = resolvedCustomerId`.
  2. Next (`L684-715`), `tx.vendorTransaction.updateMany` and `tx.customerTransaction.updateMany` reassign the `DEBIT` transaction rows from `invoice.vendorId` to `resolvedVendorId` (and `invoice.customerId` to `resolvedCustomerId`) **without updating either the old party's or the new party's `currentBalance`**!
  3. Next (`L760-769`), `updateInvoiceBalance` is called **only if `oldInvoiceAmount !== finalInvoiceAmount`**, and it passes `(tx, invoice.id, oldInvoiceAmount, finalInvoiceAmount, invoice.customerId, invoice.customerId, invoice.vendorId, invoice.vendorId)` — passing the **same ID twice** for `oldCustomerId`/`newCustomerId` and `oldVendorId`/`newVendorId`! So `customerChanged` and `vendorChanged` in `updateInvoiceBalance` (`ledger.ts:282-283`) are **always `false`**!
  4. And if `updateInvoiceBalance` **is** called with different party IDs (e.g. from `PUT /api/accounts/invoices/[id]` at `src/app/api/accounts/invoices/[id]/route.ts:227`), `ledger.ts:307, 338, 424, 450` calls `tx.customerTransaction.create` / `tx.vendorTransaction.create` **without `organizationId`**, causing a runtime Prisma validation crash!

---

#### [LOGIC-HIGH-8] Pricing Formula & Vendor Cost Discrepancy Between `add-shipment` and `update-shipment`
- **Locations:**
  - `src/app/api/add-shipment/route.ts:265-296, 485`
  - `src/app/api/update-shipment/route.tsx:286-325, 439`
- **Root Causes:**
  1. **Double-dividing by profit percentage (`update-shipment/route.tsx:287, 307, 439`):** `add-shipment/route.ts:485` stores `originalPrice` (price **after** stripping out `profitPercentage`) into `shipment.price`. When `update-shipment` runs without a new `price` in the request body, `effectivePrice` defaults to `existingShipment.price` (`L287`), and then `L307` divides it by `(1 + effectiveProfitPercentage / 100)` **a second time**!
  2. **Overwriting `vendorPrice` (`update-shipment/route.tsx:321-323`):** `add-shipment/route.ts:292-294` sets `vendorTotalCost = Math.round(parseFloat(vendorPrice) || 0)` when `!manualRate`, whereas `update-shipment/route.tsx:321-323` sets `vendorTotalCost = Math.round(originalPrice - effectiveFixedCharge)` — ignoring `vendorPrice` and overwriting the vendor bill's `totalAmount`!

---

#### [LOGIC-CRIT-8] `DELETE /api/shipments/[id]` & `DELETE /api/accounts/invoices/[id]` Corrupt Balances and Wipe Partial Payments
- **Locations:**
  - `src/app/api/shipments/[id]/route.ts:243-245, 335-552`
  - `src/app/api/accounts/invoices/[id]/route.ts:327-431`
- **Root Causes:**
  1. **Partially Paid Invoices (`status === "Partial"`) Lose Customer/Vendor Payments (`shipments/[id]/route.ts:344-369, 456-458`):** `unpaidCustomerTransactions` selects **all** transactions where `invoice === inv.invoiceNumber` — matching **both** the `DEBIT` invoice row **and** any `CREDIT` partial payment row — and deletes both, erasing the customer's partial payment from their sub-ledger while keeping the cash payment in `Payment` and `JournalEntry`!
  2. **Same Bug in `DELETE /api/accounts/invoices/[id]` (`invoices/[id]/route.ts:369-386`):** Deletes all `CustomerTransaction` rows matching `OR: [{ reference: invNum }, { invoice: invNum }]` (wiping both `DEBIT` and `CREDIT` rows) and then adds `cust.currentBalance + invAmount`.
  3. **Vendor Invoice Number Padding Mismatch (`shipments/[id]/route.ts:243-245`):** Computes `vendorInvoiceNumber = (invoiceNumberInt + 2).toString()` without `.padStart(6, "0")`.

---

### 2.5 Sequence Generation, Concurrency & SaaS Billing Bugs

- **[LOGIC-HIGH-9] `GET /api/accounts/transactions/customer/[id]` Mutates Database on Read (`src/app/api/accounts/transactions/customer/[id]/route.ts:158-228`):** Scans for invoices missing a `DEBIT` `CustomerTransaction` and calls `prisma.customerTransaction.create` (`L211`) on `GET` without updating `currentBalance` or wrapping in a transaction (race condition on concurrent `GET` requests).
- **[LOGIC-HIGH-10] Lexicographical Sort Bug & Duplicate Payment Creation in `POST /api/accounts/payments` (`src/app/api/accounts/payments/route.ts:370-421`):**
  1. Generates journal entry numbers using `prisma.journalEntry.findFirst({ orderBy: { entryNumber: "desc" } })` instead of `nextJournalEntryNumber()`. Because string sorting orders `"JE-9999" > "JE-10000"`, once an org reaches `JE-10000`, `findFirst` always returns `"JE-9999"` and collides with `P2002` forever.
  2. Calls `prisma.payment.create` (`L370`) before `createJournalEntryForPayment` (`L373`) outside a transaction; if `createJournalEntryForPayment` throws, the `catch` block (`L395`) calls `prisma.payment.create` **a second time**, creating a duplicate payment!
- **[LOGIC-MED-2] Unvalidated Manual Payment Amount & Race Condition on Approval:**
  - `src/app/api/billing/manual-payment/submit/route.ts:68-86` computes `amountPkr` on line 72, never uses it, and accepts any arbitrary `amount` submitted by the user.
  - `src/app/api/saas/payment-proofs/[id]/route.ts:48-94` checks `proof.status !== "pending"` and runs 3 non-transactional updates; concurrent clicks extend `currentPeriodEnd` twice.

---

## 4. Domain 3: UI/UX, Design System, Frontend Architecture & Accessibility

### 3.1 Design System, Typography, Color Tokens & Dark/Light Mode

#### [UX-HIGH-1] 20+ Non-Existent / Invalid Tailwind v4 Utility Classes
Throughout the codebase, components use invented shade numbers (`105`, `150`, `205`, `350`, `355`, `405`, `450`, `550`, `650`, `655`, `750`, `850`, `905`) that do not exist in Tailwind CSS or `globals.css`. In Tailwind v4, these silently fail to generate CSS, resulting in missing backgrounds, missing borders, and broken dark-mode contrast:
- `src/components/LayoutContent.tsx`: `bg-gray-105` (line 91), `dark:bg-zinc-905` (line 102)
- `src/components/Navbar.tsx`: `text-indigo-655` (line 240)
- `src/app/dashboard/page.tsx`: `text-gray-550` (lines 127, 894), `text-slate-650` (line 900), `text-red-550` (line 910), `text-gray-650` (line 914)
- `src/app/dashboard/shipments/page.tsx`: `w-43` (line 1719)
- `src/app/dashboard/customers/page.tsx`: `border-gray-150`, `dark:border-zinc-650`, `dark:border-zinc-655`, `dark:text-gray-350`, `dark:text-gray-355` (lines 746, 753, 772, 784, 803, 810)
- `src/app/dashboard/settings/branding/page.tsx`: `text-slate-350` (line 372)
- `src/app/auth/signup/page.tsx`: `text-slate-550` (line 504), `border-slate-205` (lines 584, 971, 1038, 1059), `text-slate-405` (line 592), `text-slate-350` (line 811), `text-slate-450` (line 813), `dark:border-slate-850` (lines 893, 983), `text-indigo-650` (lines 1102, 1117), `hover:to-purple-750` (line 1109), `text-indigo-655` (line 1123)

#### [UX-HIGH-2] Broken Font Variable Binding
- **Locations:** `src/app/layout.tsx:11, 28` vs. `src/app/globals.css:9-10`
- **Root Cause:** `layout.tsx` initializes `const inter = Inter({ subsets: ["latin"] })` without defining `--font-geist-sans` or `--font-geist-mono`, while `globals.css:9-10` sets `--font-sans: var(--font-geist-sans); --font-mono: var(--font-geist-mono);`. Any element using `font-sans` or `font-mono` references undefined CSS variables.

#### [UX-MED-1] Fragmented Palette, Hardcoded Currencies & Disconnected Branding
- **Three Competing Neutral Palettes & Four Primary Colors:** Neutral surfaces mix `gray-*`, `slate-*`, and `zinc-*` on the same screen. Primary actions oscillate between `#4F46E5`, `bg-blue-600`, `bg-sky-400`, and `bg-indigo-600`.
- **Disconnected `accentColor` Setting:** `src/app/dashboard/settings/branding/page.tsx:44-51` lets admins pick an `accentColor`, but no CSS variable or component reads `accentColor`.
- **Hardcoded Currencies:** `PermissionContext` provides org `currency`, yet `shipments/[id]/page.tsx:552, 592, 729` hardcodes `"USD"`, `shipments/page.tsx:2086`, `add-shipment/page.tsx:485`, and `customers/page.tsx:1216` hardcode `"$"`, and `add-shipment/page.tsx:2262` and `accounts/ledger/page.tsx:351` hardcode `"PKR"`.
- **Dark Mode Regressions on Public Pages:** `TrackingResultsDialog.tsx:341-358` (when `isPage={true}` in `/tracking`) and `RateCalculatorContent.tsx:267-335` (`publicView` in `/rate-calculator`) use hardcoded light classes (`text-slate-900`, `bg-white`) with no `dark:` variants inside dark-mode page wrappers.

---

### 3.2 Navigation, Layout & Mobile Responsiveness

#### [UX-CRIT-1] Unconditional Desktop Sidebar Margin Crushes Mobile Viewports to `119px`
- **Location:** `src/components/LayoutContent.tsx:79-93`
- **Root Cause:**
  - Sidebar wrapper (lines 79–83) is `fixed left-0 top-16 h-[calc(100vh-64px)] z-30` with `w-64` (256px) or `w-20` (80px) at **all** viewport widths.
  - `<main>` (lines 89–93) applies `isSidebarOpen ? "ml-64" : "ml-20"` at **all** viewport widths (`375px` mobile included!).
  - **Impact:** On a 375px phone with the sidebar expanded, `<main>` is crushed into **119px**.

#### [UX-HIGH-3] Broken Sidebar Active State & Auto-Expand Logic
- **Location:** `src/components/Sidebar.tsx:76-78, 138, 737, 774-790`
- **Root Cause:** `isShipmentSettingsActive` checks `pathname.startsWith("/dashboard/shipment-settings")`, whereas the Configuration child links are `/dashboard/settings/branding`, `/dashboard/settings/manage-zones`, `/dashboard/settings/manage-rate-list`, `/dashboard/settings/hscodes`, and `/dashboard/email`. Navigating to any Configuration sub-page fails to highlight or auto-expand the Configuration menu.

#### [UX-HIGH-4] Public Navbar & Marketing Page Issues (`PublicNavbar.tsx`, `src/app/page.tsx`)
- **Empty Public Navbar (`src/components/PublicNavbar.tsx:7-29`):** Renders **only** the company logo — no navigation links, no "Track Shipment" link, no "Rate Calculator" link, and no "Log In" or "Start Free Trial" button.
- **Hero Section Has No CTA (`src/app/page.tsx:1123-1151`):** Full-screen hero slider displays a title and subtitle with zero Call-To-Action buttons or AWB tracking bar.
- **Broken Mobile Testimonials Carousel (`src/app/page.tsx:476, 504`):** Hardcodes `const CARDS_PER_VIEW = 3`, squeezing 3 cards side-by-side (~95px each) on mobile screens.
- **Clipped Contact Form (`src/app/page.tsx:1536`):** Sets `max-h-[240px] sm:max-h-[400px]` on a 7-field form (~480px tall), clipping the message textarea and submit button.
- **Nested Double Scrollbars:** `LayoutContent.tsx:91` sets `h-[calc(100vh-64px)] overflow-y-auto` on `<main>`, and `add-shipment/page.tsx:1358` sets `h-[calc(100vh-64px)] overflow-y-auto` again on its child `<div>`.

---

### 3.3 Core Operational Workflows: Fake Controls, Bugs & UX Traps

#### [UX-CRIT-2] Fake CSV Imports, Dead Buttons, Stacked Modal Portals & Leaked Blur Data
1. **Financial Data Leaked in DOM Under Blur Overlays (`src/app/dashboard/page.tsx:314-375, 391-550`):**
   - When `!hasPermission("view_revenue")` or `!canViewAnalytics`, the real `totalRevenue`, `totalReceivable`, and chart datasets are still rendered in the DOM underneath a translucent `backdrop-blur-[6px]` overlay.
2. **Fake Bulk Import Modals (`src/app/dashboard/shipments/page.tsx:2174-2184` & `src/app/dashboard/customers/page.tsx:1371-1386`):**
   - Clicking **Import** inside `shipments/page.tsx` and `customers/page.tsx` checks `if (!uploadedFile)` and immediately executes `toast.success("...imported successfully!"); window.location.reload();` **without sending the file to any API**!
3. **50× Duplicate Delete Dialog Portals (`src/app/dashboard/customers/page.tsx:1137-1155`):**
   - `<Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>` is placed **inside `customers.map(...)`** (line 1018), mounting 50 simultaneous dialog portals bound to one boolean.
4. **Broken Shipment Detail Page Controls (`src/app/dashboard/shipments/[id]/page.tsx`):**
   - Line 309: `"Edit Shipment"` links to `/dashboard/update-shipment?id=${shipment.id}` (an outdated 7-field form) instead of `/dashboard/add-shipment?id=${shipment.id}`.
   - Lines 607–630: `"Payments"` tab is hardcoded to `"No payment records found for this shipment"`, ignoring `shipmentInvoices`.
   - Line 768: `"Change status"` button has **no `onClick` handler**.
5. **Hardcoded Origin & Pieces Count:**
   - `src/components/TrackingResultsDialog.tsx:293` hardcodes `"LAHORE, PAKISTAN"` as the origin for every tracked shipment.
   - `src/app/dashboard/page.tsx:806` hardcodes `1` piece for every row in Recent Shipments instead of `{shipment.amount || 1}`.
6. **SaaS Plan Editor Overwrite Bug (`src/app/dashboard/saas/plans/page.tsx:183-187`):**
   - `savePlanEdit()` hardcodes `analytics: true, customersPage: true, vendorsPage: true, recipientsPage: true` in the `PUT` payload instead of reading `editAnalytics`, `editCustomersPage`, `editVendorsPage`, `editRecipientsPage`.
7. **Cryptic Single-Letter Mobile Table Headers (`src/app/dashboard/shipments/page.tsx:1463-1511`):**
   - Replaces column headers on `<640px` screens with single letters (`D`, `B`, `S / R`, `D`, `T`, `P`, `W`, `T`, `T`, `A`).
8. **Flash of Empty State (`shipments/page.tsx:1440-1443`, `customers/page.tsx:904-907`):**
   - Renders `"No shipments found."` / `"No customers found."` while the initial fetch is still in flight.

---

### 3.4 Accessibility (a11y) Audit

1. **Custom `<div>` Modals Missing `role="dialog"`, `aria-modal="true"`, Focus Trap, and `Escape` Key Support:**
   - `src/app/dashboard/page.tsx`: `mapFullscreen` (line 554), `showReceivableModal` (line 933), `showCustomersModal` (line 1079).
   - `src/app/auth/signup/page.tsx`: `showTermsModal` (line 1068), `statusPopup` (line 472).
2. **Inaccessible `PartyCombobox` (`src/app/dashboard/add-shipment/page.tsx:69-184`):**
   - Missing `role="combobox"`, `aria-expanded`, `role="listbox"`, `role="option"`, and keyboard arrow navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`).
3. **Interactive `<div onClick>` Cards Without Keyboard Support (`role="button"`, `tabIndex={0}`, `onKeyDown`):**
   - `src/app/dashboard/page.tsx` (lines 224, 344, 381) and `src/app/dashboard/accounts/ledger/page.tsx` (lines 321–333, 365–377).
4. **Icon-Only Buttons Missing `aria-label`:**
   - `src/components/Navbar.tsx:290-303` (Theme toggle), `src/app/dashboard/customers/page.tsx:1088-1090` (Row actions trigger), `src/app/dashboard/shipments/page.tsx:1447-1452, 1597-1603` (Table checkboxes).

---

## 5. Domain 4: Performance, Runtime Architecture, DevOps & Testing

### 4.1 Backend Session & Permission Query Amplification (6–7 DB Queries per Request)
- **Locations:** `src/lib/auth/session.ts:142-236`, `src/lib/auth/requirePermission.ts:20-152`
- **Root Cause:** Every call to `requirePermission(req, ...)` executes **6 to 7 sequential/parallel database round-trips** before the API route handler even starts:
  1. `prisma.authSession.findUnique({ where: { id: claims.sid } })` (`session.ts:173`)
  2. `prisma.organizationMember.findFirst({ where: { userId } })` (`session.ts:194`)
  3. `prisma.user.findUnique({ where: { id: userId } })` (`session.ts:201`)
  4. `prisma.organization.findUnique({ where: { id: membership.organizationId } })` (`session.ts:218`)
  5. `getOrgPlan(session.organizationId)` -> `prisma.subscription.findUnique` (`requirePermission.ts:38`)
  6. `Promise.all([prisma.appSetting.findUnique, prisma.appSetting.findUnique])` (`requirePermission.ts:109`)
- **Impact:** When a page like `settings/page.tsx` fires 12 API requests on load, the server executes **~80 database queries just for auth/permission verification**!
- **Fix:** Collapse steps 1–5 into **one single Prisma query** using nested `include`/`select` on `authSession.findUnique`, and cache `appSetting` role permissions in memory for 30–60 seconds per organization.

### 4.2 Client-Side Fetching Waterfalls & Monolithic Client Components
- **Layout Blocking Waterfall (`src/components/LayoutContent.tsx:96-100` & `src/components/PermissionContext.tsx:85-171`):**
  - `PermissionContext.tsx` runs 3 sequential requests (`getClientSession()` -> `/api/settings/custom` -> `/api/org/current`). While `loading` is `true`, `LayoutContent.tsx` renders `"Checking permissions..."` and **blocks mounting `{children}`**. Only after those 3 requests finish does the page mount and begin its own `useEffect` fetches.
  - Meanwhile, `Navbar.tsx`, `Sidebar.tsx`, and `shipments/page.tsx` independently call `getClientSession()` and `/api/org/current` again.
- **12-Request Sequential Waterfall in `src/app/dashboard/settings/page.tsx:127-190`:**
  - `loadAllSettings()` `await`s 12 `fetch()` calls one by one sequentially instead of `Promise.all()`, and re-fetches all 12 endpoints after every single item edit or delete.
- **5-Request Sequential Loop in `src/app/dashboard/add-shipment/page.tsx:516-556`:**
  - Uses `for (const { fn, url } of endpoints) { const res = await fetch(url); ... }` sequentially instead of `Promise.all()`.

### 4.3 Client Bundle Bloat & Global `window.fetch` Monkey-Patching
- **`country-state-city` (~8 MB Uncompressed JSON) Imported in 8+ Client Bundles:**
  - Imported directly in `dashboard/page.tsx`, `shipments/page.tsx`, `shipments/[id]/page.tsx`, `add-shipment/page.tsx`, `customers/page.tsx`, `RateCalculatorContent.tsx`, and `lib/utils.ts`.
  - `src/app/dashboard/shipments/page.tsx:437-441` calls `Country.getAllCountries().find(...)` on every shipment row render. Replace with native `new Intl.DisplayNames(['en'], { type: 'region' }).of(code)` (**0 KB bundle cost, O(1) lookup**).
- **Global `window.fetch` Override (`src/components/TopLoaderFetch.tsx:11-62`):**
  - Monkey-patches `window.fetch` so every background API call (including debounced keystrokes in search bars and comboboxes) triggers the top page-navigation progress bar.

---

## 6. How to Make This App Bulletproof & World-Class (The Next-Level Blueprint)

### Part A: Making the Backend, Multi-Tenancy & Accounting Engine Bulletproof

1. **Enforce `withAuth` + `orgPrisma` Across All API Routes:**
   - Wire `src/lib/api/withAuth.ts` and `src/lib/tenant/orgPrisma.ts` into all ~89 API routes so tenant isolation (`organizationId`), RBAC permissions, and active subscription checks are enforced automatically rather than relying on manual per-query filters.
2. **Single Double-Entry Accounting Gateway (`postJournalEntry`):**
   - Funnel all Journal Entry creation and updates through a single transactional function that enforces:
     - `lines.length >= 2`
     - $\sum \text{debitAmount} = \sum \text{creditAmount}$ (to 4 decimal places)
     - Every `accountId` belongs to `organizationId`
     - Every `JournalEntryLine` carries `organizationId`
     - Namespaced references (`INV-${invoiceNumber}`, `BILL-${vendorInvoiceNumber}`, `PMT-${paymentId}`, `CN-${creditNoteNumber}`, `DN-${debitNoteNumber}`) so entries never overwrite one another.
3. **Eliminate Sequence Collisions & Decimal Concatenation:**
   - Separate Customer Invoice numbers (`INV-600001` or `600001`) from Vendor Bill numbers (`VB-600001`) so `N` and `N + 2` never collide.
   - Change `CreditNote.creditNoteNumber` and `DebitNote.debitNoteNumber` to composite `@@unique([organizationId, ...])`.
   - Fix `hydrateDecimals` in `src/lib/prisma.ts` to use duck-typing (`typeof value?.toNumber === "function"`) instead of `instanceof Decimal`, and use Prisma atomic `{ increment: money(delta) }` / `{ decrement: money(delta) }` for all customer/vendor balance mutations.
4. **Collapse Session Resolution to 1 Query:**
   - Replace the 5 sequential DB queries in `getSession()` + `requirePermission()` with a single joined `prisma.authSession.findUnique` query and a 30-second in-memory cache for org role permissions.

---

### Part B: Elevating UI/UX to Linear / Stripe / Flexport Grade

1. **Responsive App Shell & Instant Hydration:**
   - Fix `LayoutContent.tsx` to use `md:ml-64 md:ml-20` (`ml-0` on mobile) and wrap `Sidebar` in a Radix `<Sheet>` drawer on `<768px` screens.
   - Pass initial session, org branding, and permissions from the Server Layout (`src/app/dashboard/layout.tsx`) into `PermissionContext` so pages mount **instantly** without the `"Checking permissions..."` full-screen blocker.
   - Remove `TopLoaderFetch.tsx` so background fetches and combobox typing don't trigger the top navigation bar.
2. **Global Command Palette (`Cmd+K` / `Ctrl+K`):**
   - Add a keyboard-first command bar allowing logistics staff to jump directly to any Tracking ID / AWB, Invoice `#`, Customer, Vendor, or quick action (`New Shipment`, `Record Payment`, `Calculate Rate`, `Track AWB`) from anywhere in the app.
3. **Redesigned "Add Shipment" Cockpit:**
   - Replace the cramped half-width 11-column package table in `add-shipment/page.tsx` with a **70% / 30% Two-Pane Layout**:
     - **Left Pane (70%):** Clean stepped sections (*1. Sender & Recipient -> 2. Routing & Carrier -> 3. Full-Width Package Dimensions & HS Codes*).
     - **Right Sticky Summary Rail (30%):** Live **Waybill & Margin Preview** showing Base Rate, Fuel Surcharge, Customs/Tax, Discount, Vendor Cost, Net Profit Margin %, and Final Total — reactive on every keystroke via `useMemo`.
4. **Slide-Over Quick-View Drawers on Tables:**
   - Clicking a shipment in `/dashboard/shipments` or an invoice in `/dashboard/accounts/invoices` opens a fast right-hand **Slide-Over Drawer** with tracking timeline, quick status update, 1-click thermal label/A4 invoice print, and payment allocation — without losing table scroll position or filters.
5. **Unified Design Tokens & Tabular Typography:**
   - Purge all 20+ invalid Tailwind shade classes (`bg-gray-105`, `text-indigo-655`, etc.).
   - Bind `--font-sans` (`Inter`) and `--font-mono` (`JetBrains Mono`) properly in `layout.tsx`, and apply `font-mono tabular-nums` to all tracking IDs, invoice numbers, weights, dimensions, and currency figures.
   - Dynamically bind `--primary` to the organization's chosen `accentColor` from Branding Settings.

---

### Part C: Prioritized Execution Roadmap

- **Phase 1 — Critical Security & Multi-Tenancy Hotfixes (Day 1–2):**
  - [ ] Remove auto-`OWNER` promotion in `src/lib/auth/membership.ts:57-81` and fix `google/callback/route.ts:123`.
  - [ ] Scope `PUT`/`DELETE /api/users/[id]` to `OrganizationMember` and require invite confirmation in `POST /api/org/members`.
  - [ ] Fix `src/middleware.ts:125` `config.matcher` so CSRF `Origin` checks run on `/api/*`.
  - [ ] Fix shipment IDOR in `PUT /api/accounts/invoices/[id]/edit`, cross-tenant CoA leak in `vendor-excel/route.ts:182`, and `AppSetting` leak in `settings/custom/route.ts:33`.
  - [ ] Escape all interpolations in `src/app/api/accounts/invoices/[id]/invoice/route.ts` and revoke sessions on password reset/change.
- **Phase 2 — Accounting, Ledger & Database Integrity Fixes (Day 3–5):**
  - [ ] Prefix vendor bills (`VB-${invoiceNumber}`) to eliminate the every-3rd-shipment `N + 2` `P2002` collision.
  - [ ] Fix `hydrateDecimals` in `src/lib/prisma.ts:18` and replace all `Decimal + Decimal` string concatenations with `money()` + atomic `{ increment / decrement }`.
  - [ ] Migrate `CreditNote.creditNoteNumber` and `DebitNote.debitNoteNumber` to composite `@@unique([organizationId, ...])`.
  - [ ] Fix prepaid credit application in `add-shipment/route.ts` and `bulk-upload-shipments/route.ts`.
  - [ ] Rewrite `POST /api/accounts/close-period` to close every Revenue and Expense account individually within `[startDate, endDate]`.
  - [ ] Fix `DELETE`/`PUT`/`PATCH` on `/api/accounts/payments/[id]`, `/api/credit-notes/[id]`, `/api/debit-notes/[id]`, `/api/shipments/[id]`, and `update-shipment/route.tsx`.
- **Phase 3 — UI/UX, Responsive Shell & Performance Overhaul (Week 2):**
  - [ ] Fix mobile layout (`md:ml-64 md:ml-20` + mobile `<Sheet>` drawer) in `LayoutContent.tsx` and `Sidebar.tsx`.
  - [ ] Stop rendering real financial figures under `backdrop-blur` when unauthorized in `dashboard/page.tsx`.
  - [ ] Wire `BulkUploadModal` into `shipments/page.tsx`, hoist the 50× `<Dialog>` outside `customers.map()` in `customers/page.tsx`, and fix dead tabs/buttons in `shipments/[id]/page.tsx` and `saas/plans/page.tsx`.
  - [ ] Replace all 20+ invalid Tailwind shade classes, fix font variables in `layout.tsx`, and replace `Country.getAllCountries()` in tables with `Intl.DisplayNames`.
  - [ ] Collapse `getSession()` into 1 joined DB query and parallelize the client waterfalls in `settings/page.tsx` and `add-shipment/page.tsx`.

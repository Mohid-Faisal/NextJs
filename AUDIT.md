# AUDIT.md

## Tenancy and Permissions

> **STATUS: pass 1 (partial). Continued in "Tenancy and Permissions (continued)" below.**
> No source file was modified.

> **RETRACTION — the pass-1 sweep table has been deleted.**
> It was a machine-generated marker inventory whose `tenant-scoped?` column counted
> occurrences of the literal string `organizationId` in each route file. That metric
> is wrong: this codebase scopes most queries through `orgWhere()` / `orgData()` /
> `findOrg*()`, and in those files the string `organizationId` never appears. The
> table therefore labelled correctly-scoped routes as suspicious. Verified
> counter-example: `/api/shipments/[id]` was flagged "org=0, strong IDOR suspicion"
> but in fact calls `orgWhere(session, { id })` on every query. Every `org=N` value
> and every `NOT-REVIEWED (suspect)` verdict from that table is withdrawn. The table
> is rebuilt from scratch, one row per handler actually read, in the continued
> section.

### What was established in pass 1

1. **The intended pattern exists and is sound.** `orgWhere`/`orgData`,
   `findOrgInvoice`, `findOrgPayment`, `findOrgJournalEntry`,
   `nextJournalEntryNumber` all correctly force `organizationId` from the session
   and never from the request. `requireApiSession` / `requirePermission` /
   `requireSuperAdmin` are correct guards.
2. **The permission mapping is a single global row, not per-tenant.**
   `AppSetting` has no `organizationId` (`project/prisma/schema.prisma:586-589`),
   and `requirePermission` reads role permissions from the single key
   `settings_role_permissions` (`project/src/lib/auth/requirePermission.ts:105-107`).
   One writable row governs authorization for every tenant on the platform.
3. **Two financial models have no tenant column at all.** `DebitNote`
   (`schema.prisma:495-508`) and `CreditNote` (`schema.prisma:510-523`) have no
   `organizationId` field. `JournalEntryLine` (`schema.prisma:563-574`) likewise.

Models confirmed tenant-owned (`organizationId` present): OrganizationMember,
Subscription, Shipment, Customers, Vendors, Recipients, DeliveryTime, Agency,
Office, DeliveryStatus, ShippingMode, PackagingType, ServiceMode, HsCode, Zone,
ZoneUpload, RemoteArea, Rate, filename, CustomerTransaction, VendorTransaction,
vendorservice, Payment, Invoice, ChartOfAccount, JournalEntry, FixedCharge,
PaymentProof.

Models with no tenant column: User, Organization, Plan, DebitNote, CreditNote,
JournalEntryLine, AppSetting.

### Verified sweep rows from pass 1

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped? | verdict |
|---|---|---|---|---|---|
| /api/org/current | GET, PATCH | `requireApiSession` | OWNER/ADMIN allowlist on PATCH | yes — `id: session.organizationId` | OK |
| /api/org/members | GET, POST | `requireApiSession` | OWNER/ADMIN | yes | HIGH — ADMIN may assign `OWNER` (F-3) |
| /api/org/members/[id] | PATCH, DELETE | `requireApiSession` | OWNER/ADMIN | yes — `loadMember` filters org | HIGH — ADMIN self-promotion (F-3) |
| /api/org/usage | GET | `requireApiSession` | none (any member) | yes | OK |
| /api/users | GET, POST | `requireApiSession` | SUPER_ADMIN or OWNER | yes — membership filter, org from session | MEDIUM — `role` from body unvalidated (F-5) |
| /api/users/[id] | PUT, DELETE | `requireApiSession` | SUPER_ADMIN or OWNER | pre-check scoped, **write unscoped** | HIGH — bare `user.update`/`user.delete` (F-4) |
| /api/users/approve/[id] | POST | `requireSuperAdmin` | SUPER_ADMIN | n/a — platform scope | OK |
| /api/settings/custom | GET, POST | `requireApiSession` | **none** | **no — `AppSetting` is global** | CRITICAL — platform-wide priv-esc (F-1) |

---

### Detailed findings (pass 1)

#### F-1 — CRITICAL: any authenticated user can rewrite the permission matrix for every tenant on the platform

`project/src/app/api/settings/custom/route.ts:65-81`

```ts
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { key, value } = await req.json();
  ...
  const setting = await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
```

The only check is "is there a valid session". There is no role check, no
permission check, no allowlist of writable keys, and `AppSetting` is keyed by
`key` alone with no `organizationId` (`project/prisma/schema.prisma:586-589`).

Exploit: a `CUSTOMER`- or `STAFF`-role member of *any* tenant posts

```json
{"key":"settings_role_permissions","value":"{\"Customer\":[\"manage_billing\",\"view_revenue\",\"delete_shipment\",\"bulk_delete\",\"manage_customers\",\"manage_vendors\",\"view_config\"]}"}
```

`requirePermission` then reads that exact row for every request from every
organization (`project/src/lib/auth/requirePermission.ts:105-119`), so the
attacker instantly grants themselves every permission — and simultaneously grants
or revokes permissions for every other customer's staff. Every route whose only
protection is `requirePermission` is defeated in one request. The same handler
also lets any user overwrite `settings_billing`, `settings_notifications` and
`settings_booking_numbering` platform-wide, and the GET at line 5-63 lets any
authenticated user read any key by name, cross-tenant.

Fix: (a) gate POST behind `requireSuperAdmin` for platform keys and an OWNER
check plus a per-key allowlist for tenant keys; (b) add `organizationId` to
`AppSetting` with a composite primary key `@@id([organizationId, key])`, scope
both the GET and the upsert through `orgWhere`/`orgData`, and make
`requirePermission` load the mapping for `session.organizationId`; (c) reject
unknown keys.

#### F-2 — CRITICAL (schema): `DebitNote` and `CreditNote` have no tenant column

`project/prisma/schema.prisma:495-508` (DebitNote), `510-523` (CreditNote),
`563-574` (JournalEntryLine)

These are financial documents that adjust invoice and bill balances, and they
carry no `organizationId`, unlike `Invoice` (`:465`) and `Payment` (`:442`).
There is no column available for a handler to filter on, so no amount of
route-level patching fixes this without a migration.

*(The route-level consequences are confirmed against handler source in the
continued section below — see the credit-notes / debit-notes rows and findings.)*

Fix: add `organizationId Int` plus `@@index([organizationId])` to `DebitNote`,
`CreditNote`, and enforce scoping on `JournalEntryLine` via its parent;
backfill from the related `Invoice.organizationId` / `Customers.organizationId`;
then convert every handler to `orgWhere`/`orgData`.

#### F-3 — HIGH: privilege escalation from ADMIN to OWNER via the members endpoints

`project/src/app/api/org/members/[id]/route.ts:28-68` and
`project/src/app/api/org/members/route.ts:58,87,138-139`

Both endpoints gate on `MANAGE_ROLES = ["OWNER", "ADMIN"]` but then accept any
value from `ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT"]`,
`OWNER` included. Nothing prevents the acting user from targeting their *own*
membership row: `loadMember` (`:8-13`) correctly scopes by `organizationId`, but
there is no `member.userId === session.userId` guard and no "you cannot grant a
role above your own" rule. The only protection present is about not demoting the
last owner (`:54-62`), which is a different concern.

Exploit: an `ADMIN` calls `GET /api/org/members`, reads its own row (the response
even labels it with `isSelf`, `route.ts:38`), then
`PATCH /api/org/members/<own id> {"role":"OWNER"}`. It is now OWNER, and
`requirePermission` short-circuits on `session.orgRole === "OWNER"`
(`requirePermission.ts:100-102`), bypassing every permission check in the app.

Fix: forbid acting on your own membership row; restrict `OWNER` assignment to
callers whose own `orgRole` is `OWNER`; re-sign or invalidate the target's session
token when their role changes.

#### F-4 — HIGH: `/api/users/[id]` deletes and rewrites `User` rows without a tenant-scoped write

`project/src/app/api/users/[id]/route.ts:36-71` (PUT) and `:112-133` (DELETE)

The ownership pre-check is correct — `findFirst` with
`memberships: { some: { organizationId: session.organizationId } }` — but the
mutation that follows is a bare `prisma.user.update({ where: { id: userId } })`
and `prisma.user.delete({ where: { id: userId } })`. `User` is a global model with
no `organizationId`, and users can belong to several organizations
(`org/members/route.ts:100-139` explicitly adds *existing* users to a new org).

Exploit: tenant A's OWNER invites `victim@tenantB.com` into tenant A (the POST at
`org/members/route.ts:53` allows adding any existing account by email, with no
consent step). The victim now has a membership in A, so the pre-check passes, and
A's OWNER can then `PUT /api/users/<victimId> {"email":"attacker@evil.com"}` —
rewriting the victim's global login identity and locking them out of tenant B — or
`DELETE /api/users/<victimId>`, destroying the account and, by cascade, their
membership and history in tenant B. The check at `:36` and the write at `:55` are
also not in a transaction (TOCTOU).

Fix: never mutate `User` from a tenant-scoped endpoint. Removing a "user" from an
organization should delete the `OrganizationMember` row only. Disallow `email`
changes through this route entirely; restrict `role`/`status` edits to the
membership record. Add a consent step before an existing account joins a new org.

#### F-5 — MEDIUM: `role` accepted from the request body and written to both `User.role` and the membership

`project/src/app/api/users/route.ts:122`, `:160`, `:180`

`const { name, email, password, role } = body;` — `role` is never validated
against an allowlist (contrast `ASSIGNABLE_ROLES` in the org/members routes) and
is written both to `User.role` (`:160`) and to `organizationMember.role` (`:180`).
`organizationId` is correctly taken from the session (`:178`), so this is not
tenant forgery, but an OWNER can mint arbitrary role strings. `resolveRoleName`
(`project/src/lib/auth/roles.ts:33-34`) falls through to `return orgRole as
RoleName` for unknown values, so an unrecognised role becomes a lookup key into
the permission mapping — and that mapping is attacker-controlled per F-1.

Fix: validate `role` against `ASSIGNABLE_ROLES`; stop writing a role onto the
global `User` model; make `resolveRoleName` fail closed.

#### F-6 — MEDIUM: `roles-permissions` page is protected only by client-side JWT decoding

`project/src/app/dashboard/roles-permissions/page.tsx:159-179`

Authorization is `jwtDecode(Cookies.get("token"))` in a `useEffect`, checking
`platformRole === "SUPER_ADMIN" || orgRole === "OWNER"`, and on failure it renders
an "Access Denied" card (`:240-260`). This is a UI-only control: the page's only
write path is `POST /api/settings/custom` (`:198-205`), which as shown in F-1
performs no role check at all. Hiding the page changes nothing for `curl`.

Fix: enforce the OWNER/SUPER_ADMIN check server-side in the route (F-1).

#### F-7 — LOW: `requirePermission` fails open on a corrupt permission mapping

`project/src/lib/auth/requirePermission.ts:110-116`

```ts
let permissionsMapping = defaultPermissions;
if (setting) {
  try { permissionsMapping = JSON.parse(setting.value); }
  catch (e) { console.error("Error parsing settings_role_permissions:", e); }
}
```

A malformed stored value is swallowed and the code silently falls back to the
hardcoded `defaultPermissions`, which grant `Admin` a broad set including
`manage_billing` and `delete_shipment`. Combined with F-1 an attacker can
deliberately corrupt the value to force every tenant back to the permissive
defaults, and the only trace is a `console.error`. The outer `catch` at
`:132-141` correctly fails closed with a 500.

Fix: on a parse failure, deny the request and alert.

#### F-8 — LOW: role changes are not reflected until the JWT expires

`project/src/lib/auth/session.ts:36-59`, `:90-102`

`orgRole` and `platformRole` are read from the JWT claims, and only
`organizationId`/`orgRole` *absence* triggers a database lookup (`:93-102`).
`platformRole` prefers the claim over the freshly-loaded database value
(`:127`, `claims.platformRole ?? user.platformRole`). Tokens live one week
(`:57`). A user demoted from OWNER or stripped of SUPER_ADMIN keeps their
elevated authorization for up to seven days, and there is no revocation list.

Fix: resolve `orgRole` and `platformRole` from the database on every request, or
add a token version bumped on any role change.

### Files read in pass 1

`project/src/lib/tenant/prismaScope.ts`, `findOrgInvoice.ts`, `findOrgPayment.ts`,
`findOrgJournalEntry.ts`, `orgJournalChart.ts`,
`project/src/lib/auth/requirePermission.ts`, `requireSuperAdmin.ts`,
`requireApiSession.ts`, `session.ts`, `roles.ts`,
`project/src/components/PermissionContext.tsx`,
`project/src/app/api/org/current/route.ts`, `org/members/route.ts`,
`org/members/[id]/route.ts`, `org/usage/route.ts`, `users/route.ts`,
`users/[id]/route.ts`, `users/approve/[id]/route.ts`,
`settings/custom/route.ts`, `project/src/app/dashboard/roles-permissions/page.tsx`,
`project/prisma/schema.prisma`.

---

## Tenancy and Permissions (continued)

Pass 2. 105 remaining route files under `project/src/app/api`, read in batches of
12. Every row below comes from reading the file. Order: `accounts/*`, then
credit-notes / debit-notes, then `saas/*`, then the unauthenticated routes, then
the remainder.

### Batch 1/9 — `accounts/*` (part 1)

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped? | verdict |
|---|---|---|---|---|---|
| /api/accounts/close-period | POST | `requireApiSession` | none | yes — `orgWhere` on all 5 reads; `journalEntry.create` uses `session.organizationId`; JE lines use accountIds from scoped reads | OK (no `manage_billing` check — see B1-F4) |
| /api/accounts/company/stats | GET | `requireApiSession` | none | yes — `orgWhere` on all 4 `payment.aggregate` calls | OK (no `view_revenue` check — B1-F4) |
| /api/accounts/invoices/[id]/edit | GET, PUT | `requireApiSession` | none | GET yes (`findOrgInvoice` + shipmentId filter); **PUT no** — `shipment.update` keyed on the raw path param | **HIGH** — cross-tenant shipment write (B1-F2) |
| /api/accounts/invoices/[id]/invoice | GET | `requireApiSession` | none | yes — `findOrgInvoice`, `organization.findUnique` by session org | OK (client-supplied `data` param renders unvalidated — B1-F6) |
| /api/accounts/invoices/[id]/pdf | GET | `requireApiSession` | none | n/a — no Prisma access, wraps the invoice route in an iframe | OK |
| /api/accounts/invoices/[id]/receipt | GET | `requireApiSession` | none | n/a — redirect only | OK |
| /api/accounts/invoices/[id] | GET, PUT, DELETE | `requireApiSession` | none | GET yes; DELETE pre-checked then delete-by-id; **PUT accepts `customerId`/`vendorId`/`shipmentId` from body with no org validation** | **CRITICAL** — cross-tenant balance + shipment write (B1-F1) |
| /api/accounts/invoices | GET, POST | `requireApiSession` | none | yes — GET `orgWhere`; POST validates customer/vendor/shipment against org **then** `orgData` | OK — this is the correct pattern |
| /api/accounts/payments/[id] | GET, PUT, DELETE, PATCH | `requireApiSession` | none (DELETE re-auths password) | reads yes (`findOrgPayment`, `orgWhere`); writes keyed by ids derived from those reads | MEDIUM — unvalidated `fromCustomerId`/`toVendorId`/`accountId` from body (B1-F3); silent catches (B1-F5) |
| /api/accounts/payments/allocate | POST, GET | `requireApiSession` | none | yes — `findOrgInvoiceByNumber`, `orgWhere` on customer/vendor/invoice/payment | OK, but delegates to `allocateExcessPayment` (B1-F1 helper class) |
| /api/accounts/payments/bulk-import | POST | `requireApiSession` | none | yes — `orgWhere` chartOfAccount, `orgData` payment, JE org from session | LOW — dead unscoped `$queryRaw` (B1-F7) |
| /api/accounts/payments/process | POST | `requireApiSession` | none | yes — `findOrgInvoiceByNumber`, `orgWhere`, `orgData`; `invoice.update` by unique `invoiceNumber` after org check | MEDIUM — `debitAccountId`/`creditAccountId` from body unvalidated (B1-F3) |

Supporting files read for this batch: `project/src/lib/utils.ts` (helpers
`addCustomerTransaction`, `addVendorTransaction`, `updateInvoiceBalance`).

---

#### B1-F1 — CRITICAL: `PUT /api/accounts/invoices/[id]` rewrites another tenant's customer balances and shipment totals

`project/src/app/api/accounts/invoices/[id]/route.ts:85-203`, exploiting
`project/src/lib/utils.ts:293-396` and `:91-141`

The handler correctly loads the invoice under `orgWhere` (`:85-92`), so you can
only edit *your own* invoice. But the update payload is built straight from the
body with no validation of the foreign keys:

```ts
if (body.customerId !== undefined) updateData.customerId = body.customerId ? parseInt(body.customerId) : null;
if (body.vendorId   !== undefined) updateData.vendorId   = body.vendorId   ? parseInt(body.vendorId)   : null;
if (body.shipmentId !== undefined) updateData.shipmentId = body.shipmentId ? parseInt(body.shipmentId) : null;
```
(`:125-127`)

Those ids are then fed into two unscoped code paths:

1. `updateInvoiceBalance(prisma, invoiceId, oldAmount, newAmount, oldCustomerId, newCustomerId, ...)` (`:148-157`). Inside
   (`lib/utils.ts:367-396`) it does `prisma.customers.findUnique({ where: { id: newCustomerId } })`
   and `prisma.customers.update({ where: { id: newCustomerId }, data: { currentBalance: newBalance } })`
   — **no organization filter anywhere**, and the `customerTransaction.create` it
   writes (`:382-394`) carries no `organizationId` at all, so the forged ledger
   row lands on the column default rather than the victim's org.
2. `prisma.shipment.update({ where: { id: invoice.shipmentId }, data: { totalCost: newAmount } })`
   (`:192-195`), where `invoice.shipmentId` is the value the attacker just wrote.

Concrete exploit. Attacker is any authenticated member of org A (no permission
check is performed at all, so a `CUSTOMER`-role user qualifies). They own
invoice 100. Victim org B has customer 55 and shipment 900.

```
PUT /api/accounts/invoices/100
{"customerId": 55, "totalAmount": 999999, "shipmentId": 900, "profile": "Customer"}
```

Result: org B's customer 55 has `currentBalance` increased by 999999 and gains a
fabricated `customerTransaction` DEBIT row reading "Invoice INV-… assigned to
customer"; org B's shipment 900 has its `totalCost` overwritten. The attacker
never needed read access to org B — ids are small sequential integers and can be
enumerated by response timing (a nonexistent customer silently no-ops, an
existing one succeeds). Repeated against a range of ids this corrupts the
receivables ledger of every tenant on the platform.

`updateJournalEntriesForInvoice` is called with the same attacker-chosen ids
(`:169-181`); it does receive `session.organizationId` as its last argument, but
the customer/vendor ids it acts on are still forged.

Fix: validate `customerId`, `vendorId` and `shipmentId` against the session org
before building `updateData` — exactly what the sibling POST at
`accounts/invoices/route.ts:344-367` already does correctly. Change
`updateInvoiceBalance` and `addCustomerTransaction`/`addVendorTransaction` to
take the session (or an `organizationId`) and use `findFirst` with `orgWhere`
plus an `updateMany` scoped on `organizationId`, so a foreign id can never match.
Make `customerTransaction.create`/`vendorTransaction.create` require
`organizationId` rather than treating it as optional (`lib/utils.ts:136`, `:192`).

#### B1-F2 — HIGH: `PUT /api/accounts/invoices/[id]/edit` writes to any shipment id in the URL

`project/src/app/api/accounts/invoices/[id]/edit/route.ts:83`, `:123-142`

The path segment is the *shipment* id and the query string carries the invoice
id. The GET at `:28-33` is correct — it passes `{ shipmentId: parseInt(shipmentId) }`
as an extra filter into `findOrgInvoice`, so the invoice must both belong to your
org and belong to that shipment. The PUT drops that second condition:

```ts
const currentInvoice: any = await findOrgInvoice(session, invoiceId, {}, {...});  // :88 — no shipmentId filter
...
await prisma.shipment.update({
  where: { id: shipmentId },                                                       // :140 — raw path param
  data: shipmentUpdateData
});
```

The only guard on reaching line 139 is `if (body.shipment && currentInvoice.shipment)`
(`:123`) — i.e. *your* invoice merely has to have some shipment attached; the
shipment actually written is whichever id you put in the URL.

Exploit: attacker owns invoice 100, which has any shipment attached. Victim org
owns shipment 900.

```
PUT /api/accounts/invoices/900/edit?invID=100
{"shipment":{"trackingId":"ATTACKER","destination":"XX","packages":[]},"discount":0,"totalAmount":1}
```

overwrites the victim's `trackingId`, `destination`, `referenceNumber`,
`discount`, `packages`, `calculatedValues`, and — if the amount changed —
`totalCost` and `price`. Corrupting `trackingId` on a live shipment also breaks
the public `/api/track` lookup for that consignment.

Fix: pass `{ shipmentId: parseInt(shipmentId) }` into `findOrgInvoice` in the PUT
exactly as the GET does, and change the write to
`prisma.shipment.updateMany({ where: orgWhere(session, { id: shipmentId }), ... })`.

#### B1-F3 — MEDIUM: foreign-key fields accepted from the body without an org check on the payment routes

`project/src/app/api/accounts/payments/[id]/route.ts:105-107`, `:242`, `:253`;
`project/src/app/api/accounts/payments/process/route.ts:29-30`, `:87`

`PUT /api/accounts/payments/[id]` writes `fromCustomerId: body.fromCustomerId`
and `toVendorId: body.toVendorId` (`:105-107`) with no validation that those rows
belong to the session org, and the journal-entry rebuild writes
`accountId: body.debitAccountId` / `body.creditAccountId` (`:242`, `:253`)
likewise. `POST /api/accounts/payments/process` passes the same two account ids
into `createJournalEntryForPaymentProcess` (`:87`, `:188`) unvalidated.

This is weaker than B1-F1 because the rows created stay in the attacker's org —
the damage is a dangling cross-tenant reference: your payment and your journal
lines now point at another tenant's `Customers`/`ChartOfAccount` rows. Any report
that joins through those relations will surface the other tenant's account names
and party names, and deleting the victim's account can break your books.

Fix: validate every id from the body with a `findFirst` under `orgWhere` before
writing, as `accounts/invoices/route.ts:344-367` does.

#### B1-F4 — MEDIUM: the entire `accounts/*` surface has authentication but no permission check

Every handler in this batch calls `requireApiSession` and none calls
`requirePermission`: `close-period/route.ts:9`, `company/stats/route.ts:8`,
`invoices/[id]/route.ts:13`, `:77`, `:234`, `invoices/route.ts:9`, `:314`,
`payments/[id]/route.ts:15`, `:72`, `:291`, `:509`, `payments/allocate/route.ts:14`,
`:112`, `payments/bulk-import/route.ts:291`, `payments/process/route.ts:16`.

`PermissionContext.tsx:43-53` maps these pages to `manage_billing` and
`view_revenue`, and `requirePermission` enforces the plan-feature gate
(`requirePermission.ts:74-84`) only when it is actually called. Because it never
is, a `CUSTOMER`- or `VENDOR`-role member of an org — the roles whose default
permission set is `view_dashboard`/`view_shipments` only
(`requirePermission.ts:13-14`) — can read the org's full revenue figures, create
closing entries, edit invoices and delete payments. The subscription-plan gate on
accounting features is bypassed for the same reason: an org on a plan without
`features.accounts` can use the whole accounting module through the API.

This is in-tenant privilege escalation plus billing-control bypass, not
cross-tenant, hence MEDIUM. It is also what makes B1-F1 and B1-F2 reachable by
the lowest-privileged account in any org.

Fix: replace `requireApiSession` with `requirePermission(req, "manage_billing")`
(or `"view_revenue"` for read-only endpoints) throughout `accounts/*`.

#### B1-F5 — MEDIUM: financial mutations are wrapped in silent catch blocks, leaving the ledger half-written

`project/src/app/api/accounts/payments/[id]/route.ts:195-198`, `:266-269`,
`:419-422`, `:443-446`, `:481-484`, `:625-628`;
`project/src/app/api/accounts/invoices/[id]/route.ts:158-161`, `:182-185`,
`:198-202`; `project/src/app/api/accounts/invoices/[id]/edit/route.ts:174-177`

Every one of these follows the same shape:

```ts
} catch (transactionError) {
  console.error("Error updating customer/vendor transactions:", transactionError);
  // Don't fail the payment update if transaction update fails
}
```

None of these handlers wraps its work in `prisma.$transaction`. So the `Payment`
row is updated, then the matching `CustomerTransaction` update throws, is
swallowed, and the endpoint returns `{ success: true }`. The customer balance and
the payment record now disagree permanently, and the caller is told the operation
succeeded. In `DELETE` the same pattern can leave the journal entry deleted but
the payment intact, or vice versa, breaking double-entry balance.

Fix: wrap each handler's mutations in a single `prisma.$transaction`, let errors
propagate, and return a non-2xx status when any leg fails.

#### B1-F6 — LOW: the invoice renderer will render an entirely client-supplied invoice

`project/src/app/api/accounts/invoices/[id]/invoice/route.ts:35-43`

```ts
if (formData) {
  invoice = JSON.parse(formData);      // no DB read, no org check
} else {
  invoice = await findOrgInvoice(...); // correctly scoped
}
```

When the `data` query parameter is present the database is never consulted, so
the rendered document is whatever JSON the caller passed. There is no tenancy
leak — nothing is read or written — but the endpoint will happily produce a
company-branded invoice HTML document (it does fetch the real
`organization.logoUrl`/`name` at `:116-119`) containing arbitrary attacker text,
served from your own domain. That is a convincing phishing/forgery primitive, and
the same string is echoed into the `pdf` route's iframe wrapper
(`invoices/[id]/pdf/route.ts:25-31`).

Fix: drop the `data` bypass and always render from the scoped DB row, or restrict
the preview path to a non-branded template.

#### B1-F7 — LOW: dead `$queryRaw` over `JournalEntry` with no tenant filter

`project/src/app/api/accounts/payments/bulk-import/route.ts:187-206`

```ts
const rows = await prisma.$queryRaw<{ max: bigint | null }[]>`
  SELECT MAX(CAST(NULLIF(REGEXP_REPLACE(\`entryNumber\`, '[^0-9]', ''), '') AS SIGNED)) AS max
  FROM \`JournalEntry\`
`;
```

Injection review: clean — the template has no interpolated values, so there is no
injection surface. Tenancy: the query scans `JournalEntry` platform-wide with no
`organizationId` predicate. It is currently **dead code** — the POST handler uses
the correct `nextJournalEntryNumber(prisma, session.organizationId)` at `:328`
instead — so it leaks nothing today. Left in place it is a trap for the next
person who wires it up, and it would leak the platform-wide journal-entry high
water mark (a rough count of all tenants' accounting activity).

Fix: delete the function, or add `WHERE organizationId = ?` with a bound
parameter.

**batch 1/9 written**

### Batch 2/9 — `accounts/*` (part 2), credit-notes, debit-notes

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped? | verdict |
|---|---|---|---|---|---|
| /api/accounts/payments | GET, POST | `requireApiSession` | none | yes — GET builds `where` from `orgWhere`; POST `orgData` + scoped dedup; JE org from session | MEDIUM — `debitAccountId`/`creditAccountId` unvalidated (B1-F3); silent fallback (B2-F4) |
| /api/accounts/payments/vendor-apx-auto-pay | POST | `requireApiSession` | none | yes — vendor verified via `orgWhere`, `organizationId` passed to helper | OK |
| /api/accounts/payments/vendor-skynet-auto-pay | POST | `requireApiSession` | none | yes — same pattern | OK |
| /api/accounts/payments/vendor-excel | POST | `requireApiSession` | none | **no** — `chartOfAccount.findMany` at `:184` has no org filter | **HIGH** — cross-tenant chart-of-accounts (B2-F1) |
| /api/accounts/transactions/customer/[id] | GET, POST | `requireApiSession` | none | yes — customer verified via `orgWhere`; every read `orgWhere`/`creditNoteOrgFilter`; writes keyed by derived ids | MEDIUM — GET mutates balances when `?recalc=true` (B2-F2) |
| /api/accounts/transactions/vendor/[id] | GET, POST | `requireApiSession` | none | yes — vendor verified via `orgWhere`; all 30 reads scoped or id-derived | MEDIUM — same state-changing GET (B2-F2) |
| /api/credit-notes | GET, POST | `requireApiSession` | none | yes — `creditNoteOrgFilter`; POST validates customer, invoice and both accounts against org | LOW — global note numbering (B2-F3) |
| /api/credit-notes/invoices | GET | `requireApiSession` | none | yes — `orgWhere`, customer re-verified | OK |
| /api/credit-notes/[id] | GET, PUT, DELETE | `requireApiSession` | none | yes — `findOrgCreditNote` + `orgWhere` on every ledger row; accounts validated via `findOrgChartAccount` | OK |
| /api/debit-notes | GET, POST | `requireApiSession` | none | yes — `debitNoteOrgFilter`; POST validates vendor, bill and accounts against org | LOW — global note numbering (B2-F3) |
| /api/debit-notes/bills | GET | `requireApiSession` | none | yes — `orgWhere`, vendor re-verified | OK |
| /api/debit-notes/[id] | GET, PUT, DELETE | `requireApiSession` | none | yes — `findOrgDebitNote` + `orgWhere` throughout | OK |

Supporting files read: `project/src/lib/tenant/findOrgCreditNote.ts`,
`findOrgDebitNote.ts`.

---

#### CORRECTION TO F-2 (pass 1) — the credit/debit-note routes are scoped after all; downgrade CRITICAL → LOW

F-2 predicted that because `DebitNote` and `CreditNote` have no `organizationId`
column, their routes must be cross-tenant readable. **Having now read all six
handlers, that prediction is wrong.** The codebase compensates with relation-based
filters that I had not seen when F-2 was written:

```ts
export function creditNoteOrgFilter(session) {
  return { customer: { organizationId: session.organizationId } };   // findOrgCreditNote.ts:20-22
}
export function debitNoteOrgFilter(session) {
  return { vendor: { organizationId: session.organizationId } };     // findOrgDebitNote.ts:20-22
}
```

and `findOrgCreditNote` / `findOrgDebitNote` apply the same predicate to
single-row loads. Every one of the six handlers uses them —
`credit-notes/route.ts:79`, `:113`, `:146`, `:149`;
`credit-notes/[id]/route.ts:29`, `:121`, `:280`, `:312`;
`debit-notes/route.ts:64`, `:98`, `:130`, `:133`;
`debit-notes/[id]/route.ts:28`, `:119`, `:278`, `:309` — and every associated
`Payment`, `JournalEntry`, `CustomerTransaction` and `VendorTransaction` write
goes through `orgWhere`. The `updateMany`/`deleteMany` calls that the pass-1
grep flagged (`credit-notes/[id]:222`, `:353`, `:357`; `debit-notes/[id]:220`,
`:345`, `:349`) are all `orgWhere`-filtered. No cross-tenant read or write is
reachable through these endpoints.

Two residual risks keep this at LOW rather than closing it entirely:

1. `DebitNote.vendorId` and `CreditNote.invoiceId` are nullable
   (`schema.prisma:500`, `:513`). A debit note with `vendorId = null` matches
   *no* org's filter, so it becomes invisible and un-deletable through the API —
   an orphan row that still appears in any raw report. `CreditNote.customerId` is
   non-null, so credit notes are safe from this.
2. The protection is one `...Filter(session)` spread away from being lost. A
   single new query written as `prisma.debitNote.findMany({ where: { id } })`
   would be a full cross-tenant read with nothing to stop it, because the model
   itself carries no tenant column and no database-level constraint.

Fix (unchanged in substance, lower urgency): add `organizationId` to both models
with `@@index`, backfill from `vendor`/`customer`, and switch the helpers to a
direct column filter so scoping does not depend on a join through a nullable
relation.

#### B2-F1 — HIGH: the vendor Excel importer resolves chart-of-accounts across every tenant

`project/src/app/api/accounts/payments/vendor-excel/route.ts:184-191`

```ts
const accounts = await prisma.chartOfAccount.findMany({
  where: { isActive: true },      // <- no organizationId
});
const coaRows: ChartAccountRow[] = accounts.map((a) => ({ id: a.id, accountName: a.accountName, category: a.category }));
```

Everything else in this handler is correct — the vendor is verified with
`orgWhere` (`:163-165`), the matched invoice is explicitly re-checked with
`invoice.organizationId !== session.organizationId` (`:254`), and the payment is
created through `processPaymentWithAllocation(..., session.organizationId)`.
Only the account lookup is unscoped. Compare the sibling importer
`payments/bulk-import/route.ts:318-320`, which does the same query correctly with
`orgWhere(session, { isActive: true })`.

`resolveVendorPaymentAccountIds(coaRows, paymentMethod)` (`:264-267`) then picks
an account by fuzzy name match ("Accounts Payable", "cash", "bank") over the
platform-wide list. Whichever tenant's row happens to sort first wins, so a
tenant with no Cash account of its own silently gets *another tenant's* account
id, and the journal lines written at `createJournalEntryForPaymentProcess`
(`:309-314`) are posted against that foreign `accountId`.

Cross-tenant impact: the victim's ledger account now carries debit and credit
lines generated by the attacker's imports. Any report that aggregates
`JournalEntryLine` by `accountId` — the balance sheet, the income statement and
the account-books view — will include those amounts in the victim's books. The
attacker also learns, indirectly, that a given account name exists in another
tenant. This requires no crafted request at all: an ordinary Excel import by a
tenant whose chart of accounts is incomplete triggers it.

Fix: `where: orgWhere(session, { isActive: true })`, matching the bulk-import
handler. Additionally, `resolveVendorPaymentAccountIds` should fail loudly when
no in-org account matches, rather than falling through to a fuzzy match.

#### B2-F2 — MEDIUM: `GET` on both transaction ledgers rewrites stored balances

`project/src/app/api/accounts/transactions/customer/[id]/route.ts:52`, `:970-984`;
`project/src/app/api/accounts/transactions/vendor/[id]/route.ts:53`, `:801-804`

```ts
const recalcBalances = searchParams.get('recalc') === 'true';
...
await Promise.all(transactionsToUpdate.map(({ id, previousBalance, newBalance }) =>
  prisma.customerTransaction.update({ where: { id }, data: { previousBalance, newBalance } })
));
await prisma.customers.update({
  where: { id: customerId },
  data: { currentBalance: runningBalance }
});
```

A `GET` request with `?recalc=true` rewrites `previousBalance`/`newBalance` on
every ledger row for that party and overwrites `Customers.currentBalance` /
`Vendors.currentBalance`. The scoping is correct (`customerId` was verified with
`orgWhere` at `:31-33`, the ids come from an `orgWhere` query at `:736-737`), so
this is not cross-tenant — the writes are TOCTOU-only.

The problem is that it is a state-changing GET reachable with an ambient cookie
session. Any page that can make the victim's browser issue a cross-site GET — an
`<img src>`, a prefetch, a link in an email — can silently rewrite a tenant's
customer balances, and the recomputation is not idempotent with respect to the
`STARTING-BALANCE` handling at `:922-967`. Search-engine or monitoring crawlers
following links with the parameter would do the same. There is no CSRF token
anywhere in this codebase, and the session cookie is read by `getSession`
(`session.ts:75-77`) without a `SameSite` check at the handler level.

Fix: move the recalculation to `POST` (or a dedicated `POST .../recalc`
endpoint), require `manage_billing`, and wrap the loop in `$transaction`.

#### B2-F3 — LOW: credit-note and debit-note numbers are allocated from a platform-wide sequence

`project/src/app/api/credit-notes/route.ts:238-243`;
`project/src/app/api/debit-notes/route.ts:217-219`

```ts
const lastCreditNote = await prisma.creditNote.findFirst({
  orderBy: { id: "desc" },        // no tenant filter
});
const nextId = (lastCreditNote?.id || 0) + 1;
const creditNoteNumber = formatCreditNoteReference(nextId);
```

Unlike `nextJournalEntryNumber` (`orgJournalChart.ts:9-12`), which correctly
filters `{ organizationId }`, these two read the global maximum. Consequences:
the returned `creditNoteNumber` discloses the total number of credit notes across
all tenants (a business-volume side channel), and each tenant's note numbering
has visible gaps that correlate with other tenants' activity. Because
`creditNoteNumber` and `debitNoteNumber` are `@unique` platform-wide
(`schema.prisma:497`, `:512`), two tenants creating a note in the same instant
collide on a P2002 and one gets an opaque "Failed to create credit note" 500.

Fix: derive the sequence per tenant, e.g. `findFirst({ where:
creditNoteOrgFilter(session), orderBy: { id: "desc" } })`, and make the uniqueness
constraint composite with `organizationId` once that column exists.

#### B2-F4 — LOW: the payments list silently degrades to an empty result

`project/src/app/api/accounts/payments/route.ts:120-167`, and the POST fallback at
`:310-334`

The GET wraps its query in a `try`, retries with a reduced `select` on failure,
and if that also throws returns `NextResponse.json({ payments: [], total: 0 })`
(`:164-166`) with a 200 status. A database error is therefore indistinguishable
from "this tenant has no payments" — an accountant looking at the page sees an
empty ledger and no error. The POST has the mirror-image problem: the whole
create path is duplicated in a `catch` (`:310-334`) so a genuine failure in the
first attempt is retried blind.

Neither is a tenancy bug — both branches use `orgWhere`/`orgData` correctly.

Fix: return a 500 and let the UI show a failure state; delete the duplicated
fallback create.

**batch 2/9 written**

### Batch 3/9 — `saas/*` and the first unauthenticated routes

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped? | verdict |
|---|---|---|---|---|---|
| /api/saas/organizations | GET | `requireSuperAdmin` | SUPER_ADMIN | n/a — platform scope by design | OK |
| /api/saas/organizations/[id] | PATCH, DELETE | `requireSuperAdmin` | SUPER_ADMIN + password + 2FA on DELETE | n/a — every `deleteMany` filtered on the target `orgId` | OK (see B3-F4 for the orphan-note gap) |
| /api/saas/organizations/[id]/billing | POST | `requireSuperAdmin` | SUPER_ADMIN | n/a — platform scope | OK |
| /api/saas/organizations/[id]/send-2fa | POST | `requireSuperAdmin` | SUPER_ADMIN + password | n/a — writes only the caller's own `User` row | MEDIUM — 2FA code in `User.status`, `Math.random`, status clobber (B3-F3) |
| /api/saas/payment-proofs | GET | `requireSuperAdmin` | SUPER_ADMIN | n/a — platform scope | OK |
| /api/saas/payment-proofs/[id] | PATCH | `requireSuperAdmin` | SUPER_ADMIN | n/a — org derived from the proof row | OK |
| /api/saas/pending-approvals | GET | `requireSuperAdmin` | SUPER_ADMIN | n/a — platform scope | OK |
| /api/saas/pending-approvals/[id] | DELETE | `requireSuperAdmin` | SUPER_ADMIN | n/a — platform scope; self-rejection blocked | OK |
| /api/customers/check-inactive | GET, POST | **none** | none | **no** — reads and `updateMany`s every tenant's customers | **CRITICAL** — unauthenticated (B3-F1) |
| /api/customers/reactivate | GET, POST | **none** | none | **no** — `findUnique`/`update` by raw id, global list | **CRITICAL** — unauthenticated (B3-F1) |
| /api/email/send | POST | raw `jwt.verify` Bearer | **none** | **no** — `user.findMany` platform-wide | **HIGH** — authenticated mail relay to any user (B3-F2) |
| /api/auth/reset-2fa | POST | raw `jwt.verify` Bearer | none | n/a — acts only on the token's own `id` | LOW — part of the shadow auth scheme (B3-F5) |

Supporting file read: `project/src/lib/auth/session.ts:36-59` (token claims),
`project/src/middleware.ts:33-39`.

---

#### B3-F1 — CRITICAL: two unauthenticated endpoints read and write every tenant's customer table

`project/src/app/api/customers/check-inactive/route.ts:4`, `:15-45`, `:81-90`, `:128`, `:137-167`
`project/src/app/api/customers/reactivate/route.ts:4`, `:16-19`, `:36-46`, `:70`, `:72-102`

Neither file imports `requireApiSession`, `requirePermission`, `getSession`, or
any secret-header check. There is no guard of any kind — the handlers begin
with `export async function POST() {` and go straight to Prisma.

```ts
// check-inactive/route.ts:137
const activeCustomers = await prisma.customers.findMany({
  where: { ActiveStatus: "Active", createdAt: { lt: oneYearAgo } },
  select: { id: true, CompanyName: true, PersonName: true, Email: true, createdAt: true,
            invoices: { select: { shipment: { select: { shipmentDate: true, trackingId: true } } } } }
});
```

`Customers` is a tenant-owned model (`organizationId` present per the pass-1
census), and this query has no tenant predicate.

Exploit 1 — mass data exfiltration, no credentials:

```
curl https://<host>/api/customers/check-inactive
curl https://<host>/api/customers/reactivate
```

The first returns every tenant's dormant customers with company name, contact
person, **email address**, signup date and last shipment date. The second
(`reactivate/route.ts:72-102`) returns the same fields for every customer whose
`ActiveStatus` is `"Inactive"`, plus the internal `id`. Together they hand an
anonymous caller a cross-tenant customer and prospect list — the single most
commercially sensitive dataset a logistics SaaS holds, since it is precisely the
list a competitor would target.

Exploit 2 — unauthenticated writes:

```
curl -X POST https://<host>/api/customers/check-inactive
```

runs `prisma.customers.updateMany({ where: { id: { in: customerIds } }, data: { ActiveStatus: "Inactive" } })`
(`:81-90`) across **all** tenants. `POST /api/customers/reactivate {"customerId": 55}`
(`:36-46`) flips any single customer in any tenant back to `"Active"` with a raw
`prisma.customers.update({ where: { id: customerId } })`. The ids are small
sequential integers, so the whole space is enumerable in minutes, and the 404 vs
400 vs 200 responses (`:21-33`) confirm existence and current status of each id —
a cross-tenant oracle even without the list endpoints.

The endpoints look like an internal maintenance job that was never wired to the
cron secret used elsewhere (`cron/*` at least has the shape of scheduled tasks).
There is nothing in either file that suggests intentional public exposure, so:
**VULNERABLE, not public-by-design.**

Fix: if these are cron jobs, move them under `/api/cron/`, require the shared
secret header, and scope the query per organization by iterating orgs. If they
back a dashboard button, gate them with `requirePermission(req, "manage_customers")`
and add `orgWhere(session, ...)` to the read, the `updateMany`, and the single
`update`. Nothing about the current implementation should survive.

#### B3-F2 — HIGH: `POST /api/email/send` will mail arbitrary content to any user on the platform

`project/src/app/api/email/send/route.ts:9-22`, `:40-53`, `:60-82`

The only check is that the `Authorization: Bearer` header carries a JWT that
verifies against `JWT_SECRET` (`:19`). There is no role check, no
`requirePermission`, and — critically — no tenant filter on the recipient lookup:

```ts
const recipientUsers = await prisma.user.findMany({
  where: { id: { in: recipients.map((r: any) => parseInt(r.id)) } },   // :40-45
  select: { id: true, name: true, email: true, role: true, status: true }
});
```

`subject` and `body` come straight from the request (`:24`) and are sent as HTML
(`:73`) from the platform's own mail infrastructure.

Exploit: any logged-in user of any tenant — the session token is in a
JS-readable `token` cookie, which `PermissionContext.tsx` already reads with
`Cookies.get("token")` — copies their token and posts

```
POST /api/email/send
Authorization: Bearer <own token>
{"recipients":[{"id":1},{"id":2},...,{"id":5000}],
 "subject":"Urgent: verify your account",
 "body":"<a href='https://evil/'>Click here</a> {{name}}"}
```

Every user on the platform, across every tenant, receives a phishing email that
passes SPF/DKIM for the real domain, personalised with their own name, email,
role and account status via the placeholder substitution at `:63-67`. That
personalisation makes the message far more convincing than a generic phish, and
the platform's sending reputation is burned in the process. The attacker also
gets a per-recipient success/failure report (`:88-96`) that confirms which user
ids exist — a cross-tenant enumeration oracle over the whole `User` table.

Fix: gate with `requireApiSession` + a `MANAGE_USERS`-class permission (or
`requireSuperAdmin` if this is a platform broadcast tool); restrict recipients to
`memberships: { some: { organizationId: session.organizationId } }`; sanitize or
template the HTML body instead of passing caller-supplied markup to `sendEmail`;
rate-limit.

#### B3-F3 — MEDIUM: super-admin 2FA codes are stored in plaintext in `User.status`, generated with `Math.random`, and reset clobbers the real status

`project/src/app/api/saas/organizations/[id]/send-2fa/route.ts:56-62`, `:76-79`;
consumed at `project/src/app/api/saas/organizations/[id]/route.ts:129-158`

```ts
const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
const tempStatus = `PENDING_2FA_${verificationCode}_${Date.now()}`;
await prisma.user.update({ where: { id: user.id }, data: { status: tempStatus } });
```

Three problems, all on the guard protecting "delete an entire organization and
all of its data":

1. The code is stored **in cleartext in a general-purpose status column**. Any
   endpoint that returns `user.status` discloses a live 2FA code — and
   `/api/saas/pending-approvals/route.ts:25` and `/api/users/route.ts` both
   select `status`. It is also in every database backup and log dump.
2. `Math.random()` is not a CSPRNG. Combined with the 10-minute window
   (`organizations/[id]/route.ts:136`) and the absence of any attempt counter on
   the code comparison at `:147`, a six-digit code is brute-forceable — nothing
   in the DELETE handler locks out after repeated `Invalid verification code`
   responses.
3. On email failure the handler writes `status: "ACTIVE"` unconditionally
   (`:76-79`), as do the expiry path (`organizations/[id]/route.ts:137-140`) and
   the success path (`:244-247`). A user who was `SUSPENDED` or
   `PENDING_APPROVAL` before requesting a code is silently promoted to `ACTIVE`.

Fix: store the code hashed in a dedicated table with an attempt counter and an
expiry column; generate it with `crypto.randomInt`; restore the previous status
instead of hardcoding `"ACTIVE"`; use a constant-time comparison.

#### B3-F4 — LOW: organization deletion leaves credit/debit notes behind

`project/src/app/api/saas/organizations/[id]/route.ts:180-194`, `:216-218`

The cleanup deletes notes by their **invoice** link only:

```ts
await tx.debitNote.deleteMany({ where: { billId: { in: invoiceIds } } });
await tx.creditNote.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
```

but `CreditNote.invoiceId` and `DebitNote.billId` are nullable, and a note can be
raised against a customer or vendor with no invoice attached (the create path at
`credit-notes/route.ts:191-198` sets `resolvedInvoiceId = null` when no matching
invoice is found). Those notes survive, while their `customer`/`vendor` parent is
deleted at `:216-218`. The result is exactly the orphan class described in the
F-2 correction: rows that belong to no organization, invisible to
`creditNoteOrgFilter`/`debitNoteOrgFilter`, still present in the table and in any
reporting query that does not join through the parent.

Fix: delete notes by `customerId in (...)` / `vendorId in (...)` as well, or add
the `organizationId` column and delete on it like every other model in this
transaction.

#### B3-F5 — LOW (structural): a second, weaker authentication scheme runs alongside `requireApiSession`

`project/src/app/api/auth/reset-2fa/route.ts:5-12`, `:31-45`; and the same
`decodeToken` helper copy-pasted into `email/send/route.ts:15`,
`email/users/route.ts:14`, `email/templates/route.ts:43`, `:94`, `:157`, `:228`,
`profile/change-password/route.ts:10`, `shipments/[id]/route.ts:12`,
`shipments/[id]/send-2fa/route.ts:12`, `user-activity/route.ts:28`,
`public-tools/route.ts:8`, `lib/utils.ts:13`

These routes do not use `requireApiSession`. They read a raw `Authorization:
Bearer` header and call `jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")`
directly. Compared with `requireApiSession` this scheme skips: the organization
lookup, the `orgStatus`/subscription check, the user `status`/`isApproved` check,
and it yields no `session` object — so the handler has no `organizationId`
available even if it wanted to scope its queries. That is the mechanical reason
`email/send` (B3-F2) is unscoped: the auth path it chose never produces a tenant
id.

`reset-2fa` itself is low impact — it only clears `PENDING_2FA_*` on the user id
embedded in the caller's own token (`:31-45`), and both `id` and `userId` claims
are present (`session.ts:47-48`), so it resolves correctly. The finding is the
pattern, not this route.

Note also the shared fallback: `process.env.JWT_SECRET || "your-secret-key"`
appears in `session.ts:5`, `middleware.ts:36` and each of the routes above. If
`JWT_SECRET` is ever unset in an environment, the application silently accepts
tokens signed with a hardcoded, publicly-known string — anyone could mint a
`platformRole: "SUPER_ADMIN"` token. That is a deployment-config landmine rather
than a code defect today, but it should fail closed at boot.

Fix: delete the per-route `decodeToken` copies and route everything through
`requireApiSession`/`requirePermission`; throw at startup if `JWT_SECRET` is
missing.

**batch 3/9 written**

### Batch 4/9 — remaining unauthenticated routes and the shipments surface

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped? | verdict |
|---|---|---|---|---|---|
| /api/reset-password | PATCH | **none** | none | n/a — global `User`, but no identity proof | **CRITICAL** — anyone resets anyone's password (B4-F1) |
| /api/signup/update-plan | POST | **none** | none | **no** — `organizationId` and `userId` come from the body | **CRITICAL** — unauthenticated cross-tenant billing write (B4-F2) |
| /api/email/users | GET | raw `jwt.verify` Bearer | **none** | **no** — `user.findMany` with an empty `where` | **HIGH** — platform-wide user directory (B4-F3) |
| /api/services | GET | **none** | none | **no** — `serviceMode.findMany` with no filter | MEDIUM — unauthenticated cross-tenant config read (B4-F4) |
| /api/email/templates | GET, POST, PUT, DELETE | raw `jwt.verify` Bearer | **none** | n/a — module-level in-memory array, shared by all tenants | MEDIUM — shared mutable state (B4-F5) |
| /api/signup/upload | POST | **none** | none | n/a — no Prisma; type allowlist + 5 MB cap, secret held server-side | PUBLIC-BY-DESIGN (no rate limit) |
| /api/user-activity | POST, GET | POST: `jwt.verify` on a body token; **GET: none** | none | n/a — in-memory `Map`, no Prisma | LOW — token logging, unauthenticated counter (B4-F7) |
| /api/shipments/[id] | GET, DELETE | `requirePermission` | `view_shipments` / `delete_shipment` | **yes** — `orgWhere` on every read; all deletes keyed by ids from scoped reads | OK — the pass-1 "IDOR suspicion" is retracted |
| /api/shipments/[id]/tracking-status | GET, PATCH, PUT, DELETE | `requirePermission` | `view_shipments` / `update_status` | yes — `orgWhere` before every mutation; status values allowlisted | OK |
| /api/shipments/[id]/ensure-initial-tracking | POST | `requireApiSession` | none | yes — `orgWhere` pre-check, update by derived id | OK |
| /api/shipments/[id]/send-2fa | POST | `requireApiSession` **and** a separate Bearer token | none | shipment yes (`orgWhere`); the `User` write targets the *Bearer token's* id | LOW — two identities in one handler (B4-F6) |

Inventory correction: there is no `/api/shipments/route.ts`. The pass-1 table
listed `/api/shipments | GET`; the shipments directory contains only the four
`[id]` routes above (verified by globbing `src/app/api/shipments/**/route.ts`).

---

#### B4-F1 — CRITICAL: `PATCH /api/reset-password` changes any user's password with no proof of identity

`project/src/app/api/reset-password/route.ts:5-33`

```ts
export async function PATCH(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  if (password.length < 8) { ... }
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { email }, data: { password: hashedPassword } });
  return NextResponse.json({ success: true, message: "Password reset successful." });
}
```

That is the entire handler. There is no session, no reset token, no OTP, no
current-password check, no expiry, no rate limit — the request body alone
decides whose password is replaced. The pass-1 table guessed this was a
"token flow"; it is not. There is no token anywhere in the file.

Exploit:

```
curl -X PATCH https://<host>/api/reset-password \
  -H 'content-type: application/json' \
  -d '{"email":"owner@victim-tenant.com","password":"attacker-chosen"}'
```

then log in as that user. This is total account takeover of **any** account on
the platform by anyone on the internet who knows or guesses an email address —
and `/api/email/users` (B4-F3) hands over the complete email list, while the
404-vs-200 response here is itself an account-existence oracle.

Escalation path to the whole platform: take over a `SUPER_ADMIN` (the pending-
approvals and organizations endpoints reveal who they are), then
`DELETE /api/saas/organizations/[id]` every tenant, or simply read every
tenant's data through the `saas/*` endpoints. Taking over a tenant `OWNER`
gives `requirePermission`'s OWNER short-circuit (`requirePermission.ts:100-102`),
i.e. every permission in that tenant.

This supersedes F-1 as the most severe finding in the audit: F-1 requires a
valid session, this requires nothing.

Fix: delete this endpoint and implement a real flow — a single-use,
time-limited, cryptographically random token stored hashed against the user,
delivered by email, consumed atomically; rate-limit by IP and by account; return
an identical response whether or not the email exists; invalidate all sessions on
success.

#### B4-F2 — CRITICAL: `POST /api/signup/update-plan` lets an anonymous caller rewrite any organization's subscription

`project/src/app/api/signup/update-plan/route.ts:7-58`, `:109-120`, `:128-139`

```ts
const { userId, organizationId, planCode, paymentMethod, referenceId, receiptUrl, billingCycle } = body;
...
await prisma.subscription.upsert({
  where:  { organizationId: parseInt(organizationId, 10) },
  update: { planId: plan.id, status: isTrial ? "trialing" : "pending", trialEndsAt },
  create: { organizationId: parseInt(organizationId, 10), planId: plan.id, ... }
});
await prisma.organization.update({
  where: { id: parseInt(organizationId, 10) },
  data: { status: isTrial ? "trial" : "pending" },
});
```

No session, no signup-token, no check that the caller has anything to do with
`organizationId` — this is the textbook tenant-forgery pattern: the tenant id
comes from the request body. It is presumably reachable during signup before a
session exists, but nothing scopes it to that moment.

Exploit 1 — denial of service against any tenant. `organizationId` is a small
integer:

```
POST /api/signup/update-plan
{"userId":1,"organizationId":7,"planCode":"basic"}
```

Organization 7's subscription is switched to `status: "pending"` and the org row
to `status: "pending"`. `requireApiSession` gates on `orgStatus`, so every member
of that tenant is locked out of the product until an admin intervenes. Loop over
ids 2..N and the entire customer base is down.

Exploit 2 — free service. Post `planCode: "trial"` for your own org to reset
`trialEndsAt` to `now + 14 days` (`:30-34`), repeatedly, forever; or set any
`planCode` to move a tenant onto a plan whose `features` unlock modules
`requirePermission` gates on (`requirePermission.ts:74-84`).

Exploit 3 — forged payment records. With `paymentMethod` and `referenceId` set,
the handler writes a `PaymentProof` row (`:109-120`) with an attacker-chosen
amount, currency, method, reference and receipt URL against **any** org id. Those
rows are what the super-admin approves in `saas/payment-proofs`, and they feed
the platform revenue chart (`saas/organizations/route.ts:92-129`). An anonymous
caller can therefore both poison the revenue reporting and present a plausible
"I already paid" record for any tenant.

It also flips a user's status to `PENDING_APPROVAL` (`:136-139`) for any
`userId` whose current status is one of the three pending values, and triggers an
email to the super admin — a spam vector.

Fix: require an authenticated session (or a signed, single-use signup token
issued by `/api/signup` and bound to that specific `organizationId`); take
`organizationId` from the session/token, never from the body; verify `userId`
matches the session; make the `PaymentProof` amount server-computed from the plan
rather than trusted from the request.

#### B4-F3 — HIGH: `GET /api/email/users` returns the whole platform's user directory to any token holder

`project/src/app/api/email/users/route.ts:8-20`, `:31`, `:49-79`

```ts
jwt.verify(token, secret);      // :17 — result discarded, no role, no org
...
const where: any = {};          // :31
const [users, total] = await Promise.all([
  prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true }, ... }),
  prisma.user.count({ where }),
]);
```

The verified token is not even assigned to a variable — the handler never learns
who the caller is, so it cannot scope anything. `where` starts empty and only
ever receives caller-supplied `search`/`role`/`status` filters.

Exploit: any authenticated user of any tenant requests
`/api/email/users?limit=1000&page=1` with their own token and receives every
user on the platform — full name, email address, role and account status —
paginated, searchable, plus the distinct role and status lists at `:68-79`. That
is a cross-tenant PII disclosure covering every customer's staff, and it is the
targeting list that makes B4-F1 (reset anyone's password by email) and B4-F2
trivial to weaponise. Note `status` may transiently contain a live
`PENDING_2FA_<code>_<ts>` value per B3-F3 — so this endpoint can leak an
in-flight super-admin 2FA code.

Fix: use `requireApiSession`, filter with
`memberships: { some: { organizationId: session.organizationId } }`, require a
user-management permission, and drop `status` from the projection.

#### B4-F4 — MEDIUM: `GET /api/services` publishes every tenant's service modes

`project/src/app/api/services/route.ts:4-15`

```ts
export async function GET(req: NextRequest) {
  const services = await prisma.serviceMode.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ success: true, data: services });
}
```

No guard and no filter. `ServiceMode` is tenant-owned (`organizationId` present),
so an anonymous request returns the full service catalogue of every tenant on the
platform, including each row's `organizationId`. The rows themselves are low
sensitivity — service names such as "Express", "Economy" — but they disclose how
many tenants exist, their internal ids, and each one's operational offering,
which is competitor-useful and helps an attacker size the platform before
exploiting B4-F1/B4-F2.

Fix: `requireApiSession` + `orgWhere(session)`. If a public list is genuinely
needed for a marketing page, expose only distinct names for a single, explicitly
identified organization.

#### B4-F5 — MEDIUM: email templates are a process-global array any token holder can rewrite

`project/src/app/api/email/templates/route.ts:5-32` (module-level `templates`,
`nextId`), with GET/POST/PUT/DELETE each verifying only that a JWT parses
(`:46`, `:97`, `:160`, `:231`)

```ts
let templates: any[] = [ ... ];   // module scope — one array for the whole server
let nextId = 4;
```

There is no database model and no tenant key, so every organization shares one
mutable set of email templates, and any authenticated user of any tenant can
create, edit or delete them for everyone. The bodies are the templates used for
customer-facing mail (`{{name}}`, `{{tracking_id}}`, `{{invoice_number}}`), so a
malicious edit propagates to other tenants' outbound email — combined with
B3-F2 (`email/send` accepts arbitrary bodies anyway) this is a content-integrity
problem more than a disclosure one. Being module state, it also silently resets
on every deploy or serverless cold start and diverges between instances, so
edits appear to vanish.

Fix: persist templates in a tenant-scoped table with `organizationId`, gate
writes behind an admin permission, and scope reads with `orgWhere`.

#### B4-F6 — LOW: `shipments/[id]/send-2fa` authenticates one user and writes to another

`project/src/app/api/shipments/[id]/send-2fa/route.ts:24-26`, `:39-55`, `:69-71`, `:110-113`

The handler establishes a session from the cookie (`requireApiSession`, `:24`)
and uses it correctly for the shipment lookup (`orgWhere`, `:91-93`). But the
user whose password is verified and whose `status` is overwritten comes from a
*separate* `Authorization: Bearer` token:

```ts
const decoded = decodeToken(token);                      // :48
const user = await prisma.user.findUnique({ where: { id: parseInt(decoded.id) } });   // :69-71
...
await prisma.user.update({ where: { id: user.id }, data: { status: tempStatus } });    // :110-113
```

Nothing checks `decoded.id === session.userId`. A caller who holds any other
user's token (for example one leaked through the JS-readable `token` cookie on a
shared machine) can, while logged in as themselves, cause that other account's
`status` to be overwritten with `PENDING_2FA_...` and a code mailed to them.
Combined with B3-F3's unconditional reset to `"ACTIVE"`, this can also clear
another account's `SUSPENDED` state. Same `Math.random()` code generation and
same plaintext-in-`status` storage as B3-F3.

Fix: drop the Bearer path entirely and use `session.userId` for the password
check and the status write.

#### B4-F7 — LOW: `user-activity` logs bearer tokens and exposes an unauthenticated counter

`project/src/app/api/user-activity/route.ts:25`, `:64-71`, `:87-130`

`console.log("🔑 Token received:", token.substring(0, 20) + "...")` (`:25`) and
the map dump at `:64-71` write token prefixes into the server log on every
request; the `GET` (`:87`) has no authentication at all and returns the live
count of active sessions platform-wide. The store is an in-process `Map` (`:6`),
so the number is per-instance and meaningless behind more than one worker. No
Prisma access, no tenant data — hence LOW — but the token logging is a
credential-handling defect and the counter leaks platform activity levels.

Fix: remove the token from the logs, require a session on the `GET`, and move the
store to Redis if the feature is meant to work in production.

**batch 4/9 written**

### Batch 5 — CRM surface (customers, vendors, recipients, search)

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped | verdict |
|---|---|---|---|---|---|
| `api/customers` | GET | `requirePermission` | `view_customers` | yes — `orgWhere(session)` on the list, all five counts, and the per-customer `shipment.findMany` (`:26`, `:76-79`, `:87-89`) | OK |
| `api/customers/[id]` | GET, PUT, DELETE, PATCH | `requirePermission` (+ Bearer token + password on DELETE) | `view_customers` / `manage_customers` | yes — every read is `orgWhere(session, { id })` (`:53`, `:93`, `:218`, `:259`); the bare `update`/`delete` by id (`:113`, `:230`, `:271`) are all preceded by a scoped existence check in the same handler | OK (TOCTOU/LOW on the bare writes); see B5-F1 for the DELETE identity mix |
| `api/add-customers` | POST | `requirePermission` | `manage_customers` | dup check `orgWhere` (`:130`), create `orgData` (`:143`) — but `getNextCustomerId()` (`:10-13`) scans all tenants | MEDIUM — see B5-F2 |
| `api/vendors` | GET | `requirePermission` | `view_vendors` | yes — `orgWhere(session)` (`:25`) feeds both `findMany` and `count` | OK |
| `api/vendors/[id]` | GET, PUT, DELETE | `requirePermission` (+ Bearer token + password on DELETE) | `view_vendors` / `manage_vendors` | yes — `orgWhere(session, { id })` at `:41`, `:81`, `:191`; bare `update`/`delete` (`:90`, `:203`) preceded by scoped check | OK (TOCTOU/LOW); see B5-F1 |
| `api/add-vendors` | POST | `requirePermission` | `manage_vendors` | yes — `orgWhere` dup check (`:44`), `orgData` create (`:58`) | OK |
| `api/recipients` | GET | `requireApiSession` | none | yes — `orgWhere(session)` (`:26`) reused by `findMany` and both counts | OK, but no permission check — see B5-F3 |
| `api/recipients/[id]` | GET, PUT, DELETE, PATCH | `requireApiSession` (+ Bearer token + password on DELETE) | none | yes — `orgWhere(session, { id })` at `:49`, `:92`, `:211`, `:255`; `checkRemoteArea` is passed `session.organizationId` explicitly (`:103`, `:269`) | OK (TOCTOU/LOW); see B5-F1 and B5-F3 |
| `api/add-recipients` | POST | `requireApiSession` | none | yes — `orgWhere` dup check (`:89`), `orgData` create (`:106`), `checkRemoteArea(..., session.organizationId)` (`:102`) | OK, no permission check — see B5-F3 |
| `api/recipients/recalculate-remote` | POST | `requireApiSession` | none | yes — both source reads use `orgWhere(session)` (`:101`, `:106`); the `update` at `:129` is keyed by an id from that scoped list | OK (TOCTOU/LOW) |
| `api/search/customers` | GET | `requireApiSession` | none | yes — `orgWhere(session, {...})` (`:21`) | OK |
| `api/search/vendors` | GET | `requireApiSession` | none | yes — `orgWhere(session, {...})` (`:29`) | OK |

The CRM surface is the cleanest area audited so far: twelve files, zero
unscoped reads, zero unscoped `where` clauses on writes, and no
`organizationId` taken from a request body. The three findings below are all
about *who* is being authenticated and about a counter that escapes the tenant,
not about row-level tenant leakage.

#### B5-F1 — MEDIUM: the delete-confirmation password is checked against the wrong user

`project/src/app/api/customers/[id]/route.ts:165-214`,
`project/src/app/api/vendors/[id]/route.ts:138-187`,
`project/src/app/api/recipients/[id]/route.ts:158-207`

All three DELETE handlers establish the tenant from the cookie session and then
re-authenticate the "are you sure" password against a completely different
identity taken from the `Authorization: Bearer` header:

```ts
const token = authHeader.substring(7);
const decoded = decodeToken(token);                                   // customers :174
const user = await prisma.user.findUnique({ where: { id: parseInt(decoded.id) } });  // :195-197
const passwordMatch = await bcrypt.compare(password, user.password);  // :207
```

`decoded.id` is never compared to `session.userId`. The step-up check therefore
proves only that the caller knows *some* account's password, not that they know
the password of the account whose session is performing the delete. Two concrete
consequences: an attacker who has a session cookie but not the password (a
stolen/borrowed browser) can supply their own token and their own password and
complete the deletion; and, in the other direction, the record actually deleted
is chosen by the session's `organizationId`, so the identity that consented and
the tenant that loses data can belong to different people. `decodeToken` also
verifies against the same `JWT_SECRET || "your-secret-key"` fallback noted in
B3-F5, so in a misconfigured deploy the token is forgeable outright.

This is the same defect as B4-F6 but on data-destroying operations, which is why
it is rated a step higher.

Fix: delete the Bearer branch. Look up the user with
`prisma.user.findUnique({ where: { id: session.userId } })` and compare the
password against that row.

#### B5-F2 — MEDIUM: `add-customers` derives new customer ids from a platform-wide scan

`project/src/app/api/add-customers/route.ts:8-24`, used at `:90`, written at `:93`

```ts
const lastCustomer = await prisma.customers.findFirst({
  orderBy: { id: "desc" },
  select: { id: true },
});          // no where clause at all
return lastCustomer.id + 5;
```

The only unscoped query in this batch. Nothing leaks a customer's *contents*,
but three real problems follow:

1. **Cross-tenant inference.** The id assigned to a newly created customer is
   `globalMax + 5`. Any tenant can create one throwaway customer and read back
   the id, learning the platform-wide high-water mark; repeating it over time
   yields the rate at which *all other tenants combined* are adding customers.
   That is a competitive-intelligence leak from a shared sequence.
2. **Collisions under concurrency.** Two tenants creating a customer in the same
   window both read the same `lastCustomer.id` and both attempt `id: max + 5`;
   the loser gets a unique-constraint 500. The catch at `:20-23` also silently
   falls back to `1000`, which collides deterministically.
3. **Id-space coupling.** One tenant bulk-importing customers advances every
   other tenant's ids.

Compare the correct pattern elsewhere in the codebase: `nextJournalEntryNumber`
in `lib/tenant/orgJournalChart.ts` filters on `{ organizationId }`.

Fix: either drop the manual id entirely and let the database autoincrement, or
scope the scan — `findFirst({ where: orgWhere(session), orderBy: { id: "desc" } })`
— and wrap read-then-create in a transaction (or a per-org counter row) so
concurrent creates cannot collide.

#### B5-F3 — LOW: recipients endpoints enforce authentication but no permission

`project/src/app/api/recipients/route.ts:8`,
`project/src/app/api/recipients/[id]/route.ts:44`, `:84`, `:153`, `:247`,
`project/src/app/api/add-recipients/route.ts:9`,
`project/src/app/api/recipients/recalculate-remote/route.ts:96`

Customers and vendors are gated on `view_customers`/`manage_customers` and
`view_vendors`/`manage_vendors`. The parallel recipients endpoints call only
`requireApiSession`, so every member of an organization — including the lowest
role the tenant has defined — can list, create, edit and delete recipient
records, and can trigger the bulk `recalculate-remote` rewrite. Tenant isolation
holds, so this is intra-tenant only: the role UI implies recipients are
restricted, the server does not enforce it. `recalculate-remote` is the worst of
the group because a single unprivileged POST rewrites `isRemoteArea` on every
recipient row in the org, which feeds surcharge pricing.

Fix: add `requirePermission(req, "view_recipients")` on the reads and
`"manage_recipients"` on the writes, matching the customers/vendors convention.

**batch 5/9 written**

### Batch 6 — ledger, dashboard, and org structure

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped | verdict |
|---|---|---|---|---|---|
| `api/account-books` | GET | `requireApiSession` | none | yes — `orgWhere(session)` is the base of `whereClause` (`:22`) and both the `count` (`:53`) and `findMany` (`:57`) use it; the `category` sub-filter re-asserts `organizationId` on the joined account (`:47`) | OK; logic bug B6-F3 |
| `api/chart-of-accounts` | GET, POST, PUT | `requireApiSession` | none | yes — `orgWhere` (`:24`, `:135`), `findOrgChartAccountByCode` (`:88`), `orgData` on `create` (`:98`) and on every row of `createMany` (`:150`) | OK; no permission check (B6-F5) |
| `api/chart-of-accounts/[id]` | GET, PUT, DELETE | `requireApiSession` | none | yes — `findOrgChartAccount` at `:26`, `:70`, `:125`; bare `update`/`delete` (`:79`, `:148`) follow a scoped lookup; the in-use check joins `journalEntry: orgWhere(session)` (`:137`) | OK (TOCTOU/LOW) |
| `api/journal-entries` | GET, POST, PUT | `requireApiSession` | none | yes — `orgWhere` (`:23`, `:153`), every posted line's account revalidated with `findOrgChartAccount` (`:129`), `orgData` on create (`:165`), `findOrgJournalEntry` before the post (`:221`) | OK — the strongest input validation seen so far; numbering race B6-F4 |
| `api/dashboard` | GET | `requireApiSession` | none | **no** — ~40 tenant queries all use the local `org()` helper (`:74`) correctly, but `prisma.user.count()` (`:105`) and the two fallbacks at `:145-149` and `:156-160` have no filter | MEDIUM — see B6-F1 and B6-F2 |
| `api/fixed-charges` | GET, POST, PUT, DELETE | `requireApiSession` | none | yes — `orgWhere` (`:17`, `:82`, `:131`), `orgData` on both create paths (`:241`, `:273`); bare `update`/`delete` (`:91`, `:140`) follow scoped lookups | OK (TOCTOU/LOW) |
| `api/offices` | GET, POST | `requireApiSession` | none | yes — `orgWhere` (`:14`), `orgData` (`:42`); `checkBranchLimit(session.organizationId)` (`:29`) | OK |
| `api/offices/[id]` | PUT, DELETE | `requireApiSession` | none | yes — `orgWhere(session, { id })` (`:25`, `:58`) before both writes | OK (TOCTOU/LOW) |
| `api/agencies` | GET, POST | `requireApiSession` | none | yes — `orgWhere` (`:14`), `orgData` (`:42`), limit checked against `session.organizationId` (`:29`) | OK |
| `api/agencies/[id]` | PUT, DELETE | `requireApiSession` | none | yes — `orgWhere(session, { id })` (`:25`, `:58`) before both writes | OK (TOCTOU/LOW) |
| `api/zones` | GET, POST, DELETE | `requireApiSession` | none | yes — `deleteMany` scoped (`:107`, `:302`), `createMany` stamps `organizationId: session.organizationId` on every row (`:113`), both upserts key on the `organizationId_service` / `organizationId_vendor_service_fileType` composite (`:122`, `:144`), reads scoped (`:203`, `:209`, `:223`, `:242`) | OK |
| `api/zones/available` | GET | `requireApiSession` | none | yes — `orgWhere(session, { fileType: "zone" })` (`:13`) | OK |

Eleven of the twelve are tenant-clean, including the two destructive bulk
operations in `api/zones` (`deleteMany` at `:107` and `:302` both carry
`orgWhere`). `api/dashboard` is the exception and it is the only unscoped
`prisma.user.*` read found in this batch.

#### B6-F1 — MEDIUM: the dashboard reports platform-wide user counts to every tenant

`project/src/app/api/dashboard/route.ts:105`, `:129-141`, `:145-149`, `:156-160`, `:894`, `:970`

Every other query in this 1,090-line handler goes through the local
`org()` wrapper defined at `:74`. Three do not:

```ts
const totalUsers = await prisma.user.count();                       // :105 — no where
...
activeUsers = await prisma.user.count({ where: { status: "ACTIVE" } });   // :145-149 and :156-160
```

`totalUsers` is emitted as `finalData.totalUsers` (`:970`, via `:894`), so the
"Users" tile on every tenant's dashboard is the count of *all* users on the
platform. Tracked over time it reveals competitors' hiring and onboarding —
the same class of leak as B5-F2 but on a directly rendered number.

The primary path is worse. At `:129-133` the server calls its own API over HTTP:

```ts
const activityUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user-activity`;
const activityResponse = await fetch(activityUrl);
```

That endpoint is the unauthenticated platform-wide session counter from B4-F7,
so the number normally shown is the live count of active users across all
tenants. Two secondary problems: the request carries no cookies, so it can never
be tenant-aware; and the base URL comes from `NEXT_PUBLIC_APP_URL`, a
client-exposed variable — if it is unset in production the dashboard silently
calls `localhost:3000`, and if it is ever attacker-influenced the server issues
an outbound request to a chosen host.

Fix: scope all three counts with `where: { organizationId: session.organizationId }`
(via the existing `org()` helper), and replace the HTTP self-call with a direct
in-process function call that takes the organization id.

#### B6-F2 — MEDIUM: the dashboard tears down the shared Prisma connection pool on every request

`project/src/app/api/dashboard/route.ts:1071-1073`

```ts
} finally {
  await prisma.$disconnect();
}
```

`prisma` is the shared singleton from `@/lib/prisma`. Disconnecting it in a
`finally` closes the pool for the whole process, not for this request. Any other
tenant's request in flight when a dashboard load finishes can fail mid-query,
and each subsequent request pays a reconnect. Under concurrent multi-tenant load
this is a self-inflicted denial of service and a source of the intermittent
500s that the silent catches elsewhere in the codebase would mask. Nothing else
audited so far calls `$disconnect()`.

Fix: delete the `finally` block. A long-lived singleton client is the intended
pattern in Next.js; the pool should live for the lifetime of the process.

#### B6-F3 — LOW: `account-books` silently discards the account filter when a category is also supplied

`project/src/app/api/account-books/route.ts:34-51`

```ts
if (accountId) {
  whereClause.lines = { some: { accountId: parseInt(accountId) } };      // :35-39
}
if (category && category !== 'all-categories') {
  whereClause.lines = { some: { account: { category, organizationId } } }; // :43-50  ← overwrites
}
```

The second assignment replaces the first rather than merging, so a request with
both `accountId` and `category` fetches entries by category alone. The
post-query `.filter()` at `:74-82` does apply both conditions, so the visible
rows end up correct — but the `total` returned at `:108` comes from the
pre-filter `count` at `:53`, so the UI's pagination total is inflated and pages
appear partly empty. Tenant isolation is unaffected: both branches stay inside
`orgWhere(session)`.

Fix: build the `lines.some` object once and merge both conditions into it, and
derive `total` from the same filtering the response uses.

#### B6-F4 — LOW: journal entry numbers are generated by a read-then-create race

`project/src/app/api/journal-entries/route.ts:152-174`

```ts
const lastEntry = await prisma.journalEntry.findFirst({
  where: orgWhere(session),
  orderBy: { entryNumber: "desc" },
});                                              // :152-155
let entryNumber = "JE-0001";
if (lastEntry) { ... entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`; }
const journalEntry = await prisma.$transaction(async (tx) => { ... });   // :163
```

Correctly tenant-scoped, but the read happens *before* the transaction opens,
so two users in the same organization posting simultaneously both compute the
same `entryNumber` and both succeed — the ledger ends up with two distinct
entries sharing one number, which breaks reconciliation and audit trails in a
double-entry system. Separately, `orderBy: { entryNumber: "desc" }` is a string
sort: once the org reaches `JE-10000`, `"JE-9999"` still sorts highest and
numbering silently resets and collides from then on.

Fix: move the `findFirst` inside the `$transaction`, add a unique constraint on
`(organizationId, entryNumber)` so a collision fails loudly instead of
corrupting the ledger, and either zero-pad wider or store a numeric sequence
column to sort on.

#### B6-F5 — LOW: the entire accounting surface is gated on session only, never on a permission

`project/src/app/api/chart-of-accounts/route.ts:10`, `:74`, `:126`,
`project/src/app/api/chart-of-accounts/[id]/route.ts:12`, `:53`, `:111`,
`project/src/app/api/journal-entries/route.ts:10`, `:91`, `:213`,
`project/src/app/api/account-books/route.ts:10`,
`project/src/app/api/fixed-charges/route.ts:10`, `:45`, `:67`, `:116`,
`project/src/app/api/offices/route.ts:9`, `:25`, `api/agencies/route.ts:9`, `:25`,
`api/zones/route.ts:10`, `:187`, `:284`

Every handler in this batch calls `requireApiSession` and stops there. The
customers and vendors endpoints reviewed in batch 5 demonstrate the intended
convention (`requirePermission(req, "view_customers")` etc.), and
`requirePermission` supports names such as `manage_billing` and `view_revenue`
that the batch 1 accounts routes were also missing. As written, the newest and
least-privileged member of an organization can read the full general ledger,
create and post journal entries, rewrite the chart of accounts, change the fixed
charge table that drives pricing, and delete every zone row for a service
(`api/zones` DELETE at `:301`, which wipes rate-zone mapping for the whole org).

This is intra-tenant privilege escalation, not cross-tenant, hence LOW — but it
is the widest instance of the "the only authorization is the UI hiding the
button" pattern found so far, and it covers the financially sensitive endpoints.

Fix: apply `requirePermission` with the appropriate view/manage permission on
each of these handlers, matching the customers/vendors pattern.

**batch 6/9 written**

### Batch 7 — shipment lifecycle, rates, and reference data

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped | verdict |
|---|---|---|---|---|---|
| `api/shipments` (`route.tsx`) | GET | `requireApiSession` | none | yes — `orgWhere(session)` is the base of `where` (`:50`); the derived `baseWhereNoStatus` (`:151`) keeps it, so all six counts and the aggregate stay scoped | OK; no `view_shipments` check unlike `api/shipments/[id]` (B7-F4) |
| `api/add-shipment` | POST | `requirePermission` | `create_shipment` | mostly — `orgWhere` on the duplicate checks (`:151`, `:163`) and party lookups (`:446`, `:455`), `orgData` on the shipment (`:334`) and both balance payments (`:707`, `:788`), `session.organizationId` passed to every ledger helper; **but** `generateInvoiceNumber(prisma)` (`:330`) is unscoped | HIGH — see B7-F1 |
| `api/update-shipment` (`route.tsx`) | PUT, PATCH | `requirePermission` | `edit_shipment` | yes — the shipment is resolved with `orgWhere(session, { id })` (`:305`) and everything after works from that row or its `invoices` relation; the journal `updateMany` (`:485`) uses ids from an `orgWhere`-scoped `findMany` (`:476`) | OK (TOCTOU/LOW); dead unscoped helpers B7-F5 |
| `api/bulk-upload-shipments` | POST | `requireApiSession` | **none** | mostly — `orgWhere` on lookups (`:257`, `:261`, `:265`, `:306`) and `orgData` on every create; **but** the customer-id scan (`:322-325`) and `generateInvoiceNumber` (`:424`) are unscoped | MEDIUM — see B7-F2 and B7-F3 |
| `api/rates` (`route.tsx`) | POST, GET, DELETE | `requireApiSession` | none | yes — `deleteMany` scoped (`:182`, `:345`, `:353`), `createMany` stamps `organizationId` per row (`:191`), `upsert` keys on the org composite (`:200`), GET `where` built from `orgWhere` (`:270`) | OK |
| `api/rates/calc` | POST | `requireApiSession` | none | yes — `orgWhere` on zones (`:73`), rates (`:140`) and fixed charge (`:244`) | OK |
| `api/rate-calc` | POST | `requireApiSession` | none | yes — `orgWhere` on fixed charge (`:58`), zones (`:64`), vendor services (`:89`) and rates (`:102`) | OK |
| `api/rate-vendor` | GET | `requireApiSession` | none | yes — `orgWhere(session)` (`:13`) | OK |
| `api/remote-areas` | POST, GET, DELETE | `requireApiSession` | none | yes — `deleteMany` scoped (`:619`, `:706` via `:701`), `createMany` stamps `organizationId` per chunked row (`:631`), GET `where` from `orgWhere` (`:664`) | OK |
| `api/settings/vendorService` | GET, POST, DELETE | `requireApiSession` | none | yes — `orgWhere` (`:13`, `:44`, `:82`) and both cascade `deleteMany` calls (`:94`, `:100`); `orgData` on create (`:55`) | OK (TOCTOU/LOW on the final delete at `:112`) |
| `api/search/recipients` | GET | `requireApiSession` | none | yes — `orgWhere(session, {...})` (`:21`) | OK |
| `api/filenames` | POST, GET | `requireApiSession` | none | yes — `deleteMany` scoped (`:24`), `orgData` create (`:32`), both reads scoped (`:70`, `:94`) | OK |

The rate engine and reference-data endpoints are clean, including the bulk
`deleteMany` in `api/rates` and `api/remote-areas`. The two shipment-creation
paths share a genuinely cross-tenant defect in invoice numbering.

#### B7-F1 — HIGH: invoice numbers are allocated from a platform-wide sequence

`project/src/lib/utils.ts:21-36` (`generateInvoiceNumber`), called at
`project/src/app/api/add-shipment/route.ts:330` and
`project/src/app/api/bulk-upload-shipments/route.ts:424`

```ts
export async function generateInvoiceNumber(prisma: any): Promise<string> {
  const recentShipments = await prisma.shipment.findMany({
    where: { invoiceNumber: { not: null } },   // no organizationId
    orderBy: { id: "desc" },
    take: 500,
    select: { invoiceNumber: true },
  });
  ...
  nextNumber = highestNumber + 5;
```

The function has no organization parameter and no filter. Every tenant's invoice
numbers are drawn from one global counter seeded by the 500 most recent
shipments *on the platform*. Three consequences, in increasing severity:

1. **Cross-tenant volume disclosure.** Consecutive invoices in one tenant's books
   jump by more than 5 exactly when other tenants create shipments in between.
   The gap size is a direct measurement of competitors' shipping volume,
   readable from the tenant's own invoice list.
2. **Duplicate invoice numbers inside a tenant.** The window is the 500 newest
   shipments *by id* across all tenants. On a busy platform, a smaller tenant's
   own shipments fall out of that window entirely, so the computed maximum comes
   from other tenants and can be *below* that tenant's existing numbers. The
   next invoice then reuses a number already on the tenant's books.
3. **Wrong-record writes downstream.** `generateVendorInvoiceNumber` derives the
   vendor invoice as `customer + 2` (`utils.ts:65-72`), and several
   reconciliation helpers locate rows by invoice number rather than by id —
   `syncShipmentInvoiceDebitTransactionDescriptions` matches on
   `{ reference: inv.invoiceNumber }` / `{ invoice: inv.invoiceNumber }`
   (`utils.ts:231-240`, `:261-268`), and `updateJournalEntryForTransaction`
   in `update-shipment/route.tsx:27-63` falls back to
   `description: { contains: invoice }`. Those helpers are scoped by
   `customerId`/`vendorId` or by `orgFilter`, so today the blast radius stays
   inside the tenant — but the moment a number is reused, the "find the
   transaction for invoice X" logic updates the wrong financial row.

There is also a plain race: two concurrent creates read the same 500 rows and
allocate the same number, since there is no transaction and no unique constraint.

Fix: give `generateInvoiceNumber` an `organizationId` parameter, filter the scan
on it, allocate inside a transaction (or from a per-organization counter row),
and add a unique constraint on `(organizationId, invoiceNumber)` on both
`Shipment` and `Invoice` so a collision fails loudly instead of silently
corrupting the ledger. `nextJournalEntryNumber` in
`lib/tenant/orgJournalChart.ts` is the in-repo model for this.

#### B7-F2 — MEDIUM: `bulk-upload-shipments` bypasses the `create_shipment` permission

`project/src/app/api/bulk-upload-shipments/route.ts:19`

```ts
const auth = await requireApiSession(req);   // :19 — session only
```

`api/add-shipment` requires `create_shipment` (`add-shipment/route.ts:21`) and
`api/update-shipment` requires `edit_shipment` (`update-shipment/route.tsx:236`).
The bulk path requires neither. Any authenticated member can upload a
spreadsheet and create an unlimited number of shipments — and, as a side effect
of the find-or-create logic, new customer (`:328`), recipient (`:382`) and vendor
(`:405`) records, plus invoices, ledger transactions and journal entries — all
without holding the permission the single-shipment route enforces. The plan/quota
gate at `:222-253` still applies, so this is a permission bypass rather than a
billing bypass. Tenant isolation is intact.

Fix: change `:19` to `requirePermission(req, "create_shipment")`.

#### B7-F3 — MEDIUM: `bulk-upload-shipments` allocates customer ids from a global scan

`project/src/app/api/bulk-upload-shipments/route.ts:322-325`

```ts
const maxCustomer = await prisma.customers.findFirst({
  orderBy: { id: 'desc' },        // no where clause
});
const nextCustomerId = maxCustomer ? maxCustomer.id + 1 : 1000;
```

The same defect as B5-F2 in `add-customers`, and worse in two ways: it steps by
1 where `add-customers` steps by 5, so a bulk upload walks straight into ids that
`add-customers` will later try to claim; and it runs once per row, so a single
50-row spreadsheet performs 50 platform-wide scans and 50 racy allocations. The
code already anticipates the failure — the `P2002` handler at `:349-367` retries
with autoincrement — which is the correct behaviour and should simply be the
only behaviour. The residual leak is the same as B5-F2: the id assigned to a
newly created customer reveals the platform-wide high-water mark.

Fix: delete the manual id block and always take the autoincrement path already
present at `:350-367`.

#### B7-F4 — LOW: `api/shipments` list is session-only while `api/shipments/[id]` requires `view_shipments`

`project/src/app/api/shipments/route.tsx:8` versus
`project/src/app/api/shipments/[id]/route.ts` (which uses
`requirePermission(req, "view_shipments")`)

Reading a single shipment requires the permission; listing every shipment in the
organization — with sender and recipient names, addresses, destinations, costs
and a `totalValue` aggregate (`:176-186`) — requires only a session. A member
denied `view_shipments` sees the whole book by calling the collection endpoint
with `limit=all` (`:15-16`). Intra-tenant only.

Fix: add `requirePermission(req, "view_shipments")` at `:8`.

#### B7-F5 — LOW: two unscoped balance helpers sit unused in `update-shipment`

`project/src/app/api/update-shipment/route.tsx:159-190` (`updateCustomerBalance`),
`:193-224` (`updateVendorBalance`)

```ts
const customer = await tx.customers.findUnique({ where: { id: customerId } });  // :162-164
await tx.customers.update({ where: { id: customerId }, data: { currentBalance: newBalance } });  // :176-181
```

Neither function takes or applies an `organizationId`, and neither is called
anywhere in the file — the live path uses `updateInvoiceBalance` from
`lib/utils.ts` instead (`:581`). As dead code they are harmless today; as a
template they are a cross-tenant balance write waiting to be wired up, since a
`customerId` sourced from a request body would hit any tenant's row. Both also
swallow their errors (`:187-189`, `:221-223`), matching the silent-catch pattern
flagged elsewhere.

Fix: delete both functions.

**batch 7/9 written**

### Batch 8 — public entry points, auth, profile, and file storage

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped | verdict |
|---|---|---|---|---|---|
| `api/login` | POST | none (this is the login) | n/a | n/a — reads `user` by email (`:27`), writes `lastLoginAt` on the authenticated user (`:67`) | PUBLIC-BY-DESIGN — protected by bcrypt compare (`:58`), `isApproved` (`:36`), status (`:48`) and org-suspension (`:83`) checks; org id comes from `resolveMembership` (`:72`), never from the request |
| `api/signup` | POST | none | n/a | n/a — creates a user and, via `createOrganizationForSignup`, its org (`:71`) | PUBLIC-BY-DESIGN, but see B8-F6 |
| `api/verify-email` | POST | none (holds the emailed code) | n/a | n/a — acts only on the `userId` in the body, gated by the code in `status` (`:41`) | PUBLIC-BY-DESIGN; brute-forceable, see B8-F8 |
| `api/track` | GET | **none** | none | **no** — `shipment.findFirst` searches every organization (`:39-46`), then an unauthenticated `shipment.update` writes back (`:88-94`) | **CRITICAL** — see B8-F1 |
| `api/contact` | POST | none | n/a | none — no Prisma access; sends to the fixed `CONTACT_RECIPIENT` (`:4`, `:48`) with all fields HTML-escaped (`:24-31`) | PUBLIC-BY-DESIGN; protected by the hard-coded recipient. No rate limit or captcha |
| `api/public-tools` | GET, POST | GET none; POST a hard-coded email in the JWT | none | n/a — global `AppSetting` row, not tenant data (`:31`, `:53`) | PUBLIC-BY-DESIGN for GET; see B8-F7 for POST |
| `api/auth/google` | GET | none | n/a | none — builds the Google consent URL (`:6-19`) | PUBLIC-BY-DESIGN; no `state` parameter, see B8-F5 |
| `api/auth/google/callback` | GET | the OAuth code | n/a | n/a — user matched by the Google-verified email (`:78`), org from `resolveMembership` (`:118`) | PUBLIC-BY-DESIGN; suspension and approval checked (`:105`, `:145`). Cookie flags are the problem — B8-F4 |
| `api/profile/me` | GET, PUT | `requireApiSession` | none (self-service) | yes by identity — both queries key on `session.userId` (`:12`, `:61`) and the membership lookup pins `session.organizationId` (`:32-33`, `:82-83`); the PUT allow-list is `name`/`phone`/`address` only (`:63-65`), so no role or status self-escalation | OK — the correct pattern for a `prisma.user.*` write from a tenant route |
| `api/profile/change-password` | POST | `requireApiSession` **and** a Bearer token | none | no — every read and write targets `parseInt(decoded.id)` from the Bearer token (`:47`, `:80`, `:150`), not `session.userId` | **HIGH** — see B8-F3 |
| `api/download-file` | GET | `requireApiSession` | none | yes — `orgWhere` on the filename record (`:24`) and the zone export (`:38`) | OK; unsanitised `filename` interpolated into `Content-Disposition` (`:60`) |
| `api/upload` | POST, DELETE | `requireApiSession` | none | n/a — no Prisma; proxies to cPanel storage | **HIGH** on DELETE — see B8-F2 |

This batch contains the worst finding of the audit so far. `api/track` is
correctly listed as public, but what it returns is not.

#### B8-F1 — CRITICAL: `/api/track` publishes every tenant's full shipment record, including cost and profit, to anonymous callers

`project/src/app/api/track/route.ts:39-46`, `:88-94`, `:100-122`, `:124-129`

The handler takes a `bookingId` from the query string, searches **all
organizations** for a matching `invoiceNumber` or `trackingId`, and returns the
entire row:

```ts
const shipment = await prisma.shipment.findFirst({
  where: { OR: [{ invoiceNumber: { equals: bookingId } },
                { trackingId:    { equals: bookingId } }] }
});          // :39-46 — no select, no organization filter
...
return NextResponse.json({ success: true, shipment: finalShipment, recipient, organization: ... });  // :124-129
```

`finalShipment` is the unfiltered Prisma model. Based on the fields written at
`add-shipment/route.ts:334-381`, that payload includes `price` (cost before
profit), `cos` (cost of service), `profitPercentage`, `subtotal`, `totalCost`,
`fixedCharge`, `discount`, `vendor` (which carrier the tenant actually uses),
`senderName`, `senderAddress`, `recipientAddress`, `packageDescription`,
`declaredValue` and the raw `calculatedValues` JSON. The `recipient` object at
`:127` is likewise a whole `recipients` row — `Email`, `Phone`, `Address`,
`PersonName`.

A public tracking page needs a status, a date and a location. This returns the
tenant's margin structure and their customer's contact details.

**The exploit.** The lookup accepts `invoiceNumber`, and by B7-F1 invoice
numbers come from one platform-wide counter that starts at 600000 and steps by
5. So:

```
GET /api/track?bookingId=600000
GET /api/track?bookingId=600005
GET /api/track?bookingId=600010   ...
```

No authentication, no rate limit, no tenant boundary. Walking that sequence
enumerates every shipment ever created on the platform and, for each one, yields
the operating tenant's buy price, sell price and profit percentage, the carrier
they use, and the sender's and recipient's names and addresses. A competitor who
is also a tenant can reconstruct a rival's entire pricing model and customer
list in a single scripted pass. This is the exact cross-customer financial
exposure this audit slice was written to find, and it needs no credentials at
all.

Two aggravating details. First, `:88-94` performs a `shipment.update` on an
unauthenticated `GET` — any anonymous request can write `trackingStatusHistory`
and `trackingStatus` on any shipment whose history is empty, with a fabricated
"Booked / Picked Up in Lahore" pair. Second, the org-suspension check at `:66-71`
runs *after* the shipment has already been read, and the response at `:128`
discloses the internal `organizationId`.

Fix, in priority order:
1. Add an explicit `select` that returns only what a tracking page renders:
   `trackingId`, `deliveryStatus`, `trackingStatus`, `trackingStatusHistory`,
   `shipmentDate`, `destination`, and at most a masked recipient name. Never
   return the model wholesale, and never return `recipient` in full.
2. Stop accepting `invoiceNumber` as a tracking key — it is a sequential
   internal document number. Match on `trackingId` only, and make tracking ids
   high-entropy.
3. Move the history back-fill out of the `GET`; a public read must not write.
4. Rate-limit the endpoint per IP.

#### B8-F2 — HIGH: any authenticated user can delete any tenant's uploaded files

`project/src/app/api/upload/route.ts:75-103`

```ts
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);   // :76 — any session, any org
  ...
  const { url } = await req.json();            // :80 — caller-supplied
  cpanelFormData.append("action", "delete");
  cpanelFormData.append("url", url);
  cpanelFormData.append("secret_key", secretKey);   // :96-98 — server's key
  const response = await fetch(storageUrl, { method: "POST", body: cpanelFormData });
```

There is no check that the URL belongs to the caller's organization, no lookup
of a corresponding database row, and no path validation. The server signs the
delete with its own `CPANEL_UPLOAD_SECRET_KEY`, so the caller inherits full
delete authority over the entire shared storage bucket. The bucket holds
customer identity documents (`add-customers/route.ts:60`, category
`customer-documents`), payment receipts (`:35`, category `receipts`) and
organization logos.

**The exploit.** Receipt and document URLs are handed out in ordinary API
responses — `add-customers` returns `customer.FilePath`, and payment-proof
records carry `receiptUrl` (visible to platform admins and echoed in signup
flows). Any tenant who has ever seen or guessed another tenant's file URL can
issue one `DELETE /api/upload` and destroy it. Even without knowing URLs, the
predictable `receipts/` and `customer-documents/` prefixes make enumeration
plausible depending on how the cPanel endpoint names files. The result is
irreversible cross-tenant data destruction — including the KYC documents and
payment evidence a tenant may be legally required to retain.

Fix: persist every upload with its `organizationId` and public URL, and on
delete look the URL up with `orgWhere(session, { url })`, rejecting anything the
caller's organization does not own. Do not pass a caller-controlled URL straight
through to a secret-key-signed storage call.

#### B8-F3 — HIGH: `change-password` acts on the Bearer token's user and clears account suspension

`project/src/app/api/profile/change-password/route.ts:20-22`, `:33-48`, `:80-83`, `:93-96`, `:136-139`, `:150-156`

Two defects in one handler.

**Wrong identity.** The route establishes a session (`:20`) and then ignores it.
The user whose password is verified, whose `status` is overwritten, and whose
password is finally replaced is `parseInt(decoded.id)` from the
`Authorization: Bearer` header (`:47`, `:80-83`, `:150-156`). Nothing compares
`decoded.id` to `session.userId`. This is the same pattern as B4-F6 and B5-F1,
now on the credential-change endpoint. `decodeToken` here is a fourth local copy
of the helper and verifies against `process.env.JWT_SECRET || "your-secret-key"`
(`:10`), so under a misconfigured deploy the token — and therefore the target
identity — is forgeable outright.

**Suspension bypass.** The handler writes `status: "ACTIVE"` unconditionally at
three points: on email failure (`:93-96`), on code expiry (`:136-139`), and on
success (`:150-156`). It never checks what the status was before. `api/login`
admits any user whose status is `ACTIVE` (`login/route.ts:47-56`), and an
already-issued JWT stays valid for a week regardless of status. So a user an
administrator has just suspended, holding a still-valid token and knowing their
own current password, calls this endpoint twice — `send-2fa` then
`change-password` — and their account is `ACTIVE` again with a password of their
choosing. Suspension is undone by the suspended user. The same unconditional
reset appears in the 2FA handlers flagged as B3-F3 and B4-F6; here it is
directly reachable by the affected account.

Fix: load the user with `session.userId` and drop the Bearer branch entirely;
capture the pre-existing status before writing the temporary `PENDING_2FA_`
value and restore *that* value rather than hard-coding `"ACTIVE"`; and refuse
the operation outright when the account is suspended. Longer term, move 2FA
codes out of the `status` column into their own table with a hashed code and an
expiry, and generate them with `crypto.randomInt` rather than `Math.random()`
(`:76`).

#### B8-F4 — MEDIUM: the session cookie is readable by JavaScript and has no SameSite

`project/src/app/api/auth/google/callback/route.ts:174-179`

```ts
response.cookies.set("token", token, {
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  httpOnly: false,          // :177 — "Must be false so client-side logout can clear it"
  secure: process.env.NODE_ENV === "production",
});
```

The session JWT — carrying `organizationId`, `orgRole` and `platformRole`, the
claims `requirePermission` trusts — is placed in a cookie any script on the
origin can read, for a week. The stated reason is client-side logout, which is
solved by a `POST /api/logout` that clears the cookie server-side.

This is the enabling condition for the "attacker holds another user's token"
scenarios in B4-F6, B5-F1 and B8-F3: with `httpOnly: false`, a single XSS
anywhere in the dashboard hands over a full session rather than being contained.
`sameSite` is also unset, which leaves the cookie attached to cross-site
top-level requests and makes the state-changing `GET` endpoints noted earlier in
this report (`accounts/transactions/*?recalc=true`, `customers/reactivate`)
reachable by CSRF.

Fix: `httpOnly: true`, `sameSite: "lax"`, and a server-side logout route.

#### B8-F5 — MEDIUM: Google OAuth has no `state` parameter

`project/src/app/api/auth/google/route.ts:6-19`,
`project/src/app/api/auth/google/callback/route.ts:6-12`

The consent URL is built from `redirect_uri`, `client_id`, `access_type`,
`response_type`, `prompt` and `scope` — no `state`, and the callback accepts any
`code` without correlating it to a value it issued. This is login CSRF: an
attacker completes the Google consent step themselves, captures the `code`, and
causes a victim's browser to load
`/api/auth/google/callback?code=<attacker code>`. The victim's browser is then
issued a session cookie for the *attacker's* account. If the victim proceeds to
enter data — creating customers, uploading documents, submitting payment
details — it lands in the attacker's organization.

The `google_signup_data` cookie read at `:62-75` compounds this: it is parsed
from an unauthenticated, client-set cookie and its `companyName` is used to
create an organization (`:121-123`).

Fix: generate a random `state`, store it in a short-lived `httpOnly` cookie,
include it in the consent URL, and reject any callback whose `state` does not
match. While there, check `profile.verified_email` before trusting
`profile.email` at `:55`.

#### B8-F6 — MEDIUM: `signup` lets an anonymous caller overwrite an invited user's password

`project/src/app/api/signup/route.ts:20-29`, `:38-49`

```ts
if (existingUser && !existingUser.status.startsWith("INVITED")) {
  return ... "User with this email already exists" ...      // :24-29
}
...
if (existingUser && existingUser.status.startsWith("INVITED")) {
  user = await prisma.user.update({
    where: { id: existingUser.id },
    data: { name: resolvedName, password: hashedPassword, status: verificationStatus, ... },
  });                                                        // :40-49
}
```

Any unauthenticated caller who knows or guesses the email address of a
pre-created `INVITED` member — and `GET /api/email/users` (B4-F3) hands out the
complete platform directory including status — can POST to `/api/signup` with
that address and a password of their choosing. The invited user's row is
rewritten in place: new name, new password hash, new status. The row keeps its
existing `organizationMember` link, so the attacker is writing credentials onto
an account that is already attached to somebody else's organization.

Completing the takeover still requires the 6-digit code, which is mailed to the
legitimate address, so this is not immediate account access. What it does
achieve without any credential is: the invitation is destroyed (the intended
member can no longer sign up normally, and their status no longer reads
`INVITED`), and a password the attacker controls now sits on an
organization-linked account waiting for any other path that activates it —
`api/reset-password` (B4-F1) or the status writes in B8-F3 among them.

Fix: invitations should carry a single-use, high-entropy token that the signup
request must present. Match on the token, not on the email address alone.

#### B8-F7 — LOW: `public-tools` authorises by a hard-coded personal email and the fallback JWT secret

`project/src/app/api/public-tools/route.ts:7-8`, `:10-21`, `:42-47`

```ts
const ADMIN_EMAIL = "mohidfaisal321@gmail.com";                    // :7
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";    // :8
...
const decoded = jwt.verify(token, JWT_SECRET) as { email?: string };
return email === ADMIN_EMAIL.toLowerCase();                        // :15-17
```

The platform has a real authorisation model — `platformRole === "SUPER_ADMIN"`
via `requireSuperAdmin`, used correctly by every `api/saas/*` route. This
endpoint ignores it in favour of one hard-coded Gmail address. Consequences: the
flag cannot be managed if that person leaves; anyone who can obtain a token for
that address controls it; and with `JWT_SECRET` unset, anyone can mint
`{ email: "mohidfaisal321@gmail.com" }` themselves and flip the flag. The blast
radius is limited — the setting only enables or disables the public tools page —
which is why this is LOW rather than higher.

Fix: replace `assertAdminCanChangeFlag` with `requireSuperAdmin`, and remove the
`"your-secret-key"` fallback here and in the three other copies of
`decodeToken`.

#### B8-F8 — LOW: email verification codes are brute-forceable and not randomly generated

`project/src/app/api/signup/route.ts:31`, `project/src/app/api/verify-email/route.ts:11-18`, `:41-46`

`verify-email` accepts a `userId` and a `verificationCode` from the body, looks
the user up by id, and compares the code (`:41`). There is no attempt counter,
no lockout, no delay, and the code is six digits — the whole space is one
million requests, and user ids are small sequential integers. The code itself
comes from `Math.floor(100000 + Math.random() * 900000)` (`signup:31`), a
non-cryptographic PRNG, the same generator used for the 2FA codes in B3-F3,
B4-F6 and B8-F3.

Impact is bounded: a successful guess moves the account from
`PENDING_VERIFICATION_` to `PENDING_APPROVAL` or `PENDING_PLAN_SELECTION`, both
of which still block login. So this is a step in a chain rather than a
standalone break — but it is the step that would let an attacker who has already
overwritten an invited account's password (B8-F6) push it forward without
access to the mailbox.

Fix: generate codes with `crypto.randomInt`, count failed attempts on the user
row and invalidate the code after five, and rate-limit the endpoint per IP.

**batch 8/9 written**

### Batch 9 — billing, plans, cron, and the last unauthenticated routes

| path | methods | auth guard | permission check | all Prisma calls tenant-scoped | verdict |
|---|---|---|---|---|---|
| `api/billing/checkout` | POST | `requireApiSession` | `OWNER`/`ADMIN` via `MANAGE_ROLES` (`:18`) | yes — org read (`:54`) and subscription write (`:71-74`) both key on `session.organizationId`; the Stripe metadata is stamped from the session, never the body (`:84-88`) | OK — the cleanest authorisation in the codebase |
| `api/billing/manual-payment/submit` | POST | `requireApiSession` | `OWNER`/`ADMIN` (`:17`) | mostly — the proof is created with `session.organizationId` (`:68`); the duplicate check at `:43-45` is platform-wide | MEDIUM — see B9-F4 |
| `api/billing/webhook` | POST | Stripe signature | n/a | n/a — org resolved from Stripe-signed metadata or by `stripeSubscriptionId`/`stripeCustomerId` lookup (`:11-35`) | PUBLIC-BY-DESIGN — protected by `stripe.webhooks.constructEvent` against the raw body (`:92-93`), which rejects unsigned or replayed payloads; correctly refuses to run when the secret is absent (`:78-83`) |
| `api/plans` | GET, POST | GET none; POST `requireSuperAdmin` (`:86`) | SUPER_ADMIN on POST | n/a — platform-level table | PUBLIC-BY-DESIGN for GET (signup needs it), but it leaks subscriber counts — B9-F5 |
| `api/plans/[id]` | GET, PUT, DELETE | GET **none**; PUT `requireSuperAdmin` (`:46`) | SUPER_ADMIN on writes | n/a — platform-level table | same as above; GET is unauthenticated and includes `_count.subscriptions` (`:24-26`) |
| `api/cron/check-inactive-customers` | GET | `CRON_SECRET` **only if the env var is set** (`:13`) | none | **no** — `customers.findMany` (`:32-62`) and `customers.updateMany` (`:99-108`) span every organization | HIGH — see B9-F2 |
| `api/cron/reset-demo` | GET | **none at all** (`:9-11`) | none | n/a — `resetDemoUserEntries` scopes every delete to the demo org (`demoAccount.ts:129-155`) | HIGH — see B9-F2 |
| `api/cron/subscription-reminders` | GET | `CRON_SECRET` only if set (`:30-41`) | none | by design platform-wide (it emails every expiring org) | HIGH when `CRON_SECRET` is unset — see B9-F2 |
| `api/customers/check-inactive` | POST, GET | **none** | none | **no** — unscoped `findMany` (`:15-45`, `:137-167`) and unscoped `updateMany` (`:81-90`) | **CRITICAL** — see B9-F1 |
| `api/settings/[type]` | GET, POST, PUT, DELETE | `requireApiSession` | none | yes — `orgWhere` on the list (`:30`) and on every pre-write lookup (`:77`, `:113`); `orgData` on create (`:48`); the `serviceMode` cascade pins `organizationId: orgId` on all five `deleteMany` calls (`:126`, `:132`, `:141`, `:147`, `:153`) | OK — and note `:47` and `:70` strip `organizationId` out of the request body before it reaches Prisma, the correct anti-tenant-forgery pattern |
| `api/assets/logo-footer` | GET | `requireApiSession` called but **its error is discarded** (`:14-15`) | none | yes — org read keys on `auth.session.organizationId` (`:17`) | MEDIUM — see B9-F3 |

#### B9-F1 — CRITICAL: `POST /api/customers/check-inactive` deactivates every tenant's customers, unauthenticated

`project/src/app/api/customers/check-inactive/route.ts:4`, `:15-22`, `:81-90`, `:106-111`, `:128`, `:202-207`

```ts
export async function POST() {          // :4 — no request parameter, so no auth is even possible
  const activeCustomers = await prisma.customers.findMany({
    where: { ActiveStatus: "Active", createdAt: { lt: oneYearAgo } },   // :16-22 — no organizationId
    select: { id: true, CompanyName: true, PersonName: true, Email: true, ... },
  });
  ...
  const updateResult = await prisma.customers.updateMany({
    where: { id: { in: customerIds } },                                  // :82-86 — no organizationId
    data: { ActiveStatus: "Inactive" },
  });
```

The handler signature takes no `Request`, so there is no session, no cron
secret, and no header to check — it is reachable by anyone who can send a POST.
It then reads every `Active` customer on the platform older than one year,
decides which look dormant, and flips them to `Inactive` in a single
cross-tenant `updateMany`.

**The exploit.** One anonymous request:

```
POST /api/customers/check-inactive
```

Two effects, both cross-tenant. First, mass mutation: every organization's
long-standing customers that lack a recent shipment are deactivated at once.
`api/customers` filters on `ActiveStatus` (`customers/route.ts:28`) and the
dashboard counts active versus inactive (`dashboard/route.ts:111-118`), so
tenants see their customer base silently collapse, with no audit trail and no
way to know which rows were changed by an outsider versus by staff. Second,
disclosure: the response at `:106-111` returns `companyName`, `personName` and
`email` for every affected customer across every organization — a ready-made
cross-tenant customer list with contact details.

The `GET` at `:128` is the same query without the write, so it hands over the
identical PII dump on a plain browser request, no body required. And because it
is a `GET`, it is reachable by CSRF, by a crawler, or by anything that
prefetches links.

This is the same defect as `api/customers/reactivate` (B3-F1) — the two routes
appear to be a matched pair, one deactivating and one reactivating, both
unauthenticated and both unscoped. A properly authenticated version of this
logic already exists as the cron route below.

Fix: delete this route. The `cron/check-inactive-customers` endpoint performs
the same work and at least attempts an authorisation check. If a manual trigger
is genuinely needed, gate it behind `requirePermission(req, "manage_customers")`
and scope both the `findMany` and the `updateMany` with
`orgWhere(session)`/`session.organizationId`.

#### B9-F2 — HIGH: all three cron routes fail open, and two of them are cross-tenant

`project/src/app/api/cron/check-inactive-customers/route.ts:12-23`, `:32-62`, `:99-108`, `:124-130`
`project/src/app/api/cron/subscription-reminders/route.ts:30-41`
`project/src/app/api/cron/reset-demo/route.ts:9-11`

The check in two of the three is conditional on the secret existing:

```ts
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) {                        // :13 — if unset, no check runs at all
  const requestAuth = request.headers.get("authorization") ?? "";
  ...
}
```

The comment above it records that a previous version compared the env var to
itself and "never actually authenticated the caller", so this is a partial fix
of a known bug — but it still fails open. When `CRON_SECRET` is missing from the
environment (a deployment mistake, a new environment, a local build promoted to
staging), the endpoints revert to fully public. There is no startup assertion
anywhere that the variable is set.

`cron/reset-demo` has no check at all — not even the conditional one. Any
anonymous `GET` runs `resetDemoUserEntries()`, which deletes the demo
organization's journal entries, journal lines, customer and vendor transactions,
payments and invoices outright (`demoAccount.ts:129-146`) plus its non-default
shipments, customers and vendors. Those deletes *are* correctly scoped to the
demo org, so no other tenant's data is destroyed — but any visitor can wipe the
sales-demo workspace at will, including mid-demonstration.

`cron/check-inactive-customers` is the cross-tenant one. With `CRON_SECRET`
unset it becomes B9-F1 with a different verb: an unauthenticated `GET` that runs
`updateMany` across all organizations (`:99-108`) and returns every affected
customer's company name, contact name and email in the response body
(`:124-130`). `cron/subscription-reminders` similarly emails every organization
whose subscription expires in three days; an unauthenticated caller can trigger
that mail-out repeatedly, spamming every customer of the platform from the
platform's own domain and reputation.

Fix: require `CRON_SECRET` unconditionally — treat a missing value as a hard
failure (`503`) rather than an open door — and add the same check to
`reset-demo`. Compare with `crypto.timingSafeEqual`. Separately, remove the
per-customer PII from the cron response bodies; a cron caller needs a count, not
a contact list.

#### B9-F3 — MEDIUM: `assets/logo-footer` discards its auth error and reads files from a database-controlled path

`project/src/app/api/assets/logo-footer/route.ts:14-15`, `:34-38`, `:45`

```ts
const auth = await requireApiSession(req);
if (auth.session) {                       // :14-15 — auth.error is never returned
```

Every other route in the codebase writes `if (auth.error) return auth.error;`.
Here the error is dropped and the handler continues, so the endpoint is
effectively unauthenticated — it simply falls back to the default logo. That
part is low impact on its own.

The path handling is the real issue:

```ts
} else if (org.logoUrl.startsWith('/')) {
  const customPath = path.join(process.cwd(), 'public', org.logoUrl);   // :35
  if (fs.existsSync(customPath)) { logoPath = customPath; }             // :36-38
}
...
const logoBuffer = fs.readFileSync(logoPath);                            // :45
const base64 = logoBuffer.toString('base64');                            // :46
```

`org.logoUrl` comes straight from the database with no validation beyond the
leading slash, and `path.join` resolves `..` segments. An organization whose
`logoUrl` is set to `/../../.env` (or `/../../prisma/schema.prisma`, or any
path readable by the server process) causes that file to be read and, once the
`:49` bug below is fixed, base64-encoded into the JSON response. Whoever can set
an organization's logo — the org's own owner through the settings UI, or a
super-admin — gains arbitrary server-side file read, which in this deployment
means `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY` and
`CPANEL_UPLOAD_SECRET_KEY`. Note that `JWT_SECRET` is exactly the value needed
to forge the sessions described in B3-F5 and B8-F3, and
`CPANEL_UPLOAD_SECRET_KEY` is the key behind B8-F2.

The severity is held at MEDIUM only because setting `logoUrl` requires
privileged access within an organization; the reachable read itself is
unauthenticated.

Fix: return `auth.error` like every other route; resolve the candidate path and
verify with `path.resolve(customPath).startsWith(path.resolve(process.cwd(), 'public'))`
before touching the filesystem; and validate `logoUrl` at write time.

#### B9-F4 — MEDIUM: manual payment proofs trust a self-declared amount and collide across tenants

`project/src/app/api/billing/manual-payment/submit/route.ts:23`, `:37-40`, `:43-51`, `:66-78`

Two separate problems in one handler.

**Self-declared amount.** `amount` is read from the request body (`:23`) and
written to the proof unchanged (`:70`). The plan is looked up (`:32`) and the
currency conversion machinery at `:60-64` computes a PKR equivalent, but nothing
compares the submitted amount to the plan's actual price. An OWNER or ADMIN can
transfer a token sum, submit a proof claiming the full plan price, and rely on
the reviewing admin (`api/saas/payment-proofs/[id]`) accepting the stated figure.
The check exists only in the reviewer's diligence.

**Cross-tenant reference collision.** The duplicate check is platform-wide:

```ts
const existing = await prisma.paymentProof.findFirst({
  where: { referenceId: String(referenceId).trim() },   // :43-45 — no organizationId
});
if (existing) return ... 409 ...
```

Two consequences. It is an oracle: a tenant can probe arbitrary transaction
reference strings and learn from the `409` whether another organization has
already submitted that reference. And it is a denial of service: bank references
are not globally unique, so one organization can pre-register a reference string
— or a range of plausible ones — and block a competitor from submitting a
genuine proof carrying that reference.

Fix: derive the amount server-side from the plan and billing cycle rather than
accepting it from the body (or store the claimed amount separately from the
expected amount and surface the discrepancy to the reviewer), and scope the
duplicate check with `{ organizationId: session.organizationId, referenceId }`.

#### B9-F5 — LOW: the public plan endpoints disclose per-plan subscriber counts

`project/src/app/api/plans/route.ts:12-19`, `:71`;
`project/src/app/api/plans/[id]/route.ts:13`, `:21-28`, `:34`

Both `GET` handlers are unauthenticated — correctly, since the signup page needs
to render plan choices — but both `include: { _count: { select: { subscriptions: true } } }`
and return it in the response. That is the number of paying organizations on
each tier, published to anyone who curls `/api/plans`. Combined with the public
prices in the same payload, it yields a close estimate of the platform's
recurring revenue and its growth rate over time. No tenant data leaks, hence LOW,
but this is business-confidential information exposed by an unauthenticated
endpoint that has no need for it.

Fix: drop the `_count` include from the public `GET` responses and keep it on a
super-admin-only endpoint.

#### B9-F6 — LOW: the default logo is never returned because of a variable mix-up

`project/src/app/api/assets/logo-footer/route.ts:45-49`

```ts
const logoBuffer = fs.readFileSync(logoPath);
const base64 = logoBuffer.toString('base64');       // :46 — result stored in `base64`
const ext = path.extname(logoPath).toLowerCase();
const mime = ...;
logoBase64 = `data:${mime};base64,${logoBase64}`;   // :49 — interpolates `logoBase64`, still ""
```

The fallback branch interpolates the empty `logoBase64` instead of the `base64`
it just computed, so every organization without a remote `logoUrl` receives
`data:image/png;base64,` — a valid data URI containing no image. The footer
immediately below (`:59-61`) does it correctly, which makes the slip easy to
miss. Pure FLOW bug, no security impact, but it silently breaks branding on
every PDF and invoice that consumes this endpoint.

Fix: `logoBase64 = \`data:${mime};base64,${base64}\`;`

**batch 9/9 written**

### Coverage and the unauthenticated-route verdict

All 113 `route.ts` / `route.tsx` files under `project/src/app/api` are now
accounted for: 105 read line by line across batches 1-9, plus the 8 skipped as
already reviewed in the first pass (`org/current`, `org/members`,
`org/members/[id]`, `org/usage`, `users`, `users/[id]`, `users/approve/[id]`,
`settings/custom`). Every row in the batch tables above was written from the
file, not from a grep.

The original brief asked which handlers reference no session, no permission
helper and no `organizationId`, and whether each is public on purpose. Having
read them, the answer is fourteen routes, split as follows.

**Public by design — and adequately protected:**

| route | what protects it instead |
|---|---|
| `api/login` | bcrypt compare, plus `isApproved`, status and org-suspension checks |
| `api/signup` | nothing, by nature; org id is server-derived. See B8-F6 for the invited-user gap |
| `api/verify-email` | the emailed 6-digit code. Brute-forceable — B8-F8 |
| `api/contact` | a hard-coded recipient address and HTML escaping. No rate limit |
| `api/billing/webhook` | Stripe signature verification against the raw body — the only cryptographically sound guard in this group |
| `api/auth/google` | nothing needed; it only builds a redirect. Missing `state` — B8-F5 |
| `api/auth/google/callback` | the OAuth code exchange and Google's email claim |
| `api/plans` GET, `api/plans/[id]` GET | nothing. Acceptable for prices; not for subscriber counts — B9-F5 |
| `api/public-tools` GET | nothing. Returns one boolean flag |
| `api/signup/upload` | nothing. No Prisma access; proxies to storage |

**Public by accident — vulnerable:**

| route | finding |
|---|---|
| `api/track` | B8-F1 — CRITICAL. Returns whole shipment rows, cross-tenant, enumerable |
| `api/customers/check-inactive` | B9-F1 — CRITICAL. Unauthenticated cross-tenant `updateMany` plus a PII dump |
| `api/customers/reactivate` | B3-F1 — CRITICAL. The matching reactivation half of the same pair |
| `api/reset-password` | B4-F1 — CRITICAL. Changes any user's password with no identity proof |
| `api/signup/update-plan` | B4-F2 — CRITICAL. Anonymous writes to any organization's subscription |
| `api/services` | B4-F4 — MEDIUM. Unauthenticated cross-tenant service catalogue |
| `api/user-activity` GET | B4-F7 — LOW. Unauthenticated platform-wide session counter |
| `api/cron/reset-demo` | B9-F2 — HIGH. No guard at all; wipes the demo workspace |

The three `api/cron/*` routes and `api/assets/logo-footer` sit between the two
lists: they each contain an authorisation check that does not work — conditional
on an environment variable in the cron cases (B9-F2), and an ignored return
value in the assets case (B9-F3).

### What the pattern looks like across all nine batches

The tenancy layer itself is sound. `orgWhere`, `orgData` and the `findOrg*`
helpers are correct, and the great majority of handlers use them properly —
roughly 90 of the 105 files read have every Prisma call scoped. The correction
that opened this pass was right: counting the literal string `organizationId`
badly misrepresented the codebase.

The breaches cluster in five recognisable places, none of which is "someone
forgot `orgWhere` on a list query":

1. **Routes that were never wired into the auth system at all.** Five criticals,
   all unauthenticated, all reachable with curl and no credentials. These are
   almost certainly older endpoints that predate the multi-tenant refactor and
   were missed when guards were added everywhere else.
2. **Shared sequences and shared state.** Invoice numbers (B7-F1), customer ids
   (B5-F2, B7-F3), the in-memory email template array (B4-F5) and the
   in-process activity map (B4-F7) all cross tenant lines because they were
   written when there was only one tenant.
3. **Two identities in one handler.** The `requireApiSession` session decides
   which tenant's data is touched while a separate `Authorization: Bearer` token
   decides which user is authenticated and written to (B4-F6, B5-F1, B8-F3).
   Four local copies of `decodeToken`, all with the `"your-secret-key"`
   fallback, keep this pattern alive.
4. **Utility functions that take an id but not an organization.** The helpers in
   `lib/utils.ts` are called with ids derived from already-scoped queries, so
   they are safe today; they are one careless caller away from not being.
5. **Permissions applied unevenly.** `requirePermission` exists and works, but
   the entire accounting surface (B6-F5), the recipients endpoints (B5-F3), the
   shipment list (B7-F4) and the bulk shipment upload (B7-F2) check only that a
   session exists. In the bulk-upload case that is a direct route around a check
   the single-record endpoint enforces.

If the remediation is sequenced, the five unauthenticated criticals and
`DELETE /api/upload` (B8-F2) are the ones exploitable right now by an outsider
with no account; everything else requires at least a valid session.

**audit complete — 9/9 batches**

## Accounting Arithmetic

Scope: numeric correctness and ledger consistency only. Tenant-isolation,
permission and `organizationId` defects were audited separately and are not
repeated here; where an arithmetic defect is downstream of one of those, it is
referenced but not re-reported.

Environment note that changes the weight of several findings below: the
datasource in `project/prisma/schema.prisma:5-9` is **MySQL**, not PostgreSQL,
and it runs with `relationMode = "prisma"`. That means **no foreign keys and no
`ON DELETE CASCADE` exist in the database at all** — every `@relation(...
onDelete: Cascade)` in the schema is emulated by the Prisma client and applies
only when the delete goes through that exact client call. `@@unique` indexes
*are* still created, so `JournalEntry.@@unique([organizationId, entryNumber])`
is real. Also: MySQL has no `SELECT ... FOR UPDATE` usage anywhere in this
codebase (verified in later batches), and no `CHECK` constraints are declared.

### Batch 1 - schema + accounting libs + journal-entries + chart-of-accounts

---

#### [HIGH] STEP 1 - every monetary column in the database is a binary float; there is not one Decimal column in the schema

`project/prisma/schema.prisma` (whole file)

Prisma `Float` maps to MySQL `DOUBLE`. Binary floating point cannot represent
most decimal currency values exactly, so every stored amount, every balance and
every ledger total in this system is an approximation. Complete list of
monetary columns, all of them `Float`:

| Model | Columns (all `Float`) |
| --- | --- |
| `Plan` (:60) | `priceMonthlyUsd` |
| `Shipment` (:110-123) | `fixedCharge`, `decValue`, `price`, `discount`, `fuelSurcharge`, `insurance`, `customs`, `tax`, `declaredValue`, `reissue`, `profitPercentage`, `cos`, `totalCost`, `subtotal` |
| `Customers` (:157-158) | `currentBalance`, `creditLimit` |
| `Vendors` (:180-181) | `currentBalance`, `creditLimit` |
| `CustomerTransaction` (:376-381) | `amount`, `previousBalance`, `newBalance` |
| `VendorTransaction` (:396-400) | `amount`, `previousBalance`, `newBalance` |
| `Payment` (:446) | `amount` |
| `Invoice` (:474-485) | `fscCharges`, `discount`, `totalAmount` |
| `DebitNote` (:502) | `amount` |
| `CreditNote` (:517) | `amount` |
| `JournalEntry` (:551-552) | `totalDebit`, `totalCredit` |
| `JournalEntryLine` (:569-570) | `debitAmount`, `creditAmount` |
| `FixedCharge` (:580) | `fixedCharge` |
| `PaymentProof` (:595) | `amount` |

**Decimal columns: none.** Precision/scale therefore cannot be assessed — there
is nothing to assess.

**Int used for money: one place, and it is inconsistent.** `Rate.price` is
`Int` (`schema.prisma:350`) while every other price in the system is `Float`.
It is *not* minor units — `project/src/app/api/rates/*` and the shipment pricing
path read it as a whole-currency figure and add it directly to `Float` fields
such as `Shipment.price`. So the rate card silently cannot express 12.50, and a
rate of 12.5 seeded through Prisma is truncated to 12. (`Shipment.amount`
(:103) and `totalPackages` (:125) are `Int` but are counts, not money — those
are correct.)

Worked example of the float defect on its own:

```
Invoice.totalAmount = 1234.56           stored as 1234.5599999999999
three payments of 411.52 recorded:
  411.52 + 411.52 + 411.52            = 1234.5600000000002
remaining = 1234.5599999999999 - 1234.5600000000002
          = -2.2737367544323206e-13
```

The invoice is now overpaid by -2.27e-13. Any code doing `remaining <= 0`
happens to work; any code doing `remaining === 0`, `balance > 0`, or
`status = remaining > 0 ? "Partial" : "Paid"` produces a wrong status, and a
customer statement that sums 5,000 such rows drifts into the cents. Because the
same values feed `JournalEntry.totalDebit`/`totalCredit`, a trial balance run
over a year of entries will not foot exactly.

**Representation changes mid-calculation.** Values move between `string` and
`number` repeatedly and inconsistently on the write paths:

- `project/src/app/api/accounts/payments/process/route.ts:57` stores
  `parseFloat(paymentAmount)` but `:99` re-parses the same raw string into
  `paymentAmountNum` — two parses of the same input, and `parseFloat` on a
  non-numeric string yields `NaN` with no guard.
- `project/src/app/api/accounts/payments/vendor-excel/route.ts:116`
  `parseFloat(String(amountRaw ?? "").replace(/,/g, ""))` — strips commas only;
  a European-format cell `1.234,56` becomes `1.23456`, three orders of
  magnitude wrong, and an empty cell becomes `NaN`.
- `project/src/app/api/accounts/invoices/route.ts:377-386` and
  `.../invoices/[id]/route.ts:106-123` and `.../invoices/[id]/edit/route.ts:99-128`
  use `parseFloat(x) || 0`, which converts `NaN` **and** any unparseable input
  silently to `0` — a malformed `totalAmount` posts a zero invoice rather than
  a 400.
- `project/src/app/api/accounts/close-period/route.ts:174,207,237` uses
  `toFixed(2)` on the closing figures, but only inside the description string;
  the amounts actually written to the ledger are the unrounded doubles. The
  description a human reads and the number posted are therefore different
  values.
- `project/src/lib/accounts/createJournalEntryForPaymentProcess.ts:37-38,49,60`
  uses `Number(body.paymentAmount)` with no validation at all.

Fix: migrate every column in the table above to `Decimal @db.Decimal(18, 4)`
(18,4 gives room for FX-rate-derived and unit-price values; use 18,2 only for
posted ledger amounts if you want to force cent granularity at the storage
layer), switch the application to `Prisma.Decimal` / a decimal library, and
change `Rate.price` to the same Decimal type. Replace every `parseFloat(x) || 0`
on a money field with an explicit parse-and-reject: `if (!Number.isFinite(n))
return 400`. Round exactly once, at the point of posting, never in a display
string only.

---

#### [HIGH] Journal entry numbering breaks permanently at the 10,000th entry, and then every journal entry creation in that tenant fails forever

`project/src/lib/tenant/orgJournalChart.ts:9-15`
`project/src/app/api/journal-entries/route.ts:152-161` (same logic, duplicated)

Both sites pick the "last" entry with `orderBy: { entryNumber: "desc" }`.
`entryNumber` is a `String` (`schema.prisma:547`), so MySQL orders it
lexicographically, not numerically.

```
existing rows: JE-0001 ... JE-9998, JE-9999
create #10000 -> last = "JE-9999", n = 9999, next = "JE-10000"   OK, inserted

create #10001 ->
  lexicographic desc over {..., "JE-9999", "JE-10000"}
  "JE-9999" > "JE-10000"  because '9' > '1' at position 3
  last = "JE-9999" again, n = 9999, next = "JE-10000"
  -> collides with the row just inserted
  -> @@unique([organizationId, entryNumber]) rejects the insert
```

From entry 10,001 onward the tenant can never post another journal entry: the
manual route returns a generic 500 ("Failed to create journal entry",
`route.ts:202-207`), and — worse — `createJournalEntryForPaymentProcess` throws
*after* the payment row has already been written by its caller (see the
transaction-coverage table in a later batch), leaving a payment with no ledger
entry. This is a separate defect from the already-reported read-then-create
race; fixing the race with a transaction does not fix this.

Fix: store the sequence numerically. Either add
`JournalEntry.sequence Int` and order by that, or use a per-tenant counter row
updated with an atomic `UPDATE ... SET seq = seq + 1` inside the same
transaction as the insert, and format the display string from the integer.

---

#### [HIGH] POST /api/journal-entries sums line amounts without coercing them to numbers, so string input concatenates and an entry posts with totals that bear no relation to its lines

`project/src/app/api/journal-entries/route.ts:105-119, 176-189`

```js
const totalDebit = lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
```

`+` on a number and a string is string concatenation. HTML forms and JSON
clients routinely send numeric fields as strings, and nothing in this handler
validates the type.

Worked example — a legitimate 3-line entry submitted with string amounts:

```
lines = [ {accountId: 5, debitAmount: "1"},
          {accountId: 6, debitAmount: "2"},
          {accountId: 7, creditAmount: "3"} ]

totalDebit  = 0 + "1"      -> "01"
            = "01" + "2"   -> "012"
totalCredit = 0 + "3"      -> "03"

balance check: Math.abs("012" - "03") = Math.abs(12 - 3) = 9  > 0.01
```

That one is rejected, but for the wrong reason and with a misleading message.
Now the dangerous direction — the check *passes* while the totals are wrong:

```
lines = [ {accountId: 5, debitAmount: "1"},
          {accountId: 6, debitAmount: "2"},
          {accountId: 7, creditAmount: "1"},
          {accountId: 8, creditAmount: "2"} ]

totalDebit  = "012"  -> 12
totalCredit = "012"  -> 12
Math.abs(12 - 12) = 0  <= 0.01   -> ACCEPTED

JournalEntry written with totalDebit = "012", totalCredit = "012"
lines written with debitAmount "1", "2" (real sum 3), credits "1","2" (sum 3)
```

The header now claims 12 debit / 12 credit against 3 / 3 of actual lines. The
entry is internally balanced so no reconciliation that compares
`totalDebit == totalCredit` will ever flag it, but every report that reads
`JournalEntry.totalDebit` (dashboards, trial balance headers) is overstated by
4x while every report that sums `JournalEntryLine` is correct. The two never
agree and there is no way to tell from the data which is right.

Two aggravating factors at the same site:

- `line.debitAmount || 0` treats `0`, `""`, `null` and `NaN` identically, so a
  line with `debitAmount: NaN` passes the "must have debit or credit" check at
  `:137` (because `NaN || 0` is `0`... no — `NaN || 0` evaluates to `0`, so it
  is caught) but a line with `debitAmount: "0.5"` passes `:144`'s
  both-sides check by string comparison.
- The totals written at `:170-171` come from the reduce, and the lines written
  at `:182-183` come from the raw request. They are never cross-checked after
  insert.

Fix: coerce and validate each line up front —
`const d = Number(line.debitAmount ?? 0); if (!Number.isFinite(d) || d < 0)
return 400;` — sum the coerced values, and derive the header totals from the
same coerced array that is used to create the lines.

---

#### [MEDIUM] The only balance check in the system has a 1-cent tolerance and is applied at one of many write paths

`project/src/app/api/journal-entries/route.ts:114`

The good news first, stated explicitly because a clean result is a result:
**POST /api/journal-entries does validate that debits equal credits**, it does
reject single-line entries (`:98`), it does reject a line with neither amount
(`:137`) and it does reject a line with both (`:144`). That is the correct set
of checks and it is the only place in the codebase that has them.

The defect is the tolerance:

```js
if (Math.abs(totalDebit - totalCredit) > 0.01) { reject }
```

An entry that is out by exactly 0.01 is accepted. Post 200 such entries — which
is a normal month for a freight operation importing payments — and the trial
balance is out by 2.00 with no single entry looking wrong. The tolerance exists
to paper over the float representation defect above; with `Decimal` columns the
comparison can and should be exact.

Also at this site: negative amounts are accepted. `debitAmount: -500` fails
neither `:137` (it is not `0`) nor `:144` (only one side is `> 0`), and
`-500 / -500` balances. Contra-entries expressed as negative debits break every
report that assumes debit and credit columns are non-negative, and they let a
user reduce an account balance through the debit column where an auditor would
look for a credit.

Fix: require exact equality on Decimal values, and reject any line amount that
is not `>= 0`.

---

#### [MEDIUM] PUT /api/journal-entries?action=post re-posts without re-verifying that the entry still balances, and without any period check

`project/src/app/api/journal-entries/route.ts:220-245`

The handler loads the entry with its lines (`:221-223`), checks only
`isPosted` (`:232`), and then flips `isPosted = true`. It never re-sums the
lines, never compares them to `totalDebit`/`totalCredit`, and never looks at
`entry.date` against a closed period. So an entry created balanced, then
mutated by any other path (or created unbalanced through a path that does not
validate — see the payment routes in later batches), is posted as-is. The
`postedAt` written at `:243` is `new Date()` while the accounting date remains
`entry.date`, with no constraint that the two fall in the same open period.

Fix: inside the same transaction as the `isPosted` update, re-sum the lines,
require exact debit/credit equality and require `totalDebit`/`totalCredit` to
match that sum, and reject if `entry.date` falls in a closed period.

---

#### [MEDIUM] `JournalEntryLine` has no database foreign key, so orphaned lines are creatable directly and survive any delete that does not go through the Prisma client

`project/prisma/schema.prisma:8` (`relationMode = "prisma"`), `:563-574`

`JournalEntryLine.journalEntry` declares `onDelete: Cascade`, and
`JournalEntryLine.account` declares `onDelete: Cascade`, but with
`relationMode = "prisma"` neither is a real MySQL constraint. Consequences,
all reachable today:

1. `prisma.journalEntryLine.create({ data: { journalEntryId: 999999, ... } })`
   succeeds against a `journalEntryId` that does not exist. Nothing in the
   schema prevents it, and `createJournalEntryForPaymentProcess` and the payment
   routes all create lines by raw `journalEntryId` rather than by nested write.
2. `prisma.journalEntry.deleteMany({...})` — as opposed to `delete` — does
   **not** emulate the cascade in the same way for every Prisma version, and a
   `$executeRaw` delete or any DBA/console delete leaves the lines behind
   permanently. Those orphaned lines still carry `debitAmount`/`creditAmount`
   and are still joined by `accountId`, so an account-balance report that sums
   `JournalEntryLine` by `accountId` (which is the natural query) counts them,
   while an entry-level report does not.
3. There is no index on `JournalEntryLine.journalEntryId` or `.accountId`
   either (`:563-574` declares none), which with `relationMode = "prisma"` also
   means every cascade emulation and every ledger-by-account query is a full
   table scan.

Worked example: delete a duplicated 10,000.00 entry with a raw SQL statement
during cleanup. The header is gone, so the journal listing is correct and the
entry count drops by one. The two lines remain. The Accounts Payable balance
computed as `SUM(creditAmount) - SUM(debitAmount)` over
`JournalEntryLine WHERE accountId = AP` is still 10,000.00 too high, and there
is no entry to point at to explain it.

Fix: either drop `relationMode = "prisma"` and let MySQL enforce the foreign
keys with real `ON DELETE CASCADE`, or keep it and add
`@@index([journalEntryId])` plus `@@index([accountId])` and route every line
creation through a nested write under its parent entry so the parent cannot be
absent.

---

#### [MEDIUM] `createJournalEntryForPaymentProcess` trusts the caller for both the amount and both account ids, and derives the entry totals from the input instead of from the lines

`project/src/lib/accounts/createJournalEntryForPaymentProcess.ts:21, 37-38, 44-65`

This helper is the shared journal-writing path for payment processing, and it
is the "balanced by construction" one — it writes one debit line and one credit
line for the same figure, so the entry always balances. That part is correct.
What it does not do:

- `Number(body.paymentAmount)` (`:37,38,49,60`) is never checked. If the caller
  passes `"1,500.00"`, `Number` returns `NaN`; the entry is written with
  `totalDebit: NaN`/`totalCredit: NaN` and lines of `NaN`, or the driver
  rejects it mid-transaction after the caller has already written the payment
  row. `NaN` in a `DOUBLE` column poisons every `SUM()` that touches it — one
  such row turns an entire account balance into `NaN`/`NULL`.
- Negative and zero amounts are accepted, producing a zero-value entry or a
  reversed one.
- `body.debitAccountId` and `body.creditAccountId` are used raw. They are never
  compared, so `debitAccountId === creditAccountId` produces a self-cancelling
  entry that debits and credits the same account — it balances perfectly and
  moves nothing, while the payment it documents did move money.
- `entryNumber` is resolved at `:21`, **outside** the `$transaction` opened at
  `:23` (this is the already-reported read-then-create race; noted here only
  because the fix belongs in this function).

Fix: validate `const amt = Number(body.paymentAmount); if (!Number.isFinite(amt)
|| amt <= 0) throw`, reject `debitAccountId === creditAccountId`, build the two
lines first and compute `totalDebit`/`totalCredit` by summing them, and move the
entry-number allocation inside the transaction.

---

#### [MEDIUM] `resolveCreditPaymentVoucherDate` always returns a date, even when nothing matched, so ledger lines get dated from an unrelated payment

`project/src/lib/accounts/resolveCreditPaymentVoucherDate.ts:136-143`

Strategies 1-7 are progressively weaker but all require some match. Strategy 8
requires nothing:

```js
if (payments.length >= 1) {
  const sorted = [...payments].sort((a, b) =>
    Math.abs(a.amount - ledger.amount) - Math.abs(b.amount - ledger.amount));
  return sorted[0].date;
}
```

If the ledger line matches no payment on invoice, reference or amount, the
closest-by-amount payment for that party wins regardless of how far off it is.

Worked example, vendor with two payments:

```
ledger CREDIT line: amount 4,800.00, invoice null, reference "00000" (weak),
                    createdAt 2025-03-02
payments for this vendor:
  P1  amount   250.00  date 2024-11-15
  P2  amount 12,000.00 date 2025-06-20

strategy 1 skipped (no invoice)
strategies 2,3,7 skipped (reference is weak per isWeakPaymentReference:30)
strategy 5: |250 - 4800| = 4550 > 0.02, |12000 - 4800| = 7200 > 0.02 -> no match
strategy 8: |250-4800|=4550 < |12000-4800|=7200 -> returns P1.date = 2024-11-15
```

A March 2025 ledger line is stamped with a November 2024 voucher date — a
different fiscal year. `computeVendorLedgerVoucherDate`
(`project/src/lib/accounts/vendorLedgerVoucherDate.ts:40-51`) applies this
unconditionally for every non-debit-note CREDIT, and its own comment says it
deliberately never leaves the line on `createdAt`. Aged-payables buckets and any
period report keyed on voucher date are wrong for that line, and the prior
closed period's totals change retroactively when the ledger is recomputed.

Fix: return `undefined` from strategy 8 (fall back to `createdAt`, which is at
least the true recording date) or gate it on a bounded amount/date window, and
surface unmatched lines for manual resolution rather than guessing.

---

#### [MEDIUM] `normalizePaymentMethod` produces values that are not members of the `PaymentMode` enum, and the bank account is resolved by name substring

`project/src/lib/accounts/vendorPaymentAccounts.ts:52-90` and `:12-50`

`normalizePaymentMethod` can return `"CHECK"` (`:73`) or `"CREDIT_CARD"`
(`:81`). The Prisma enum is `CASH | BANK_TRANSFER | CARD | CHEQUE`
(`schema.prisma:433-438`) — `CHECK` and `CREDIT_CARD` are not members. Any
attempt to persist the normalized value into `Payment.mode` throws; where the
value is instead used only for account selection, a cheque and a credit card
silently take the `BANK_TRANSFER` branch (`:36-38`), which is defensible for a
cheque and wrong for a card (a card payment should credit a card liability
account, not the bank). The unmapped default at `:39-41` sends anything
unrecognised — including a genuinely unknown method — to **Cash**, so a wire
transfer whose method cell reads "TT" credits the cash account and the bank
reconciliation will never balance.

Separately, `:21-26` resolves the bank account by
`accountName.toLowerCase().includes("bank")` over an unordered `find`. A tenant
with "Bank - HBL Current" and "Bank - Meezan USD" gets whichever row the query
returned first, and it can change between requests. Payments then credit
whichever bank account happened to sort first, and both bank reconciliations
fail.

Fix: make `normalizePaymentMethod` return the `PaymentMode` enum type so the
compiler catches non-members, map `CARD` to a dedicated account, fail closed
(reject) on unrecognised methods rather than defaulting to Cash, and select the
bank/cash account by chart-of-accounts `code`, not by name substring.

---

#### [LOW] `findLatestVendorInvoiceBeforePaymentDate` computes the day boundary in the server's local timezone

`project/src/lib/accounts/vendorPaymentAccounts.ts:100-101`

```js
const dayStart = new Date(paymentDate);
dayStart.setHours(0, 0, 0, 0);
```

`setHours` is local-time. `DateTime` values come back from MySQL as UTC. On a
server running UTC+5 (this deployment's timezone), a payment dated
`2025-03-10T00:00:00Z` yields `dayStart = 2025-03-09T19:00:00Z`, so an invoice
dated `2025-03-09T20:00:00Z` is treated as being *before* the payment day when
it is in fact the same local day. The wrong bill is selected and the payment is
applied against it. The reverse error occurs west of UTC. Fix: compute the
boundary in the tenant's accounting timezone explicitly (`Date.UTC(...)` after
converting), and store accounting dates as date-only values.

---

#### [LOW] `POST /api/chart-of-accounts` does not validate `category`, `type`, `debitRule` or `creditRule` against any known set

`project/src/app/api/chart-of-accounts/route.ts:79-108`

`category` and `type` are free-form strings, and `debitRule`/`creditRule`
default to `""` (`:103-104`). Nothing constrains `category` to
Asset/Liability/Equity/Revenue/Expense, which is the value every downstream
balance computation switches on to decide the account's normal balance and
therefore the sign of its balance. An account created with `category: "Assets"`
(plural) or `"asset"` (lower case) falls through those switches, and its balance
is reported with the wrong sign or omitted from the trial balance entirely,
while the underlying journal lines are perfectly correct. `resolveVendorPayment
AccountIds` also matches on `a.category === "Asset"` exactly
(`project/src/lib/accounts/vendorPaymentAccounts.ts:23`), so a mis-cased
category silently disables bank-account resolution and pushes the payment to
Cash.

The duplicate-code check at `:88-95` is a read-then-create race, but
`@@unique([organizationId, code])` (`schema.prisma:540`) genuinely enforces it
at the database, so the worst outcome is a 500 instead of a 400. Noting that as
clean.

Fix: validate `category` and `type` against enums (ideally make them Prisma
enums), and require `debitRule`/`creditRule` to be one of `increase`/`decrease`
consistent with the category.


### Batch 2 - chart-of-accounts/[id], account-books, close-period, company/stats, invoices (list + [id] + edit), payments (list + create)

---

#### [CRITICAL] STEP 5 - there is no period-close mechanism at all: nothing anywhere prevents posting into a closed period

`project/src/app/api/accounts/close-period/route.ts` (whole file),
`project/prisma/schema.prisma` (no model)

Answering STEP 5 directly: **an entry can be posted with a date inside a closed
period, from every write path in the system, with no warning.**

There is no `ClosedPeriod`, `FiscalPeriod`, `AccountingPeriod` or lock model in
the schema, and no `closedAt`/`lockedUntil` column anywhere. "Closing a period"
in this codebase means only one thing: `POST /api/accounts/close-period`
computes a net income figure and writes one extra journal entry. It sets no
state. Nothing is consulted afterwards. Confirmed against every JE-writing path
in the codebase (`journal-entries` POST/PUT, `payments` POST,
`createJournalEntryForPaymentProcess`, `createJournalEntryForTransaction` in
`lib/utils.ts`, `credit-notes`, `debit-notes`, `bulk-import`,
`skynetVendorAutoPay`, `close-period` itself) — not one of them reads a period
boundary before writing.

Worked example:

```
2025-01-31  close-period POST for 2025-01-01..2025-01-31
            netIncome = 40,000.00, closing entry JE-0500 posted, equity +40,000
            January financials issued to the bank.

2025-02-14  a user edits a January invoice from 30,000 to 45,000
            (PUT /api/accounts/invoices/[id])
            -> updateJournalEntriesForInvoice writes GL movement dated in January
            -> revenue for January is now 15,000 higher
            -> the closing entry JE-0500 is unchanged
            -> January revenue and January equity now disagree by 15,000
            -> re-running close-period for January returns
               "Closing entry already exists for this period" (:34-40)
               and refuses to correct it
```

The issued statements can never be reproduced from the database, and the
difference is silent — no report shows it, because every report recomputes from
the same mutated lines.

Fix: add a `ClosedPeriod` model (`organizationId, startDate, endDate, closedAt,
closedBy`), enforce it in a single shared `assertPeriodOpen(organizationId,
date)` helper called at the top of every journal-writing path, and make
`close-period` write that row inside the same transaction as the closing entry.
Corrections to a closed period must be posted as dated adjustments in the
current open period, never as edits to the closed one.

---

#### [CRITICAL] The closing entry double-counts prior periods once any revenue account is driven negative, creating equity out of nothing

`project/src/app/api/accounts/close-period/route.ts:74-129, 163-195`

Three compounding defects in one calculation:

1. `startDate` is accepted (`:14`) and **never used in the balance query**. The
   query at `:75-81` filters only `date lte endDate`, so it always computes
   cumulative-to-date, not period, figures.
2. The offsetting line is written to `revenueAccounts[0]` (`:187`) — an
   arbitrary real operating revenue account, chosen by array position — rather
   than to an Income Summary account. The code comments admit this ("for
   simplicity we use revenue", `:180-181`).
3. `totalRevenue` and `totalExpenses` only accumulate accounts whose balance is
   `> 0` (`:122, :126`).

Items 1 and 2 accidentally cancel while every revenue account stays positive
(the prior closing debit reduces cumulative revenue by exactly the prior net
income, so `cumulativeNet - alreadyClosed` comes out right). Item 3 breaks that
cancellation the moment `revenueAccounts[0]` goes negative — which it does as
soon as net income exceeds that one account's own revenue.

```
Chart of accounts, revenue: [0] "Freight Income", [1] "Handling Income"

Period 1 activity:
  Freight Income   credit  10,000.00   -> balance  10,000.00
  Handling Income  credit  90,000.00   -> balance  90,000.00
  Expenses         debit   60,000.00   -> balance  60,000.00
  totalRevenue 100,000.00  totalExpenses 60,000.00  netIncome 40,000.00

Closing entry JE-A:
  credit Current Year Earnings   40,000.00
  debit  Freight Income          40,000.00     <- revenueAccounts[0]
  -> Freight Income balance = 10,000 - 40,000 = -30,000.00

Period 2: NO activity whatsoever. Close 2025-02-01..2025-02-28:
  Freight Income balance  -30,000.00  -> skipped by `if (balance > 0)` :122
  Handling Income balance  90,000.00  -> counted
  totalRevenue   = 90,000.00      (should be 60,000.00)
  totalExpenses  = 60,000.00
  netIncome      = 30,000.00      (should be 0.00)

Closing entry JE-B: credit Current Year Earnings 30,000.00
                    debit  Freight Income        30,000.00
  -> equity overstated by 30,000.00 against zero trading
  -> Freight Income balance now -60,000.00, so the next close invents
     another 30,000.00, and so on, every period, forever
```

The `contains` guard at `:23-32` does not stop this because each close uses a
different `CLOSE-{startDate}-{endDate}` reference. Balance-sheet equity grows
by 30,000 per period with no revenue behind it, and the P&L shows Freight
Income at -60,000.

Two further defects at the same site:

- If `revenueAccounts.length === 0` on a profit (`:182`) or
  `expenseAccounts.length === 0` on a loss (`:214`), **only one line is
  created** while the header is still written with
  `totalDebit = totalCredit = |netIncome|` and `isPosted: true` (`:150-152`).
  That is a posted, permanently unbalanced journal entry — see the STEP 2
  verdict below. A tenant that has revenue posted through accounts it later
  deleted, or that has never created a Revenue-category account, hits this.
- The idempotency check (`:23-32`) is a read-then-check with no transaction and
  uses `contains`, so two concurrent close requests both pass and both post,
  and closing an overlapping range (`2025-01-01..2025-06-30` after
  `2025-01-01..2025-03-31`) is a different reference and is allowed.

Fix: create a dedicated Income Summary equity-contra account and post the
closing entry as *close every revenue account by its own balance, close every
expense account by its own balance, transfer the difference to Current Year
Earnings* — one line per account, no `> 0` filter, so contra-revenue and
contra-expense balances are handled correctly by sign. Bound the balance query
by `startDate` as well as `endDate`. Refuse to close a period that overlaps an
already-closed one, checked inside the transaction against the `ClosedPeriod`
table proposed above.

---

#### [CRITICAL] Invoice payment allocations are stored as text in `Payment.description`, and the parser only ever reads the first allocation

`project/src/app/api/accounts/invoices/route.ts:211-238` and the identical
vendor block at `:256-283`

There is no allocation table in the schema. When a payment is spread across
several invoices, the split is serialised into the free-text `description`
column as `ALLOCATIONS:INV-A:100|INV-B:200|INV-C:50`, and the remaining balance
of every invoice is recovered by regex.

The regex is wrong:

```js
const allocMatch = payment.description?.match(/ALLOCATIONS:([^|]+)/);
if (allocMatch) {
  const allocations = allocMatch[1].split('|');   // can never split
```

`[^|]+` stops at the first `|`, so capture group 1 can never contain a `|`, so
the subsequent `.split('|')` always yields exactly one element. **Every
allocation after the first is invisible to this calculation.**

```
Payment #900, INCOME, 5,000.00, customer ACME
description = "Bulk receipt ALLOCATIONS:INV-1001:2000|INV-1002:2000|INV-1003:1000"

INV-1001 (2,000.00):  match[1] = "INV-1001:2000"
                      allocatedAmount = 2000
                      remaining = 2000 - 2000 = 0.00        correct

INV-1002 (2,000.00):  match[1] = "INV-1001:2000"  -> no match on INV-1002
                      allocatedAmount = 0
                      remaining = 2,000.00                  WRONG, it is paid

INV-1003 (1,000.00):  remaining = 1,000.00                  WRONG, it is paid
```

Accounts receivable is overstated by 3,000.00 on a payment that was received in
full, the customer is chased for invoices they have already settled, and the
aged-debt report shows two phantom debts. Nothing reconciles the 5,000.00
actually banked against the 2,000.00 the system believes was applied.

Even with the regex fixed, this design cannot be made correct: the allocation
is not a first-class row, so it cannot be constrained, indexed, transacted,
reversed or audited, and `description` is user-editable text — editing the
description of a payment silently changes which invoices are considered paid.
It is also the direct cause of the over-application race in STEP 3 (batch 3),
because there is nothing to lock.

A second defect at the same site: allocations are added to *direct* payments
(`:236-237`) with no exclusion between them. If a payment carries both
`invoice: "INV-1001"` and `ALLOCATIONS:INV-1001:2000`, the 2,000.00 is counted
twice and `remaining` is understated by 2,000.00. `Math.max(0, ...)` at `:238`
then clamps any resulting negative to zero, so over-application is invisible in
both directions.

Fix: add a real `PaymentAllocation` model (`paymentId, invoiceId, amount,
createdAt`, unique on `(paymentId, invoiceId)`, indexed on `invoiceId`), write
allocations inside the same transaction as the payment, and compute
`remaining = invoice.totalAmount - SUM(allocation.amount)` with a database
aggregate. Backfill the existing text allocations before removing the parser —
and note that the backfill must re-parse the *full* string, since only the
first allocation has ever been reflected in any balance the users have seen.

---

#### [HIGH] Invoices created through the accounts module never produce a journal entry, so payments credit an AR balance that was never debited

`project/src/app/api/accounts/invoices/route.ts:369-395`

`POST /api/accounts/invoices` writes the `Invoice` row and returns. It creates
no `JournalEntry`. Verified across the codebase: journal entries are created by
`add-shipment`, `bulk-upload-shipments`, `update-shipment`, `shipments/[id]`,
the payment routes, credit/debit notes, `bulk-import` and `close-period` — but
**not** by invoice creation. So an invoice raised directly in the accounts UI
(the normal path for a manual or corrective bill) has a subledger row and no
general-ledger row.

The payment side does post to the GL. `createJournalEntryForPaymentProcess`
debits cash/bank and credits Accounts Receivable.

```
2025-04-01  POST /api/accounts/invoices  INV-2001  customer ACME  8,000.00
            Invoice row created.
            GL: nothing.        AR (GL) = 0.00     AR (subledger) = 8,000.00

2025-04-20  payment of 8,000.00 processed against INV-2001
            GL: debit  Cash                 8,000.00
                credit Accounts Receivable  8,000.00
            AR (GL) = -8,000.00             AR (subledger) = 0.00
```

Accounts Receivable in the general ledger is now negative by the full value of
every manually-raised invoice ever paid, revenue for the period is understated
by the same amount, and the balance sheet balances only because the offsetting
error sits in equity via the closing entry. The AR control account can never be
reconciled to the invoice list, which is the single most important
reconciliation in the module.

Fix: create the invoice and its journal entry (`debit AR / credit Revenue` for
`profile: "Customer"`, `debit Expense / credit AP` for `profile: "Vendor"`) in
one `prisma.$transaction`, using the same helper the shipment path uses.

---

#### [HIGH] `PUT /api/accounts/invoices/[id]/edit` unconditionally rewrites `totalAmount`, `fscCharges` and `discount` from the request body, so any partial edit zeroes them

`project/src/app/api/accounts/invoices/[id]/edit/route.ts:99, 106-120, 128`

Unlike its sibling `PUT /api/accounts/invoices/[id]`, which carefully applies
each field only `if (body.x !== undefined)` (`:115-131` of that file), this
handler writes the money fields unconditionally:

```js
const newAmount = parseFloat(body.totalAmount) || 0;
...
totalAmount: newAmount,
fscCharges:  parseFloat(body.fscCharges) || 0,
discount:    parseFloat(body.discount)   || 0,
```

`parseFloat(undefined)` is `NaN`, and `NaN || 0` is `0`. So a client that PUTs
only `{ disclaimer: "..." }` — or any client that omits a field it did not
intend to change — sets the invoice total to zero.

```
INV-3001  totalAmount 12,500.00  fscCharges 750.00  discount 200.00
PUT .../edit?invID=3001  body = { disclaimer: "Revised terms" }

  newAmount = parseFloat(undefined) || 0 = 0
  invoice.totalAmount -> 0.00
  invoice.fscCharges  -> 0.00
  invoice.discount    -> 0.00
  amountChanged = true
  updateInvoiceBalance(prisma, 3001, 12500, 0, ...)
      -> customer currentBalance reduced by 12,500.00
  updateJournalEntriesForInvoice(... 12500 -> 0 ...)
      -> GL revenue reduced by 12,500.00
  shipment.totalCost -> 0.00 and shipment.price -> 0.00   (:135-136)
```

A note about the disclaimer wiped a 12,500.00 receivable, the customer's
balance, the general ledger and the shipment's cost basis, and returned
`success: true`. The `discount` write at `:128` also propagates the zero onto
the shipment record, destroying the original pricing.

Fix: apply the same `if (body.x !== undefined)` guard used by the sibling
route, and reject rather than coerce an unparseable money value.

---

#### [HIGH] Both invoice edit paths swallow balance and journal-entry failures and still return `success: true`

`project/src/app/api/accounts/invoices/[id]/route.ts:146-186` (two try/catch
blocks, `:158-161` and `:182-185`),
`project/src/app/api/accounts/invoices/[id]/edit/route.ts:146-178` (`:174-177`)

The invoice row is updated first, outside any transaction. The customer/vendor
balance update and the journal-entry update follow in `try` blocks whose
`catch` does nothing but `console.error` — the comments say so explicitly
("Continue with the response even if balance update fails"). The response is
`success: true` with `journalUpdated: true` regardless of whether the journal
was actually updated.

```
INV-4002 changed from 20,000.00 to 25,000.00
  1. prisma.invoice.update            -> committed, invoice is 25,000.00
  2. updateInvoiceBalance             -> throws (deadlock / missing account /
                                         the JE-10000 numbering failure above)
                                      -> swallowed
  3. updateJournalEntriesForInvoice   -> not reached or also swallowed
  4. shipment.update                  -> may still succeed (:192)

response: { success: true, balanceUpdated: true, journalUpdated: true }

Invoice   25,000.00
Customer  balance still reflects 20,000.00
GL        still reflects 20,000.00
Shipment  totalCost 25,000.00
```

Four stores, three different values, no error surfaced to the user and no
record that the divergence happened. Because `updateInvoiceBalance` is also the
thing that writes the `CustomerTransaction` audit row, there is not even a
trace to reconcile from later.

Fix: wrap steps 1-4 in a single `prisma.$transaction` and let the failure
propagate as a 500 so the invoice change rolls back with everything else.
`success: true` must mean all of it committed.

---

#### [HIGH] `DELETE /api/accounts/invoices/[id]` deletes the invoice without reversing its journal entries, its party balance, or checking for payments against it

`project/src/app/api/accounts/invoices/[id]/route.ts:229-258`

The handler verifies the invoice exists and deletes it. That is all it does.
There is no reversal, no balance adjustment, no check that payments have been
applied, no check that the invoice's period is closed, and no transaction.

```
INV-5003  customer ACME  15,000.00, raised via add-shipment so it DOES
          have GL entries: debit AR 15,000 / credit Revenue 15,000
          Customers.currentBalance for ACME includes 15,000.00
          Payment #712 of 15,000.00 recorded with invoice = "INV-5003"

DELETE /api/accounts/invoices/5003

  Invoice row            : gone
  JournalEntry lines     : still there, AR still debited 15,000.00
  Customers.currentBalance: still includes 15,000.00
  Payment #712           : still there, still 15,000.00, pointing at an
                           invoice number that no longer exists
  CreditNote.invoiceId   : silently nulled by Prisma's emulated referential
                           action (no real FK, schema.prisma:8), so the credit
                           note keeps its amount and its own journal entry but
                           is now attached to nothing
```

The customer is left permanently 15,000.00 in credit, the GL still shows a
receivable that no document supports, and the payment cannot be matched to
anything. Any later ledger recalculation produces a different answer than it
did the day before, with no audit trail explaining why.

Fix: refuse the delete when payments, credit notes or debit notes reference the
invoice; otherwise, inside one transaction, post a reversing journal entry
(dated in the current open period, not the original date), reverse the party
balance, write the offsetting `CustomerTransaction`/`VendorTransaction`, and
prefer a soft `voided` status over a physical delete.

---

#### [HIGH] `POST /api/accounts/payments`: when journal-entry creation fails, the catch block creates the payment a second time

`project/src/app/api/accounts/payments/route.ts:303-334`

```js
try {
  const payment = await prisma.payment.create({ data: orgData(session, data) });
  await createJournalEntryForPayment(payment, body, session.organizationId);   // may throw
  return ...;
} catch (e) {
  // "Fallback: some databases may still have scalar columns instead of relations"
  const payment = await prisma.payment.create({ data: orgData(session, fallbackData) });
  await createJournalEntryForPayment(payment, body, session.organizationId);
  return ...;
}
```

The `try` block contains **two** operations, but the `catch` was written as if
it contained one. `data` and `fallbackData` (`:270-283` vs `:313-326`) are
field-for-field identical, so the "fallback" is not a fallback from anything —
it simply repeats the insert. `createJournalEntryForPayment` re-throws on any
error (`:408`), and it has at least three routine failure modes: the
entryNumber uniqueness collision from the read-then-create race, the permanent
JE-10000 collision described in batch 1, and an invalid `debitAccountId`.

```
POST /api/accounts/payments  amount 250,000.00  EXPENSE  vendor settlement

  payment.create               -> row #4101 committed, 250,000.00
  createJournalEntryForPayment -> unique violation on entryNumber, throws
  catch:
  payment.create               -> row #4102 committed, 250,000.00
  createJournalEntryForPayment -> succeeds this time (number moved on)

Result: cash reduced by 500,000.00 in the payments ledger,
        one journal entry for 250,000.00,
        payment #4101 with no journal entry at all.
```

The 10-second deduplication guard at `:286-301` does not help: it runs *before*
the first insert, and the fallback insert at `:328` does not consult it.

Fix: delete the fallback branch entirely (it is dead weight — the two payloads
are identical), and put the payment insert and its journal entry inside one
`prisma.$transaction` so a journal failure rolls the payment back rather than
duplicating it.

---

#### [MEDIUM] `POST /api/accounts/payments` accepts `NaN` and negative amounts

`project/src/app/api/accounts/payments/route.ts:240-248, 274`

The required-field loop only checks that the stringified value is non-empty, so
`amount: "12,500"` and `amount: "abc"` both pass, and `Number(body.amount)`
yields `NaN`. That `NaN` is written to `Payment.amount` (a `DOUBLE`) and then to
`JournalEntry.totalDebit`/`totalCredit` and both lines (`:369-370, 383, 395`).
A single `NaN` row makes every subsequent `SUM(amount)` over that account —
the cash-flow stats in `accounts/company/stats`, the payments list total, the
account balance — return `NaN`/`NULL`, and no report will say why. Negative
amounts are likewise accepted and silently invert the entry.

The account validation immediately above is correct and worth noting as clean:
`:251-256` requires both accounts and `:259-264` rejects
`debitAccountId === creditAccountId`. (One gap: `===` is type-strict, so
`debitAccountId: "7"` and `creditAccountId: 7` pass the check and then both
lines land on account 7, producing a self-cancelling entry.)

Fix: `const amount = Number(body.amount); if (!Number.isFinite(amount) ||
amount <= 0) return 400;` and compare the account ids after coercing both to
`Number`.

---

#### [MEDIUM] `PUT /api/chart-of-accounts/[id]` allows an account's `category` to be changed after it has journal entries, retroactively flipping the sign of history

`project/src/app/api/chart-of-accounts/[id]/route.ts:79-90`

`category` and `type` are updated with no check for existing
`JournalEntryLine` rows — the `DELETE` handler at `:134-146` performs exactly
that check, correctly, and blocks the delete, but `PUT` does not.

Every balance computation in the system derives the account's normal balance
from `category`, including `close-period` (`:105-113`) and the ledger
recalculations. Changing it rewrites the meaning of every historical line at
once:

```
"Fuel Surcharge Recovery", category Expense, three years of lines,
cumulative debit balance 480,000.00, included in expenses in every
closed period.

PUT { category: "Revenue" }

close-period now evaluates it under the Revenue branch:
  balance = SUM(credit) - SUM(debit) = -480,000.00
  `if (balance > 0)` -> excluded from totalRevenue entirely
  and it is no longer in totalExpenses either
  -> netIncome for every period recomputes 480,000.00 higher
```

Prior-year comparatives change retroactively, and no journal entry records the
change. The same applies to `isActive: false` (`:88`): the lines remain and
still affect balances, but the account disappears from filtered views, so the
balance is present in totals and absent from the drill-down.

Fix: block `category`/`type` changes when `journalEntryLine.count({ accountId })
> 0`; require the user to create a new account and post a reclassification
entry. Block deactivation while the account has a non-zero balance.

---

#### [MEDIUM] `accounts/company/stats` measures cash flow on `createdAt` instead of the transaction date, and treats every `ADJUSTMENT` as an outflow

`project/src/app/api/accounts/company/stats/route.ts:17-37, 70-73, 118-121`

Four separate defects in the cash-flow figures:

1. **Wrong date column.** The filter is on `createdAt` (`:20, :32`), the row's
   insertion timestamp, while `Payment.date` is the transaction date every
   other screen filters on. A cheque dated 2025-01-28 and entered on 2025-02-03
   appears in February's cash flow and in January's payments list. Month-end
   cash figures never agree between the two screens, and backdated entries move
   a previously-reported month's number without touching that month's data.
2. **`ADJUSTMENT` is only ever an outflow.** `mode: CASH, transactionType:
   ADJUSTMENT` is unconditionally added to `cashOutflow` (`:70-73`), and the
   same for bank (`:118-121`); no branch adds an adjustment to inflow. A
   positive adjustment of 5,000.00 posted to correct an understated cash
   balance is *subtracted*, moving reported cash 10,000.00 in the wrong
   direction.
3. **Transfers are classified by substring match on free text.** `description:
   { contains: "Bank to Cash" }` (`:50-52, :124-126`) and `"Cash to Bank"`
   (`:76-78, :98-100`). A transfer whose description reads "Transfer from bank
   to cash" (lower case) matches neither and vanishes from both sides — cash
   and bank both wrong, total net unaffected, so nothing looks broken. A
   correction described as "Reversing the Bank to Cash of 3rd; this is a Cash to
   Bank" matches **all four** aggregates and is counted four times.
4. **Rows with `mode: null` are invisible.** `Payment.mode` is optional
   (`schema.prisma:453`) and `POST /api/accounts/payments` writes `null`
   whenever `body.paymentMethod` is absent (`:277`). Those payments appear in
   no bucket, so the cash-flow panel under-reports by the whole volume of
   payments entered without a method.

Also, `endOfMonth` (`:29`) is built as `...23, 59, 59` with no milliseconds and
in server-local time, so a payment stamped `23:59:59.400` on the last day of
the month is excluded from both that month and the next.

Fix: filter on `date`; derive transfer direction from the debit/credit accounts
on the linked journal entry rather than from description text; give
`ADJUSTMENT` a signed treatment (or split it into two categories); treat a null
mode as an explicit "Unclassified" bucket that is displayed rather than
dropped; and build month boundaries as half-open UTC ranges
(`gte start, lt nextStart`).

---

#### [MEDIUM] `account-books` reports a total that does not match the rows it returns, and its category filter silently discards the account filter

`project/src/app/api/account-books/route.ts:34-51, 53-55, 69-103`

- `whereClause.lines` is assigned at `:35` for `accountId` and then
  **reassigned** at `:43` for `category`. When both parameters are supplied,
  the account filter is gone from the database query. The rows are re-filtered
  in memory at `:74-82`, so the returned lines are right, but `totalCount`
  (`:53`) is computed from the clobbered `whereClause` and is therefore the
  count of entries matching the category alone.
- `totalCount` counts `JournalEntry` rows while `payments` contains one element
  per `JournalEntryLine` (`:72`, `flatMap`). The two are never comparable: a
  page showing 300 line rows reports `total: 140`.
- The default `limit` is 1000 entries with no offset (`:20, :69`). An account
  book with more than 1000 entries silently truncates, while still reporting
  the full `total`. A user reconciling an account against this screen is
  reconciling against an arbitrary subset, and the screen gives no indication.
- `amount: line.debitAmount > 0 ? line.debitAmount : line.creditAmount` and
  `transactionType: line.debitAmount > 0 ? 'DEBIT' : 'CREDIT'` (`:87-89`)
  mis-handle the negative amounts that the system permits (see batch 1): a line
  with `debitAmount: -500, creditAmount: 0` is labelled `CREDIT` and displayed
  with `amount: 0`. The 500.00 disappears from the account book while remaining
  in every aggregate.

Fix: merge the two `lines` conditions with `AND`, count what is actually
returned, paginate properly with `skip`/`take` driven by the same filters, and
select the display amount by sign (`debitAmount !== 0 ? debitAmount :
creditAmount`) once negative amounts are prohibited at write time.

---

#### [MEDIUM] Date-range filters use three different end-of-day conventions across the module, so the same period returns different totals on different screens

`project/src/app/api/journal-entries/route.ts:39` — `new Date(toDate + "T23:59:59.999Z")`
`project/src/app/api/account-books/route.ts:30` — `new Date(dateTo + 'T23:59:59.999Z')`
`project/src/app/api/accounts/invoices/route.ts:130` — `new Date(toDate)`
`project/src/app/api/accounts/payments/route.ts:84` — `new Date(toDate)`
`project/src/app/api/accounts/company/stats/route.ts:22` — `new Date(endDate)`

The first two include the whole final day; the last three stop at
`00:00:00.000Z` on the final day and therefore **exclude it entirely**.

```
Filter 2025-01-01 .. 2025-01-31, with 42,000.00 of invoices dated 2025-01-31:

/api/journal-entries   -> includes 31 Jan
/api/accounts/invoices -> excludes 31 Jan, totalAmount 42,000.00 lower
```

Month-end is the heaviest posting day of the month, so this is not a marginal
discrepancy. The `gte` side has the mirror problem: `new Date(fromDate)` is
UTC midnight while `company/stats` builds its default range in server-local
time (`:28`), shifting the window by the server's offset (UTC+5 here).

Fix: one shared helper that converts a `YYYY-MM-DD` pair into a half-open UTC
range (`gte startOfDay(from)`, `lt startOfDay(to + 1 day)`) in the tenant's
accounting timezone, used by every route.

---

#### [LOW] The payments list sums income, expense and transfer amounts into a single "total amount"

`project/src/app/api/accounts/payments/route.ts:185-191`

`totalAmount` is `SUM(amount)` over whatever the current filter returns, with
no regard to `transactionType`. With the "All" tab active it adds money
received, money paid and internal transfers together as positive numbers. A
month with 100,000.00 received, 60,000.00 paid and a 40,000.00 bank-to-cash
transfer displays 200,000.00, a figure that corresponds to nothing. The
transfer is also counted once even though it is internal and nets to zero.

Fix: return signed subtotals per `transactionType` and let the UI display them
separately; exclude `TRANSFER` from any net figure.

---

#### [LOW] The payments list matches a payment to its journal entry by `reference`, which is not unique

`project/src/app/api/accounts/payments/route.ts:103-110, 147-154`

`journalEntry.findFirst({ where: { reference: payment.reference || \`Payment-${payment.id}\` } })`.
`reference` is free text and is routinely a shared placeholder — 
`resolveCreditPaymentVoucherDate` has explicit handling for references like
`"00000"` being reused across many payments
(`project/src/lib/accounts/resolveCreditPaymentVoucherDate.ts:24-32`). Every
payment sharing a reference displays the same, usually wrong, journal entry
number, so a user drilling from a payment into the GL lands on someone else's
entry. Fix: add a nullable `journalEntryId` to `Payment`, set it when the entry
is created, and join on it.

---

#### [LOW] `POST /api/accounts/invoices` does not check that `totalAmount` agrees with `lineItems`, `fscCharges` and `discount`

`project/src/app/api/accounts/invoices/route.ts:369-395`

`lineItems` is stored as opaque `Json` (`schema.prisma:476`) and `totalAmount`
is taken from the request (`:386`). Nothing verifies that
`sum(lineItems) + fscCharges - discount == totalAmount`. A client bug or a
tampered request produces an invoice whose printed lines add up to one figure
and whose posted total is another; the customer disputes it and the ledger
cannot be defended. `parseFloat(totalAmount)` with no `|| 0` also writes `NaN`
if the field is missing, poisoning subsequent `SUM()`s.

Fix: recompute the total server-side from the line items and reject a mismatch
beyond a rounding tolerance rather than trusting the client figure.


### Batch 3 - payments/allocate, payments/process, the payment/allocation helpers in lib/utils.ts, bulk-import, vendor-excel, both auto-pay routes, skynetVendorAutoPay

---

#### [CRITICAL] STEP 3 - a payment can be applied to more than its own value with no concurrency required at all

`project/src/lib/utils.ts:611-760` (`allocateExcessPayment`), `:763-978`
(`processPaymentWithAllocation`), `:981-1013`
(`calculateInvoicePaymentStatus`),
`project/src/app/api/accounts/payments/process/route.ts:72-96`

Answering STEP 3 first on the deterministic path, because the race is not even
needed to break it.

When a payment exceeds the invoice's remaining balance,
`processPaymentWithAllocation` calls `allocateExcessPayment` with the excess
(`:819-831`). That function walks the party's other open invoices and — per its
own comment at `:672`, *"no payment record or transaction created for
allocation"* — **only updates `Invoice.status`** (`:676-679`). No `Payment` row,
no `CustomerTransaction`, no journal entry, no allocation record. The only
trace is the `ALLOCATIONS:` text appended to the payment description at
`:922-929`, which the reader in `accounts/invoices/route.ts` mis-parses (see
the CRITICAL in batch 2).

Meanwhile the `Payment` row is written with `invoice: invoiceNumber` — the
*original* invoice — for the **full** amount (`:938, :947`), and
`calculateInvoicePaymentStatus` then sums every payment carrying that invoice
number (`:987-994`).

```
Customer ACME, open invoices:
  INV-A  2,000.00   INV-B  2,000.00   INV-C  1,000.00

POST /api/accounts/payments/process
  { invoiceNumber: "INV-A", paymentAmount: 5000, enableAllocation: true }

  alreadyPaid        = 0
  remainingAmount    = 2,000.00
  overpaymentAmount  = 3,000.00
  allocateExcessPayment(3,000.00):
      INV-B -> status "Paid"     (no payment, no GL, no transaction)
      INV-C -> status "Paid"     (no payment, no GL, no transaction)
  Payment #A1 created: amount 5,000.00, invoice "INV-A"
  calculateInvoicePaymentStatus("INV-A", 2000):
      totalPaid = 5,000.00 >= 2,000.00 -> INV-A status "Paid"

State: 5,000.00 received.
  INV-A "Paid", and its own totalPaid reads 5,000.00 against a 2,000.00 bill
  INV-B "Paid" with 0.00 recorded against it
  INV-C "Paid" with 0.00 recorded against it
  Customer balance credited 5,000.00 (correct)
  GL: one entry for 5,000.00 debiting cash, crediting AR (correct in total)
```

INV-A is over-applied by 3,000.00 in every per-invoice query, and INV-B/INV-C
are marked settled with nothing behind them. The instant anything recomputes
their status from payments — `calculateInvoicePaymentStatus` runs on every
subsequent payment to the same customer, and the ledger GET routes recompute
too — INV-B and INV-C flip back to `Unpaid` and the customer is invoiced again
for 3,000.00 they already paid. The status is not a fact, it is a guess that
gets re-guessed differently later.

**Now the concurrency question, answered explicitly:**

- Is there a transaction? **No.** `processPaymentWithAllocation` performs
  between 5 and N writes with no `prisma.$transaction` anywhere in it or in its
  caller `payments/process/route.ts`. (Grep-verified: `process/route.ts`
  contains no `$transaction`.)
- Is there a row lock? **No.** There is no `SELECT ... FOR UPDATE`, no
  `$queryRaw` with a locking clause, and no interactive transaction wrapping
  the read and the write. Grep-verified across `project/src`: zero occurrences
  of `FOR UPDATE`.
- Is there a database constraint? **No.** `Payment` has no unique index beyond
  its primary key (`schema.prisma:440-461`), no `CHECK`, and MySQL with
  `relationMode = "prisma"` has no foreign keys either. Nothing at the database
  level relates the sum of payments to an invoice's total.

All three absent. The interleaving:

```
INV-D total 10,000.00, nothing paid.
Two operators (or one double-click, past the 10-second dedup window,
or the same file uploaded to two tabs) submit 10,000.00 each.

T1  req A: aggregate SUM(payment.amount where invoice=INV-D) -> 0.00
T2  req B: aggregate SUM(...)                                -> 0.00
T3  req A: remaining = 10,000.00, overpayment = 0.00
T4  req B: remaining = 10,000.00, overpayment = 0.00
T5  req A: addCustomerTransaction CREDIT 10,000.00
T6  req B: addCustomerTransaction CREDIT 10,000.00
T7  req A: payment.create 10,000.00
T8  req B: payment.create 10,000.00
T9  req A: calculateInvoicePaymentStatus -> totalPaid 20,000.00 -> "Paid"
T10 req B: same -> "Paid"

INV-D: 10,000.00 invoice, 20,000.00 applied, status "Paid",
       remainingAmount clamped to 0.00 by Math.max (:997)
       so the overpayment is invisible on every screen.
```

The window between the read at `:800` and the write at `:932` is not
microseconds — when there is an overpayment, `allocateExcessPayment` runs a
`findMany` plus a grouped aggregate plus one `UPDATE` per invoice in between,
so the window is comfortably hundreds of milliseconds on a customer with many
open invoices.

Fix, in order of importance:
1. Add the `PaymentAllocation` table proposed in batch 2 and make allocation a
   real row, written in the same transaction as the payment.
2. Wrap read, validate and write in one `prisma.$transaction` (interactive),
   and take a row lock on the invoice inside it —
   `await tx.$queryRaw\`SELECT id FROM Invoice WHERE id = ${id} FOR UPDATE\``
   works on MySQL/InnoDB.
3. Add a database-level backstop: a `paidAmount` column on `Invoice` maintained
   by the same transaction with a `CHECK (paidAmount <= totalAmount)` (MySQL 8
   enforces `CHECK`), or a unique constraint on
   `(paymentId, invoiceId)` in the allocation table plus a trigger.
4. Stop clamping with `Math.max(0, ...)` — surface over-application as an
   error rather than hiding it.

---

#### [CRITICAL] `addCustomerTransaction` / `addVendorTransaction` read-modify-write the party balance with no lock, so concurrent postings silently lose money

`project/src/lib/utils.ts:91-141` and `:143-197`

Both helpers do exactly this:

```js
const customer = await prisma.customers.findUnique({ where: { id: customerId } });
const previousBalance = customer.currentBalance;
const newBalance = type === 'CREDIT' ? previousBalance + amount : previousBalance - amount;
await prisma.customers.update({ where: { id: customerId }, data: { currentBalance: newBalance } });
await prisma.customerTransaction.create({ data: { ..., previousBalance, newBalance } });
```

Read, compute in JavaScript, write an absolute value. No transaction, no lock,
no atomic `{ increment: amount }`. These two functions are the single point
through which every customer and vendor balance in the system moves — they are
called from the payment routes, the shipment routes, the bulk upload, the
invoice edit path and the ledger routes.

```
Customer ACME currentBalance = 0.00 (nothing owed)
Concurrent: invoice posting DEBIT 7,500.00 and a receipt CREDIT 3,000.00

T1  DEBIT  reads currentBalance -> 0.00
T2  CREDIT reads currentBalance -> 0.00
T3  DEBIT  writes 0.00 - 7,500.00 = -7,500.00
T4  CREDIT writes 0.00 + 3,000.00 =  3,000.00     <- overwrites T3 entirely

Customers.currentBalance = 3,000.00
Correct value            = -4,500.00
Error                    = 7,500.00, permanent

CustomerTransaction rows written:
  DEBIT  7,500.00  previousBalance 0.00  newBalance -7,500.00
  CREDIT 3,000.00  previousBalance 0.00  newBalance  3,000.00
```

The two audit rows both claim a `previousBalance` of 0.00, so the running
balance column in the customer ledger does not even chain to itself — the
second row's `previousBalance` does not equal the first row's `newBalance`.
There is no way to tell from the data which row was applied and which was lost,
and `previousBalance`/`newBalance` are precisely the columns an auditor would
use to prove the balance. (This also explains why the ledger GET routes
recompute and rewrite stored balances — already reported separately — which is
a symptom of this defect, not a fix for it: the recompute produces yet another
answer.)

Fix: perform the update atomically —
`prisma.customers.update({ where: { id }, data: { currentBalance: { increment: delta } } })` —
and take the resulting value back for the audit row, all inside a
`prisma.$transaction` that also writes the `CustomerTransaction`. Better still,
stop storing a mutable balance and derive it from the transaction rows, with a
periodically-checkpointed materialised value.

---

#### [HIGH] `calculateInvoicePaymentStatus` counts every payment carrying the invoice number regardless of direction, so a refund or a vendor payment can mark a customer invoice paid

`project/src/lib/utils.ts:981-1013`

```js
const totalPayments = await prisma.payment.aggregate({
  where: { invoice: invoiceNumber },       // no transactionType, no organizationId
  _sum: { amount: true }
});
```

Every other caller in the codebase filters by `transactionType: "INCOME"` for
customer money and `"EXPENSE"` for vendor money — `processPaymentWithAllocation`
does it at `:802-803` and `:866-867`, the `allocate` GET does it at `:151` and
`:185`, the invoices list does it at `:204` and `:249`. This function, which is
the one that actually decides the invoice's stored `status`, filters by
neither.

```
INV-7001, customer invoice, 6,000.00
  Payment #1  INCOME     4,000.00  invoice "INV-7001"
  Payment #2  ADJUSTMENT 2,500.00  invoice "INV-7001"
              (a refund/write-back keyed to the same invoice)

calculateInvoicePaymentStatus: totalPaid = 6,500.00 >= 6,000.00
  -> INV-7001 status "Paid", remainingAmount clamped to 0.00

Reality: 4,000.00 received, 2,500.00 refunded, 2,000.00 still owed.
```

The invoice drops off every outstanding-invoice screen — including
`GET /api/accounts/payments/allocate` (`:141`, `:175`) which only ever offers
`Unpaid`/`Partial` invoices for allocation — so the 2,000.00 becomes
uncollectable through the UI. Because `EXPENSE` rows count too, a vendor
payment that happens to carry a customer invoice number (the vendor invoice
number is derived from the customer one by
`generateVendorInvoiceNumber`, `lib/utils.ts:65`) settles the customer invoice.

The missing `organizationId` on the same query is a tenant-isolation issue of
the already-reported class, but it also changes the arithmetic: an identically
numbered invoice in another tenant contributes its payments to this tenant's
`totalPaid`.

Fix: filter by `transactionType` matching the invoice profile and by
`organizationId`, and pass the profile in rather than inferring it.

---

#### [HIGH] STEP 4 - transaction coverage table

Every in-scope handler that performs more than one write. "Atomic?" means all
of that handler's writes are inside one `prisma.$transaction`.

| Handler | Writes performed | Atomic? | What a mid-way failure leaves behind |
| --- | --- | --- | --- |
| `POST /api/journal-entries` | entry + N lines | **Yes** (`route.ts:163`) | Nothing. Clean. Entry-number allocation is outside, so it can fail before the tx opens, but nothing is written. |
| `PUT /api/journal-entries` (post) | 1 write | n/a | Single write. |
| `PUT /api/chart-of-accounts/[id]` | 1 write | n/a | Single write. |
| `POST /api/accounts/close-period` | entry + 1-2 lines | **Yes** (`:142`) | Nothing. Clean, though the entry itself may be unbalanced (see batch 2). |
| `POST /api/accounts/invoices` | 1 write | n/a | Single write — but it should be two (invoice + journal entry); see batch 2. |
| `PUT /api/accounts/invoices/[id]` | invoice, party balance, party transaction, journal entries, shipment | **No** | Invoice at the new amount; party balance, `CustomerTransaction`/`VendorTransaction`, GL and shipment at any mix of old and new. Errors are swallowed and `success: true` is returned. |
| `PUT /api/accounts/invoices/[id]/edit` | invoice, shipment, party balance, party transaction, journal entries | **No** | Same, plus `shipment.price`/`totalCost` overwritten while the GL is not. |
| `DELETE /api/accounts/invoices/[id]` | 1 delete | n/a | The single write is the problem: no reversal of the GL or the party balance. |
| `POST /api/accounts/payments` | payment, JE, 2 JE lines | **Partly** — the JE and its lines are in a tx (`:357`), the payment is not | JE fails ⇒ payment exists with no GL entry, **and the catch block creates a second payment** (batch 2). Payment succeeds, JE tx fails ⇒ cash movement with no ledger entry. |
| `POST /api/accounts/payments/process` (`enableAllocation: true`) | party balance, party transaction, 0-N invoice status updates, payment, invoice status, JE, 2 JE lines | **No** | See the failure ladder below. |
| `POST /api/accounts/payments/process` (`enableAllocation: false`) | party balance, party transaction, payment, JE + lines, invoice status | **No** | Same ladder, minus allocation. |
| `POST /api/accounts/payments/allocate` | N invoice status updates | **No** | Some invoices flipped to `Paid`, the rest not, no record of which — and none of them have a payment behind them anyway. |
| `POST /api/accounts/payments/bulk-import` | per row: payment, JE, 2 JE lines | **Per row: yes** (`:377`, with `P2002` retry). Across rows: no | Row 400 of 500: rows 1-399 committed, row 400 rolled back cleanly, rows 401-500 still attempted. Response is `success: true` with a per-row result list. No overall rollback and no way to re-run only the failures. |
| `POST /api/accounts/payments/vendor-excel` | per row: everything `processPaymentWithAllocation` does, then a separate JE tx | **No** | Row 400 of 500: rows 1-399 fully committed; row 400 can leave a committed payment + vendor balance change + invoice status change with **no journal entry**, and the response marks row 400 as `success: false`, so an operator re-runs it and pays the vendor twice. |
| `POST /api/accounts/payments/vendor-{apx,skynet}-auto-pay` | per invoice: payment, vendorTransaction, vendor balance, invoice status, JE + 2 lines | **Per invoice: yes** (`skynetVendorAutoPay.ts:248`, `{timeout: 60s}`) | Invoice 400 of 500: 1-399 committed, 400 rolled back. The best-behaved path in the module. |
| `POST/PUT /api/credit-notes`, `/api/debit-notes` | note + JE + 2 lines | **Yes** | Covered in batch 4. |
| `DELETE /api/credit-notes/[id]`, `/api/debit-notes/[id]` | lines + entry + note | **Yes** | Covered in batch 4. |

The failure ladder for `payments/process`, spelled out because it is the
highest-volume path in the module:

```
POST /api/accounts/payments/process  INV-E 4,000.00  CUSTOMER_PAYMENT

 1. addCustomerTransaction: Customers.currentBalance  += 4,000.00   [committed]
 2. addCustomerTransaction: CustomerTransaction row               [committed]
 3. allocateExcessPayment:  Invoice.status updates, 0..N           [committed]
 4. prisma.payment.create                                          [committed]
 5. createJournalEntryForPaymentProcess: JE + 2 lines              [own tx]
 6. prisma.invoice.update  status                                  [committed]

Fail at 5 (unique entryNumber collision — routine, see batch 1):
    customer credited 4,000.00, payment recorded, GL untouched.
    Cash in the payments module is 4,000.00 higher than cash in the ledger.
    The 500 tells the operator it failed; they retry; now it is 8,000.00.

Fail at 4 (any DB error):
    customer credited 4,000.00 with a CustomerTransaction row,
    but no payment exists, so every per-invoice recomputation says unpaid
    while the customer's balance says they paid.

Fail at 6:
    everything posted, invoice still shows "Unpaid", so it is offered
    for allocation again and gets paid a second time.
```

Fix: one `prisma.$transaction` per handler, spanning every write including the
journal entry, with the invoice row locked inside it. For the two bulk paths,
keep per-row transactions (correct granularity for an importer) but make the
row transaction cover the journal entry as well, record a per-row idempotency
key so a re-run cannot double-post, and report the true committed state per
row.

---

#### [HIGH] `vendor-excel` attaches every payment in the file to whichever vendor invoice happens to be the latest one before the payment date

`project/src/app/api/accounts/payments/vendor-excel/route.ts:248-307`,
`project/src/lib/accounts/vendorPaymentAccounts.ts:95-112`

`findLatestVendorInvoiceBeforePaymentDate` returns
`findFirst({ where: { vendorId, profile: "Vendor", invoiceDate: { lt: dayStart } }, orderBy: [{ invoiceDate: "desc" }, { id: "desc" }] })`.
It does not consider the invoice's status, its outstanding balance, or the
payment amount. Every row in the spreadsheet is applied to that one invoice.

```
Vendor SKYNET, invoices:
  INV-V1  dated 2025-03-01   40,000.00
  INV-V2  dated 2025-03-20   35,000.00

Excel file (a month of bank debits), all dated after 2025-03-20:
  22 Mar   5,000.00
  25 Mar   7,500.00
  28 Mar  12,000.00
  ... 15 more rows

Every row resolves to INV-V2 (the latest invoice before its date).

Row 1: remaining 35,000 -> payment 5,000 applied, fine
Row 2: remaining 27,500 -> payment 7,500 applied, fine
...
Row k: remaining 0 -> overpaymentAmount = full row amount
       -> allocateExcessPayment spreads it over other invoices
          by flipping their status only, no payments, no GL
Every Payment row carries invoice = "INV-V2".
calculateInvoicePaymentStatus("INV-V2") sums all of them:
  totalPaid = 150,000.00 against a 35,000.00 bill.
```

The vendor's total balance is right (each payment credits the vendor for its
own amount), but no invoice's paid figure is meaningful, the AP ageing is
fiction, and the `ALLOCATIONS:` strings that record where the excess supposedly
went are only ever read one-allocation-deep.

`reference` is also set to the invoice number for every row (`:279`), so all
20 payments share a reference. That defeats
`resolveCreditPaymentVoucherDate`'s reference matching (batch 1) and makes the
payments-list journal-entry lookup by reference (batch 2) return the same entry
for all of them.

Fix: require the spreadsheet to carry the invoice number (or a remittance
reference) per row and match on it; refuse rows that cannot be matched instead
of guessing; never apply more than the target invoice's remaining balance
without an explicit "post as credit on account" decision.

---

#### [HIGH] `vendor-excel`'s duplicate detection silently discards genuine second payments of the same amount on the same day

`project/src/app/api/accounts/payments/vendor-excel/route.ts:75-77, 193-204,
235-246`

The fingerprint is `\`${yyyy-MM-dd}|${Math.round(amount * 100)}\`` per vendor.
Any row matching an existing payment's date and amount is skipped — and
reported as `success: true, skipped: true`, which reads as "already handled"
rather than "not imported".

```
Vendor pays two of its own invoices on 2025-04-10, both 12,500.00
(identical round amounts are the norm for freight settlements).

Row 6:  2025-04-10  12,500.00  -> imported
Row 7:  2025-04-10  12,500.00  -> fingerprint already in the set -> SKIPPED

Result: 12,500.00 of a 25,000.00 bank debit is never recorded.
Vendor balance 12,500.00 too high, cash 12,500.00 too high,
and the import summary reports "imported: 1, skipped: 1, failed: 0".
```

The set is also seeded from *all* existing EXPENSE payments to that vendor
(`:193-199`), so re-importing a corrected file after fixing one row skips every
previously-imported row — which is the intended behaviour — while also skipping
any legitimately repeated amount. The fingerprint uses `Math.round(amount*100)`,
which is the only correct cent-normalisation in the module, but it is applied
to the wrong problem.

Fix: deduplicate on a stable per-row identity (bank reference / remittance id,
or a hash of the whole row including its position in the file) recorded on the
`Payment` row, not on a date+amount pair, and report skips as warnings that
require confirmation.

---

#### [HIGH] `bulk-import` has no duplicate detection whatsoever, so re-uploading a file posts every row again

`project/src/app/api/accounts/payments/bulk-import/route.ts:341-464`

Unlike `vendor-excel`, this handler carries no fingerprint set and no
idempotency key. Each row unconditionally creates a `Payment` plus a posted
journal entry. Because rows commit individually (`:377`), a file that fails
halfway leaves a partial import with no marker of where it stopped — and the
natural operator response is to upload the file again.

```
500-row file, 3,850,000.00 total. Row 400 fails (unresolvable category).
  Rows 1-399  : imported, 3,100,000.00 posted to the GL
  Row 400     : failed
  Rows 401-500: still processed and imported

Operator fixes the category cell and re-uploads the same file:
  Rows 1-399  : imported AGAIN
  Row 400     : imported
  Rows 401-500: imported AGAIN

GL now contains 3,850,000.00 + 3,100,000.00 + 750,000.00 of double postings.
Every affected expense and revenue account is roughly doubled for the period,
and there is nothing on the rows to distinguish the copies.
```

Fix: require an import batch id, store it on both `Payment` and `JournalEntry`,
make `(organizationId, importBatchId, rowNumber)` unique, and skip rows already
present in that batch. Offer a "re-run failures only" mode.

---

#### [MEDIUM] Excel date parsing prefers `dd/MM/yyyy`, so US-formatted spreadsheets are silently misdated into the wrong month or period

`project/src/app/api/accounts/payments/bulk-import/route.ts:76-86`,
`project/src/app/api/accounts/payments/vendor-excel/route.ts:52-62`

Both format lists try `dd/MM/yyyy` before `MM/dd/yyyy`, and `date-fns` `parse`
succeeds on the first that is valid.

```
Cell "03/04/2025" meaning 4 March 2025 (US export)
  -> parsed as 3 April 2025
  -> payment lands in April, not March
  -> March cash flow understated, April overstated
  -> if March has been "closed", the closing entry is now wrong and,
     per the STEP 5 finding, nothing stopped the posting

Cell "13/04/2025" -> dd/MM succeeds -> 13 April  (correct for a EU sheet)
```

Any day ≤ 12 is ambiguous and resolves the same wrong way every time, so
roughly 40% of a US-formatted file is misdated while the rest is correct —
which is far harder to notice than a wholesale failure. The final
`new Date(s)` fallback at `:92`/`:69` is worse still: it applies JavaScript's
own locale-independent-but-US-leaning parsing to anything the format list
rejected.

Also, the Excel serial branch (`bulk-import:69-73`, `vendor-excel:45-49`) does
`Math.floor(value - 25569)` then multiplies by 86,400,000, discarding the time
fraction and interpreting the result as UTC. Combined with the local-time
`setHours` in `findLatestVendorInvoiceBeforePaymentDate` (batch 1), a payment
can be assigned to the wrong day and therefore the wrong invoice.

Fix: require an explicit date format selection on the upload form (or detect it
from the whole column by finding a value with a day > 12), reject ambiguous
files rather than guessing, and drop the bare `new Date(s)` fallback.

---

#### [MEDIUM] The auto-pay paths generate journal entry numbers from a microsecond timestamp, permanently destroying the sequential numbering the rest of the system relies on

`project/src/lib/accounts/skynetVendorAutoPay.ts:57-79, 246`

```js
const tsBase = Date.now() * 1000;
return Math.max(maxExisting, tsBase) + 1;
...
const entryNumber = `JE-${nextJENum + bump}`;      // no padStart
```

Entry numbers from this path look like `JE-1785312000000001`. Three
consequences:

1. The column now holds two incompatible formats — `JE-0007` from every other
   path and `JE-1785312000000001` from this one. Because
   `nextJournalEntryNumber` (`lib/tenant/orgJournalChart.ts:9-12`) picks the
   maximum **lexicographically**, one auto-pay run on a tenant whose entries
   are still `JE-0xxx` makes `JE-17853...` the new maximum, so every subsequent
   entry from every other path also jumps into timestamp space and the tenant's
   numbering never returns. A tenant that has already passed `JE-1000` gets the
   opposite: `JE-9999` still sorts above `JE-17853...`, so the two schemes
   interleave permanently.
2. Journal entry numbers are an audit control; they are expected to be
   sequential and gapless per entity so that a missing entry is detectable.
   After one auto-pay run the sequence contains a gap of ~1.7 quadrillion and
   is no longer evidence of anything.
3. `getJournalEntryBase` queries `JournalEntry` with **no `organizationId`
   filter** (`:61-65`), so the base is taken from the largest number across all
   tenants. (Isolation aspect is the already-reported class; the numbering
   consequence is that one tenant's auto-pay run moves every other tenant's
   numbering.)

A near-identical dead function exists at
`project/src/app/api/accounts/payments/bulk-import/route.ts:187-206`
(`getNextJournalEntrySeq`), also unscoped, also using `MAX` over the whole
table. It is never called — `:327` uses `nextJournalEntryNumber` instead — but
it should be deleted before someone wires it up.

Fix: one shared, per-tenant, transactional counter (see the batch 1 fix), used
by every path, with the display string formatted from the integer at render
time.

---

#### [MEDIUM] The auto-pay loop computes the vendor balance from a snapshot taken before the loop starts

`project/src/lib/accounts/skynetVendorAutoPay.ts:190-196, 215-216, 239-240,
356-357`

`runningVendorBalance` is seeded from `vendor.currentBalance` once (`:196`) and
carried in memory across every invoice, and `paidByInvoice` is likewise loaded
once before the loop (`:190-193`). Each per-invoice transaction writes
`previousBalance`/`newBalance` from that in-memory chain and sets
`currentBalance` to an absolute value (`:285-288`).

A 500-invoice run takes minutes. Any other write to that vendor during the run
— a manual payment, an invoice posting, a second auto-pay run — is overwritten
by the next iteration's absolute `currentBalance` write.

```
Auto-pay starts, vendor.currentBalance = 500,000.00
  invoice 1 pays 10,000.00 -> writes 490,000.00
  [operator posts a new 25,000.00 vendor bill: balance -> 515,000.00]
  invoice 2 pays 10,000.00 -> writes 480,000.00   <- the 25,000.00 is gone
```

The `VendorTransaction` chain written by the run also disagrees with the bill's
own transaction row, so the vendor ledger cannot be reconstructed.

Everything else about this path is the strongest code in the module and worth
saying so explicitly: the payment, the vendor transaction, the balance update,
the invoice status and the journal entry with its lines are all in **one**
transaction (`:248-328`), the lines are created as a nested write under the
entry so they cannot be orphaned, `remaining` is rounded to cents
(`:216`) — the only correct cent-rounding on a posting path in the module — and
the unique-violation retry (`:333-335`) is a reasonable mitigation for the
numbering race.

Two smaller defects at the same site: the payment is dated from the shipment or
invoice date (`:230-232`), so a run posts cash movements into arbitrarily old
periods (see STEP 5 — nothing stops it); and the recovery branch at `:337-348`
treats "invoice is now Paid" as proof that this transaction committed, when
another concurrent process could have marked it Paid — the comment there refers
to Postgres, but the datasource is MySQL.

Fix: re-read the vendor balance inside each per-invoice transaction and update
it with `{ decrement: remaining }` rather than an absolute value; re-read the
invoice's paid total inside the transaction too.

---

#### [MEDIUM] `POST /api/accounts/payments/allocate` allocates against a balance that ignores prior allocations, and writes nothing but status flags

`project/src/app/api/accounts/payments/allocate/route.ts:80-90`,
`project/src/lib/utils.ts:663-689`

The manual allocation endpoint hands `excessAmount` straight to
`allocateExcessPayment`, which — as established above — records nothing but
`Invoice.status`. Two additional defects specific to this endpoint:

- `excessAmount` is taken from the request body and validated only as `> 0`
  (`:71-78`). Nothing checks it against the originating payment; in fact the
  payment is never loaded. A caller can allocate 1,000,000.00 of "excess" from
  a 500.00 payment and mark a year of invoices `Paid`.
- The per-invoice remaining used inside the loop comes from
  `paymentTotalsByInvoiceForAllocation`, i.e. from `Payment` rows only. Since
  allocation never creates payment rows, allocating twice against the same
  invoice sees the same `alreadyPaid` both times and both allocations
  "succeed":

```
INV-F 3,000.00, nothing paid.
allocate 3,000.00 -> alreadyPaid 0 -> allocationAmount 3,000.00 -> "Paid"
allocate 3,000.00 -> alreadyPaid 0 (still no payment rows!) -> "Paid" again
Total allocated 6,000.00 against a 3,000.00 invoice, zero payments recorded.
```

The matching GET (`:110-207`) computes `remainingAmount` from INCOME/EXPENSE
payment sums only and filters to `remainingAmount > 0` (`:200-202`), so it
happily re-offers an invoice that a previous allocation already marked `Paid`.

Fix: load the payment, cap the allocation at
`payment.amount - SUM(existing allocations)`, and write real allocation rows
inside a transaction — the same fix as STEP 3.

---

#### [LOW] `processPaymentWithAllocation` computes `amountForInvoice` and never uses it

`project/src/lib/utils.ts:813, 877`

`const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);` is
computed in both branches and then discarded — the party transaction is written
for the full `paymentAmountNum` (`:849`, `:911`). The non-allocation branch of
`payments/process/route.ts:119-146` *does* use the split, writing
`amountForInvoice` and a separate overpayment credit. So the two branches of
the same endpoint record a 5,000.00 payment on a 2,000.00 invoice as either one
5,000.00 customer credit or two credits of 2,000.00 and 3,000.00, depending on
the `enableAllocation` flag (which defaults to `true`, `route.ts:31`). The
customer's ledger shows a different number of rows for the same event depending
on a request flag. Fix: pick one representation — preferably the split one,
with the overpayment posted to a "Customer Advances" liability account rather
than sitting inside AR.

---

#### [LOW] `parseAmount` in `bulk-import` is the correct pattern and should be the template for the rest of the module

`project/src/app/api/accounts/payments/bulk-import/route.ts:98-106, 262-265`

Stated as a clean result: this is the only money parser in the audited surface
that gets it right — it accepts a real number, strips separators from a string,
requires `Number.isFinite`, and the caller rejects `amount <= 0` before any
write. Compare `parseFloat(x) || 0` in the invoice routes (batch 1) and
`Number(body.amount)` with no check in `payments/route.ts`. The only gap is
that it strips both `,` and space without knowing the locale, so `1.234,56`
becomes `1.23456` — the same defect noted for `vendor-excel:116`.


### Batch 4 - credit-notes (list + [id]), debit-notes (list + [id]), customer/vendor transaction ledgers, fixed-charges

---

#### [CRITICAL] STEP 5 - credit notes and debit notes post the general-ledger entry of the transaction they are supposed to reverse

`project/src/app/api/credit-notes/route.ts:322-323` and `:441-442`,
`project/src/app/api/debit-notes/route.ts:300-301`

When the caller does not supply explicit accounts (`useProvidedAccounts` is
false), the default postings are:

| Document | What it means | What the code posts | What it should post |
| --- | --- | --- | --- |
| Credit note, `type: "CREDIT"` | reduce a customer receivable | **debit Cash, credit Revenue** (`credit-notes:322-323`) | debit Revenue / Sales Returns, credit Accounts Receivable |
| Credit note, `type: "DEBIT"` | increase a customer receivable | **debit Expense, credit Cash** (`credit-notes:441-442`) | debit Accounts Receivable, credit Revenue |
| Debit note, `type: "DEBIT"` | reclaim value from a vendor | **debit Vendor Expense, credit Cash** (`debit-notes:300-301`) | debit Accounts Payable, credit Expense |

Every one of them is the entry for the *opposite* event. Answering STEP 5
directly: **no, credit and debit notes do not produce correct reversing
entries — they produce reinforcing ones.**

```
Customer ACME was over-billed 50,000.00 on INV-8001. A credit note is issued.

POST /api/credit-notes  { type: "CREDIT", amount: 50000, customerId, invoiceNumber }

GL written:
    debit  Cash      50,000.00
    credit Revenue   50,000.00

Effect: revenue is 50,000.00 HIGHER after issuing a credit note that exists
        to reduce revenue by 50,000.00.
        Cash is 50,000.00 higher with no money received.
        Accounts Receivable is untouched, so the receivable the note was
        meant to cancel is still on the books in full.
Net error on the P&L: 100,000.00 in the wrong direction.
```

Compounding this, each note also creates a **`Payment` row**
(`credit-notes:287-302`, `:406-421`, `debit-notes:264-280`) with
`mode: "CASH"` and `transactionType: "INCOME"`/`"EXPENSE"`. Nothing was
received or paid. That row then flows into the cash-flow panel
(`accounts/company/stats` counts `mode: CASH, transactionType: INCOME` as cash
inflow) and into the payments list total. A month with 200,000.00 of credit
notes reports 200,000.00 of phantom cash receipts.

And the payment's `invoice` field is written as the *prefixed* string
`` `Invoice ${invoiceNumber}` `` (`credit-notes:299, :418`) or
`` `Bill ${billId}` `` (`debit-notes:277`), while every other writer and every
reader in the system uses the bare invoice number. So the note's payment row
matches no invoice aggregate anywhere: **a credit note does not reduce the
outstanding balance of the invoice it names.** The customer still owes the full
amount on every screen that computes remaining balance from payments.

Fix: post the correct double entry for each document type against AR/AP and a
Sales Returns / Purchase Returns account; do not create a `Payment` row for a
non-cash document (or give it its own `transactionType` that the cash reports
exclude); write the invoice key in the same format as everyone else; and link
the note to the invoice's outstanding balance so it actually reduces it.

---

#### [CRITICAL] STEP 2 verdict - nothing enforces sum(debits) == sum(credits), and there are three live paths that post an unbalanced entry

Answering STEP 2 as a whole.

**Database constraint: none.** MySQL, `relationMode = "prisma"`
(`schema.prisma:5-9`). No `CHECK` constraints are declared anywhere in the
schema, no triggers exist, and `JournalEntry.totalDebit`/`totalCredit`
(`:551-552`) are two independent `DOUBLE` columns with no relationship to the
`JournalEntryLine` rows.

**Validation function: none.** There is no shared `validateJournalEntry`,
`assertBalanced`, or equivalent anywhere in `project/src`. Grep-verified.

**Check before create: exactly one, at one of nine write paths.**
`POST /api/journal-entries:114` compares the two client-supplied totals with a
0.01 tolerance. The other eight paths that create journal entries
(`payments/route.ts:344`, `createJournalEntryForPaymentProcess`,
`createJournalEntryForTransaction` in `lib/utils.ts:1016`,
`credit-notes:306`, `credit-notes:425`, `debit-notes:284`, `debit-notes:401`,
`bulk-import:396`, `close-period:143`, `skynetVendorAutoPay:295`) each
construct their lines by hand and write `totalDebit`/`totalCredit` from an
input value. Most are balanced by construction — they emit one debit line and
one credit line of the same figure — but "balanced by construction" is not
enforcement, and three paths break it:

**Path 1 — `close-period` with no revenue or no expense accounts**
(`close-period/route.ts:150-152, 182, 214`):

```
Tenant has posted revenue through accounts that were later deleted, so
chartOfAccount.findMany({ category: "Revenue" }) returns [].
netIncome computes as +40,000.00 from the surviving lines.

JournalEntry written: totalDebit 40,000.00, totalCredit 40,000.00,
                      isPosted: true
Lines written:        credit Current Year Earnings 40,000.00
                      (the `if (revenueAccounts.length > 0)` guard skips
                       the offsetting debit line entirely)

SUM(debitAmount) = 0.00
SUM(creditAmount) = 40,000.00
Trial balance out by 40,000.00, permanently, in a posted entry whose own
header claims to be balanced.
```

**Path 2 — `PUT /api/credit-notes/[id]` (and `/api/debit-notes/[id]`) after an
amount is set to zero** (`credit-notes/[id]/route.ts:150, 253-265`;
`debit-notes/[id]/route.ts:251-263`):

The line rewrite decides each line's direction from its *current* value:

```js
const isDebit = Number(line.debitAmount) > 0;
... debitAmount: isDebit ? newAmount : 0,
    creditAmount: isDebit ? 0 : newAmount,
```

`newAmount` is validated only as `>= 0` (`:150`), so zero is allowed.

```
Credit note #CR0042, 8,000.00.  Lines: L1 debit 8,000 / L2 credit 8,000

PUT { amount: 0 }
  L1: isDebit = 8000 > 0 = true  -> debit 0, credit 0
  L2: isDebit = 0 > 0    = false -> debit 0, credit 0
  header: totalDebit 0, totalCredit 0          (still balanced)

PUT { amount: 8000 }   (the user undoes their mistake)
  L1: isDebit = 0 > 0 = false -> debit 0,     credit 8,000.00
  L2: isDebit = 0 > 0 = false -> debit 0,     credit 8,000.00
  header: totalDebit 8,000.00, totalCredit 8,000.00

SUM(debitAmount)  = 0.00
SUM(creditAmount) = 16,000.00
A posted entry with zero debits and 16,000.00 of credits, whose header
says 8,000.00 / 8,000.00.
```

**Path 3 — string amounts through `POST /api/journal-entries`** — the header
totals diverge from the lines by string concatenation; documented in batch 1.

**Can `JournalEntryLine` rows exist without their parent? Yes.** There is no
foreign key (`relationMode = "prisma"`), so a `journalEntryLine.create` with an
arbitrary `journalEntryId` succeeds, and every path except
`skynetVendorAutoPay:306-323` creates lines by raw id rather than as a nested
write under the parent. Documented in batch 1.

**Does deleting an entry orphan its lines? It depends on how it is deleted.**
`prisma.journalEntry.delete()` triggers Prisma's emulated cascade. But the
delete paths in this module do it manually and out of order in places, and
`saas/organizations/[id]/route.ts:221` calls
`tx.journalEntry.deleteMany({ where: { organizationId } })` **without deleting
the lines first** — with no database cascade, every line of every entry in that
organisation is orphaned, keeping its amounts and its `accountId`. Any
account-balance query that sums `JournalEntryLine` by `accountId` (the natural
query) still counts them forever.

The credit/debit-note delete paths do it correctly — lines first, then entries
(`credit-notes/[id]:334-350`, `debit-notes/[id]:331-338`) — and inside a
transaction. Worth stating as clean.

Fix: a single `postJournalEntry(tx, { date, description, lines })` helper that
every path must use, which coerces the amounts, requires exact
`sum(debits) === sum(credits)` on `Decimal` values, requires at least two
lines, requires each line to have exactly one non-zero side, derives the header
totals from the lines, and creates the lines as a nested write. Back it with a
`CHECK` constraint on `JournalEntry` (`totalDebit = totalCredit`) and a
scheduled reconciliation job that reports any entry whose lines do not sum to
its header.

---

#### [HIGH] Editing a starting balance does not move the party's stored balance, and a CREDIT starting balance never reaches the general ledger

`project/src/app/api/accounts/transactions/customer/[id]/route.ts:1491-1566`,
`project/src/app/api/accounts/transactions/vendor/[id]/route.ts:1243-1309`

The "existing starting balance" branch updates the `CustomerTransaction` /
`VendorTransaction` row, deletes and recreates the journal entry, and returns
`success: true` — but it never calls `addCustomerTransaction` /
`addVendorTransaction` and never touches `Customers.currentBalance` /
`Vendors.currentBalance`.

```
Customer ACME, opening balance recorded as DEBIT 100,000.00 (they owe us).
  Customers.currentBalance = -100,000.00
  CustomerTransaction #1: STARTING-BALANCE, DEBIT 100,000.00,
                          previousBalance 0, newBalance -100,000.00

Correction: the opening balance was really 60,000.00.
POST with reference "STARTING-BALANCE-CUST-12", type DEBIT, amount 60000

  CustomerTransaction #1 -> amount 60,000.00, newBalance -60,000.00
  journal entry deleted and re-created at 60,000.00
  Customers.currentBalance -> UNCHANGED at -100,000.00

The ledger detail says 60,000.00, the GL says 60,000.00,
the customer's stored balance says 100,000.00, and the credit-limit
check, the dashboard AR figure and every list view read the stored balance.
```

The stored balance only self-corrects when someone happens to open the ledger
GET, which recomputes and rewrites it (the already-reported "GET rewrites
stored balances" behaviour). Until then the three stores disagree.

Second defect at the same site: the journal entry is created **only for
`type === 'DEBIT'`** (`customer:1538, 1605`; `vendor:1281`), with the comment
"skip for CREDIT as it's not needed". A customer or vendor whose opening
position is a credit balance therefore has an opening subledger balance with no
general-ledger counterpart at all, so the AR/AP control account is short by the
total of every credit-side opening balance in the system from day one.

Third: the delete-then-recreate of the journal entry (`customer:1507-1521`,
`vendor:1250-1264`) runs on `prisma` directly, outside any transaction, in a
loop. A failure between the delete and the recreate leaves the opening entry
gone with nothing in its place. Deleting rather than reversing also silently
rewrites prior periods.

Fix: route the correction through the same atomic balance helper as every other
movement, post an adjusting entry rather than deleting the original, and create
the opening journal entry for both directions.

---

#### [MEDIUM] The note edit handlers adjust the party balance based on the type of whatever transaction row shares the note's reference, and skip the adjustment entirely when no such row is found

`project/src/app/api/credit-notes/[id]/route.ts:186-211`,
`project/src/app/api/debit-notes/[id]/route.ts:184-209`

The direction of the balance correction comes from `txn?.type`, where `txn` is
`findFirst({ where: { reference: note.creditNoteNumber, customerId } })`. Two
failure modes:

1. **No matching row** — if the transaction was deleted, or its reference was
   edited, or it was written by a path that used a different reference, `txn`
   is `null`, so **neither** `if` branch runs. The note amount, the payment,
   the journal entry and its lines are all updated to the new figure while the
   party balance keeps the old one. The response is a normal 200.

```
Credit note #CR0007 for 30,000.00 edited to 12,000.00, txn row missing:
  note        -> 12,000.00
  payment     -> 12,000.00
  GL entry    -> 12,000.00 / 12,000.00
  customer balance -> still reflects 30,000.00
  divergence: 18,000.00, silent
```

2. **Wrong row matched** — references are not unique and are frequently
   shared. If the `findFirst` returns a different transaction whose `type` is
   the opposite of the note's, the correction is applied with the wrong sign
   and the balance moves by `2 × amountDelta` in the wrong direction.

The balance is also updated by reading `cust.currentBalance` and writing an
absolute value (`:200-208`). Although this one *is* inside a
`prisma.$transaction`, a plain read under MySQL's default REPEATABLE READ takes
no lock, so two concurrent edits still lose one update — the same defect as
`addCustomerTransaction` (batch 3), just harder to hit.

Fix: derive the direction from the note's own type, not from a looked-up row;
fail the request if the linked transaction cannot be found rather than
silently skipping; adjust with `{ increment: delta }`.

---

#### [MEDIUM] Notes are matched to their journal entries and payments by reference substring, and deleted rather than reversed

`project/src/app/api/credit-notes/[id]/route.ts:231-239, 322-365`,
`project/src/app/api/debit-notes/[id]/route.ts:229-237, 318-338`

Both the edit and delete handlers locate the ledger rows with:

```js
where: { OR: [ { reference: noteNumber },
               { description: { contains: noteNumber } } ] }
```

`contains` is an unanchored substring match on a reference of the form
`#CR0001` (`lib/noteFormats.ts:2-4`). While numbers stay four digits this is
safe, but the padding is `padStart(4, "0")` — at sequence 10,000 the references
become `#CR10000`, and `#CR1000` is a substring of `#CR10000`. Deleting note
`#CR1000` then deletes the journal entry belonging to `#CR10000`. The
`payment.deleteMany({ where: { reference: noteNumber } })` at
`credit-notes/[id]:353-355` is an exact match and is safe, but it deletes
*every* payment carrying that reference, including a genuine customer payment
that happened to be entered with the note's number as its reference.

More fundamentally, `DELETE` removes the journal entry and its lines
(`:335-350`) instead of posting a reversing entry. Combined with the total
absence of period locking, deleting a note dated in a signed-off month silently
changes that month's revenue, its closing entry's basis, and the figures
already reported — with no record that anything was removed. The entry number
is also freed in a way the numbering scheme cannot reuse, leaving a permanent
unexplained gap in the sequence.

Both delete handlers do get the mechanics right, and that is worth recording:
lines are deleted before entries, and the whole delete runs in one
`prisma.$transaction`.

Fix: match on a stored `journalEntryId` / `paymentId` foreign key rather than
on text; anchor any residual text matching; and replace physical deletion with
a reversing entry dated in the current open period plus a `voided` flag on the
note.

---

#### [MEDIUM] The credit-note create path does not validate the amount, and only one of its two branches takes the absolute value

`project/src/app/api/credit-notes/route.ts:201, 263, 313-314` vs `:411, 432-433`

The `type: "DEBIT"` branch consistently wraps the figure in
`Math.abs(parseFloat(amount))` (`:411, 432, 433, 449, 462`). The
`type: "CREDIT"` branch uses bare `parseFloat(amount)` everywhere
(`:263, 292, 313, 314, 330, 343`). The only guard is `!amount` at `:201`, which
rejects `0`, `""` and `undefined` but happily passes `-5000` and `"abc"`.

```
POST /api/credit-notes { type: "CREDIT", amount: -5000, ... }
  CreditNote.amount        -5,000.00
  Payment.amount           -5,000.00   (a negative INCOME payment)
  JournalEntry.totalDebit  -5,000.00
  lines: debit -5,000.00 / credit -5,000.00

The entry "balances" (-5000 == -5000), passes every check in the system,
and silently reverses the direction of the posting. The negative Payment
also subtracts from the cash-inflow aggregate in company/stats.

amount: "abc" -> parseFloat -> NaN -> NaN written to five DOUBLE columns
     -> every SUM() over those accounts becomes NaN
```

Fix: one validated parse at the top of the handler —
`const amt = Number(amount); if (!Number.isFinite(amt) || amt <= 0) return 400;`
— used by both branches.

---

#### [MEDIUM] `PUT /api/fixed-charges` cannot set a charge or a weight to zero

`project/src/app/api/fixed-charges/route.ts:94-95`

```js
weight:      weight      ? parseFloat(weight)      : undefined,
fixedCharge: fixedCharge ? parseFloat(fixedCharge) : undefined,
```

`0` is falsy, so `undefined` is passed and Prisma leaves the column unchanged.
An operator zeroing a fixed charge that should no longer apply gets a
`success: true` response and a row that still carries the old value; every
shipment priced afterwards keeps picking up the charge. The same expression
also converts an unparseable value to `undefined` rather than rejecting it, so
a typo is silently a no-op — and `"0.00"` is truthy, so whether zeroing works
depends on whether the client sends a number or a string.

`FixedCharge.weight` is a `Float` (`schema.prisma:579`) and the GET matches it
with exact equality (`:20`), so a lookup for a weight the operator believes is
stored — but which is `2.2999999999999998` in the column — returns nothing and
the charge silently becomes 0.00 for that shipment.

Fix: test `!== undefined` rather than truthiness, reject non-finite values, and
select the charge by weight *band* (`weight <= x` ordered descending) rather
than by float equality.

---

#### [LOW] Customer and vendor balances use opposite sign conventions with nothing in the schema recording which is which

`project/src/lib/utils.ts:111-113` vs `:167-169`,
`project/src/app/api/accounts/transactions/customer/[id]/route.ts:1533` vs
`project/src/app/api/accounts/transactions/vendor/[id]/route.ts:1276`

For a customer, `CREDIT` **increases** `currentBalance` and `DEBIT` decreases
it, so a customer who owes money carries a *negative* balance. For a vendor,
`DEBIT` **increases** `currentBalance`, so a vendor who is owed money carries a
*positive* balance. Both are internally consistent, but they are inverses of
each other, and the convention is recorded only in a comment
(`lib/utils.ts:164-166`).

The starting-balance handlers duplicate the rule by hand and correctly invert
it between the two files (`customer:1533` writes
`type === 'DEBIT' ? -amount : amount`, `vendor:1276` writes
`type === 'DEBIT' ? amount : -amount`). Every future dashboard, report or
export that treats "party balance" uniformly will get one of the two backwards,
and the mistake produces a plausible-looking number rather than an obvious one.

Fix: adopt one signed convention (positive = they owe us) for both, or make the
sign explicit in the schema with separate `receivable`/`payable` semantics, and
delete the hand-rolled duplicates in favour of the shared helper.

---

#### [LOW] Dead code that recomputes balances and then discards the result

`project/src/app/api/accounts/transactions/customer/[id]/route.ts:1554-1559`,
`project/src/app/api/accounts/transactions/vendor/[id]/route.ts:1297-1302`

```js
const allTransactions = await prisma.customerTransaction.findMany({ ... });
// Recalculate balances (this will be done on next GET request)
// For now, just return success
```

The query runs on every starting-balance edit, loads the party's entire
transaction history, and the result is never read. Beyond the wasted query, the
comment documents the design decision behind the already-reported "GET rewrites
stored balances" behaviour: the write path knowingly leaves the stored balance
wrong and relies on a read to fix it. That is why the divergence described in
the HIGH finding above persists. Fix: delete the query and correct the balance
on the write path.

---

### Summary of step verdicts

| Step | Verdict |
| --- | --- |
| 1. Money representation | **Fails.** 40+ monetary columns, every one `Float`/`DOUBLE`; zero `Decimal` columns; `Rate.price` is an inconsistent `Int`. Representation changes mid-calculation at every boundary, with `parseFloat(x) \|\| 0` silently turning bad input into zero. |
| 2. Double-entry integrity | **Fails.** No DB constraint, no validation function, one check at one of nine write paths. Three live paths post unbalanced entries; lines have no foreign key and can be orphaned. |
| 3. Allocation / over-application | **Fails.** Over-application is reachable deterministically without concurrency (allocation writes only status flags), and concurrently there is no transaction, no row lock and no constraint — all three absent. |
| 4. Transaction coverage | **Mostly fails.** 5 of 15 multi-write handlers are atomic. `journal-entries`, `close-period`, the notes routes, `bulk-import` (per row) and the auto-pay paths (per invoice) are correct; the invoice edit/delete paths, `payments`, `payments/process`, `allocate` and `vendor-excel` are not. |
| 5. Period close and reversal | **Fails.** No period-lock mechanism exists at all, so entries post freely into closed periods. Invoice edits mutate prior-period journal entries in place. Credit and debit notes post the entry of the event they are meant to reverse, create phantom cash payments, and never reduce the invoice they name. Notes and starting balances are deleted rather than reversed. |
| Clean results worth recording | `POST /api/journal-entries` is the only endpoint with a real balance check, and it also correctly rejects single-line entries, lines with neither amount and lines with both. `DELETE /api/chart-of-accounts/[id]` correctly refuses to delete an account that has journal lines. `POST /api/accounts/payments` correctly rejects equal debit/credit accounts. `bulk-import`'s `parseAmount` is the only correct money parser. The auto-pay path (`skynetVendorAutoPay`) is fully atomic per invoice, uses a nested line write, and is the only posting path that rounds to cents. Both note delete handlers order their deletes correctly inside a transaction. `parseDateInputAsLocalDate` sensibly anchors date-only input at local noon to survive timezone shifts. |


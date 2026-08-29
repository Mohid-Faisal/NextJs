# Migrations

## History / why there is a `0_init` baseline

The original `prisma/migrations` history was written for **PostgreSQL**, but the
live database is **MySQL** (`datasource db { provider = "mysql" }`). Those
Postgres migrations could never be applied by `prisma migrate deploy` and have
been archived to `prisma/migrations-legacy-postgres/` (kept for reference only).

Recent schema work (`AuthSession`, `AuditLog`, `OrgSequence`, per-org unique
constraints) was applied to the live DB via hand-written SQL in
`prisma/manual-migrations/`. Those files are also kept for reference; their
contents are now captured by the `0_init` baseline below.

The migration history was re-baselined on 2026-08-29:

- `0_init` — full schema as it existed in production **before** the
  payment-allocation work (includes AuthSession/AuditLog/OrgSequence and the
  per-org uniques from the manual migrations).
- `20260829000000_payment_allocations_and_integrity` — `PaymentAllocation` table and financial indexes.
- `20260829150000_drop_organizationid_defaults` — drops silent `organizationId DEFAULT 1` on tenant tables.
- `20260829180000_decimal_money_and_payment_reference_unique` — money columns as `DECIMAL(19,4)`, unique payment references per org. The Prisma schema uses the `Decimal` scalar; `src/lib/prisma.ts` hydrates values to JS numbers and `scripts/patch-prisma-decimal-types.js` (run after `prisma generate`) keeps TypeScript in sync.

## One-time baseline step for EXISTING databases (prod/staging)

An existing database already contains everything in `0_init`, so mark it as
applied **without running it**:

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate deploy   # applies 20260829000000_... and future migrations
```

## Fresh databases (dev/CI)

```bash
npx prisma migrate deploy   # runs 0_init + everything after it
```

Note: `0_init` contains only DDL. The seeding INSERTs from
`manual-migrations/2026-08-23-audit-log-and-sequences.sql` (OrgSequence
seeding from legacy data) are only relevant for databases that already had
journal entries; fresh databases don't need them (the code self-seeds).

## Going forward

- Never write SQL directly against prod. Change `schema.prisma`, then
  `npx prisma migrate dev --name <change>` locally and commit the migration.
- Deploys must run `npm run db:migrate` (`prisma migrate deploy`) before or
  during release.

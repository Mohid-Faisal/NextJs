# Operational Scripts Guide

This directory contains maintenance, migration, diagnostic, and data-repair scripts.

## Safety Guidelines

- **Dry-Run by Default**: Data mutation scripts default to a read-only dry-run. Pass `--apply` to actually execute database writes.
- **Production Execution**: Always run dry-run first in staging/development and verify log output before executing `--apply` on production databases.

## Script Catalog

| Script | Purpose | Safety / Flags |
|---|---|---|
| `backfill-payment-allocations.ts` | Parses historical multi-invoice payment descriptions into `PaymentAllocation` records | Defaults to dry-run. Pass `--apply` to persist. |
| `migrate-to-default-org.ts` | Multi-tenant migration helper for assigning legacy rows to default organization | Run once during initial tenant migration. |
| `repair-isolation.ts` | Audits and associates orphaned rows to their matching organization | Safe verification tool. |
| `diagnose-faree.ts` | Diagnostic script for verifying ledger and balance calculations | Read-only. |
| `seed-pricing-plans.ts` | Seeds tier pricing plans (Free, Starter, Pro, Enterprise) | Idempotent upsert. |
| `seed-demo-account.ts` | Creates sandboxed demo account data | Safe demo seeder. |

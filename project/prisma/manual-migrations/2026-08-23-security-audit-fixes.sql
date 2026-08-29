-- =============================================================================
-- Migration: security-audit-fixes-01
-- Companion to prisma/schema.prisma changes on branch security-audit-fixes.
--
-- Apply with:  npx prisma migrate dev --name security_audit_fixes_01
--   (or generate SQL only, without touching the DB:)
--   npx prisma migrate diff --from-migrations ./prisma/migrations \
--     --to-schema-datamodel ./prisma/schema.prisma --script
--
-- Summary of changes:
--   1. Invoice/Shipment invoiceNumber uniqueness moves from GLOBAL
--      (@unique) to PER-ORGANIZATION (@@unique([organizationId, ...])).
--      This prevents cross-tenant invoice-number enumeration via
--      duplicate-key errors and cross-tenant numbering collisions.
--   2. organizationId columns added to DebitNote, CreditNote and
--      JournalEntryLine (nullable + backfilled) so tenant isolation no
--      longer depends solely on join-through queries.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Per-organization invoice number uniqueness
-- -----------------------------------------------------------------------------

-- Drop the old global unique indexes (exact index names may differ in your
-- database — inspect with SHOW INDEX FROM invoices / shipments first).
ALTER TABLE `Invoice` DROP INDEX `Invoice_invoiceNumber_key`;
ALTER TABLE `Shipment` DROP INDEX `Shipment_invoiceNumber_key`;

-- Add per-org unique indexes. MySQL permits multiple NULLs in a unique
-- index, so nullable shipment invoice numbers remain safe.
CREATE UNIQUE INDEX `Invoice_organizationId_invoiceNumber_key`
  ON `Invoice` (`organizationId`, `invoiceNumber`);

CREATE UNIQUE INDEX `Shipment_organizationId_invoiceNumber_key`
  ON `Shipment` (`organizationId`, `invoiceNumber`);

-- -----------------------------------------------------------------------------
-- 2. Tenant columns on previously org-less tables
-- -----------------------------------------------------------------------------

ALTER TABLE `DebitNote` ADD COLUMN `organizationId` INTEGER NULL;
ALTER TABLE `CreditNote` ADD COLUMN `organizationId` INTEGER NULL;
ALTER TABLE `JournalEntryLine` ADD COLUMN `organizationId` INTEGER NULL;

CREATE INDEX `DebitNote_organizationId_idx` ON `DebitNote` (`organizationId`);
CREATE INDEX `CreditNote_organizationId_idx` ON `CreditNote` (`organizationId`);
CREATE INDEX `JournalEntryLine_organizationId_idx` ON `JournalEntryLine` (`organizationId`);

-- Backfill from parent records (run once):
UPDATE `DebitNote` dn
  JOIN `Vendors` v ON v.`id` = dn.`vendorId`
SET dn.`organizationId` = v.`organizationId`
WHERE dn.`organizationId` IS NULL;

UPDATE `DebitNote` dn
  JOIN `Invoice` i ON i.`id` = dn.`billId`
SET dn.`organizationId` = i.`organizationId`
WHERE dn.`organizationId` IS NULL;

UPDATE `CreditNote` cn
  JOIN `Customers` c ON c.`id` = cn.`customerId`
SET cn.`organizationId` = c.`organizationId`
WHERE cn.`organizationId` IS NULL;

UPDATE `JournalEntryLine` jel
  JOIN `JournalEntry` je ON je.`id` = jel.`journalEntryId`
SET jel.`organizationId` = je.`organizationId`
WHERE jel.`organizationId` IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Post-backfill verification (should return zero rows)
-- -----------------------------------------------------------------------------
SELECT 'debit_notes_unassigned' AS check_name, COUNT(*) AS cnt FROM `DebitNote` WHERE `organizationId` IS NULL
UNION ALL
SELECT 'credit_notes_unassigned', COUNT(*) FROM `CreditNote` WHERE `organizationId` IS NULL
UNION ALL
SELECT 'journal_lines_unassigned', COUNT(*) FROM `JournalEntryLine` WHERE `organizationId` IS NULL;

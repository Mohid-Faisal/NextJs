-- Money columns: DOUBLE → DECIMAL(19,4). Weights/dimensions stay DOUBLE.
-- Payment (organizationId, reference) unique after normalizing blanks and
-- suffixing duplicate non-null references (MySQL allows multiple NULLs).

-- Plan / party balances
ALTER TABLE `Plan` MODIFY `priceMonthlyUsd` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `Customers` MODIFY `currentBalance` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Customers` MODIFY `creditLimit` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Vendors` MODIFY `currentBalance` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Vendors` MODIFY `creditLimit` DECIMAL(19, 4) NOT NULL DEFAULT 0;

-- Shipment money (not weight/dimension columns)
ALTER TABLE `Shipment` MODIFY `fixedCharge` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `decValue` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `price` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `discount` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `fuelSurcharge` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `insurance` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `customs` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `tax` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `declaredValue` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `reissue` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `cos` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Shipment` MODIFY `totalCost` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `Shipment` MODIFY `subtotal` DECIMAL(19, 4) NOT NULL DEFAULT 0;

-- Ledgers
ALTER TABLE `CustomerTransaction` MODIFY `amount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `CustomerTransaction` MODIFY `previousBalance` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `CustomerTransaction` MODIFY `newBalance` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `VendorTransaction` MODIFY `amount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `VendorTransaction` MODIFY `previousBalance` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `VendorTransaction` MODIFY `newBalance` DECIMAL(19, 4) NOT NULL;

-- Payments / invoices / notes / GL
ALTER TABLE `Payment` MODIFY `amount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `PaymentAllocation` MODIFY `amount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `Invoice` MODIFY `fscCharges` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Invoice` MODIFY `discount` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `Invoice` MODIFY `totalAmount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `DebitNote` MODIFY `amount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `CreditNote` MODIFY `amount` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `JournalEntry` MODIFY `totalDebit` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `JournalEntry` MODIFY `totalCredit` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `JournalEntryLine` MODIFY `debitAmount` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `JournalEntryLine` MODIFY `creditAmount` DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE `FixedCharge` MODIFY `fixedCharge` DECIMAL(19, 4) NOT NULL;
ALTER TABLE `PaymentProof` MODIFY `amount` DECIMAL(19, 4) NOT NULL;

-- Unique payment references per org (empty string → NULL; dupes get -<id>)
UPDATE `Payment` SET `reference` = NULL WHERE `reference` = '';

UPDATE `Payment` p
INNER JOIN (
  SELECT `id`
  FROM (
    SELECT `id`,
           ROW_NUMBER() OVER (PARTITION BY `organizationId`, `reference` ORDER BY `id`) AS rn
    FROM `Payment`
    WHERE `reference` IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
) dups ON p.`id` = dups.`id`
SET p.`reference` = CONCAT(p.`reference`, '-', p.`id`);

DROP INDEX `Payment_organizationId_reference_idx` ON `Payment`;

CREATE UNIQUE INDEX `Payment_organizationId_reference_key` ON `Payment`(`organizationId`, `reference`);

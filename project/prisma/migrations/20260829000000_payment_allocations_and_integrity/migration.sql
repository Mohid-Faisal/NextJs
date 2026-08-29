-- AlterTable
ALTER TABLE `Payment` ALTER COLUMN `organizationId` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Invoice` ALTER COLUMN `organizationId` DROP DEFAULT;

-- AlterTable
ALTER TABLE `JournalEntry` ALTER COLUMN `organizationId` DROP DEFAULT;

-- CreateTable
CREATE TABLE `PaymentAllocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `paymentId` INTEGER NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentAllocation_organizationId_invoiceId_idx`(`organizationId`, `invoiceId`),
    INDEX `PaymentAllocation_paymentId_idx`(`paymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_organizationId_invoice_idx` ON `Payment`(`organizationId`, `invoice`);

-- CreateIndex
CREATE INDEX `Payment_organizationId_reference_idx` ON `Payment`(`organizationId`, `reference`);

-- CreateIndex
CREATE INDEX `Invoice_customerId_idx` ON `Invoice`(`customerId`);

-- CreateIndex
CREATE INDEX `Invoice_vendorId_idx` ON `Invoice`(`vendorId`);

-- CreateIndex
CREATE INDEX `Invoice_shipmentId_idx` ON `Invoice`(`shipmentId`);

-- CreateIndex
CREATE INDEX `JournalEntryLine_journalEntryId_idx` ON `JournalEntryLine`(`journalEntryId`);

-- CreateIndex
CREATE INDEX `JournalEntryLine_accountId_idx` ON `JournalEntryLine`(`accountId`);


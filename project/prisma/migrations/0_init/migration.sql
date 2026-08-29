-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'USER',
    `platformRole` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastLoginAt` DATETIME(3) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `organizationId` INTEGER NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    INDEX `AuthSession_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organization` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `logoUrl` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR',
    `invoicePrefix` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Organization_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,

    INDEX `OrganizationMember_userId_idx`(`userId`),
    UNIQUE INDEX `OrganizationMember_organizationId_userId_key`(`organizationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceMonthlyUsd` DOUBLE NOT NULL,
    `maxUsers` INTEGER NOT NULL,
    `maxShipmentsPerMonth` INTEGER NOT NULL,
    `features` JSON NOT NULL,

    UNIQUE INDEX `Plan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeSubscriptionId` VARCHAR(191) NULL,

    UNIQUE INDEX `Subscription_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `trackingId` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `agency` VARCHAR(191) NULL,
    `office` VARCHAR(191) NULL,
    `senderName` VARCHAR(191) NOT NULL,
    `senderAddress` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `recipientAddress` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `deliveryTime` VARCHAR(191) NULL,
    `invoiceStatus` VARCHAR(191) NULL,
    `deliveryStatus` VARCHAR(191) NULL,
    `trackingStatus` VARCHAR(191) NULL,
    `trackingStatusHistory` JSON NULL,
    `shippingMode` VARCHAR(191) NULL,
    `packaging` VARCHAR(191) NULL,
    `vendor` VARCHAR(191) NULL,
    `serviceMode` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL DEFAULT 1,
    `packageDescription` VARCHAR(191) NULL,
    `weight` DOUBLE NOT NULL DEFAULT 0,
    `length` DOUBLE NOT NULL DEFAULT 0,
    `width` DOUBLE NOT NULL DEFAULT 0,
    `height` DOUBLE NOT NULL DEFAULT 0,
    `weightVol` DOUBLE NOT NULL DEFAULT 0,
    `fixedCharge` DOUBLE NOT NULL DEFAULT 0,
    `decValue` DOUBLE NOT NULL DEFAULT 0,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `fuelSurcharge` DOUBLE NOT NULL DEFAULT 0,
    `insurance` DOUBLE NOT NULL DEFAULT 0,
    `customs` DOUBLE NOT NULL DEFAULT 0,
    `tax` DOUBLE NOT NULL DEFAULT 0,
    `declaredValue` DOUBLE NOT NULL DEFAULT 0,
    `reissue` DOUBLE NOT NULL DEFAULT 0,
    `profitPercentage` DOUBLE NOT NULL DEFAULT 0,
    `cos` DOUBLE NOT NULL DEFAULT 0,
    `totalCost` DOUBLE NOT NULL,
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `manualRate` BOOLEAN NOT NULL DEFAULT false,
    `totalPackages` INTEGER NOT NULL DEFAULT 0,
    `totalWeight` DOUBLE NOT NULL DEFAULT 0,
    `totalWeightVol` DOUBLE NOT NULL DEFAULT 0,
    `shipmentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `packages` JSON NULL,
    `packageTotals` JSON NULL,
    `calculatedValues` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Shipment_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Shipment_organizationId_trackingId_key`(`organizationId`, `trackingId`),
    UNIQUE INDEX `Shipment_organizationId_invoiceNumber_key`(`organizationId`, `invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `CompanyName` VARCHAR(191) NOT NULL,
    `PersonName` VARCHAR(191) NOT NULL,
    `Email` VARCHAR(191) NOT NULL,
    `Phone` VARCHAR(191) NOT NULL,
    `DocumentType` VARCHAR(191) NOT NULL,
    `DocumentNumber` VARCHAR(191) NOT NULL,
    `DocumentExpiry` VARCHAR(191) NULL,
    `Country` VARCHAR(191) NOT NULL,
    `State` VARCHAR(191) NOT NULL,
    `City` VARCHAR(191) NOT NULL,
    `Zip` VARCHAR(191) NOT NULL,
    `Address` VARCHAR(191) NOT NULL,
    `ActiveStatus` VARCHAR(191) NOT NULL,
    `FilePath` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentBalance` DOUBLE NOT NULL DEFAULT 0,
    `creditLimit` DOUBLE NOT NULL DEFAULT 0,

    INDEX `Customers_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Customers_organizationId_CompanyName_key`(`organizationId`, `CompanyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `CompanyName` VARCHAR(191) NOT NULL,
    `PersonName` VARCHAR(191) NOT NULL,
    `Email` VARCHAR(191) NOT NULL,
    `Phone` VARCHAR(191) NOT NULL,
    `Country` VARCHAR(191) NOT NULL,
    `State` VARCHAR(191) NOT NULL,
    `City` VARCHAR(191) NOT NULL,
    `Zip` VARCHAR(191) NOT NULL,
    `Address` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentBalance` DOUBLE NOT NULL DEFAULT 0,
    `creditLimit` DOUBLE NOT NULL DEFAULT 0,

    INDEX `Vendors_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Vendors_organizationId_CompanyName_key`(`organizationId`, `CompanyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `CompanyName` VARCHAR(191) NOT NULL,
    `PersonName` VARCHAR(191) NOT NULL,
    `Email` VARCHAR(191) NOT NULL,
    `Phone` VARCHAR(191) NOT NULL,
    `Country` VARCHAR(191) NOT NULL,
    `State` VARCHAR(191) NOT NULL,
    `City` VARCHAR(191) NOT NULL,
    `Zip` VARCHAR(191) NOT NULL,
    `Address` VARCHAR(191) NOT NULL,
    `isRemoteArea` BOOLEAN NOT NULL DEFAULT false,
    `remoteAreaCompanies` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Recipients_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Recipients_organizationId_CompanyName_key`(`organizationId`, `CompanyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryTime` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeliveryTime_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `DeliveryTime_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Agency_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Agency_organizationId_code_key`(`organizationId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Office` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Office_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Office_organizationId_code_key`(`organizationId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `order` INTEGER NULL DEFAULT 0,
    `status` VARCHAR(191) NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeliveryStatus_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `DeliveryStatus_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingMode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShippingMode_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `ShippingMode_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackagingType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PackagingType_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `PackagingType_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceMode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceMode_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `ServiceMode_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HsCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HsCode_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `HsCode_organizationId_code_key`(`organizationId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Zone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `code` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `zone` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `phoneCode` VARCHAR(191) NULL,

    INDEX `Zone_organizationId_idx`(`organizationId`),
    INDEX `Zone_organizationId_service_idx`(`organizationId`, `service`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ZoneUpload` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `service` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ZoneUpload_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `ZoneUpload_organizationId_service_key`(`organizationId`, `service`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RemoteArea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `company` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `iataCode` VARCHAR(191) NOT NULL,
    `low` VARCHAR(191) NOT NULL,
    `high` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `filename` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RemoteArea_organizationId_idx`(`organizationId`),
    INDEX `RemoteArea_organizationId_company_idx`(`organizationId`, `company`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `weight` DOUBLE NOT NULL,
    `vendor` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `zone` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `docType` VARCHAR(191) NOT NULL,

    INDEX `Rate_organizationId_idx`(`organizationId`),
    INDEX `Rate_organizationId_vendor_service_idx`(`organizationId`, `vendor`, `service`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `filename` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `filename` VARCHAR(191) NOT NULL,
    `vendor` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `filename_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `filename_organizationId_vendor_service_fileType_key`(`organizationId`, `vendor`, `service`, `fileType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `customerId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `invoice` VARCHAR(191) NULL,
    `previousBalance` DOUBLE NOT NULL,
    `newBalance` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerTransaction_customerId_idx`(`customerId`),
    INDEX `CustomerTransaction_createdAt_idx`(`createdAt`),
    INDEX `CustomerTransaction_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VendorTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `vendorId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `invoice` VARCHAR(191) NULL,
    `previousBalance` DOUBLE NOT NULL,
    `newBalance` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VendorTransaction_vendorId_idx`(`vendorId`),
    INDEX `VendorTransaction_createdAt_idx`(`createdAt`),
    INDEX `VendorTransaction_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorservice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `vendor` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,

    INDEX `vendorservice_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `vendorservice_organizationId_vendor_service_key`(`organizationId`, `vendor`, `service`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `transactionType` ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'EQUITY') NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `fromPartyType` ENUM('US', 'CUSTOMER', 'VENDOR') NOT NULL,
    `fromCustomerId` INTEGER NULL,
    `fromCustomer` VARCHAR(191) NOT NULL,
    `toPartyType` ENUM('US', 'CUSTOMER', 'VENDOR') NOT NULL,
    `toVendorId` INTEGER NULL,
    `toVendor` VARCHAR(191) NOT NULL,
    `mode` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE') NULL,
    `reference` VARCHAR(191) NULL,
    `invoice` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `receiptNumber` VARCHAR(191) NULL,
    `trackingNumber` VARCHAR(191) NULL,
    `destination` VARCHAR(191) NOT NULL,
    `dayWeek` VARCHAR(191) NULL,
    `weight` DOUBLE NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `fscCharges` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `lineItems` JSON NOT NULL,
    `customerId` INTEGER NULL,
    `vendorId` INTEGER NULL,
    `shipmentId` INTEGER NULL,
    `disclaimer` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Unpaid',
    `totalAmount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Invoice_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Invoice_organizationId_invoiceNumber_key`(`organizationId`, `invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebitNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NULL,
    `debitNoteNumber` VARCHAR(191) NOT NULL,
    `billId` INTEGER NULL,
    `vendorId` INTEGER NULL,
    `amount` DOUBLE NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DebitNote_debitNoteNumber_key`(`debitNoteNumber`),
    INDEX `DebitNote_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NULL,
    `creditNoteNumber` VARCHAR(191) NOT NULL,
    `invoiceId` INTEGER NULL,
    `customerId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditNote_creditNoteNumber_key`(`creditNoteNumber`),
    INDEX `CreditNote_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChartOfAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `code` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `debitRule` VARCHAR(191) NOT NULL,
    `creditRule` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChartOfAccount_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `ChartOfAccount_organizationId_code_key`(`organizationId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `entryNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `totalDebit` DOUBLE NOT NULL,
    `totalCredit` DOUBLE NOT NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JournalEntry_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `JournalEntry_organizationId_entryNumber_key`(`organizationId`, `entryNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntryLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NULL,
    `journalEntryId` INTEGER NOT NULL,
    `accountId` INTEGER NOT NULL,
    `debitAmount` DOUBLE NOT NULL DEFAULT 0,
    `creditAmount` DOUBLE NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalEntryLine_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FixedCharge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL DEFAULT 1,
    `weight` DOUBLE NOT NULL,
    `fixedCharge` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FixedCharge_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentProof` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR',
    `method` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentProof_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NULL,
    `actorUserId` INTEGER NULL,
    `actorEmail` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrgSequence` (
    `organizationId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nextNumber` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`organizationId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


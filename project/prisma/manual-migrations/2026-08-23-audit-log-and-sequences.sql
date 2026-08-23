-- =============================================================================
-- Migration: audit-log-and-sequences-01
-- Adds AuditLog (append-only security trail) and OrgSequence (atomic
-- per-org document counters).
--
-- Apply with:  npx prisma migrate dev --name audit_log_and_sequences
-- (Reference SQL — review before executing against production.)
-- =============================================================================

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

    INDEX `AuditLog_organizationId_createdAt_idx` (`organizationId`, `createdAt`),
    INDEX `AuditLog_actorUserId_createdAt_idx` (`actorUserId`, `createdAt`),
    INDEX `AuditLog_action_createdAt_idx` (`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgSequence` (
    `organizationId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nextNumber` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`organizationId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed journal-entry sequences from existing data so new atomic numbers
-- continue above the current maximum per organization.
INSERT INTO `OrgSequence` (`organizationId`, `key`, `nextNumber`)
SELECT je.`organizationId`, 'journal_entry',
       COALESCE(MAX(CAST(SUBSTRING(je.`entryNumber` FROM 5) AS SIGNED)), 0) + 1
FROM `JournalEntry` je
WHERE je.`entryNumber` REGEXP '^JE-[0-9]{4}$'
GROUP BY je.`organizationId`
ON DUPLICATE KEY UPDATE `nextNumber` = GREATEST(`nextNumber`, VALUES(`nextNumber`));

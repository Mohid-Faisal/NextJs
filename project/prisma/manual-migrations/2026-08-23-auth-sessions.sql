-- =============================================================================
-- Migration: auth-sessions-01
-- Adds the AuthSession table for server-side session management.
--
-- Apply with:  npx prisma migrate dev --name auth_sessions_01
-- (Reference SQL — review before executing against production.)
-- =============================================================================

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

    INDEX `AuthSession_userId_idx` (`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ADD CONSTRAINT `AuthSession_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional hygiene: purge sessions expired more than 30 days ago.
-- DELETE FROM `AuthSession` WHERE `expiresAt` < NOW() - INTERVAL 30 DAY;

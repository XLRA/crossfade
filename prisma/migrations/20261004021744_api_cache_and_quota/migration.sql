-- CreateTable
CREATE TABLE `ApiCache` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApiCache_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiQuota` (
    `provider` VARCHAR(16) NOT NULL,
    `day` VARCHAR(10) NOT NULL,
    `units` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`provider`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

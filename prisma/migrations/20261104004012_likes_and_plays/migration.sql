-- CreateTable
CREATE TABLE `TrackLike` (
    `userId` VARCHAR(191) NOT NULL,
    `trackId` VARCHAR(191) NOT NULL,
    `likedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrackLike_userId_likedAt_idx`(`userId`, `likedAt`),
    INDEX `TrackLike_trackId_idx`(`trackId`),
    PRIMARY KEY (`userId`, `trackId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Play` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `trackId` VARCHAR(191) NOT NULL,
    `contextType` VARCHAR(16) NULL,
    `contextId` VARCHAR(64) NULL,
    `playedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Play_userId_playedAt_idx`(`userId`, `playedAt`),
    INDEX `Play_userId_contextType_playedAt_idx`(`userId`, `contextType`, `playedAt`),
    INDEX `Play_trackId_idx`(`trackId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrackLike` ADD CONSTRAINT `TrackLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackLike` ADD CONSTRAINT `TrackLike_trackId_fkey` FOREIGN KEY (`trackId`) REFERENCES `Track`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Play` ADD CONSTRAINT `Play_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Play` ADD CONSTRAINT `Play_trackId_fkey` FOREIGN KEY (`trackId`) REFERENCES `Track`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

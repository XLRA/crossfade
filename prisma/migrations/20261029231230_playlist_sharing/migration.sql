-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE `PlaylistCollaborator` (
    `playlistId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlaylistCollaborator_userId_idx`(`userId`),
    PRIMARY KEY (`playlistId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Playlist_ownerId_visibility_idx` ON `Playlist`(`ownerId`, `visibility`);

-- AddForeignKey
ALTER TABLE `PlaylistCollaborator` ADD CONSTRAINT `PlaylistCollaborator_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaylistCollaborator` ADD CONSTRAINT `PlaylistCollaborator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

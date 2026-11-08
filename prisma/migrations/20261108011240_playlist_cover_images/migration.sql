-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `coverUpdatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `PlaylistImage` (
    `playlistId` VARCHAR(191) NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`playlistId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlaylistImage` ADD CONSTRAINT `PlaylistImage_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

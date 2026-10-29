-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `importSource` ENUM('SPOTIFY', 'YOUTUBE') NULL,
    ADD COLUMN `importSourceId` VARCHAR(64) NULL,
    ADD COLUMN `importedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Playlist_ownerId_importSource_importSourceId_idx` ON `Playlist`(`ownerId`, `importSource`, `importSourceId`);

-- Class-wise subject mapping: which subjects each class offers
CREATE TABLE `class_subjects` (
    `id` VARCHAR(191) NOT NULL,
    `schoolClassId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `class_subjects_schoolClassId_subjectId_key`(`schoolClassId`, `subjectId`),
    INDEX `class_subjects_schoolClassId_idx`(`schoolClassId`),
    INDEX `class_subjects_subjectId_idx`(`subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `school_classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

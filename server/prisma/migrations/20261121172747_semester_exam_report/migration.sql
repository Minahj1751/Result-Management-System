-- AlterTable
ALTER TABLE `class_subjects` ADD COLUMN `assessmentRule` VARCHAR(191) NOT NULL DEFAULT 'BEST2_AVG';

-- CreateTable
CREATE TABLE `student_remarks` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `academicSessionId` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NOT NULL,
    `schoolClassId` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `remarks` TEXT NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_remarks_studentId_idx`(`studentId`),
    INDEX `student_remarks_academicSessionId_idx`(`academicSessionId`),
    INDEX `student_remarks_semesterId_idx`(`semesterId`),
    INDEX `student_remarks_schoolClassId_idx`(`schoolClassId`),
    INDEX `student_remarks_sectionId_idx`(`sectionId`),
    UNIQUE INDEX `student_remarks_studentId_academicSessionId_semesterId_schoo_key`(`studentId`, `academicSessionId`, `semesterId`, `schoolClassId`, `sectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_academicSessionId_fkey` FOREIGN KEY (`academicSessionId`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `semesters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `school_classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

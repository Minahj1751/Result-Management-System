-- CreateTable
CREATE TABLE `term_exam_marks` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `academicSessionId` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NOT NULL,
    `schoolClassId` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `classTestMarks` DECIMAL(5, 2) NULL,
    `classWorkMarks` DECIMAL(5, 2) NULL,
    `homeWorkMarks` DECIMAL(5, 2) NULL,
    `termExamMarks` DECIMAL(5, 2) NULL,
    `enteredById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `term_exam_marks_academicSessionId_idx`(`academicSessionId`),
    INDEX `term_exam_marks_semesterId_idx`(`semesterId`),
    INDEX `term_exam_marks_schoolClassId_idx`(`schoolClassId`),
    INDEX `term_exam_marks_sectionId_idx`(`sectionId`),
    INDEX `term_exam_marks_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `term_exam_marks_studentId_academicSessionId_semesterId_schoo_key`(`studentId`, `academicSessionId`, `semesterId`, `schoolClassId`, `sectionId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddIndex (BTREE: MariaDB creates long-named unique keys as HASH, which cannot back foreign keys)
CREATE INDEX `term_exam_marks_studentId_idx` ON `term_exam_marks`(`studentId`);

-- AddIndex
CREATE INDEX `term_exam_marks_enteredById_idx` ON `term_exam_marks`(`enteredById`);

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_academicSessionId_fkey` FOREIGN KEY (`academicSessionId`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `semesters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `school_classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `term_exam_marks` ADD CONSTRAINT `term_exam_marks_enteredById_fkey` FOREIGN KEY (`enteredById`) REFERENCES `teacher_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `semesters` ADD COLUMN `visibleToClassTeachers` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `visibleToSubjectTeachers` BOOLEAN NOT NULL DEFAULT true;

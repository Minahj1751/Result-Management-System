-- Make semesterId optional (NULL = session-level roster/assignment)
-- and rollNumber optional on student_enrollments.
-- Existing rows are untouched; semester-specific enrollments keep working.

ALTER TABLE `student_enrollments`
  MODIFY COLUMN `semesterId` VARCHAR(191) NULL,
  MODIFY COLUMN `rollNumber` INTEGER NULL;

ALTER TABLE `teacher_assignments`
  MODIFY COLUMN `semesterId` VARCHAR(191) NULL;

ALTER TABLE `class_teacher_assignments`
  MODIFY COLUMN `semesterId` VARCHAR(191) NULL;

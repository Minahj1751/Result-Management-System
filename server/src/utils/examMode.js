const prisma = require('../config/database');

/**
 * Exam modes per school class.
 *
 * STANDARD (Grade 4+): assessment-based class marks scale to 40
 *   (CT 20 + CW 10 + HW 10) + Term Exam (60) = 100. Direct Term Exam
 *   entry takes a single combined "Class Work" mark out of 40
 *   (stored in classWorkMarks) plus Term Exam out of 60.
 * PRIMARY  (Grade 1-3): no term exam — CT (40) + CW (20) + HW (20)
 *   = Class Marks (80) + Attendance (20) = 100.
 *
 * The mode is derived from the class name ("Grade 1", "Grade 2",
 * "Grade 3" — "Class N" also matches).
 */

const EXAM_MODES = {
  STANDARD: 'STANDARD',
  PRIMARY: 'PRIMARY',
};

const STANDARD_MAX_MARKS = {
  classTestMarks: 20,
  classWorkMarks: 10,
  homeWorkMarks: 10,
  termExamMarks: 60,
};

const PRIMARY_MAX_MARKS = {
  classTestMarks: 40,
  classWorkMarks: 20,
  homeWorkMarks: 20,
  attendanceMarks: 20,
};

const MAX_MARKS_BY_MODE = {
  [EXAM_MODES.STANDARD]: STANDARD_MAX_MARKS,
  [EXAM_MODES.PRIMARY]: PRIMARY_MAX_MARKS,
};

const MARK_FIELDS_BY_MODE = {
  [EXAM_MODES.STANDARD]: ['classTestMarks', 'classWorkMarks', 'homeWorkMarks', 'termExamMarks'],
  [EXAM_MODES.PRIMARY]: ['classTestMarks', 'classWorkMarks', 'homeWorkMarks', 'attendanceMarks'],
};

// Direct Term Exam entry max marks. Grade 4+ teachers enter one combined
// "Class Work" mark out of 40 (kept in the classWorkMarks column) instead
// of separate CT/CW/HW marks, plus Term Exam out of 60.
const STANDARD_ENTRY_MAX_MARKS = {
  classWorkMarks: 40,
  termExamMarks: 60,
};

const ENTRY_MAX_MARKS_BY_MODE = {
  [EXAM_MODES.STANDARD]: STANDARD_ENTRY_MAX_MARKS,
  [EXAM_MODES.PRIMARY]: PRIMARY_MAX_MARKS,
};

const ENTRY_MARK_FIELDS_BY_MODE = {
  [EXAM_MODES.STANDARD]: ['classWorkMarks', 'termExamMarks'],
  [EXAM_MODES.PRIMARY]: MARK_FIELDS_BY_MODE[EXAM_MODES.PRIMARY],
};

/**
 * Extract the grade level from a class name like "Grade 3" / "Class 2".
 * Returns the integer level or null when the name has no grade/class number.
 */
const gradeLevelFromClassName = (name) => {
  const match = /(?:grade|class)\s*(\d{1,2})\b/i.exec(String(name || '').trim());
  if (!match) return null;
  const level = parseInt(match[1], 10);
  return Number.isFinite(level) ? level : null;
};

const isPrimaryClassName = (name) => {
  const level = gradeLevelFromClassName(name);
  return level !== null && level >= 1 && level <= 3;
};

const examModeForClassName = (name) =>
  (isPrimaryClassName(name) ? EXAM_MODES.PRIMARY : EXAM_MODES.STANDARD);

/**
 * Resolve the exam mode and max marks for a school class.
 * Returns { mode, maxMarks, markFields, className }.
 */
const getClassExamMode = async (schoolClassId) => {
  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id: schoolClassId },
    select: { name: true },
  });
  const mode = examModeForClassName(schoolClass?.name);
  return {
    mode,
    className: schoolClass?.name || null,
    maxMarks: ENTRY_MAX_MARKS_BY_MODE[mode],
    markFields: ENTRY_MARK_FIELDS_BY_MODE[mode],
  };
};

module.exports = {
  EXAM_MODES,
  STANDARD_MAX_MARKS,
  PRIMARY_MAX_MARKS,
  MAX_MARKS_BY_MODE,
  MARK_FIELDS_BY_MODE,
  STANDARD_ENTRY_MAX_MARKS,
  ENTRY_MAX_MARKS_BY_MODE,
  ENTRY_MARK_FIELDS_BY_MODE,
  gradeLevelFromClassName,
  isPrimaryClassName,
  examModeForClassName,
  getClassExamMode,
};

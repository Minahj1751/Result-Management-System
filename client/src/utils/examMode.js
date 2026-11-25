/**
 * Client-side mirror of server/src/utils/examMode.js (name-based detection only).
 * STANDARD (Grade 4+): CT(20) + CW(10) + HW(10) = Class Marks(40) + Term Exam(60).
 * PRIMARY  (Grade 1-3): CT(40) + CW(20) + HW(20) = Class Marks(80) + Attendance(20).
 */
export const EXAM_MODES = {
  STANDARD: 'STANDARD',
  PRIMARY: 'PRIMARY',
};

export const PRIMARY_MAX_MARKS = {
  classTestMarks: 40,
  classWorkMarks: 20,
  homeWorkMarks: 20,
  attendanceMarks: 20,
};

export const gradeLevelFromClassName = (name) => {
  const match = /(?:grade|class)\s*(\d{1,2})\b/i.exec(String(name || '').trim());
  if (!match) return null;
  const level = parseInt(match[1], 10);
  return Number.isFinite(level) ? level : null;
};

export const isPrimaryClassName = (name) => {
  const level = gradeLevelFromClassName(name);
  return level !== null && level >= 1 && level <= 3;
};

export const examModeForClassName = (name) =>
  (isPrimaryClassName(name) ? EXAM_MODES.PRIMARY : EXAM_MODES.STANDARD);

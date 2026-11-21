const getUserRole = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role || '';
  } catch {
    return '';
  }
};

/**
 * Admin-controlled semester visibility (UI-level filtering).
 * Returns true when the semester may be shown to the given role.
 * Semesters without the flags (older data) default to visible.
 */
export const isSemesterVisibleToRole = (semester, role = getUserRole()) => {
  if (!semester) return true;
  if (role === 'CLASS_TEACHER') return semester.visibleToClassTeachers !== false;
  if (role === 'SUBJECT_TEACHER') return semester.visibleToSubjectTeachers !== false;
  return true;
};

export const filterVisibleSemesters = (semesters = [], role = getUserRole()) =>
  (semesters || []).filter((s) => isSemesterVisibleToRole(s, role));

/**
 * Filter assignment lists so semester-specific assignments pointing at a
 * hidden semester are excluded. Session-level assignments (semesterId NULL)
 * always remain visible.
 */
export const filterVisibleAssignments = (assignments = [], role = getUserRole()) =>
  (assignments || []).filter((a) => isSemesterVisibleToRole(a.semester, role));

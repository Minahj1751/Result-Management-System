const prisma = require('../config/database');
const { getClassExamMode } = require('../utils/examMode');

/**
 * Term Exam module: subject teachers enter the report-card
 * components directly per student.
 *
 * Standard classes (Grade 4+): a single Class Work mark (out of 40,
 * stored in classWorkMarks — it covers CT+CW+HW combined) and Term
 * Exam (out of 60). When a row exists it takes precedence over the
 * assessment-based semester result calculation.
 *
 * Primary classes (Grade 1-3): no term exam — CT (out of 40),
 * CW (out of 20), HW (out of 20) sum to Class Marks (out of 80),
 * plus Attendance (out of 20) for a 100-mark total.
 */
const TERM_EXAM_MAX_MARKS = {
  classWorkMarks: 40,
  termExamMarks: 60,
};

const scopeFromQuery = (q) => ({
  academicSessionId: q.academicSessionId,
  semesterId: q.semesterId,
  schoolClassId: q.schoolClassId,
  sectionId: q.sectionId,
  subjectId: q.subjectId,
});

const missingScope = (scope) =>
  Object.entries({
    academicSessionId: scope.academicSessionId,
    semesterId: scope.semesterId,
    schoolClassId: scope.schoolClassId,
    sectionId: scope.sectionId,
    subjectId: scope.subjectId,
  }).filter(([, v]) => !v).map(([k]) => k);

/**
 * Ensure the requesting teacher is allowed to enter marks for this scope.
 * Admins bypass. Subject teachers need a subject assignment.
 * Class teachers may enter marks only for primary classes (Grade 1-3)
 * via their class teacher assignment.
 */
const assertTeacherAssignedToScope = async (req, scope) => {
  if (req.user.role === 'ADMIN') return;

  const profile = req.user.teacherProfile;
  if (!profile) {
    const error = new Error('Teacher profile not found');
    error.statusCode = 403;
    throw error;
  }

  if (req.user.role === 'CLASS_TEACHER') {
    const { mode } = await getClassExamMode(scope.schoolClassId);
    if (mode !== 'PRIMARY') {
      const error = new Error('Class teachers can enter marks only for primary classes (Grade 1-3)');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await prisma.classTeacherAssignment.findFirst({
      where: {
        teacherId: profile.id,
        academicSessionId: scope.academicSessionId,
        OR: [{ semesterId: scope.semesterId }, { semesterId: null }],
        schoolClassId: scope.schoolClassId,
        sectionId: scope.sectionId,
        isActive: true,
      },
    });

    if (!assignment) {
      const error = new Error('You are not assigned to this class and section');
      error.statusCode = 403;
      throw error;
    }

    // When the class has subject mappings, the subject must be one of them
    const mappings = await prisma.classSubject.findMany({
      where: { schoolClassId: scope.schoolClassId },
      select: { subjectId: true },
    });
    if (mappings.length > 0 && !mappings.some((m) => m.subjectId === scope.subjectId)) {
      const error = new Error('Subject is not mapped to this class');
      error.statusCode = 403;
      throw error;
    }

    return;
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      teacherId: profile.id,
      subjectId: scope.subjectId,
      academicSessionId: scope.academicSessionId,
      OR: [{ semesterId: scope.semesterId }, { semesterId: null }],
      schoolClassId: scope.schoolClassId,
      sectionId: scope.sectionId,
      isActive: true,
    },
  });

  if (!assignment) {
    const error = new Error('You are not assigned to this class and subject');
    error.statusCode = 403;
    throw error;
  }
};

const parseMark = (value, field, maxMarks) => {
  if (value === null || value === undefined || value === '') return { value: null };
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return { error: `${field} must be a number >= 0` };
  if (n > maxMarks[field]) {
    return { error: `${field} cannot exceed ${maxMarks[field]}` };
  }
  return { value: n };
};

/**
 * Get the student roster for a scope plus any saved Term Exam marks.
 */
const getTermExamMarks = async (req, res, next) => {
  try {
    const scope = scopeFromQuery(req.query);
    const missing = missingScope(scope);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required parameters: ${missing.join(', ')}` });
    }

    await assertTeacherAssignedToScope(req, scope);

    const { mode, maxMarks } = await getClassExamMode(scope.schoolClassId);

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId: scope.academicSessionId,
        schoolClassId: scope.schoolClassId,
        sectionId: scope.sectionId,
        isActive: true,
        OR: [{ semesterId: scope.semesterId }, { semesterId: null }],
      },
      include: { student: true },
    });

    const enrollmentByStudent = new Map();
    enrollments
      .sort((a, b) => (a.semesterId ? 0 : 1) - (b.semesterId ? 0 : 1))
      .forEach((e) => {
        if (!enrollmentByStudent.has(e.studentId)) enrollmentByStudent.set(e.studentId, e);
      });
    const roster = [...enrollmentByStudent.values()].sort(
      (a, b) => (a.rollNumber ?? 999999) - (b.rollNumber ?? 999999)
    );

    const marksRows = await prisma.termExamMark.findMany({
      where: {
        academicSessionId: scope.academicSessionId,
        semesterId: scope.semesterId,
        schoolClassId: scope.schoolClassId,
        sectionId: scope.sectionId,
        subjectId: scope.subjectId,
      },
    });
    const marksMap = new Map(marksRows.map((m) => [m.studentId, m]));

    const students = roster.map((enrollment) => ({
      student: enrollment.student,
      enrollment,
      marks: marksMap.get(enrollment.studentId) || null,
    }));

    res.json({ scope, mode, maxMarks, students });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk upsert Term Exam marks for a scope.
 */
const bulkUpsertTermExamMarks = async (req, res, next) => {
  try {
    const { entries } = req.body;
    const scope = {
      academicSessionId: req.body.academicSessionId,
      semesterId: req.body.semesterId,
      schoolClassId: req.body.schoolClassId,
      sectionId: req.body.sectionId,
      subjectId: req.body.subjectId,
    };

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }
    const missing = missingScope(scope);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required parameters: ${missing.join(', ')}` });
    }

    await assertTeacherAssignedToScope(req, scope);

    const { mode, maxMarks, markFields } = await getClassExamMode(scope.schoolClassId);

    const teacherProfile = req.user.teacherProfile;
    const results = [];
    const errors = [];

    for (const entry of entries) {
      const { studentId } = entry;
      if (!studentId) {
        errors.push({ entry, error: 'studentId is required' });
        continue;
      }

      const parsed = {};
      let entryError = null;
      for (const field of markFields) {
        const r = parseMark(entry[field], field, maxMarks);
        if (r.error) { entryError = r.error; break; }
        parsed[field] = r.value;
      }
      if (entryError) {
        errors.push({ entry, error: entryError });
        continue;
      }

      // Student must be enrolled in this scope
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId,
          academicSessionId: scope.academicSessionId,
          schoolClassId: scope.schoolClassId,
          sectionId: scope.sectionId,
          isActive: true,
          OR: [{ semesterId: scope.semesterId }, { semesterId: null }],
        },
        select: { id: true },
      });
      if (!enrollment) {
        errors.push({ entry, error: 'Student is not enrolled in this class/section' });
        continue;
      }

      const where = {
        termExamMark_unique: {
          studentId,
          academicSessionId: scope.academicSessionId,
          semesterId: scope.semesterId,
          schoolClassId: scope.schoolClassId,
          sectionId: scope.sectionId,
          subjectId: scope.subjectId,
        },
      };

      const data = {
        classTestMarks: parsed.classTestMarks ?? null,
        classWorkMarks: parsed.classWorkMarks ?? null,
        homeWorkMarks: parsed.homeWorkMarks ?? null,
        termExamMarks: mode === 'PRIMARY' ? null : (parsed.termExamMarks ?? null),
        attendanceMarks: mode === 'PRIMARY' ? (parsed.attendanceMarks ?? null) : null,
        enteredById: teacherProfile?.id || null,
      };

      const saved = await prisma.termExamMark.upsert({
        where,
        update: data,
        create: {
          studentId,
          academicSessionId: scope.academicSessionId,
          semesterId: scope.semesterId,
          schoolClassId: scope.schoolClassId,
          sectionId: scope.sectionId,
          subjectId: scope.subjectId,
          ...data,
        },
      });
      results.push(saved);
    }

    res.json({ successCount: results.length, errorCount: errors.length, errors });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  TERM_EXAM_MAX_MARKS,
  getTermExamMarks,
  bulkUpsertTermExamMarks,
};


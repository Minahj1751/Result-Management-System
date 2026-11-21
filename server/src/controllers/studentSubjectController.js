const prisma = require('../config/database');

/**
 * Verify the requester may manage subject assignments for a class/section.
 * Admins always pass; class teachers need an active assignment for the
 * same academic session, class and section.
 */
const assertCanManageSubjects = async (req, { academicSessionId, schoolClassId, sectionId }) => {
  if (req.user.role === 'ADMIN') return;

  if (req.user.role !== 'CLASS_TEACHER') {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  const profile = req.user.teacherProfile;
  if (!profile) {
    const error = new Error('Teacher profile not found');
    error.statusCode = 403;
    throw error;
  }

  const assignment = await prisma.classTeacherAssignment.findFirst({
    where: {
      teacherId: profile.id,
      academicSessionId,
      schoolClassId,
      sectionId,
      isActive: true,
    },
  });

  if (!assignment) {
    const error = new Error('You are not assigned to this class and section');
    error.statusCode = 403;
    throw error;
  }
};

/**
 * Get per-student subject assignments for a class/section.
 * Query: academicSessionId, schoolClassId, sectionId
 */
const getStudentSubjects = async (req, res, next) => {
  try {
    const { academicSessionId, schoolClassId, sectionId } = req.query;

    if (!academicSessionId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'academicSessionId, schoolClassId and sectionId are required' });
    }

    await assertCanManageSubjects(req, { academicSessionId, schoolClassId, sectionId });

    const rows = await prisma.studentSubject.findMany({
      where: { academicSessionId, schoolClassId, sectionId },
      include: { student: true, subject: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json(rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Replace subject assignments for students in a class/section.
 * Body: { academicSessionId, schoolClassId, sectionId,
 *         assignments: [{ studentId, subjectIds: [string] }] }
 * Students absent from `assignments` keep their existing selection.
 * An empty subjectIds array clears that student's selection (falls back
 * to all class subjects on the marksheet).
 */
const setStudentSubjects = async (req, res, next) => {
  try {
    const { academicSessionId, schoolClassId, sectionId, assignments } = req.body;

    if (!academicSessionId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'academicSessionId, schoolClassId and sectionId are required' });
    }
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'assignments must be an array' });
    }

    await assertCanManageSubjects(req, { academicSessionId, schoolClassId, sectionId });

    // Validate students are enrolled in this class/section/session
    const studentIds = [...new Set(assignments.map((a) => a.studentId).filter(Boolean))];
    if (studentIds.length === 0) {
      return res.json({ updated: 0 });
    }

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        academicSessionId,
        schoolClassId,
        sectionId,
        isActive: true,
      },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrollments.map((e) => e.studentId));
    const invalid = studentIds.filter((id) => !enrolledIds.has(id));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Students not enrolled in this class/section: ${invalid.join(', ')}` });
    }

    // Validate subjects exist
    const allSubjectIds = [...new Set(assignments.flatMap((a) => (Array.isArray(a.subjectIds) ? a.subjectIds : [])))];
    if (allSubjectIds.length > 0) {
      const subjects = await prisma.subject.findMany({
        where: { id: { in: allSubjectIds } },
        select: { id: true },
      });
      const validIds = new Set(subjects.map((s) => s.id));
      const bad = allSubjectIds.filter((id) => !validIds.has(id));
      if (bad.length > 0) {
        return res.status(400).json({ error: `Invalid subject ids: ${bad.join(', ')}` });
      }
    }

    const scope = { academicSessionId, schoolClassId, sectionId };

    await prisma.$transaction(async (tx) => {
      for (const item of assignments) {
        if (!item.studentId) continue;
        const subjectIds = Array.isArray(item.subjectIds)
          ? [...new Set(item.subjectIds.filter(Boolean))]
          : [];

        await tx.studentSubject.deleteMany({
          where: { ...scope, studentId: item.studentId },
        });

        if (subjectIds.length > 0) {
          await tx.studentSubject.createMany({
            data: subjectIds.map((subjectId) => ({
              studentId: item.studentId,
              subjectId,
              ...scope,
            })),
          });
        }
      }
    });

    res.json({ updated: studentIds.length });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentSubjects,
  setStudentSubjects,
};

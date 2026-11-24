const prisma = require('../config/database');

const REQUIRED = ['studentId', 'academicSessionId', 'semesterId', 'schoolClassId', 'sectionId'];

const missingParams = (body) => REQUIRED.filter((key) => !body[key]);

/**
 * Verify the requester may manage remarks for this class/section:
 * admins always; class teachers only for their own assignment
 * (semester-specific or session-level).
 */
const assertRemarkAccess = async (req, { academicSessionId, semesterId, schoolClassId, sectionId, studentId }) => {
  if (req.user.role === 'ADMIN') return;

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
      OR: [{ semesterId }, { semesterId: null }],
    },
  });

  if (!assignment) {
    const error = new Error('You are not assigned to this class and section');
    error.statusCode = 403;
    throw error;
  }

  if (studentId) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        academicSessionId,
        schoolClassId,
        sectionId,
        isActive: true,
        OR: [{ semesterId }, { semesterId: null }],
      },
      select: { id: true },
    });
    if (!enrollment) {
      const error = new Error('Student is not enrolled in your class');
      error.statusCode = 403;
      throw error;
    }
  }
};

/**
 * List remarks for a section/semester
 */
const getSectionRemarks = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId } = req.query;
    const missing = REQUIRED.filter((key) => !req.query[key]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required parameters: ${missing.join(', ')}` });
    }

    await assertRemarkAccess(req, { academicSessionId, semesterId, schoolClassId, sectionId });

    const remarks = await prisma.studentRemark.findMany({
      where: { academicSessionId, semesterId, schoolClassId, sectionId },
      include: { student: { select: { id: true, studentId: true, fullName: true } } },
    });

    res.json(remarks);
  } catch (error) {
    next(error);
  }
};

/**
 * Upsert a class teacher remark for a student
 */
const upsertRemark = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId, remarks } = req.body;
    const missing = missingParams(req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required parameters: ${missing.join(', ')}` });
    }

    await assertRemarkAccess(req, { studentId, academicSessionId, semesterId, schoolClassId, sectionId });

    const remark = await prisma.studentRemark.upsert({
      where: {
        studentId_academicSessionId_semesterId_schoolClassId_sectionId_remark: {
          studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
        },
      },
      update: {
        remarks: remarks || '',
        updatedById: req.user.teacherProfile?.id || null,
      },
      create: {
        studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        remarks: remarks || '',
        updatedById: req.user.teacherProfile?.id || null,
      },
      include: { student: { select: { id: true, studentId: true, fullName: true } } },
    });

    res.json(remark);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSectionRemarks,
  upsertRemark,
};

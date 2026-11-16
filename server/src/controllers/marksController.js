const prisma = require('../config/database');

/**
 * Ensure the requesting teacher is assigned to the assessment's
 * session/semester/class/section/subject. Throws an http-error on failure.
 */
const assertTeacherAssignedToAssessment = async (req, assessment) => {
  const profile = req.user.teacherProfile;
  if (!profile) {
    const error = new Error('Teacher profile not found');
    error.statusCode = 403;
    throw error;
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      teacherId: profile.id,
      subjectId: assessment.subjectId,
      academicSessionId: assessment.academicSessionId,
      // Session-level assignments (semesterId NULL) apply to every exam in the session
      OR: [{ semesterId: assessment.semesterId }, { semesterId: null }],
      schoolClassId: assessment.schoolClassId,
      sectionId: assessment.sectionId,
      isActive: true,
    },
  });

  if (!assignment) {
    const error = new Error('You are not assigned to this class and subject');
    error.statusCode = 403;
    throw error;
  }

  return profile;
};

/**
 * Get marks entries
 */
const getMarksEntries = async (req, res, next) => {
  try {
    const { assessmentId, studentId, teacherId } = req.query;

    const where = {
      ...(assessmentId && { assessmentId }),
      ...(studentId && { studentId }),
      ...(teacherId && { teacherId }),
    };

    const marksEntries = await prisma.marksEntry.findMany({
      where,
      include: {
        student: true,
        assessment: {
          include: {
            category: true,
            subject: true,
            schoolClass: true,
            section: true,
          },
        },
        teacher: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(marksEntries);
  } catch (error) {
    next(error);
  }
};

/**
 * Get marks for a specific assessment (for marks entry table)
 */
const getAssessmentMarks = async (req, res, next) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        category: true,
        subject: true,
        schoolClass: true,
        section: true,
        academicSession: true,
        semester: true,
      },
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Get enrolled students: semester-specific enrollments plus the
    // session-level class roster (semesterId NULL). Deduped by student.
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId: assessment.academicSessionId,
        schoolClassId: assessment.schoolClassId,
        sectionId: assessment.sectionId,
        isActive: true,
        OR: [{ semesterId: assessment.semesterId }, { semesterId: null }],
      },
      include: {
        student: true,
      },
    });

    // Prefer the semester-specific enrollment (roll number) over the session roster
    const enrollmentByStudent = new Map();
    enrollments
      .sort((a, b) => (a.semesterId ? 0 : 1) - (b.semesterId ? 0 : 1))
      .forEach((e) => {
        if (!enrollmentByStudent.has(e.studentId)) enrollmentByStudent.set(e.studentId, e);
      });
    const roster = [...enrollmentByStudent.values()].sort(
      (a, b) => (a.rollNumber ?? 999999) - (b.rollNumber ?? 999999)
    );

    // Get existing marks entries
    const marksEntries = await prisma.marksEntry.findMany({
      where: { assessmentId },
      include: {
        student: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
    });

    // Create a map of studentId to marks entry
    const marksMap = new Map();
    marksEntries.forEach((entry) => {
      marksMap.set(entry.studentId, entry);
    });

    // Combine roster with marks
    const studentsWithMarks = roster.map((enrollment) => {
      const marksEntry = marksMap.get(enrollment.studentId);
      return {
        student: enrollment.student,
        enrollment,
        marks: marksEntry || null,
      };
    });

    res.json({
      assessment,
      students: studentsWithMarks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update marks entry
 */
const upsertMarksEntry = async (req, res, next) => {
  try {
    const { studentId, assessmentId, marksObtained, status, individualDate, remarks } = req.body;

    // Get assessment to validate maximum marks
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const teacherProfile = await assertTeacherAssignedToAssessment(req, assessment);

    // Validate marks
    if (marksObtained !== null && marksObtained !== undefined) {
      const marks = parseFloat(marksObtained);
      if (marks < 0) {
        return res.status(400).json({ error: 'Marks cannot be negative' });
      }
      if (marks > parseFloat(assessment.maximumMarks)) {
        return res.status(400).json({ error: `Marks cannot exceed maximum marks (${assessment.maximumMarks})` });
      }
    }

    const marksEntry = await prisma.marksEntry.upsert({
      where: {
        studentId_assessmentId: {
          studentId,
          assessmentId,
        },
      },
      update: {
        marksObtained: marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null,
        status: status || 'PENDING',
        individualDate: individualDate ? new Date(individualDate) : null,
        remarks,
        teacherId: teacherProfile.id,
      },
      create: {
        studentId,
        assessmentId,
        marksObtained: marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null,
        status: status || 'PENDING',
        individualDate: individualDate ? new Date(individualDate) : null,
        remarks,
        teacherId: teacherProfile.id,
      },
      include: {
        student: true,
        assessment: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
    });

    res.json(marksEntry);
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk upsert marks entries
 */
const bulkUpsertMarks = async (req, res, next) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const results = [];
    const errors = [];
    const authorizedAssessments = new Map();
    const teacherProfile = req.user.teacherProfile;

    if (!teacherProfile) {
      return res.status(403).json({ error: 'Teacher profile not found' });
    }

    for (const entry of entries) {
      try {
        const { studentId, assessmentId, marksObtained, status, individualDate, remarks } = entry;

        // Get assessment to validate maximum marks
        let assessment = authorizedAssessments.get(assessmentId);
        if (assessment === undefined) {
          const found = await prisma.assessment.findUnique({
            where: { id: assessmentId },
          });
          if (found) {
            await assertTeacherAssignedToAssessment(req, found);
          }
          assessment = found || null;
          authorizedAssessments.set(assessmentId, assessment);
        }

        if (!assessment) {
          errors.push({ entry, error: 'Assessment not found or not assigned to you' });
          continue;
        }

        // Validate marks
        if (marksObtained !== null && marksObtained !== undefined) {
          const marks = parseFloat(marksObtained);
          if (marks < 0) {
            errors.push({ entry, error: 'Marks cannot be negative' });
            continue;
          }
          if (marks > parseFloat(assessment.maximumMarks)) {
            errors.push({ entry, error: `Marks cannot exceed maximum marks (${assessment.maximumMarks})` });
            continue;
          }
        }

        const marksEntry = await prisma.marksEntry.upsert({
          where: {
            studentId_assessmentId: {
              studentId,
              assessmentId,
            },
          },
          update: {
            marksObtained: marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null,
            status: status || 'PENDING',
            individualDate: individualDate ? new Date(individualDate) : null,
            remarks,
            teacherId: teacherProfile.id,
          },
          create: {
            studentId,
            assessmentId,
            marksObtained: marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null,
            status: status || 'PENDING',
            individualDate: individualDate ? new Date(individualDate) : null,
            remarks,
            teacherId: teacherProfile.id,
          },
          include: {
            student: true,
            assessment: true,
          },
        });

        results.push(marksEntry);
      } catch (error) {
        errors.push({ entry, error: error.message });
      }
    }

    res.json({
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete marks entry
 */
const deleteMarksEntry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.marksEntry.findUnique({
      where: { id },
      include: { assessment: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Marks entry not found' });
    }

    await assertTeacherAssignedToAssessment(req, existing.assessment);

    await prisma.marksEntry.delete({
      where: { id },
    });

    res.json({ message: 'Marks entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMarksEntries,
  getAssessmentMarks,
  upsertMarksEntry,
  bulkUpsertMarks,
  deleteMarksEntry,
};

const prisma = require('../config/database');

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

    // Get enrolled students
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId: assessment.academicSessionId,
        semesterId: assessment.semesterId,
        schoolClassId: assessment.schoolClassId,
        sectionId: assessment.sectionId,
        isActive: true,
      },
      include: {
        student: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

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

    // Combine enrollments with marks
    const studentsWithMarks = enrollments.map((enrollment) => {
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
        teacherId: req.user.teacherProfile.id,
      },
      create: {
        studentId,
        assessmentId,
        marksObtained: marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null,
        status: status || 'PENDING',
        individualDate: individualDate ? new Date(individualDate) : null,
        remarks,
        teacherId: req.user.teacherProfile.id,
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

    for (const entry of entries) {
      try {
        const { studentId, assessmentId, marksObtained, status, individualDate, remarks } = entry;

        // Get assessment to validate maximum marks
        const assessment = await prisma.assessment.findUnique({
          where: { id: assessmentId },
        });

        if (!assessment) {
          errors.push({ entry, error: 'Assessment not found' });
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
            teacherId: req.user.teacherProfile.id,
          },
          create: {
            studentId,
            assessmentId,
            marksObtained: marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null,
            status: status || 'PENDING',
            individualDate: individualDate ? new Date(individualDate) : null,
            remarks,
            teacherId: req.user.teacherProfile.id,
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

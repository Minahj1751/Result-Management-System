const resultCalculationService = require('../services/resultCalculationService');
const prisma = require('../config/database');

/**
 * Calculate result for a student subject
 */
const calculateStudentResult = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId, subjectId } = req.query;

    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId || !subjectId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await resultCalculationService.calculateStudentSubjectResult(
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      subjectId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate results for entire class
 */
const parseSectionIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
};

const calculateClassResults = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, sectionIds } = req.query;

    if (!academicSessionId || !semesterId || !schoolClassId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ids = sectionIds ? parseSectionIds(sectionIds) : (sectionId ? [sectionId] : []);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'sectionId or sectionIds is required' });
    }

    const allResults = [];
    for (const sid of ids) {
      const results = await resultCalculationService.calculateClassResults(
        academicSessionId,
        semesterId,
        schoolClassId,
        sid
      );
      allResults.push(...results);
    }

    res.json(allResults);
  } catch (error) {
    next(error);
  }
};

/**
 * Finalize result snapshot
 */
const finalizeResult = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId, subjectId } = req.body;

    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId || !subjectId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const finalizedBy = req.user.teacherProfile?.id || req.user.id;

    const snapshot = await resultCalculationService.finalizeResultSnapshot(
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      subjectId,
      finalizedBy
    );

    res.json(snapshot);
  } catch (error) {
    next(error);
  }
};

/**
 * Get result snapshots for marksheet
 */
const getResultSnapshots = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;

    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const snapshots = await resultCalculationService.getResultSnapshot(
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId
    );

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    // Get enrollment details
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
      },
      include: {
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    // Get attendance
    const attendance = await prisma.attendanceRecord.findUnique({
      where: {
        studentId_academicSessionId_semesterId_schoolClassId_sectionId: {
          studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
        },
      },
    });

    // Get school settings
    const schoolSettings = await prisma.schoolSettings.findFirst();

    res.json({
      student,
      enrollment,
      attendance,
      schoolSettings,
      snapshots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk finalize results for a class
 */
const bulkFinalizeResults = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, sectionIds } = req.body;

    if (!academicSessionId || !semesterId || !schoolClassId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ids = sectionIds ? parseSectionIds(sectionIds) : (sectionId ? [sectionId] : []);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'sectionId or sectionIds is required' });
    }

    const finalizedBy = req.user.teacherProfile?.id || req.user.id;

    const results = [];
    const errors = [];

    for (const sid of ids) {
      // Get all enrolled students
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId: sid,
          isActive: true,
        },
      });

      // Only finalize subjects that actually have assessments for this class/section
      const assessments = await prisma.assessment.findMany({
        where: { academicSessionId, semesterId, schoolClassId, sectionId: sid },
        select: { subjectId: true },
        distinct: ['subjectId'],
      });
      const subjects = assessments.map((a) => ({ id: a.subjectId }));

      for (const enrollment of enrollments) {
        for (const subject of subjects) {
          try {
            const snapshot = await resultCalculationService.finalizeResultSnapshot(
              enrollment.studentId,
              academicSessionId,
              semesterId,
              schoolClassId,
              sid,
              subject.id,
              finalizedBy
            );
            results.push(snapshot);
          } catch (error) {
            errors.push({
              studentId: enrollment.studentId,
              sectionId: sid,
              subjectId: subject.id,
              error: error.message,
            });
          }
        }
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

module.exports = {
  calculateStudentResult,
  calculateClassResults,
  finalizeResult,
  getResultSnapshots,
  bulkFinalizeResults,
};

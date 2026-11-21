const pdfService = require('../services/pdfService');
const resultCalculationService = require('../services/resultCalculationService');
const prisma = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

const getStudentMarksheetData = async ({ studentId, academicSessionId, semesterId, schoolClassId, sectionId }) => {
  if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId) {
    const error = new Error('Missing required parameters');
    error.statusCode = 400;
    throw error;
  }

  // Get marksheet data (live calculation — works even without finalized snapshots/marks)
  const snapshots = await resultCalculationService.getStudentMarksheetSnapshots(
    studentId,
    academicSessionId,
    semesterId,
    schoolClassId,
    sectionId
  );

  const student = await prisma.student.findUnique({
    where: { id: studentId },
  });

  // Enrollment may be semester-specific or session-level (semesterId NULL)
  const enrollmentRows = await prisma.studentEnrollment.findMany({
    where: {
      studentId,
      academicSessionId,
      schoolClassId,
      sectionId,
      isActive: true,
      OR: [{ semesterId }, { semesterId: null }],
    },
    include: {
      academicSession: true,
      semester: true,
      schoolClass: true,
      section: true,
    },
  });
  const enrollment = enrollmentRows.find((e) => e.semesterId === semesterId) || enrollmentRows[0] || null;

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

  const schoolSettings = await prisma.schoolSettings.findFirst();
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { name: true },
  });

  return {
    student,
    enrollment,
    attendance,
    schoolSettings,
    semester,
    snapshots,
  };
};

const assertClassTeacherAccess = async (req, { studentId, academicSessionId, semesterId, schoolClassId, sectionId }) => {
  if (req.user.role !== 'CLASS_TEACHER') return;

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
};

/**
 * Generate individual student marksheet PDF
 */
const generateStudentMarksheet = async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const data = await getStudentMarksheetData(req.query);

    // Generate PDF
    const outputDir = path.join(__dirname, '../../temp');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `marksheet_${studentId}_${Date.now()}.pdf`);

    await pdfService.generateStudentMarksheetPDF(data, outputPath);

    // Send file
    res.download(outputPath, `marksheet_${data.student?.studentId || studentId}.pdf`, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up
      try {
        await fs.unlink(outputPath);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview individual student marksheet HTML
 */
const previewStudentMarksheet = async (req, res, next) => {
  try {
    await assertClassTeacherAccess(req, req.query);
    const data = await getStudentMarksheetData(req.query);
    const html = await pdfService.generateMarksheetHTML(data);
    res.type('html').send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Get missing marks for a student, grouped by subject
 */
const getStudentMissingMarks = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;

    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    await assertClassTeacherAccess(req, { studentId, academicSessionId, semesterId, schoolClassId, sectionId });

    const assessments = await prisma.assessment.findMany({
      where: { academicSessionId, semesterId, schoolClassId, sectionId },
      include: {
        subject: true,
        category: true,
        marksEntries: {
          where: { studentId },
        },
      },
    });

    const exemptStatuses = new Set(['ABSENT', 'EXEMPTED', 'NOT_APPLICABLE']);
    const bySubject = new Map();

    assessments.forEach((assessment) => {
      const entry = assessment.marksEntries[0];
      const hasMarks = entry && entry.marksObtained !== null && entry.marksObtained !== undefined;
      const isExempt = entry && exemptStatuses.has(entry.status);
      if (hasMarks || isExempt) return;

      if (!bySubject.has(assessment.subjectId)) {
        bySubject.set(assessment.subjectId, {
          subjectId: assessment.subject.id,
          subjectName: assessment.subject.name,
          sortOrder: assessment.subject.sortOrder ?? 0,
          missingCount: 0,
          assessments: [],
        });
      }

      const subject = bySubject.get(assessment.subjectId);
      subject.missingCount += 1;
      subject.assessments.push({
        id: assessment.id,
        name: assessment.name,
        categoryName: assessment.category.name,
        maximumMarks: Number(assessment.maximumMarks),
        date: assessment.defaultDate,
      });
    });

    const subjects = [...bySubject.values()]
      .map(({ sortOrder, ...subject }) => subject)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    res.json({
      studentId,
      totalMissing: subjects.reduce((sum, subject) => sum + subject.missingCount, 0),
      subjects,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate class marksheets ZIP
 */
const generateClassMarksheets = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, studentIds } = req.query;

    if (!academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const selectedIds = studentIds
      ? String(studentIds).split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    // Get enrolled students: semester-specific + session-level roster, deduped by student
    const enrollmentRows = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId,
        schoolClassId,
        sectionId,
        isActive: true,
        OR: [{ semesterId }, { semesterId: null }],
        ...(selectedIds && { studentId: { in: selectedIds } }),
      },
      include: {
        student: true,
      },
    });
    const enrollmentByStudent = new Map();
    enrollmentRows
      .sort((a, b) => (a.semesterId ? 0 : 1) - (b.semesterId ? 0 : 1))
      .forEach((e) => {
        if (!enrollmentByStudent.has(e.studentId)) enrollmentByStudent.set(e.studentId, e);
      });
    const enrollments = [...enrollmentByStudent.values()].sort(
      (a, b) => (a.rollNumber ?? 999999) - (b.rollNumber ?? 999999)
    );

    const schoolSettings = await prisma.schoolSettings.findFirst();
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      select: { name: true },
    });

    // Prepare data for all students
    const studentsData = [];
    for (const enrollment of enrollments) {
      const snapshots = await resultCalculationService.getStudentMarksheetSnapshots(
        enrollment.studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId
      );

      const attendance = await prisma.attendanceRecord.findUnique({
        where: {
          studentId_academicSessionId_semesterId_schoolClassId_sectionId: {
            studentId: enrollment.studentId,
            academicSessionId,
            semesterId,
            schoolClassId,
            sectionId,
          },
        },
      });

      studentsData.push({
        student: enrollment.student,
        enrollment,
        attendance,
        schoolSettings,
        semester,
        snapshots,
      });
    }

    // Generate ZIP
    const outputDir = path.join(__dirname, '../../temp');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `marksheets_${schoolClassId}_${sectionId}_${Date.now()}.zip`);

    await pdfService.generateClassMarksheetsZIP(studentsData, outputPath);

    // Send file
    res.download(outputPath, `marksheets_${schoolClassId}_${sectionId}.zip`, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up
      try {
        await fs.unlink(outputPath);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateStudentMarksheet,
  previewStudentMarksheet,
  getStudentMissingMarks,
  generateClassMarksheets,
};

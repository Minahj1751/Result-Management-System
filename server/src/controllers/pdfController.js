const pdfService = require('../services/pdfService');
const resultCalculationService = require('../services/resultCalculationService');
const prisma = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

/**
 * Generate individual student marksheet PDF
 */
const generateStudentMarksheet = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;

    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
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

    const data = {
      student,
      enrollment,
      attendance,
      schoolSettings,
      snapshots,
    };

    // Generate PDF
    const outputDir = path.join(__dirname, '../../temp');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `marksheet_${studentId}_${Date.now()}.pdf`);

    await pdfService.generateStudentMarksheetPDF(data, outputPath);

    // Send file
    res.download(outputPath, `marksheet_${student.studentId}.pdf`, async (err) => {
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
  generateClassMarksheets,
};

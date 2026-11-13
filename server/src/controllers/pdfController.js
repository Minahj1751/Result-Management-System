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

    // Get marksheet data
    const snapshots = await resultCalculationService.getResultSnapshot(
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId
    );

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

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

    // Get all enrolled students
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        isActive: true,
        ...(selectedIds && { studentId: { in: selectedIds } }),
      },
      include: {
        student: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

    const schoolSettings = await prisma.schoolSettings.findFirst();

    // Prepare data for all students
    const studentsData = [];
    for (const enrollment of enrollments) {
      const snapshots = await resultCalculationService.getResultSnapshot(
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

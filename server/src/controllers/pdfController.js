const pdfService = require('../services/pdfService');
const resultCalculationService = require('../services/resultCalculationService');
const semesterResultService = require('../services/semesterResultService');
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

    // Per-student subject selection: only report missing marks for assigned subjects
    const subjectRows = await prisma.studentSubject.findMany({
      where: { studentId, academicSessionId, schoolClassId, sectionId },
      select: { subjectId: true },
    });
    const subjectFilter = subjectRows.length > 0 ? new Set(subjectRows.map((r) => r.subjectId)) : null;

    const assessments = await prisma.assessment.findMany({
      where: {
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        ...(subjectFilter && { subjectId: { in: [...subjectFilter] } }),
      },
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

/**
 * Shared context for Semester Examination Report generation.
 * Computes section-wide results once so "Highest Marks Obtained" is
 * consistent across every student's report card.
 */
const getExamReportContext = async ({ academicSessionId, semesterId, schoolClassId, sectionId }) => {
  const [schoolSettings, semester, gradingPolicy, sectionData, classTeacherAssignment] = await Promise.all([
    prisma.schoolSettings.findFirst(),
    prisma.semester.findUnique({ where: { id: semesterId }, select: { name: true } }),
    prisma.gradingPolicy.findFirst({
      where: { isActive: true },
      include: { gradeScales: { orderBy: { minPercentage: 'desc' } } },
    }),
    semesterResultService.calculateSectionSemesterResults(academicSessionId, semesterId, schoolClassId, sectionId),
    prisma.classTeacherAssignment.findFirst({
      where: {
        academicSessionId,
        schoolClassId,
        sectionId,
        isActive: true,
        OR: [{ semesterId }, { semesterId: null }],
      },
      include: { teacher: true },
      orderBy: { semesterId: 'desc' },
    }),
  ]);

  const highestBySubject = {};
  sectionData.highestBySubject.forEach((value, key) => {
    highestBySubject[key] = value;
  });

  return {
    schoolSettings,
    semester,
    gradingPolicy,
    sectionData,
    highestBySubject,
    classTeacherName: classTeacherAssignment?.teacher?.fullName || '',
  };
};

const buildExamReportData = async (ctx, studentEntry) => {
  const { studentId, academicSessionId, semesterId, schoolClassId, sectionId } = studentEntry._keys;

  const [remark, summary] = await Promise.all([
    prisma.studentRemark.findUnique({
      where: {
        studentId_academicSessionId_semesterId_schoolClassId_sectionId_remark: {
          studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
        },
      },
    }),
    semesterResultService.computeSemesterSummary(studentEntry.subjectResults),
  ]);

  return {
    student: studentEntry.student,
    enrollment: studentEntry.enrollment,
    schoolSettings: ctx.schoolSettings,
    semester: ctx.semester,
    subjectResults: studentEntry.subjectResults,
    summary,
    highestBySubject: ctx.highestBySubject,
    remark: remark?.remarks || '',
    classTeacherName: ctx.classTeacherName,
    gradingPolicy: ctx.gradingPolicy,
  };
};

const findStudentEntry = (ctx, studentId) =>
  ctx.sectionData.students.find((s) => s.student.id === studentId);

/**
 * Preview individual student exam report HTML
 */
const previewStudentExamReport = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;
    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ctx = await getExamReportContext({ academicSessionId, semesterId, schoolClassId, sectionId });
    const entry = findStudentEntry(ctx, studentId);
    if (!entry) {
      return res.status(404).json({ error: 'Student not found in this class/section' });
    }

    const data = await buildExamReportData(ctx, {
      ...entry,
      _keys: { studentId, academicSessionId, semesterId, schoolClassId, sectionId },
    });

    const html = await pdfService.generateExamReportHTML(data);
    res.type('html').send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate individual student exam report PDF
 */
const generateStudentExamReport = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;
    if (!studentId || !academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ctx = await getExamReportContext({ academicSessionId, semesterId, schoolClassId, sectionId });
    const entry = findStudentEntry(ctx, studentId);
    if (!entry) {
      return res.status(404).json({ error: 'Student not found in this class/section' });
    }

    const data = await buildExamReportData(ctx, {
      ...entry,
      _keys: { studentId, academicSessionId, semesterId, schoolClassId, sectionId },
    });

    const outputDir = path.join(__dirname, '../../temp');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `exam_report_${studentId}_${Date.now()}.pdf`);

    await pdfService.generateStudentExamReportPDF(data, outputPath);

    res.download(outputPath, `exam_report_${data.student?.studentId || studentId}.pdf`, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
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
 * Generate class exam reports ZIP
 */
const generateClassExamReports = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, studentIds } = req.query;
    if (!academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const selectedIds = studentIds
      ? String(studentIds).split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const ctx = await getExamReportContext({ academicSessionId, semesterId, schoolClassId, sectionId });

    const keys = { academicSessionId, semesterId, schoolClassId, sectionId };
    const studentsData = [];
    for (const entry of ctx.sectionData.students) {
      if (selectedIds && !selectedIds.includes(entry.student.id)) continue;
      const data = await buildExamReportData(ctx, { ...entry, _keys: { ...keys, studentId: entry.student.id } });
      studentsData.push(data);
    }

    if (studentsData.length === 0) {
      return res.status(404).json({ error: 'No students found for exam report' });
    }

    const outputDir = path.join(__dirname, '../../temp');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `exam_reports_${schoolClassId}_${sectionId}_${Date.now()}.zip`);

    await pdfService.generateClassExamReportsZIP(studentsData, outputPath);

    res.download(outputPath, `exam_reports_${schoolClassId}_${sectionId}.zip`, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
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
  previewStudentExamReport,
  generateStudentExamReport,
  generateClassExamReports,
};

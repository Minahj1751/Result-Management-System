const ExcelJS = require('exceljs');
const prisma = require('../config/database');

/**
 * Helper: send an ExcelJS workbook as a download
 */
const sendWorkbook = async (res, workbook, filename) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

const buildEnrollmentWhere = ({ academicSessionId, semesterId, schoolClassId, sectionId }) => {
  const conditions = [];
  if (academicSessionId) conditions.push({ academicSessionId });
  if (semesterId) conditions.push({ semesterId });
  if (schoolClassId) conditions.push({ schoolClassId });
  if (sectionId) conditions.push({ sectionId });
  return conditions.length ? { AND: conditions } : {};
};

/**
 * Export students (with enrollments) to Excel
 */
const exportStudents = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, search, ids } = req.query;

    const selectedIds = ids
      ? String(ids).split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const where = {
      ...(selectedIds && { id: { in: selectedIds } }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentId: { contains: search, mode: 'insensitive' } },
          { admissionNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const students = await prisma.student.findMany({
      where,
      include: {
        enrollments: {
          where: buildEnrollmentWhere({ academicSessionId, semesterId, schoolClassId, sectionId }),
          include: {
            academicSession: true,
            semester: true,
            schoolClass: true,
            section: true,
          },
        },
      },
      orderBy: { studentId: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Students');
    ws.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Admission No', key: 'admissionNumber', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 30 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Guardian', key: 'guardian', width: 25 },
      { header: 'Guardian Phone', key: 'phone', width: 18 },
      { header: 'Session', key: 'session', width: 15 },
      { header: 'Semester', key: 'semester', width: 15 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Roll', key: 'roll', width: 8 },
      { header: 'Status', key: 'status', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const s of students) {
      const enrollments = s.enrollments.filter((e) => e.isActive);
      if (enrollments.length === 0) {
        ws.addRow({
          studentId: s.studentId,
          admissionNumber: s.admissionNumber || '',
          fullName: s.fullName,
          dob: s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : '',
          guardian: s.guardianName || '',
          phone: s.guardianPhone || '',
          status: s.isActive ? 'Active' : 'Inactive',
        });
      } else {
        for (const e of enrollments) {
          ws.addRow({
            studentId: s.studentId,
            admissionNumber: s.admissionNumber || '',
            fullName: s.fullName,
            dob: s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : '',
            guardian: s.guardianName || '',
            phone: s.guardianPhone || '',
            session: e.academicSession?.name || '',
            semester: e.semester?.name || '',
            className: e.schoolClass?.name || '',
            section: e.section?.name || '',
            roll: e.rollNumber,
            status: s.isActive ? 'Active' : 'Inactive',
          });
        }
      }
    }

    await sendWorkbook(res, workbook, `students_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

/**
 * Export attendance records to Excel
 */
const exportAttendance = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, studentId, ids } = req.query;

    const selectedIds = ids
      ? String(ids).split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const records = await prisma.attendanceRecord.findMany({
      where: {
        ...(academicSessionId && { academicSessionId }),
        ...(semesterId && { semesterId }),
        ...(schoolClassId && { schoolClassId }),
        ...(sectionId && { sectionId }),
        ...(studentId && { studentId }),
        ...(selectedIds && { studentId: { in: selectedIds } }),
      },
      include: {
        student: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
      orderBy: [{ schoolClass: { sortOrder: 'asc' } }, { student: { studentId: 'asc' } }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Attendance');
    ws.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Student Name', key: 'fullName', width: 30 },
      { header: 'Session', key: 'session', width: 15 },
      { header: 'Semester', key: 'semester', width: 15 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Working Days', key: 'working', width: 14 },
      { header: 'Days Attended', key: 'attended', width: 14 },
      { header: 'Percentage', key: 'pct', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const r of records) {
      ws.addRow({
        studentId: r.student?.studentId || '',
        fullName: r.student?.fullName || '',
        session: r.academicSession?.name || '',
        semester: r.semester?.name || '',
        className: r.schoolClass?.name || '',
        section: r.section?.name || '',
        working: r.totalWorkingDays,
        attended: r.daysAttended,
        pct: r.totalWorkingDays > 0 ? `${((r.daysAttended / r.totalWorkingDays) * 100).toFixed(2)}%` : '',
      });
    }

    await sendWorkbook(res, workbook, `attendance_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

/**
 * Export finalized result snapshots to Excel
 */
const exportResults = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, ids } = req.query;

    const selectedIds = ids
      ? String(ids).split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const snapshots = await prisma.resultSnapshot.findMany({
      where: {
        status: 'FINALIZED',
        ...(academicSessionId && { academicSessionId }),
        ...(semesterId && { semesterId }),
        ...(schoolClassId && { schoolClassId }),
        ...(sectionId && { sectionId }),
        ...(selectedIds && { studentId: { in: selectedIds } }),
      },
      include: {
        student: true,
        subject: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
      orderBy: [{ student: { studentId: 'asc' } }, { subject: { sortOrder: 'asc' } }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Results');
    ws.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Student Name', key: 'fullName', width: 30 },
      { header: 'Session', key: 'session', width: 15 },
      { header: 'Semester', key: 'semester', width: 15 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Subject', key: 'subject', width: 20 },
      { header: 'Score (%)', key: 'score', width: 12 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Grade Point', key: 'gp', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const s of snapshots) {
      ws.addRow({
        studentId: s.student?.studentId || '',
        fullName: s.student?.fullName || '',
        session: s.academicSession?.name || '',
        semester: s.semester?.name || '',
        className: s.schoolClass?.name || '',
        section: s.section?.name || '',
        subject: s.subject?.name || '',
        score: s.percentage !== null && s.percentage !== undefined ? Math.round(parseFloat(s.percentage)) : '',
        grade: s.grade || '',
        gp: s.gradePoint !== null ? parseFloat(s.gradePoint) : '',
      });
    }

    await sendWorkbook(res, workbook, `results_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

/**
 * Export teachers to Excel
 */
const exportTeachers = async (req, res, next) => {
  try {
    const { search, role, includeInactive } = req.query;

    const where = {
      role: {
        in: ['SUBJECT_TEACHER', 'CLASS_TEACHER'],
      },
      ...(role && ['SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(role) && { role }),
      ...(includeInactive !== 'true' ? { isActive: true } : {}),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { teacherProfile: { fullName: { contains: search, mode: 'insensitive' } } },
          { teacherProfile: { employeeId: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const teachers = await prisma.user.findMany({
      where,
      include: { teacherProfile: true },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Teachers');
    ws.columns = [
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Password', key: 'password', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 30 },
      { header: 'Role', key: 'role', width: 18 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Status', key: 'status', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const t of teachers) {
      ws.addRow({
        email: t.email,
        password: '',
        fullName: t.teacherProfile?.fullName || '',
        role: t.role === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher',
        employeeId: t.teacherProfile?.employeeId || '',
        phone: t.teacherProfile?.phone || '',
        designation: t.teacherProfile?.designation || '',
        dob: t.teacherProfile?.dateOfBirth ? t.teacherProfile.dateOfBirth.toISOString().slice(0, 10) : '',
        address: t.teacherProfile?.address || '',
        status: t.isActive ? 'Active' : 'Inactive',
      });
    }

    await sendWorkbook(res, workbook, `teachers_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

/**
 * Export subjects to Excel
 */
const exportSubjects = async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Subjects');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Sort Order', key: 'sortOrder', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const s of subjects) {
      ws.addRow({
        name: s.name,
        code: s.code || '',
        sortOrder: s.sortOrder,
      });
    }

    await sendWorkbook(res, workbook, `subjects_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

/**
 * Export assessments to Excel (same column layout as the import template)
 */
const exportAssessments = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, subjectId, categoryId } = req.query;

    const assessments = await prisma.assessment.findMany({
      where: {
        ...(academicSessionId && { academicSessionId }),
        ...(semesterId && { semesterId }),
        ...(schoolClassId && { schoolClassId }),
        ...(sectionId && { sectionId }),
        ...(subjectId && { subjectId }),
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        subject: true,
      },
      orderBy: [{ academicSession: { name: 'asc' } }, { semester: { name: 'asc' } }, { name: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Assessments');
    ws.columns = [
      { header: 'Session', key: 'session', width: 18 },
      { header: 'Semester', key: 'semester', width: 18 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Subject', key: 'subject', width: 20 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Assessment Name', key: 'assessmentName', width: 25 },
      { header: 'Maximum Marks', key: 'maximumMarks', width: 15 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Submission Status', key: 'submissionStatus', width: 18 },
      { header: 'Publication Status', key: 'publicationStatus', width: 18 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const a of assessments) {
      ws.addRow({
        session: a.academicSession?.name || '',
        semester: a.semester?.name || '',
        className: a.schoolClass?.name || '',
        section: a.section?.name || '',
        subject: a.subject?.name || '',
        category: a.category?.name || '',
        assessmentName: a.name,
        maximumMarks: parseFloat(a.maximumMarks),
        date: a.defaultDate ? a.defaultDate.toISOString().slice(0, 10) : '',
        submissionStatus: a.submissionStatus,
        publicationStatus: a.publicationStatus,
      });
    }

    await sendWorkbook(res, workbook, `assessments_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

/**
 * Export marks entries to Excel (same column layout as the import template)
 */
const exportMarks = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, subjectId, assessmentId, studentId } = req.query;

    const entries = await prisma.marksEntry.findMany({
      where: {
        ...(studentId && { studentId }),
        ...(assessmentId && { assessmentId }),
        ...(academicSessionId || semesterId || schoolClassId || sectionId || subjectId
          ? {
              assessment: {
                ...(academicSessionId && { academicSessionId }),
                ...(semesterId && { semesterId }),
                ...(schoolClassId && { schoolClassId }),
                ...(sectionId && { sectionId }),
                ...(subjectId && { subjectId }),
              },
            }
          : {}),
      },
      include: {
        student: { include: { enrollments: true } },
        assessment: {
          include: {
            category: true,
            academicSession: true,
            semester: true,
            schoolClass: true,
            section: true,
            subject: true,
          },
        },
        teacher: true,
      },
      orderBy: [{ student: { studentId: 'asc' } }, { assessment: { name: 'asc' } }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Marks');
    ws.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Session', key: 'session', width: 18 },
      { header: 'Semester', key: 'semester', width: 18 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Subject', key: 'subject', width: 20 },
      { header: 'Assessment', key: 'assessment', width: 25 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Maximum Marks', key: 'maximumMarks', width: 15 },
      { header: 'Marks', key: 'marks', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Remarks', key: 'remarks', width: 25 },
      { header: 'Teacher', key: 'teacher', width: 25 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const e of entries) {
      const a = e.assessment;
      const enrollment = (e.student?.enrollments || []).find((en) =>
        en.academicSessionId === a.academicSessionId &&
        en.schoolClassId === a.schoolClassId &&
        en.sectionId === a.sectionId &&
        (en.semesterId === a.semesterId || en.semesterId === null)
      );
      ws.addRow({
        studentId: e.student?.studentId || '',
        session: a.academicSession?.name || '',
        semester: a.semester?.name || '',
        className: a.schoolClass?.name || '',
        section: a.section?.name || '',
        subject: a.subject?.name || '',
        assessment: a.name,
        category: a.category?.name || '',
        maximumMarks: parseFloat(a.maximumMarks),
        marks: e.marksObtained !== null && e.marksObtained !== undefined ? parseFloat(e.marksObtained) : '',
        status: e.status,
        date: (e.individualDate || a.defaultDate)
          ? new Date(e.individualDate || a.defaultDate).toISOString().slice(0, 10)
          : '',
        remarks: e.remarks || '',
        teacher: e.teacher?.fullName || '',
      });
    }

    await sendWorkbook(res, workbook, `marks_export_${Date.now()}.xlsx`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportStudents,
  exportTeachers,
  exportSubjects,
  exportAttendance,
  exportResults,
  exportAssessments,
  exportMarks,
};

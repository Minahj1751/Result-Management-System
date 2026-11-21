const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const prisma = require('../config/database');

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toDate = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Generate Excel template for student import
 */
const generateStudentTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  // Define columns
  worksheet.columns = [
    { header: 'Student ID*', key: 'studentId', width: 20 },
    { header: 'Full Name*', key: 'fullName', width: 30 },
    { header: 'Admission Number', key: 'admissionNumber', width: 20 },
    { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
    { header: 'Guardian Name', key: 'guardianName', width: 25 },
    { header: 'Guardian Phone', key: 'guardianPhone', width: 15 },
    { header: 'Class', key: 'className', width: 15 },
    { header: 'Section', key: 'sectionName', width: 10 },
    { header: 'Roll Number', key: 'rollNumber', width: 12 },
    { header: 'Academic Session', key: 'academicSession', width: 20 },
  ];

  // Add sample data
  worksheet.addRow({
    studentId: 'STU00001',
    admissionNumber: 'ADM00001',
    fullName: 'John Doe',
    dateOfBirth: '2010-01-15',
    guardianName: 'Jane Doe',
    guardianPhone: '+8801712345678',
    className: 'Grade 3',
    sectionName: 'A',
    rollNumber: 1,
    academicSession: '2025-26',
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  return workbook;
};

/**
 * Parse uploaded Excel file
 */
const parseStudentExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const rows = [];
  const headers = [];
  let headerRow = 1;

  // Find header row
  worksheet.eachRow((row, rowNumber) => {
    if (row.values[1] === 'Student ID*') {
      headerRow = rowNumber;
    }
  });

  // Extract headers
  const headerRowData = worksheet.getRow(headerRow);
  headerRowData.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Extract data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > headerRow) {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        rowData[headers[colNumber]] = cell.value;
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });

  return { headers, rows };
};

const extractStudentRow = (row) => ({
  studentId: str(cell(row, 'Student ID')),
  fullName: str(cell(row, 'Full Name')),
  admissionNumber: str(cell(row, 'Admission Number')) || str(cell(row, 'Admission No')),
  dateOfBirth: cell(row, 'Date of Birth'),
  guardianName: str(cell(row, 'Guardian Name')) || str(cell(row, 'Guardian')),
  guardianPhone: str(cell(row, 'Guardian Phone')) || str(cell(row, 'Phone')),
  className: str(cell(row, 'Class')),
  sectionName: str(cell(row, 'Section')),
  rollRaw: cell(row, 'Roll Number') ?? cell(row, 'Roll'),
  sessionName: str(cell(row, 'Academic Session')) || str(cell(row, 'Session')),
  semesterName: str(cell(row, 'Semester')),
  status: str(cell(row, 'Status')),
});

const hasEnrollmentData = (r) =>
  [r.sessionName, r.semesterName, r.className, r.sectionName, str(r.rollRaw)].some((v) => v !== '');

/**
 * Validate student import data.
 * Supports two row shapes:
 *  - Profile only: Student ID, Full Name (+ optional Admission No, DOB, Guardian, Phone, Status)
 *  - With enrollment: also Class, Section, Roll Number, Academic Session, Semester
 * Existing Student IDs are updated (upsert) instead of rejected.
 */
const validateStudentImport = async (rows) => {
  const validRows = [];
  const invalidRows = [];
  const duplicateStudentIds = new Set();
  const seenRowKeys = new Set();

  const existingStudents = await prisma.student.findMany({
    select: { id: true, studentId: true, admissionNumber: true },
  });
  const existingStudentIds = new Set(existingStudents.map((s) => s.studentId));
  const studentIdOwner = new Map(existingStudents.map((s) => [s.studentId, s]));
  const admissionOwner = new Map(
    existingStudents.filter((s) => s.admissionNumber).map((s) => [s.admissionNumber, s])
  );

  const academicSessions = await prisma.academicSession.findMany({
    select: { id: true, name: true, isActive: true },
  });
  const sessionMap = new Map(academicSessions.map((s) => [s.name, s.id]));

  const semesters = await prisma.semester.findMany({
    select: { id: true, name: true, academicSessionId: true },
  });
  const semesterMap = new Map(semesters.map((s) => [s.name, s.id]));

  const classes = await prisma.schoolClass.findMany({
    select: { id: true, name: true },
  });
  const classMap = new Map(classes.map((c) => [c.name, c.id]));

  const sections = await prisma.section.findMany({
    select: { id: true, name: true, schoolClassId: true },
  });
  const sectionMap = new Map();
  sections.forEach((s) => {
    sectionMap.set(`${s.schoolClassId}-${s.name}`, s.id);
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const r = extractStudentRow(row);
    const errors = [];

    if (!r.studentId) {
      errors.push('Student ID is required');
    }

    if (!r.fullName) {
      errors.push('Full Name is required');
    }

    if (r.admissionNumber) {
      const owner = admissionOwner.get(r.admissionNumber);
      if (owner && owner.studentId !== r.studentId) {
        errors.push('Admission Number already exists');
      }
    }

    if (r.guardianPhone && !/^\+?[0-9]{10,15}$/.test(r.guardianPhone.replace(/[\s-]/g, ''))) {
      errors.push('Invalid Guardian Phone number');
    }

    if (r.dateOfBirth && !toDate(r.dateOfBirth)) {
      errors.push('Invalid Date of Birth');
    }

    const enrollment = hasEnrollmentData(r);
    let enrollmentKey = '';
    if (enrollment) {
      // Session: explicit name, else fall back to the active session
      let resolvedSessionName = r.sessionName;
      if (!resolvedSessionName) {
        const activeSession = academicSessions.find((s) => s.isActive) || academicSessions[0];
        resolvedSessionName = activeSession?.name || '';
        if (!resolvedSessionName) errors.push('No academic session available');
      }
      if (resolvedSessionName && !sessionMap.has(resolvedSessionName)) {
        errors.push('Invalid Academic Session');
      }

      // Semester is optional (session-level roster); validate only if provided
      if (r.semesterName) {
        if (!semesterMap.has(r.semesterName)) {
          errors.push('Invalid Semester');
        } else if (resolvedSessionName && sessionMap.has(resolvedSessionName)) {
          const sem = semesters.find((s) => s.name === r.semesterName);
          const sess = academicSessions.find((s) => s.name === resolvedSessionName);
          if (sem && sess && sem.academicSessionId !== sess.id) {
            errors.push('Semester does not belong to the session');
          }
        }
      }

      if (!r.className) {
        errors.push('Class is required when enrolling');
      } else if (!classMap.has(r.className)) {
        errors.push('Invalid Class');
      }

      // Section: explicit, else auto-resolve when the class has exactly one section
      let resolvedSectionName = r.sectionName;
      if (r.className && classMap.has(r.className)) {
        const classId = classMap.get(r.className);
        const classSections = sections.filter((s) => s.schoolClassId === classId);
        if (!resolvedSectionName) {
          if (classSections.length === 1) {
            resolvedSectionName = classSections[0].name;
          } else {
            errors.push(classSections.length === 0 ? 'No sections exist for this class' : 'Section is required (class has multiple sections)');
          }
        } else if (!sectionMap.has(`${classId}-${resolvedSectionName}`)) {
          errors.push('Invalid Section');
        }
      } else if (!resolvedSectionName) {
        errors.push('Section is required when enrolling');
      }

      if (str(r.rollRaw) && (!Number.isInteger(Number(r.rollRaw)) || Number(r.rollRaw) < 1)) {
        errors.push('Roll Number must be a positive integer');
      }

      enrollmentKey = [resolvedSessionName, r.semesterName, r.className, resolvedSectionName].join('|');
    }

    // Duplicate detection: same student + same enrollment target (or profile-only twice)
    if (r.studentId) {
      const rowKey = `${r.studentId}|${enrollment ? enrollmentKey : 'profile'}`.toLowerCase();
      if (seenRowKeys.has(rowKey)) {
        errors.push('Duplicate row in file');
        duplicateStudentIds.add(r.studentId);
      } else {
        seenRowKeys.add(rowKey);
      }
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: i + 2,
        data: row,
        errors,
      });
    } else {
      validRows.push({
        data: row,
        isUpdate: existingStudentIds.has(r.studentId),
      });
    }
  }

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateStudentIds: Array.from(duplicateStudentIds),
  };
};

/**
 * Confirm student import
 * Accepts an array of raw row data objects (header-name keyed).
 * Lookup maps are rebuilt server-side — clients cannot send Maps via JSON.
 */
const confirmStudentImport = async (rows) => {
  const importedStudents = [];
  const errors = [];

  // Rebuild lookup maps from the database
  const academicSessions = await prisma.academicSession.findMany({
    select: { id: true, name: true, isActive: true },
  });
  const sessionMap = new Map(academicSessions.map((s) => [s.name, s.id]));

  const semesters = await prisma.semester.findMany({
    select: { id: true, name: true },
  });
  const semesterMap = new Map(semesters.map((s) => [s.name, s.id]));

  const classes = await prisma.schoolClass.findMany({
    select: { id: true, name: true },
  });
  const classMap = new Map(classes.map((c) => [c.name, c.id]));

  const sections = await prisma.section.findMany({
    select: { id: true, name: true, schoolClassId: true },
  });
  const sectionMap = new Map();
  sections.forEach((s) => {
    sectionMap.set(`${s.schoolClassId}-${s.name}`, s.id);
  });

  const existingStudents = await prisma.student.findMany({
    select: { id: true, studentId: true },
  });
  const studentByStudentId = new Map(existingStudents.map((s) => [s.studentId, s.id]));

  for (const data of rows) {
    try {
      const r = extractStudentRow(data);
      const dob = toDate(r.dateOfBirth);
      const isActive = r.status ? r.status.toLowerCase() !== 'inactive' : undefined;

      // Upsert student profile by Student ID
      let studentId = studentByStudentId.get(r.studentId);
      let student;
      if (studentId) {
        const updateData = { fullName: r.fullName || undefined };
        if (r.admissionNumber) updateData.admissionNumber = r.admissionNumber;
        if (r.dateOfBirth !== undefined && r.dateOfBirth !== null && r.dateOfBirth !== '') updateData.dateOfBirth = dob;
        if (r.guardianName) updateData.guardianName = r.guardianName;
        if (r.guardianPhone) updateData.guardianPhone = r.guardianPhone;
        if (isActive !== undefined) updateData.isActive = isActive;
        student = await prisma.student.update({
          where: { id: studentId },
          data: updateData,
        });
      } else {
        student = await prisma.student.create({
          data: {
            studentId: r.studentId,
            admissionNumber: r.admissionNumber || null,
            fullName: r.fullName,
            dateOfBirth: dob,
            guardianName: r.guardianName || null,
            guardianPhone: r.guardianPhone || null,
            isActive: isActive !== undefined ? isActive : true,
          },
        });
        studentByStudentId.set(r.studentId, student.id);
        studentId = student.id;
      }

      // Optional enrollment: session + class + section (+ optional semester/roll)
      if (hasEnrollmentData(r)) {
        // Session: explicit name, else the active session
        let sessionName = r.sessionName;
        if (!sessionName) {
          const active = academicSessions.find((s) => s.isActive) || academicSessions[0];
          sessionName = active?.name;
        }
        const academicSessionId = sessionName ? sessionMap.get(sessionName) : null;
        if (!academicSessionId) throw new Error(`Academic Session not found: ${sessionName || '(active session)'}`);

        const semesterId = r.semesterName ? semesterMap.get(r.semesterName) || null : null;
        if (r.semesterName && !semesterId) throw new Error(`Semester not found: ${r.semesterName}`);

        const classId = r.className ? classMap.get(r.className) : null;
        if (r.className && !classId) throw new Error(`Class not found: ${r.className}`);

        let sectionName = r.sectionName;
        if (classId && !sectionName) {
          const classSections = sections.filter((s) => s.schoolClassId === classId);
          if (classSections.length === 1) sectionName = classSections[0].name;
        }
        const sectionId = classId && sectionName ? sectionMap.get(`${classId}-${sectionName}`) : null;
        if (!sectionId) throw new Error(`Section not found: ${sectionName || '(auto)'}`);

        const rollNumber = str(r.rollRaw) ? parseInt(r.rollRaw, 10) : null;
        const existingEnrollment = await prisma.studentEnrollment.findFirst({
          where: {
            studentId,
            academicSessionId,
            schoolClassId: classId,
            sectionId,
            ...(semesterId ? { semesterId } : { semesterId: null }),
          },
        });
        if (existingEnrollment) {
          await prisma.studentEnrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              ...(rollNumber !== null && { rollNumber }),
              isActive: true,
            },
          });
        } else {
          await prisma.studentEnrollment.create({
            data: {
              studentId,
              academicSessionId,
              semesterId,
              schoolClassId: classId,
              sectionId,
              rollNumber,
              isActive: true,
            },
          });
        }
      }

      importedStudents.push(student);
    } catch (error) {
      errors.push({
        data,
        error: error.message,
      });
    }
  }

  return {
    importedCount: importedStudents.length,
    failedCount: errors.length,
    importedStudents,
    errors,
  };
};

const TEACHER_ROLE_MAP = {
  'subject teacher': 'SUBJECT_TEACHER',
  'class teacher': 'CLASS_TEACHER',
  subject_teacher: 'SUBJECT_TEACHER',
  class_teacher: 'CLASS_TEACHER',
};

const normalizeTeacherRole = (value) => {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return TEACHER_ROLE_MAP[key] || null;
};

// Row cells may be keyed with or without the template's '*' required markers
const cell = (row, name) => row[name] ?? row[`${name}*`];

/**
 * Generate Excel template for teacher import
 */
const generateTeacherTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Teachers');

  worksheet.columns = [
    { header: 'Email*', key: 'email', width: 30 },
    { header: 'Password', key: 'password', width: 20 },
    { header: 'Full Name*', key: 'fullName', width: 30 },
    { header: 'Role*', key: 'role', width: 20 },
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
    { header: 'Address', key: 'address', width: 30 },
  ];

  worksheet.addRow({
    email: 'teacher@example.com',
    password: 'password123',
    fullName: 'Jane Smith',
    role: 'Subject Teacher',
    employeeId: 'EMP001',
    phone: '+8801712345678',
    designation: 'Senior Teacher',
    dateOfBirth: '1985-05-20',
    address: 'Dhaka, Bangladesh',
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  return workbook;
};

/**
 * Parse uploaded teacher Excel file
 */
const parseTeacherExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const rows = [];
  const headers = [];
  let headerRow = 1;

  worksheet.eachRow((row, rowNumber) => {
    if (row.values[1] === 'Email*') {
      headerRow = rowNumber;
    }
  });

  const headerRowData = worksheet.getRow(headerRow);
  headerRowData.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > headerRow) {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header == null) return;
        // Normalize header names so exported files (without '*' markers) also import cleanly
        const key = String(header).replace(/\*+$/, '');
        rowData[key] = cell.value;
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });

  return { headers, rows };
};

/**
 * Validate teacher import data
 */
const validateTeacherImport = async (rows) => {
  const validRows = [];
  const invalidRows = [];
  const duplicateEmails = new Set();
  const seenEmails = new Set();

  const existingUsers = await prisma.user.findMany({
    where: { role: { in: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'ADMIN'] } },
    select: { email: true },
  });
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const email = cell(row, 'Email') ? String(cell(row, 'Email')).trim().toLowerCase() : '';
    const emailExists = email ? existingEmails.has(email) : false;
    if (!email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid email format');
    } else if (seenEmails.has(email)) {
      errors.push('Duplicate email in file');
      duplicateEmails.add(email);
    } else {
      seenEmails.add(email);
    }

    const password = cell(row, 'Password') ? String(cell(row, 'Password')) : '';
    if (!password) {
      if (!emailExists) {
        errors.push('Password is required for new teachers');
      }
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    const fullName = cell(row, 'Full Name') ? String(cell(row, 'Full Name')).trim() : '';
    if (!fullName) {
      errors.push('Full Name is required');
    } else if (fullName.length < 2 || fullName.length > 100) {
      errors.push('Full Name must be between 2 and 100 characters');
    }

    if (!normalizeTeacherRole(cell(row, 'Role'))) {
      errors.push('Role must be "Subject Teacher" or "Class Teacher"');
    }

    if (row['Phone'] && !/^\+?[0-9]{10,15}$/.test(String(row['Phone']).replace(/[\s-]/g, ''))) {
      errors.push('Invalid Phone number');
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: i + 2,
        data: row,
        errors,
      });
    } else {
      validRows.push({ data: row });
    }
  }

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateEmails: Array.from(duplicateEmails),
  };
};

/**
 * Confirm teacher import
 */
const confirmTeacherImport = async (rows) => {
  const importedTeachers = [];
  const errors = [];

  const existingUsers = await prisma.user.findMany({
    where: { role: { in: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'ADMIN'] } },
    select: { id: true, email: true },
  });
  const userIdByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u.id]));

  for (const data of rows) {
    try {
      const email = String(cell(data, 'Email')).trim().toLowerCase();
      const role = normalizeTeacherRole(cell(data, 'Role'));
      const password = cell(data, 'Password') ? String(cell(data, 'Password')) : '';
      const profileData = {
        fullName: String(cell(data, 'Full Name')).trim(),
        employeeId: cell(data, 'Employee ID') ? String(cell(data, 'Employee ID')).trim() : null,
        phone: cell(data, 'Phone') ? String(cell(data, 'Phone')).trim() : null,
        designation: cell(data, 'Designation') ? String(cell(data, 'Designation')).trim() : null,
        dateOfBirth: cell(data, 'Date of Birth') ? new Date(cell(data, 'Date of Birth')) : null,
        address: cell(data, 'Address') ? String(cell(data, 'Address')).trim() : null,
      };

      const existingId = userIdByEmail.get(email);
      let teacher;
      if (existingId) {
        // Existing teacher: update profile (and password/role only if provided)
        teacher = await prisma.user.update({
          where: { id: existingId },
          data: {
            ...(role && { role }),
            ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
            teacherProfile: { update: profileData },
          },
          include: { teacherProfile: true },
        });
      } else {
        if (!password) {
          throw new Error('Password is required for new teachers');
        }
        teacher = await prisma.user.create({
          data: {
            email,
            passwordHash: await bcrypt.hash(password, 10),
            role,
            isActive: true,
            teacherProfile: { create: profileData },
          },
          include: { teacherProfile: true },
        });
        userIdByEmail.set(email, teacher.id);
      }

      const { passwordHash: _, ...teacherWithoutPassword } = teacher;
      importedTeachers.push(teacherWithoutPassword);
    } catch (error) {
      errors.push({
        data,
        error: error.message,
      });
    }
  }

  return {
    importedCount: importedTeachers.length,
    failedCount: errors.length,
    importedTeachers,
    errors,
  };
};

/**
 * Generate Excel template for subject import
 */
const generateSubjectTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Subjects');

  worksheet.columns = [
    { header: 'Name*', key: 'name', width: 30 },
    { header: 'Code', key: 'code', width: 15 },
    { header: 'Sort Order', key: 'sortOrder', width: 12 },
  ];

  worksheet.addRow({
    name: 'Mathematics',
    code: 'MATH',
    sortOrder: 1,
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  return workbook;
};

/**
 * Parse uploaded subject Excel file
 */
const parseSubjectExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const rows = [];
  const headers = [];
  let headerRow = 1;

  worksheet.eachRow((row, rowNumber) => {
    if (row.values[1] === 'Name*') {
      headerRow = rowNumber;
    }
  });

  const headerRowData = worksheet.getRow(headerRow);
  headerRowData.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > headerRow) {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header == null) return;
        const key = String(header).replace(/\*+$/, '');
        rowData[key] = cell.value;
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });

  return { headers, rows };
};

/**
 * Validate subject import data
 */
const validateSubjectImport = async (rows) => {
  const validRows = [];
  const invalidRows = [];
  const duplicateNames = new Set();
  const seenNames = new Set();

  const existingSubjects = await prisma.subject.findMany({
    select: { id: true, name: true, code: true },
  });
  const subjectByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]));
  const subjectByCode = new Map(existingSubjects.filter((s) => s.code).map((s) => [s.code.toLowerCase(), s]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const name = cell(row, 'Name') ? String(cell(row, 'Name')).trim() : '';
    if (!name) {
      errors.push('Name is required');
    } else if (name.length < 2 || name.length > 100) {
      errors.push('Name must be between 2 and 100 characters');
    } else if (seenNames.has(name.toLowerCase())) {
      errors.push('Duplicate name in file');
      duplicateNames.add(name);
    } else {
      seenNames.add(name.toLowerCase());
    }

    const code = cell(row, 'Code') ? String(cell(row, 'Code')).trim() : '';
    if (code) {
      if (code.length < 2 || code.length > 10) {
        errors.push('Code must be between 2 and 10 characters');
      } else {
        const codeOwner = subjectByCode.get(code.toLowerCase());
        const nameOwner = subjectByName.get(name.toLowerCase());
        if (codeOwner && (!nameOwner || codeOwner.id !== nameOwner.id)) {
          errors.push(`Code "${code}" already used by "${codeOwner.name}"`);
        }
      }
    }

    const sortOrderRaw = cell(row, 'Sort Order');
    if (sortOrderRaw !== undefined && sortOrderRaw !== null && sortOrderRaw !== '') {
      const sortOrder = Number(sortOrderRaw);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        errors.push('Sort Order must be a non-negative integer');
      }
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: i + 2,
        data: row,
        errors,
      });
    } else {
      validRows.push({ data: row });
    }
  }

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateNames: Array.from(duplicateNames),
  };
};

/**
 * Confirm subject import (upsert by name)
 */
const confirmSubjectImport = async (rows) => {
  const importedSubjects = [];
  const errors = [];

  const existingSubjects = await prisma.subject.findMany({
    select: { id: true, name: true, code: true },
  });
  const subjectByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]));

  for (const data of rows) {
    try {
      const name = String(cell(data, 'Name')).trim();
      const code = cell(data, 'Code') ? String(cell(data, 'Code')).trim() : null;
      const sortOrderRaw = cell(data, 'Sort Order');
      const sortOrder = sortOrderRaw === undefined || sortOrderRaw === null || sortOrderRaw === ''
        ? 0
        : parseInt(sortOrderRaw, 10);

      const existing = subjectByName.get(name.toLowerCase());
      let subject;
      if (existing) {
        subject = await prisma.subject.update({
          where: { id: existing.id },
          data: {
            ...(code !== null && { code }),
            sortOrder,
          },
        });
      } else {
        subject = await prisma.subject.create({
          data: { name, code, sortOrder },
        });
        subjectByName.set(name.toLowerCase(), subject);
      }

      importedSubjects.push(subject);
    } catch (error) {
      errors.push({
        data,
        error: error.message,
      });
    }
  }

  return {
    importedCount: importedSubjects.length,
    failedCount: errors.length,
    importedSubjects,
    errors,
  };
};

// ---------------------------------------------------------------------------
// Shared helpers for the newer import types
// ---------------------------------------------------------------------------

const styleSheet = (worksheet) => {
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
};

const parseSheet = async (buffer, markerHeader) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const rows = [];
  const headers = [];
  let headerRow = 1;

  worksheet.eachRow((row, rowNumber) => {
    if (row.values[1] === markerHeader) {
      headerRow = rowNumber;
    }
  });

  worksheet.getRow(headerRow).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > headerRow) {
      const rowData = {};
      row.eachCell((c, colNumber) => {
        const header = headers[colNumber];
        if (header == null) return;
        const key = String(header).replace(/\*+$/, '');
        rowData[key] = c.value;
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });

  return { headers, rows };
};

const lowerMap = (items, keyFn) => {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (key) map.set(String(key).toLowerCase(), item);
  });
  return map;
};

// ---------------------------------------------------------------------------
// Assessment import
// ---------------------------------------------------------------------------

const ASSESSMENT_STATUSES = ['DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED'];
const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED'];

const generateAssessmentTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Assessments');

  worksheet.columns = [
    { header: 'Session*', key: 'session', width: 18 },
    { header: 'Semester*', key: 'semester', width: 18 },
    { header: 'Class*', key: 'className', width: 12 },
    { header: 'Section*', key: 'section', width: 10 },
    { header: 'Subject*', key: 'subject', width: 20 },
    { header: 'Category*', key: 'category', width: 18 },
    { header: 'Assessment Name*', key: 'assessmentName', width: 25 },
    { header: 'Maximum Marks*', key: 'maximumMarks', width: 15 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Submission Status', key: 'submissionStatus', width: 18 },
    { header: 'Publication Status', key: 'publicationStatus', width: 18 },
  ];

  worksheet.addRow({
    session: '2025-26',
    semester: 'First Term',
    className: 'Grade 9',
    section: 'A',
    subject: 'Mathematics',
    category: 'Class Test',
    assessmentName: 'CT-1',
    maximumMarks: 20,
    date: '2025-09-10',
    submissionStatus: 'DRAFT',
    publicationStatus: 'DRAFT',
  });

  styleSheet(worksheet);
  return workbook;
};

const parseAssessmentExcel = async (buffer) => parseSheet(buffer, 'Session*');

const loadAssessmentLookups = async () => {
  const [sessions, semesters, classes, sections, subjects, categories] = await Promise.all([
    prisma.academicSession.findMany(),
    prisma.semester.findMany({ include: { academicSession: true } }),
    prisma.schoolClass.findMany(),
    prisma.section.findMany({ include: { schoolClass: true } }),
    prisma.subject.findMany(),
    prisma.assessmentCategory.findMany(),
  ]);

  const semesterByKey = new Map();
  semesters.forEach((s) => {
    semesterByKey.set(`${s.academicSession.name}|${s.name}`.toLowerCase(), s);
    semesterByKey.set(s.name.toLowerCase(), s);
  });

  const sectionByKey = new Map();
  sections.forEach((s) => {
    sectionByKey.set(`${s.schoolClass.name}|${s.name}`.toLowerCase(), s);
    sectionByKey.set(s.name.toLowerCase(), s);
  });

  const subjectByName = lowerMap(subjects, (s) => s.name);
  subjects.forEach((s) => { if (s.code) subjectByName.set(s.code.toLowerCase(), s); });

  const categoryByName = lowerMap(categories, (c) => c.name);
  categories.forEach((c) => { if (c.code) categoryByName.set(c.code.toLowerCase(), c); });

  return {
    sessionByName: lowerMap(sessions, (s) => s.name),
    semesterByKey,
    classByName: lowerMap(classes, (c) => c.name),
    sectionByKey,
    subjectByName,
    categoryByName,
  };
};

const resolveAssessmentRow = (row, lk) => {
  const errors = [];
  const sessionName = str(cell(row, 'Session'));
  const semesterName = str(cell(row, 'Semester'));
  const className = str(cell(row, 'Class'));
  const sectionName = str(cell(row, 'Section'));
  const subjectName = str(cell(row, 'Subject'));
  const categoryName = str(cell(row, 'Category'));
  const assessmentName = str(cell(row, 'Assessment Name'));

  const session = lk.sessionByName.get(sessionName.toLowerCase());
  if (!sessionName) errors.push('Session is required');
  else if (!session) errors.push(`Session "${sessionName}" not found`);

  let semester = null;
  if (semesterName) {
    semester = lk.semesterByKey.get(`${sessionName}|${semesterName}`.toLowerCase())
      || lk.semesterByKey.get(semesterName.toLowerCase());
    if (!semester) errors.push(`Semester "${semesterName}" not found`);
    else if (session && semester.academicSessionId !== session.id) {
      errors.push(`Semester "${semesterName}" does not belong to session "${sessionName}"`);
    }
  } else {
    errors.push('Semester is required');
  }

  const schoolClass = lk.classByName.get(className.toLowerCase());
  if (!className) errors.push('Class is required');
  else if (!schoolClass) errors.push(`Class "${className}" not found`);

  let section = null;
  if (sectionName) {
    section = lk.sectionByKey.get(`${className}|${sectionName}`.toLowerCase())
      || lk.sectionByKey.get(sectionName.toLowerCase());
    if (!section) errors.push(`Section "${sectionName}" not found`);
    else if (schoolClass && section.schoolClassId !== schoolClass.id) {
      errors.push(`Section "${sectionName}" does not belong to class "${className}"`);
    }
  } else {
    errors.push('Section is required');
  }

  const subject = lk.subjectByName.get(subjectName.toLowerCase());
  if (!subjectName) errors.push('Subject is required');
  else if (!subject) errors.push(`Subject "${subjectName}" not found`);

  const category = lk.categoryByName.get(categoryName.toLowerCase());
  if (!categoryName) errors.push('Category is required');
  else if (!category) errors.push(`Category "${categoryName}" not found`);

  if (!assessmentName) errors.push('Assessment Name is required');

  const maxRaw = cell(row, 'Maximum Marks');
  const maximumMarks = maxRaw === undefined || maxRaw === null || maxRaw === '' ? NaN : Number(maxRaw);
  if (!Number.isFinite(maximumMarks) || maximumMarks <= 0) {
    errors.push('Maximum Marks must be a positive number');
  }

  const submissionStatus = str(cell(row, 'Submission Status')).toUpperCase();
  if (submissionStatus && !ASSESSMENT_STATUSES.includes(submissionStatus)) {
    errors.push(`Submission Status must be one of: ${ASSESSMENT_STATUSES.join(', ')}`);
  }
  const publicationStatus = str(cell(row, 'Publication Status')).toUpperCase();
  if (publicationStatus && !PUBLICATION_STATUSES.includes(publicationStatus)) {
    errors.push(`Publication Status must be one of: ${PUBLICATION_STATUSES.join(', ')}`);
  }

  return {
    errors,
    resolved: {
      session,
      semester,
      schoolClass,
      section,
      subject,
      category,
      assessmentName,
      maximumMarks,
      defaultDate: toDate(cell(row, 'Date')),
      submissionStatus: submissionStatus || null,
      publicationStatus: publicationStatus || null,
    },
  };
};

const assessmentKey = (r) =>
  [r.session?.id, r.semester?.id, r.schoolClass?.id, r.section?.id, r.subject?.id, r.category?.id, r.assessmentName]
    .map((v) => (v || '').toString().toLowerCase()).join('|');

const validateAssessmentImport = async (rows) => {
  const lk = await loadAssessmentLookups();
  const validRows = [];
  const invalidRows = [];
  const seenKeys = new Set();
  const duplicates = [];

  const existing = await prisma.assessment.findMany({
    include: { category: true, academicSession: true, semester: true, schoolClass: true, section: true, subject: true },
  });
  const existingKeys = new Map(existing.map((a) => [
    [a.academicSessionId, a.semesterId, a.schoolClassId, a.sectionId, a.subjectId, a.categoryId, a.name.toLowerCase()].join('|'),
    a,
  ]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { errors, resolved } = resolveAssessmentRow(row, lk);

    if (errors.length === 0) {
      const key = assessmentKey(resolved);
      if (seenKeys.has(key)) {
        errors.push('Duplicate assessment in file');
        duplicates.push(resolved.assessmentName);
      } else {
        seenKeys.add(key);
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: i + 2, data: row, errors });
    } else {
      const dbKey = [resolved.session.id, resolved.semester.id, resolved.schoolClass.id, resolved.section.id,
        resolved.subject.id, resolved.category.id, resolved.assessmentName.toLowerCase()].join('|');
      validRows.push({ data: row, resolved, existing: existingKeys.get(dbKey) || null });
    }
  }

  return { totalRows: rows.length, validRows, invalidRows, duplicates };
};

const confirmAssessmentImport = async (validRows) => {
  const imported = [];
  const errors = [];

  for (const item of validRows) {
    const r = item.resolved || item;
    try {
      const data = {
        name: r.assessmentName,
        categoryId: r.category.id,
        academicSessionId: r.session.id,
        semesterId: r.semester.id,
        schoolClassId: r.schoolClass.id,
        sectionId: r.section.id,
        subjectId: r.subject.id,
        maximumMarks: r.maximumMarks,
        defaultDate: r.defaultDate,
        ...(r.submissionStatus && { submissionStatus: r.submissionStatus }),
        ...(r.publicationStatus && { publicationStatus: r.publicationStatus }),
      };
      const existing = item.existing || null;
      const assessment = existing
        ? await prisma.assessment.update({ where: { id: existing.id }, data })
        : await prisma.assessment.create({ data });
      imported.push(assessment);
    } catch (error) {
      errors.push({ data: item.data || item, error: error.message });
    }
  }

  return { importedCount: imported.length, failedCount: errors.length, imported, errors };
};

// ---------------------------------------------------------------------------
// Marks import
// ---------------------------------------------------------------------------

const MARK_STATUSES = ['PENDING', 'ABSENT', 'EXEMPTED', 'NOT_APPLICABLE'];

const generateMarksTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Marks');

  worksheet.columns = [
    { header: 'Student ID*', key: 'studentId', width: 15 },
    { header: 'Session*', key: 'session', width: 18 },
    { header: 'Semester*', key: 'semester', width: 18 },
    { header: 'Class*', key: 'className', width: 12 },
    { header: 'Section*', key: 'section', width: 10 },
    { header: 'Subject*', key: 'subject', width: 20 },
    { header: 'Assessment*', key: 'assessment', width: 25 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Marks', key: 'marks', width: 10 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Remarks', key: 'remarks', width: 25 },
    { header: 'Teacher Email', key: 'teacherEmail', width: 25 },
  ];

  worksheet.addRow({
    studentId: 'STU00001',
    session: '2025-26',
    semester: 'First Term',
    className: 'Grade 9',
    section: 'A',
    subject: 'Mathematics',
    assessment: 'CT-1',
    category: 'Class Test',
    marks: 18,
    status: 'PENDING',
    date: '',
    remarks: '',
    teacherEmail: '',
  });

  styleSheet(worksheet);
  return workbook;
};

const parseMarksExcel = async (buffer) => parseSheet(buffer, 'Student ID*');

const validateMarksImport = async (rows) => {
  const lk = await loadAssessmentLookups();

  const [students, assessments, users] = await Promise.all([
    prisma.student.findMany({ select: { id: true, studentId: true, admissionNumber: true, fullName: true } }),
    prisma.assessment.findMany({
      include: { category: true, academicSession: true, semester: true, schoolClass: true, section: true, subject: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'ADMIN'] }, isActive: true },
      include: { teacherProfile: true },
    }),
  ]);

  const studentById = lowerMap(students, (s) => s.studentId);
  students.forEach((s) => { if (s.admissionNumber) studentById.set(s.admissionNumber.toLowerCase(), s); });

  const assessmentByScopeName = new Map();
  assessments.forEach((a) => {
    const key = [a.academicSession.name, a.semester.name, a.schoolClass.name, a.section.name, a.subject.name, a.name]
      .map((v) => String(v).toLowerCase()).join('|');
    if (!assessmentByScopeName.has(key)) assessmentByScopeName.set(key, []);
    assessmentByScopeName.get(key).push(a);
  });

  const teacherByEmail = new Map();
  users.forEach((u) => {
    if (u.teacherProfile) teacherByEmail.set(u.email.toLowerCase(), u.teacherProfile);
  });

  // Fallback teacher: first active subject assignment matching assessment scope
  const fallbackTeachers = new Map();
  const getFallbackTeacher = async (assessment) => {
    if (fallbackTeachers.has(assessment.id)) return fallbackTeachers.get(assessment.id);
    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        subjectId: assessment.subjectId,
        academicSessionId: assessment.academicSessionId,
        OR: [{ semesterId: assessment.semesterId }, { semesterId: null }],
        schoolClassId: assessment.schoolClassId,
        sectionId: assessment.sectionId,
        isActive: true,
      },
      select: { teacherId: true },
    });
    fallbackTeachers.set(assessment.id, assignment?.teacherId || null);
    return assignment?.teacherId || null;
  };

  const validRows = [];
  const invalidRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const studentKey = str(cell(row, 'Student ID'));
    const student = studentById.get(studentKey.toLowerCase());
    if (!studentKey) errors.push('Student ID is required');
    else if (!student) errors.push(`Student "${studentKey}" not found`);

    const scope = resolveAssessmentRow({ ...row, 'Assessment Name': cell(row, 'Assessment'), 'Maximum Marks': 1 }, lk);
    // Reuse scope resolution but ignore assessment-name/marks errors
    const scopeErrors = scope.errors.filter((e) =>
      !e.includes('Assessment Name') && !e.includes('Maximum Marks') && !e.includes('Submission Status') && !e.includes('Publication Status'));
    errors.push(...scopeErrors);
    const { session, semester, schoolClass, section, subject, category } = scope.resolved;

    const assessmentName = str(cell(row, 'Assessment'));
    if (!assessmentName) errors.push('Assessment is required');

    let assessment = null;
    if (!scopeErrors.length && assessmentName) {
      const key = [session.name, semester.name, schoolClass.name, section.name, subject.name, assessmentName]
        .map((v) => String(v).toLowerCase()).join('|');
      const matches = (assessmentByScopeName.get(key) || []).filter((a) => {
        if (!category) return true;
        return a.categoryId === category.id;
      });
      const categoryName = str(cell(row, 'Category'));
      if (matches.length === 0) {
        errors.push(`Assessment "${assessmentName}" not found for this class/subject`);
      } else if (matches.length > 1 && categoryName && !category) {
        errors.push(`Multiple assessments named "${assessmentName}" — please fill the Category column`);
      } else if (matches.length > 1) {
        errors.push(`Assessment "${assessmentName}" is ambiguous — check Category`);
      } else {
        assessment = matches[0];
      }
    }

    const marksRaw = cell(row, 'Marks');
    const marks = marksRaw === undefined || marksRaw === null || marksRaw === '' ? null : Number(marksRaw);
    if (marks !== null && (!Number.isFinite(marks) || marks < 0)) {
      errors.push('Marks must be a non-negative number');
    } else if (marks !== null && assessment && marks > parseFloat(assessment.maximumMarks)) {
      errors.push(`Marks cannot exceed maximum (${assessment.maximumMarks})`);
    }

    const status = str(cell(row, 'Status')).toUpperCase() || 'PENDING';
    if (!MARK_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${MARK_STATUSES.join(', ')}`);
    }
    if (status !== 'PENDING' && marks !== null) {
      errors.push('Marks and Status are mutually exclusive — fill only one');
    }
    if (status === 'PENDING' && marks === null) {
      errors.push('Provide either Marks or a Status (ABSENT/EXEMPTED/NOT_APPLICABLE)');
    }

    const teacherEmail = str(cell(row, 'Teacher Email'));
    let teacherProfile = null;
    if (teacherEmail) {
      teacherProfile = teacherByEmail.get(teacherEmail.toLowerCase());
      if (!teacherProfile) errors.push(`Teacher "${teacherEmail}" not found`);
    } else if (assessment) {
      teacherProfile = { id: await getFallbackTeacher(assessment) };
      if (!teacherProfile.id) {
        errors.push('No teacher assigned to this subject — fill Teacher Email');
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: i + 2, data: row, errors });
    } else {
      validRows.push({
        data: row,
        resolved: {
          student,
          assessment,
          marksObtained: marks,
          status,
          individualDate: toDate(cell(row, 'Date')),
          remarks: str(cell(row, 'Remarks')) || null,
          teacherId: teacherProfile.id,
        },
      });
    }
  }

  return { totalRows: rows.length, validRows, invalidRows };
};

const confirmMarksImport = async (validRows) => {
  const imported = [];
  const errors = [];

  for (const item of validRows) {
    const r = item.resolved || item;
    try {
      const entry = await prisma.marksEntry.upsert({
        where: {
          studentId_assessmentId: {
            studentId: r.student.id,
            assessmentId: r.assessment.id,
          },
        },
        update: {
          marksObtained: r.marksObtained,
          status: r.status,
          individualDate: r.individualDate,
          remarks: r.remarks,
          teacherId: r.teacherId,
        },
        create: {
          studentId: r.student.id,
          assessmentId: r.assessment.id,
          marksObtained: r.marksObtained,
          status: r.status,
          individualDate: r.individualDate,
          remarks: r.remarks,
          teacherId: r.teacherId,
        },
      });
      imported.push(entry);
    } catch (error) {
      errors.push({ data: item.data || item, error: error.message });
    }
  }

  return { importedCount: imported.length, failedCount: errors.length, imported, errors };
};

module.exports = {
  generateStudentTemplate,
  parseStudentExcel,
  validateStudentImport,
  confirmStudentImport,
  generateTeacherTemplate,
  parseTeacherExcel,
  validateTeacherImport,
  confirmTeacherImport,
  generateSubjectTemplate,
  parseSubjectExcel,
  validateSubjectImport,
  confirmSubjectImport,
  generateAssessmentTemplate,
  parseAssessmentExcel,
  validateAssessmentImport,
  confirmAssessmentImport,
  generateMarksTemplate,
  parseMarksExcel,
  validateMarksImport,
  confirmMarksImport,
};

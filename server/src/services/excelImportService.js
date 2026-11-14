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
    { header: 'Semester', key: 'semester', width: 15 },
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
    semester: 'First Term',
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
    select: { id: true, name: true },
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
      for (const [label, value] of [
        ['Academic Session', r.sessionName],
        ['Semester', r.semesterName],
        ['Class', r.className],
        ['Section', r.sectionName],
      ]) {
        if (!value) errors.push(`${label} is required when enrolling`);
      }
      if (!str(r.rollRaw) || !Number.isInteger(Number(r.rollRaw)) || Number(r.rollRaw) < 1) {
        errors.push('Valid Roll Number is required when enrolling');
      }
      if (r.sessionName && !sessionMap.has(r.sessionName)) errors.push('Invalid Academic Session');
      if (r.semesterName && !semesterMap.has(r.semesterName)) errors.push('Invalid Semester');
      if (r.className && !classMap.has(r.className)) errors.push('Invalid Class');
      if (r.className && r.sectionName && classMap.has(r.className)) {
        const classId = classMap.get(r.className);
        if (!sectionMap.has(`${classId}-${r.sectionName}`)) errors.push('Invalid Section');
      }
      enrollmentKey = [r.sessionName, r.semesterName, r.className, r.sectionName].join('|');
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
    select: { id: true, name: true },
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

      // Optional enrollment when Class/Section/Roll/Session/Semester are provided
      if (hasEnrollmentData(r)) {
        const classId = classMap.get(r.className);
        const sectionId = sectionMap.get(`${classId}-${r.sectionName}`);
        const academicSessionId = sessionMap.get(r.sessionName);
        const semesterId = semesterMap.get(r.semesterName);
        if (!classId) throw new Error(`Class not found: ${r.className}`);
        if (!sectionId) throw new Error(`Section not found: ${r.sectionName}`);
        if (!academicSessionId) throw new Error(`Academic Session not found: ${r.sessionName}`);
        if (!semesterId) throw new Error(`Semester not found: ${r.semesterName}`);

        const rollNumber = parseInt(r.rollRaw, 10);
        const existingEnrollment = await prisma.studentEnrollment.findFirst({
          where: {
            studentId,
            academicSessionId,
            semesterId,
            schoolClassId: classId,
            sectionId,
          },
        });
        if (existingEnrollment) {
          await prisma.studentEnrollment.update({
            where: { id: existingEnrollment.id },
            data: { rollNumber, isActive: true },
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
};

const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const prisma = require('../config/database');

/**
 * Generate Excel template for student import
 */
const generateStudentTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  // Define columns
  worksheet.columns = [
    { header: 'Student ID*', key: 'studentId', width: 20 },
    { header: 'Admission Number', key: 'admissionNumber', width: 20 },
    { header: 'Full Name*', key: 'fullName', width: 30 },
    { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
    { header: 'Guardian Name', key: 'guardianName', width: 25 },
    { header: 'Guardian Phone', key: 'guardianPhone', width: 15 },
    { header: 'Class*', key: 'className', width: 15 },
    { header: 'Section*', key: 'sectionName', width: 10 },
    { header: 'Roll Number*', key: 'rollNumber', width: 12 },
    { header: 'Academic Session*', key: 'academicSession', width: 20 },
    { header: 'Semester*', key: 'semester', width: 15 },
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

/**
 * Validate student import data
 */
const validateStudentImport = async (rows) => {
  const validRows = [];
  const invalidRows = [];
  const duplicateStudentIds = new Set();
  const seenStudentIds = new Set();

  // Get existing data for validation
  const existingStudents = await prisma.student.findMany({
    select: { studentId: true, admissionNumber: true },
  });

  const existingStudentIds = new Set(existingStudents.map((s) => s.studentId));
  const existingAdmissionNumbers = new Set(existingStudents.map((s) => s.admissionNumber).filter(Boolean));

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
    const errors = [];

    // Required fields
    if (!row['Student ID*'] || !row['Student ID*'].trim()) {
      errors.push('Student ID is required');
    } else if (seenStudentIds.has(row['Student ID*'])) {
      errors.push('Duplicate Student ID in file');
      duplicateStudentIds.add(row['Student ID*']);
    } else if (existingStudentIds.has(row['Student ID*'])) {
      errors.push('Student ID already exists in database');
    } else {
      seenStudentIds.add(row['Student ID*']);
    }

    if (!row['Full Name*'] || !row['Full Name*'].trim()) {
      errors.push('Full Name is required');
    }

    if (!row['Class*'] || !row['Class*'].trim()) {
      errors.push('Class is required');
    }

    if (!row['Section*'] || !row['Section*'].trim()) {
      errors.push('Section is required');
    }

    if (!row['Roll Number*'] || isNaN(row['Roll Number*'])) {
      errors.push('Valid Roll Number is required');
    }

    if (!row['Academic Session*'] || !row['Academic Session*'].trim()) {
      errors.push('Academic Session is required');
    }

    if (!row['Semester*'] || !row['Semester*'].trim()) {
      errors.push('Semester is required');
    }

    // Validate references
    if (row['Academic Session*'] && !sessionMap.has(row['Academic Session*'])) {
      errors.push('Invalid Academic Session');
    }

    if (row['Semester*'] && !semesterMap.has(row['Semester*'])) {
      errors.push('Invalid Semester');
    }

    if (row['Class*'] && !classMap.has(row['Class*'])) {
      errors.push('Invalid Class');
    }

    if (row['Admission Number'] && existingAdmissionNumbers.has(row['Admission Number'])) {
      errors.push('Admission Number already exists');
    }

    // Validate phone number if provided
    if (row['Guardian Phone'] && !/^\+?[0-9]{10,15}$/.test(row['Guardian Phone'].replace(/[\s-]/g, ''))) {
      errors.push('Invalid Guardian Phone number');
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
        sessionMap,
        semesterMap,
        classMap,
        sectionMap,
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

  for (const data of rows) {
    try {

      // Create student
      const student = await prisma.student.create({
        data: {
          studentId: data['Student ID*'],
          admissionNumber: data['Admission Number'] || null,
          fullName: data['Full Name*'],
          dateOfBirth: data['Date of Birth'] ? new Date(data['Date of Birth']) : null,
          guardianName: data['Guardian Name'] || null,
          guardianPhone: data['Guardian Phone'] || null,
          isActive: true,
        },
      });

      // Get class ID
      const classId = classMap.get(data['Class*']);
      if (!classId) {
        throw new Error(`Class not found: ${data['Class*']}`);
      }

      // Get section ID
      const sectionId = sectionMap.get(`${classId}-${data['Section*']}`);
      if (!sectionId) {
        throw new Error(`Section not found: ${data['Section*']}`);
      }

      // Get session ID
      const academicSessionId = sessionMap.get(data['Academic Session*']);
      if (!academicSessionId) {
        throw new Error(`Academic Session not found: ${data['Academic Session*']}`);
      }

      // Get semester ID
      const semesterId = semesterMap.get(data['Semester*']);
      if (!semesterId) {
        throw new Error(`Semester not found: ${data['Semester*']}`);
      }

      // Create enrollment
      await prisma.studentEnrollment.create({
        data: {
          studentId: student.id,
          academicSessionId,
          semesterId,
          schoolClassId: classId,
          sectionId,
          rollNumber: parseInt(data['Roll Number*']),
          isActive: true,
        },
      });

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

module.exports = {
  generateStudentTemplate,
  parseStudentExcel,
  validateStudentImport,
  confirmStudentImport,
  generateTeacherTemplate,
  parseTeacherExcel,
  validateTeacherImport,
  confirmTeacherImport,
};

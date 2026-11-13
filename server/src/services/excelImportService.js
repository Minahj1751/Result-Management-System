const ExcelJS = require('exceljs');
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
 */
const confirmStudentImport = async (validRows) => {
  const importedStudents = [];
  const errors = [];

  for (const row of validRows) {
    try {
      const { data, sessionMap, semesterMap, classMap, sectionMap } = row;

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
        data: row.data,
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

module.exports = {
  generateStudentTemplate,
  parseStudentExcel,
  validateStudentImport,
  confirmStudentImport,
};

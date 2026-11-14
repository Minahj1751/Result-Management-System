const excelImportService = require('../services/excelImportService');

/**
 * Download student import template
 */
const downloadTemplate = async (req, res, next) => {
  try {
    const workbook = await excelImportService.generateStudentTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Preview student import
 */
const previewImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { headers, rows } = await excelImportService.parseStudentExcel(req.file.buffer);

    const validation = await excelImportService.validateStudentImport(rows);

    res.json({
      headers,
      preview: rows.slice(0, 10), // Show first 10 rows as preview
      validation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm student import
 */
const confirmImport = async (req, res, next) => {
  try {
    // Accept either { rows: [...] } or legacy { validRows: [{ data: {...} }, ...] }
    let rows = req.body.rows;
    if (!rows && Array.isArray(req.body.validRows)) {
      rows = req.body.validRows.map((r) => (r && r.data ? r.data : r));
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid rows data' });
    }

    // Re-validate server-side to prevent importing bad/duplicate data
    const validation = await excelImportService.validateStudentImport(rows);
    if (validation.invalidRows.length > 0) {
      return res.status(400).json({
        error: `${validation.invalidRows.length} row(s) failed validation`,
        invalidRows: validation.invalidRows,
      });
    }

    const result = await excelImportService.confirmStudentImport(validation.validRows.map((r) => r.data));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Download teacher import template
 */
const downloadTeacherTemplate = async (req, res, next) => {
  try {
    const workbook = await excelImportService.generateTeacherTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=teacher_import_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Preview teacher import
 */
const previewTeacherImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { headers, rows } = await excelImportService.parseTeacherExcel(req.file.buffer);

    const validation = await excelImportService.validateTeacherImport(rows);

    res.json({
      headers,
      preview: rows.slice(0, 10),
      validation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm teacher import
 */
const confirmTeacherImport = async (req, res, next) => {
  try {
    let rows = req.body.rows;
    if (!rows && Array.isArray(req.body.validRows)) {
      rows = req.body.validRows.map((r) => (r && r.data ? r.data : r));
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid rows data' });
    }

    const validation = await excelImportService.validateTeacherImport(rows);
    if (validation.invalidRows.length > 0) {
      return res.status(400).json({
        error: `${validation.invalidRows.length} row(s) failed validation`,
        invalidRows: validation.invalidRows,
      });
    }

    const result = await excelImportService.confirmTeacherImport(validation.validRows.map((r) => r.data));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Download subject import template
 */
const downloadSubjectTemplate = async (req, res, next) => {
  try {
    const workbook = await excelImportService.generateSubjectTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=subject_import_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Preview subject import
 */
const previewSubjectImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { headers, rows } = await excelImportService.parseSubjectExcel(req.file.buffer);

    const validation = await excelImportService.validateSubjectImport(rows);

    res.json({
      headers,
      preview: rows.slice(0, 10),
      validation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm subject import
 */
const confirmSubjectImport = async (req, res, next) => {
  try {
    let rows = req.body.rows;
    if (!rows && Array.isArray(req.body.validRows)) {
      rows = req.body.validRows.map((r) => (r && r.data ? r.data : r));
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid rows data' });
    }

    const validation = await excelImportService.validateSubjectImport(rows);
    if (validation.invalidRows.length > 0) {
      return res.status(400).json({
        error: `${validation.invalidRows.length} row(s) failed validation`,
        invalidRows: validation.invalidRows,
      });
    }

    const result = await excelImportService.confirmSubjectImport(validation.validRows.map((r) => r.data));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  downloadTemplate,
  previewImport,
  confirmImport,
  downloadTeacherTemplate,
  previewTeacherImport,
  confirmTeacherImport,
  downloadSubjectTemplate,
  previewSubjectImport,
  confirmSubjectImport,
};

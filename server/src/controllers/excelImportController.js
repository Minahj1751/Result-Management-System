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
    const { validRows } = req.body;

    if (!validRows || !Array.isArray(validRows)) {
      return res.status(400).json({ error: 'Invalid validRows data' });
    }

    const result = await excelImportService.confirmStudentImport(validRows);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  downloadTemplate,
  previewImport,
  confirmImport,
};

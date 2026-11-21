const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { authenticate, isAdmin, authorize } = require('../middleware/auth');

const isAdminOrClassTeacher = authorize('ADMIN', 'CLASS_TEACHER');

// PDF generation
router.get('/student/preview', authenticate, isAdminOrClassTeacher, pdfController.previewStudentMarksheet);
router.get('/student/missing-marks', authenticate, isAdminOrClassTeacher, pdfController.getStudentMissingMarks);
router.get('/student', authenticate, isAdmin, pdfController.generateStudentMarksheet);
router.get('/class', authenticate, isAdmin, pdfController.generateClassMarksheets);

module.exports = router;

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

// Semester Examination Report (admin only)
router.get('/exam-report/student/preview', authenticate, isAdmin, pdfController.previewStudentExamReport);
router.get('/exam-report/student', authenticate, isAdmin, pdfController.generateStudentExamReport);
router.get('/exam-report/class', authenticate, isAdmin, pdfController.generateClassExamReports);

module.exports = router;

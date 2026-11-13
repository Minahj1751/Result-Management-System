const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { authenticate, isAdmin } = require('../middleware/auth');

// PDF generation
router.get('/student', authenticate, isAdmin, pdfController.generateStudentMarksheet);
router.get('/class', authenticate, isAdmin, pdfController.generateClassMarksheets);

module.exports = router;

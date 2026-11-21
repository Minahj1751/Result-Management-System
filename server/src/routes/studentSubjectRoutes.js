const express = require('express');
const router = express.Router();
const studentSubjectController = require('../controllers/studentSubjectController');
const { authenticate } = require('../middleware/auth');

// Per-student subject assignments (session-wise)
router.get('/', authenticate, studentSubjectController.getStudentSubjects);
router.put('/', authenticate, studentSubjectController.setStudentSubjects);

module.exports = router;

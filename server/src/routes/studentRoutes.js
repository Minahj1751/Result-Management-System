const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createStudentValidation, createEnrollmentValidation } = require('../validators/studentValidator');
const { idParamValidation } = require('../validators/academicValidator');

// Students
router.get('/', authenticate, studentController.getStudents);
router.post('/', authenticate, isAdmin, createStudentValidation, validate, studentController.createStudent);
router.get('/:id', authenticate, idParamValidation, validate, studentController.getStudentById);
router.patch('/:id', authenticate, isAdmin, idParamValidation, validate, studentController.updateStudent);

// Enrollments
router.post('/enrollments', authenticate, isAdmin, createEnrollmentValidation, validate, studentController.createEnrollment);
router.patch('/enrollments/:id', authenticate, isAdmin, idParamValidation, validate, studentController.updateEnrollment);

module.exports = router;

const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createTeacherValidation,
  createTeacherAssignmentValidation,
  createClassTeacherAssignmentValidation,
  idParamValidation,
} = require('../validators/academicValidator');

// Teachers
router.get('/', authenticate, isAdmin, teacherController.getTeachers);
router.post('/', authenticate, isAdmin, createTeacherValidation, validate, teacherController.createTeacher);
router.get('/:id', authenticate, idParamValidation, validate, teacherController.getTeacherById);
router.patch('/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.updateTeacher);

// Teacher Assignments
router.get('/assignments', authenticate, teacherController.getTeacherAssignments);
router.post('/assignments', authenticate, isAdmin, createTeacherAssignmentValidation, validate, teacherController.createTeacherAssignment);
router.patch('/assignments/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.updateTeacherAssignment);

// Class Teacher Assignments
router.get('/class-teacher-assignments', authenticate, teacherController.getClassTeacherAssignments);
router.post('/class-teacher-assignments', authenticate, isAdmin, createClassTeacherAssignmentValidation, validate, teacherController.createClassTeacherAssignment);
router.patch('/class-teacher-assignments/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.updateClassTeacherAssignment);

module.exports = router;

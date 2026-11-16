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

// Teacher Assignments (must be before /:id to avoid "assignments" matching as an ID)
router.get('/assignments', authenticate, teacherController.getTeacherAssignments);
router.post('/assignments', authenticate, isAdmin, createTeacherAssignmentValidation, validate, teacherController.createTeacherAssignment);
router.post('/assignments/bulk', authenticate, isAdmin, teacherController.bulkCreateTeacherAssignments);
router.put('/assignments/by-class', authenticate, isAdmin, teacherController.setClassSubjectTeachers);
router.patch('/assignments/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.updateTeacherAssignment);
router.delete('/assignments/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.deleteTeacherAssignment);

// Class Teacher Assignments
router.get('/class-teacher-assignments', authenticate, teacherController.getClassTeacherAssignments);
router.post('/class-teacher-assignments', authenticate, isAdmin, createClassTeacherAssignmentValidation, validate, teacherController.createClassTeacherAssignment);
router.post('/class-teacher-assignments/bulk', authenticate, isAdmin, teacherController.bulkCreateClassTeacherAssignments);
router.patch('/class-teacher-assignments/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.updateClassTeacherAssignment);
router.delete('/class-teacher-assignments/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.deleteClassTeacherAssignment);

// Teachers
router.get('/', authenticate, isAdmin, teacherController.getTeachers);
router.post('/', authenticate, isAdmin, createTeacherValidation, validate, teacherController.createTeacher);
router.patch('/bulk-status', authenticate, isAdmin, teacherController.bulkUpdateTeacherStatus);
router.get('/:id', authenticate, idParamValidation, validate, teacherController.getTeacherById);
router.patch('/:id', authenticate, isAdmin, idParamValidation, validate, teacherController.updateTeacher);

module.exports = router;

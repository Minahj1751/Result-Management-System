const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createAcademicSessionValidation,
  createSemesterValidation,
  createClassValidation,
  createSectionValidation,
  createSubjectValidation,
  idParamValidation,
} = require('../validators/academicValidator');

// Academic Sessions
router.get('/sessions', authenticate, academicController.getAcademicSessions);
router.post('/sessions', authenticate, isAdmin, createAcademicSessionValidation, validate, academicController.createAcademicSession);
router.patch('/sessions/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateAcademicSession);

// Semesters
router.get('/semesters', authenticate, academicController.getSemesters);
router.post('/semesters', authenticate, isAdmin, createSemesterValidation, validate, academicController.createSemester);

// Classes
router.get('/classes', authenticate, academicController.getClasses);
router.post('/classes', authenticate, isAdmin, createClassValidation, validate, academicController.createClass);
router.patch('/classes/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateClass);

// Sections
router.get('/sections', authenticate, academicController.getSections);
router.post('/sections', authenticate, isAdmin, createSectionValidation, validate, academicController.createSection);

// Subjects
router.get('/subjects', authenticate, academicController.getSubjects);
router.post('/subjects', authenticate, isAdmin, createSubjectValidation, validate, academicController.createSubject);
router.patch('/subjects/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateSubject);

module.exports = router;

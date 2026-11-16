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
router.delete('/sessions/:id', authenticate, isAdmin, idParamValidation, validate, academicController.deleteAcademicSession);

// Semesters
router.get('/semesters', authenticate, academicController.getSemesters);
router.post('/semesters', authenticate, isAdmin, createSemesterValidation, validate, academicController.createSemester);
router.patch('/semesters/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateSemester);
router.delete('/semesters/:id', authenticate, isAdmin, idParamValidation, validate, academicController.deleteSemester);

// Classes
router.get('/classes', authenticate, academicController.getClasses);
router.post('/classes', authenticate, isAdmin, createClassValidation, validate, academicController.createClass);
router.patch('/classes/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateClass);
router.delete('/classes/:id', authenticate, isAdmin, idParamValidation, validate, academicController.deleteClass);

// Sections
router.get('/sections', authenticate, academicController.getSections);
router.post('/sections', authenticate, isAdmin, createSectionValidation, validate, academicController.createSection);
router.patch('/sections/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateSection);
router.delete('/sections/:id', authenticate, isAdmin, idParamValidation, validate, academicController.deleteSection);

// Subjects
router.get('/subjects', authenticate, academicController.getSubjects);
router.post('/subjects', authenticate, isAdmin, createSubjectValidation, validate, academicController.createSubject);
router.patch('/subjects/:id', authenticate, isAdmin, idParamValidation, validate, academicController.updateSubject);
router.delete('/subjects/:id', authenticate, isAdmin, idParamValidation, validate, academicController.deleteSubject);

// Class-wise subject mapping
router.get('/class-subjects', authenticate, academicController.getClassSubjects);
router.put('/class-subjects', authenticate, isAdmin, academicController.setClassSubjects);

module.exports = router;

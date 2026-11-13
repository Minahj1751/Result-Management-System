const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createAssessmentCategoryValidation,
  createAssessmentValidation,
} = require('../validators/assessmentValidator');
const { idParamValidation } = require('../validators/academicValidator');

// Assessment Categories
router.get('/categories', authenticate, assessmentController.getAssessmentCategories);
router.post('/categories', authenticate, isAdmin, createAssessmentCategoryValidation, validate, assessmentController.createAssessmentCategory);
router.patch('/categories/:id', authenticate, isAdmin, idParamValidation, validate, assessmentController.updateAssessmentCategory);
router.delete('/categories/:id', authenticate, isAdmin, idParamValidation, validate, assessmentController.deleteAssessmentCategory);

// Assessments
router.get('/', authenticate, assessmentController.getAssessments);
router.post('/', authenticate, isAdmin, createAssessmentValidation, validate, assessmentController.createAssessment);
router.patch('/:id', authenticate, isAdmin, idParamValidation, validate, assessmentController.updateAssessment);
router.delete('/:id', authenticate, isAdmin, idParamValidation, validate, assessmentController.deleteAssessment);

module.exports = router;

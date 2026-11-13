const express = require('express');
const router = express.Router();
const marksController = require('../controllers/marksController');
const { authenticate, isTeacher } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  upsertMarksValidation,
  bulkUpsertMarksValidation,
} = require('../validators/assessmentValidator');
const { idParamValidation } = require('../validators/academicValidator');

// Marks
router.get('/entries', authenticate, marksController.getMarksEntries);
router.get('/assessment/:assessmentId', authenticate, marksController.getAssessmentMarks);
router.post('/', authenticate, isTeacher, upsertMarksValidation, validate, marksController.upsertMarksEntry);
router.post('/bulk', authenticate, isTeacher, bulkUpsertMarksValidation, validate, marksController.bulkUpsertMarks);
router.delete('/:id', authenticate, isTeacher, idParamValidation, validate, marksController.deleteMarksEntry);

module.exports = router;

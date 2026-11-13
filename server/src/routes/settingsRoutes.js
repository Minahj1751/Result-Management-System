const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { idParamValidation } = require('../validators/academicValidator');
const validate = require('../middleware/validate');

// School settings
router.get('/school', authenticate, settingsController.getSchoolSettings);
router.patch('/school', authenticate, isAdmin, settingsController.updateSchoolSettings);

// Grading policies
router.get('/grading-policies', authenticate, settingsController.getGradingPolicies);
router.patch('/grading-policies/:id', authenticate, isAdmin, idParamValidation, validate, settingsController.updateGradingPolicy);
router.post('/grading-policies/:gradingPolicyId/grade-scales', authenticate, isAdmin, settingsController.upsertGradeScale);
router.patch('/grade-scales/:id', authenticate, isAdmin, idParamValidation, validate, settingsController.upsertGradeScale);
router.delete('/grade-scales/:id', authenticate, isAdmin, idParamValidation, validate, settingsController.deleteGradeScale);

module.exports = router;

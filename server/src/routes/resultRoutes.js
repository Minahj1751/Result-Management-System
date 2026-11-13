const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authenticate, isAdmin, isTeacher } = require('../middleware/auth');

// Results
router.get('/calculate', authenticate, resultController.calculateStudentResult);
router.get('/calculate-class', authenticate, resultController.calculateClassResults);
router.get('/snapshots', authenticate, resultController.getResultSnapshots);
router.post('/finalize', authenticate, isAdmin, resultController.finalizeResult);
router.post('/finalize-bulk', authenticate, isAdmin, resultController.bulkFinalizeResults);

module.exports = router;

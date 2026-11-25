const express = require('express');
const router = express.Router();
const termExamController = require('../controllers/termExamController');
const { authenticate, isTeacher } = require('../middleware/auth');

// Term Exam module marks (subject teacher direct entry)
router.get('/marks', authenticate, isTeacher, termExamController.getTermExamMarks);
router.put('/marks', authenticate, isTeacher, termExamController.bulkUpsertTermExamMarks);

module.exports = router;

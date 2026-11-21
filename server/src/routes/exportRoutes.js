const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticate, isAdmin, isClassTeacher } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

// Excel exports (admin full access; class teachers may export attendance for their scope)
router.get('/students', authenticate, isAdmin, exportController.exportStudents);
router.get('/teachers', authenticate, isAdmin, exportController.exportTeachers);
router.get('/subjects', authenticate, isAdmin, exportController.exportSubjects);
router.get('/attendance', authenticate, authorize('ADMIN', 'CLASS_TEACHER'), exportController.exportAttendance);
router.get('/results', authenticate, isAdmin, exportController.exportResults);
router.get('/assessments', authenticate, authorize('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'), exportController.exportAssessments);
router.get('/marks', authenticate, authorize('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'), exportController.exportMarks);

module.exports = router;

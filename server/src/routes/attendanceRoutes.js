const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, isClassTeacher, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  upsertAttendanceValidation,
  bulkUpsertAttendanceValidation,
} = require('../validators/attendanceValidator');

// Attendance
router.get('/records', authenticate, attendanceController.getAttendanceRecords);
router.get('/class', authenticate, isClassTeacher, attendanceController.getClassAttendance);
router.post('/', authenticate, isClassTeacher, upsertAttendanceValidation, validate, attendanceController.upsertAttendance);
router.post('/bulk', authenticate, isClassTeacher, bulkUpsertAttendanceValidation, validate, attendanceController.bulkUpsertAttendance);

module.exports = router;

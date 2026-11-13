const { body } = require('express-validator');

const upsertAttendanceValidation = [
  body('studentId')
    .trim()
    .notEmpty()
    .withMessage('Student ID is required'),
  body('academicSessionId')
    .trim()
    .notEmpty()
    .withMessage('Academic session ID is required'),
  body('semesterId')
    .trim()
    .notEmpty()
    .withMessage('Semester ID is required'),
  body('schoolClassId')
    .trim()
    .notEmpty()
    .withMessage('School class ID is required'),
  body('sectionId')
    .trim()
    .notEmpty()
    .withMessage('Section ID is required'),
  body('totalWorkingDays')
    .trim()
    .notEmpty()
    .withMessage('Total working days is required')
    .isInt({ min: 0 })
    .withMessage('Total working days must be a non-negative integer'),
  body('daysAttended')
    .trim()
    .notEmpty()
    .withMessage('Days attended is required')
    .isInt({ min: 0 })
    .withMessage('Days attended must be a non-negative integer'),
];

const bulkUpsertAttendanceValidation = [
  body('entries')
    .isArray()
    .withMessage('Entries must be an array')
    .notEmpty()
    .withMessage('Entries array cannot be empty'),
];

module.exports = {
  upsertAttendanceValidation,
  bulkUpsertAttendanceValidation,
};

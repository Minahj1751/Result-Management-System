const { body } = require('express-validator');

const createStudentValidation = [
  body('studentId')
    .trim()
    .notEmpty()
    .withMessage('Student ID is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Student ID must be between 2 and 50 characters'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('admissionNumber')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Admission number must be between 2 and 50 characters'),
  body('guardianPhone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
];

const createEnrollmentValidation = [
  body('studentId')
    .trim()
    .notEmpty()
    .withMessage('Student ID is required'),
  body('academicSessionId')
    .trim()
    .notEmpty()
    .withMessage('Academic session ID is required'),
  body('semesterId')
    .optional()
    .trim(),
  body('schoolClassId')
    .trim()
    .notEmpty()
    .withMessage('School class ID is required'),
  body('sectionId')
    .trim()
    .notEmpty()
    .withMessage('Section ID is required'),
  body('rollNumber')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Roll number must be a positive integer'),
];

module.exports = {
  createStudentValidation,
  createEnrollmentValidation,
};

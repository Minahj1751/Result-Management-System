const { body, param } = require('express-validator');

const createAcademicSessionValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Session name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Session name must be between 2 and 50 characters'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('Invalid end date format'),
];

const createSemesterValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Semester name is required'),
  body('academicSessionId')
    .trim()
    .notEmpty()
    .withMessage('Academic session ID is required')
    .isString()
    .withMessage('Invalid academic session ID'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('Invalid end date format'),
];

const createClassValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Class name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Class name must be between 1 and 50 characters'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
];

const createSectionValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Section name is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Section name must be between 1 and 10 characters'),
  body('schoolClassId')
    .trim()
    .notEmpty()
    .withMessage('School class ID is required')
    .isString()
    .withMessage('Invalid school class ID'),
];

const createSubjectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Subject name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject name must be between 2 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Subject code must be between 2 and 10 characters'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
];

const createTeacherValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['SUBJECT_TEACHER', 'CLASS_TEACHER'])
    .withMessage('Role must be SUBJECT_TEACHER or CLASS_TEACHER'),
  body('employeeId')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Employee ID must be between 2 and 20 characters'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
];

const createTeacherAssignmentValidation = [
  body('teacherId')
    .trim()
    .notEmpty()
    .withMessage('Teacher ID is required'),
  body('subjectId')
    .trim()
    .notEmpty()
    .withMessage('Subject ID is required'),
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
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),
];

const createClassTeacherAssignmentValidation = [
  body('teacherId')
    .trim()
    .notEmpty()
    .withMessage('Teacher ID is required'),
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
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),
];

const idParamValidation = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('ID is required')
    .isString()
    .withMessage('Invalid ID format'),
];

module.exports = {
  createAcademicSessionValidation,
  createSemesterValidation,
  createClassValidation,
  createSectionValidation,
  createSubjectValidation,
  createTeacherValidation,
  createTeacherAssignmentValidation,
  createClassTeacherAssignmentValidation,
  idParamValidation,
};

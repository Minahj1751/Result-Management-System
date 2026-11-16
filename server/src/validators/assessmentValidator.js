const { body, param } = require('express-validator');

const createAssessmentCategoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Category code is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('Category code must be between 2 and 10 characters'),
  body('weightage')
    .trim()
    .notEmpty()
    .withMessage('Weightage is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Weightage must be between 0 and 100'),
];

const createAssessmentValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Assessment name is required'),
  body('categoryId')
    .trim()
    .notEmpty()
    .withMessage('Category ID is required'),
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
  body('subjectId')
    .trim()
    .notEmpty()
    .withMessage('Subject ID is required'),
  body('maximumMarks')
    .trim()
    .notEmpty()
    .withMessage('Maximum marks is required')
    .isFloat({ min: 0 })
    .withMessage('Maximum marks must be a positive number'),
  body('defaultDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date format'),
];

const bulkCreateAssessmentValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Assessment name is required'),
  body('categoryId')
    .trim()
    .notEmpty()
    .withMessage('Category ID is required'),
  body('academicSessionId')
    .trim()
    .notEmpty()
    .withMessage('Academic session ID is required'),
  body('semesterId')
    .trim()
    .notEmpty()
    .withMessage('Semester ID is required'),
  body('maximumMarks')
    .trim()
    .notEmpty()
    .withMessage('Maximum marks is required')
    .isFloat({ min: 0 })
    .withMessage('Maximum marks must be a positive number'),
  body('defaultDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date format'),
  body('combinations')
    .isArray({ min: 1 })
    .withMessage('At least one class-section-subject combination is required')
    .custom((combos) => {
      return combos.every(
        (c) => c && c.schoolClassId && c.sectionId && c.subjectId
      );
    })
    .withMessage('Each combination must include schoolClassId, sectionId and subjectId'),
];

const upsertMarksValidation = [
  body('studentId')
    .trim()
    .notEmpty()
    .withMessage('Student ID is required'),
  body('assessmentId')
    .trim()
    .notEmpty()
    .withMessage('Assessment ID is required'),
  body('marksObtained')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Marks must be a non-negative number'),
  body('status')
    .optional()
    .isIn(['PENDING', 'ABSENT', 'EXEMPTED', 'NOT_APPLICABLE'])
    .withMessage('Invalid status'),
];

const bulkUpsertMarksValidation = [
  body('entries')
    .isArray()
    .withMessage('Entries must be an array')
    .notEmpty()
    .withMessage('Entries array cannot be empty'),
];

module.exports = {
  createAssessmentCategoryValidation,
  createAssessmentValidation,
  bulkCreateAssessmentValidation,
  upsertMarksValidation,
  bulkUpsertMarksValidation,
};

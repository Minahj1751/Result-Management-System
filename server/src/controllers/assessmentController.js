const prisma = require('../config/database');

/**
 * Get assessment categories
 */
const getAssessmentCategories = async (req, res, next) => {
  try {
    const categories = await prisma.assessmentCategory.findMany({
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
};

/**
 * Create assessment category
 */
const createAssessmentCategory = async (req, res, next) => {
  try {
    const { name, code, weightage, description } = req.body;

    const category = await prisma.assessmentCategory.create({
      data: {
        name,
        code,
        weightage: parseFloat(weightage),
        description,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

/**
 * Get assessments
 */
const getAssessments = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, subjectId, categoryId } = req.query;

    const where = {
      ...(academicSessionId && { academicSessionId }),
      ...(semesterId && { semesterId }),
      ...(schoolClassId && { schoolClassId }),
      ...(sectionId && { sectionId }),
      ...(subjectId && { subjectId }),
      ...(categoryId && { categoryId }),
    };

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        category: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        subject: true,
        marksEntries: {
          include: {
            student: true,
          },
        },
      },
      orderBy: { defaultDate: 'asc' },
    });

    res.json(assessments);
  } catch (error) {
    next(error);
  }
};

/**
 * Create assessment
 */
const createAssessment = async (req, res, next) => {
  try {
    const {
      name,
      categoryId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      subjectId,
      maximumMarks,
      defaultDate,
    } = req.body;

    const assessment = await prisma.assessment.create({
      data: {
        name,
        categoryId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        subjectId,
        maximumMarks: parseFloat(maximumMarks),
        defaultDate: new Date(defaultDate),
        submissionStatus: 'DRAFT',
        publicationStatus: 'DRAFT',
      },
      include: {
        category: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        subject: true,
      },
    });

    res.status(201).json(assessment);
  } catch (error) {
    next(error);
  }
};

/**
 * Update assessment
 */
const updateAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, maximumMarks, defaultDate, submissionStatus, publicationStatus } = req.body;

    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(maximumMarks && { maximumMarks: parseFloat(maximumMarks) }),
        ...(defaultDate && { defaultDate: new Date(defaultDate) }),
        ...(submissionStatus && { submissionStatus }),
        ...(publicationStatus && { publicationStatus }),
      },
      include: {
        category: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        subject: true,
      },
    });

    res.json(assessment);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssessmentCategories,
  createAssessmentCategory,
  getAssessments,
  createAssessment,
  updateAssessment,
};

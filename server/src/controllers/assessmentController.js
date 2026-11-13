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

/**
 * Update assessment category
 */
const updateAssessmentCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, weightage, description } = req.body;

    const category = await prisma.assessmentCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(weightage !== undefined && { weightage: parseFloat(weightage) }),
        ...(description !== undefined && { description }),
      },
    });

    res.json(category);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete assessment category (only if unused)
 */
const deleteAssessmentCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assessmentCount = await prisma.assessment.count({ where: { categoryId: id } });
    if (assessmentCount > 0) {
      const error = new Error('Cannot delete category with existing assessments');
      error.statusCode = 409;
      throw error;
    }

    await prisma.assessmentCategory.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete assessment
 */
const deleteAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const marksCount = await prisma.marksEntry.count({ where: { assessmentId: id } });
    if (marksCount > 0) {
      // Remove dependent marks entries first so the assessment can be deleted
      await prisma.marksEntry.deleteMany({ where: { assessmentId: id } });
    }

    await prisma.assessment.delete({ where: { id } });
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssessmentCategories,
  createAssessmentCategory,
  updateAssessmentCategory,
  deleteAssessmentCategory,
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
};

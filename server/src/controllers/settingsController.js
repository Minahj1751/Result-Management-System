const prisma = require('../config/database');

/**
 * Get school settings (singleton)
 */
const getSchoolSettings = async (req, res, next) => {
  try {
    let settings = await prisma.schoolSettings.findFirst();
    if (!settings) {
      settings = await prisma.schoolSettings.create({
        data: { id: 'default' },
      });
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

/**
 * Update school settings (admin)
 */
const updateSchoolSettings = async (req, res, next) => {
  try {
    const allowed = [
      'schoolName', 'logoUrl', 'address', 'phone', 'email',
      'sessionLabel', 'semesterLabel', 'dateFormat',
      'showAttendancePercentage', 'subjectOrdering', 'assessmentOrdering',
      'decimalPrecision', 'principalSignature', 'classTeacherSignature',
    ];

    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    let settings = await prisma.schoolSettings.findFirst();
    if (!settings) {
      settings = await prisma.schoolSettings.create({ data: { id: 'default', ...data } });
    } else {
      settings = await prisma.schoolSettings.update({ where: { id: settings.id }, data });
    }

    res.json(settings);
  } catch (error) {
    next(error);
  }
};

/**
 * List grading policies with their grade scales
 */
const getGradingPolicies = async (req, res, next) => {
  try {
    const policies = await prisma.gradingPolicy.findMany({
      include: {
        gradeScales: { orderBy: { minPercentage: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(policies);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a grading policy (activate/deactivate, rename, description)
 */
const updateGradingPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const policy = await prisma.gradingPolicy.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: { gradeScales: { orderBy: { minPercentage: 'desc' } } },
    });

    res.json(policy);
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update a grade scale entry within a policy
 */
const upsertGradeScale = async (req, res, next) => {
  try {
    const { gradingPolicyId } = req.params;
    const { id, minPercentage, maxPercentage, grade, gradePoint, remarks } = req.body;

    const policy = await prisma.gradingPolicy.findUnique({ where: { id: gradingPolicyId } });
    if (!policy) {
      return res.status(404).json({ error: 'Grading policy not found' });
    }

    const data = {
      gradingPolicyId,
      minPercentage: parseFloat(minPercentage),
      maxPercentage: parseFloat(maxPercentage),
      grade,
      gradePoint: gradePoint !== undefined && gradePoint !== null && gradePoint !== '' ? parseFloat(gradePoint) : null,
      remarks: remarks || null,
    };

    const scale = id
      ? await prisma.gradeScale.update({ where: { id }, data })
      : await prisma.gradeScale.create({ data });

    res.status(id ? 200 : 201).json(scale);
  } catch (error) {
    next(error);
  }
};

const deleteGradeScale = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.gradeScale.delete({ where: { id } });
    res.json({ message: 'Grade scale deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchoolSettings,
  updateSchoolSettings,
  getGradingPolicies,
  updateGradingPolicy,
  upsertGradeScale,
  deleteGradeScale,
};

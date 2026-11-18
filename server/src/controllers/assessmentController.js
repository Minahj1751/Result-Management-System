const prisma = require('../config/database');

const buildAssessmentWhere = ({
  academicSessionId,
  semesterId,
  schoolClassId,
  sectionId,
  subjectId,
  categoryId,
  search,
} = {}) => {
  const term = typeof search === 'string' ? search.trim() : '';

  return {
    ...(academicSessionId && { academicSessionId }),
    ...(semesterId && { semesterId }),
    ...(schoolClassId && { schoolClassId }),
    ...(sectionId && { sectionId }),
    ...(subjectId && { subjectId }),
    ...(categoryId && { categoryId }),
    ...(term && {
      OR: [
        { name: { contains: term } },
        { subject: { name: { contains: term } } },
        { schoolClass: { name: { contains: term } } },
      ],
    }),
  };
};

const uniqueIds = (value) => [
  ...new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id) : []),
];

const getBulkSelectionWhere = ({ ids, filters, selectAll, excludedIds } = {}) => {
  if (selectAll) {
    const where = buildAssessmentWhere(filters || {});
    const exclusions = uniqueIds(excludedIds);
    if (exclusions.length > 0) {
      where.id = { notIn: exclusions };
    }
    return where;
  }

  const selectedIds = uniqueIds(ids);
  if (selectedIds.length === 0) {
    const error = new Error('No assessments selected');
    error.statusCode = 400;
    throw error;
  }
  if (selectedIds.length > 1000) {
    const error = new Error('Too many assessments selected (max 1000)');
    error.statusCode = 400;
    throw error;
  }

  return { id: { in: selectedIds } };
};

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
 * Get assessments (paginated, searchable, sortable)
 */
const getAssessments = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, sortBy = 'defaultDate', sortOrder = 'asc',
    } = req.query;

    const where = buildAssessmentWhere(req.query);

    const sortable = ['name', 'maximumMarks', 'defaultDate', 'createdAt'];
    const orderField = sortable.includes(sortBy) ? sortBy : 'defaultDate';
    const orderDir = sortOrder === 'desc' ? 'desc' : 'asc';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const include = {
      category: true,
      academicSession: true,
      semester: true,
      schoolClass: true,
      section: true,
      subject: true,
    };

    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        include: {
          ...include,
          _count: { select: { marksEntries: true } },
        },
        orderBy: [{ [orderField]: orderDir }, { name: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.assessment.count({ where }),
    ]);

    res.json({
      assessments,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subjects eligible for given class/section pairs.
 * Eligibility is derived from active teacher assignments for the
 * session/semester. Pairs without any assignments fall back to all subjects.
 */
const getEligibleSubjects = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, pairs } = req.query;

    if (!academicSessionId || !semesterId || !pairs) {
      return res.status(400).json({ error: 'academicSessionId, semesterId and pairs are required' });
    }

    let pairList;
    try {
      pairList = JSON.parse(pairs);
    } catch {
      return res.status(400).json({ error: 'pairs must be a JSON array of {schoolClassId, sectionId}' });
    }
    if (!Array.isArray(pairList) || pairList.length === 0) {
      return res.status(400).json({ error: 'pairs must be a non-empty array' });
    }

    const allSubjects = await prisma.subject.findMany({ orderBy: { sortOrder: 'asc' } });
    const allSubjectIds = allSubjects.map((s) => s.id);

    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        academicSessionId,
        isActive: true,
        // Session-level assignments (semesterId NULL) apply to every exam
        AND: [
          { OR: [{ semesterId }, { semesterId: null }] },
          { OR: pairList.map((p) => ({ schoolClassId: p.schoolClassId, sectionId: p.sectionId })) },
        ],
      },
      select: { schoolClassId: true, sectionId: true, subjectId: true },
    });

    // Class-wise subject mapping takes priority when configured
    const classIds = [...new Set(pairList.map((p) => p.schoolClassId))];
    const classSubjects = await prisma.classSubject.findMany({
      where: { schoolClassId: { in: classIds } },
      select: { schoolClassId: true, subjectId: true },
    });
    const mappedByClass = new Map();
    classSubjects.forEach((cs) => {
      if (!mappedByClass.has(cs.schoolClassId)) mappedByClass.set(cs.schoolClassId, new Set());
      mappedByClass.get(cs.schoolClassId).add(cs.subjectId);
    });

    const eligibleMap = new Map();
    pairList.forEach((p) => {
      const key = `${p.schoolClassId}:${p.sectionId}`;
      eligibleMap.set(key, new Set());
    });
    assignments.forEach((a) => {
      const key = `${a.schoolClassId}:${a.sectionId}`;
      if (eligibleMap.has(key)) eligibleMap.get(key).add(a.subjectId);
    });

    const result = pairList.map((p) => {
      const key = `${p.schoolClassId}:${p.sectionId}`;
      const assigned = eligibleMap.get(key);
      // Priority: explicit class-subject mapping > teacher assignments > all subjects
      const mapped = mappedByClass.get(p.schoolClassId);
      const subjectIds = mapped && mapped.size > 0
        ? allSubjectIds.filter((id) => mapped.has(id))
        : assigned.size > 0
          ? allSubjectIds.filter((id) => assigned.has(id))
          : allSubjectIds;
      return { schoolClassId: p.schoolClassId, sectionId: p.sectionId, subjectIds };
    });

    res.json({ pairs: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk create assessments for class-section-subject combinations.
 * Skips duplicates safely and reports created/skipped/failed counts.
 */
const bulkCreateAssessments = async (req, res, next) => {
  try {
    const {
      name, categoryId, academicSessionId, semesterId, maximumMarks, defaultDate,
      combinations,
    } = req.body;

    if (!Array.isArray(combinations) || combinations.length === 0) {
      return res.status(400).json({ error: 'combinations must be a non-empty array' });
    }
    if (combinations.length > 500) {
      return res.status(400).json({ error: 'Too many combinations (max 500)' });
    }

    // Validate referenced entities exist
    const [category, session, semester] = await Promise.all([
      prisma.assessmentCategory.findUnique({ where: { id: categoryId } }),
      prisma.academicSession.findUnique({ where: { id: academicSessionId } }),
      prisma.semester.findUnique({ where: { id: semesterId } }),
    ]);
    if (!category) return res.status(400).json({ error: 'Invalid category' });
    if (!session) return res.status(400).json({ error: 'Invalid academic session' });
    if (!semester || semester.academicSessionId !== academicSessionId) {
      return res.status(400).json({ error: 'Semester does not belong to the selected session' });
    }

    const classIds = [...new Set(combinations.map((c) => c.schoolClassId))];
    const subjectIds = [...new Set(combinations.map((c) => c.subjectId))];
    const [classes, subjects] = await Promise.all([
      prisma.schoolClass.findMany({ where: { id: { in: classIds } } }),
      prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
    ]);
    const validClassIds = new Set(classes.map((c) => c.id));
    const validSubjectIds = new Set(subjects.map((s) => s.id));

    const sections = await prisma.section.findMany({
      where: { schoolClassId: { in: classIds } },
      select: { id: true, schoolClassId: true },
    });
    const validSectionKeys = new Set(sections.map((s) => `${s.schoolClassId}:${s.id}`));

    // Deduplicate input combinations and validate each
    const seen = new Set();
    const validCombos = [];
    const invalid = [];
    for (const combo of combinations) {
      const { schoolClassId, sectionId, subjectId } = combo;
      const key = `${schoolClassId}:${sectionId}:${subjectId}`;
      if (seen.has(key)) {
        invalid.push({ ...combo, reason: 'Duplicate in request' });
        continue;
      }
      seen.add(key);
      if (!validClassIds.has(schoolClassId)) {
        invalid.push({ ...combo, reason: 'Invalid class' });
      } else if (!validSectionKeys.has(`${schoolClassId}:${sectionId}`)) {
        invalid.push({ ...combo, reason: 'Section does not belong to class' });
      } else if (!validSubjectIds.has(subjectId)) {
        invalid.push({ ...combo, reason: 'Invalid subject' });
      } else {
        validCombos.push({ schoolClassId, sectionId, subjectId });
      }
    }

    // Find existing assessments to skip duplicates
    const existing = await prisma.assessment.findMany({
      where: {
        name,
        categoryId,
        academicSessionId,
        semesterId,
        OR: validCombos.map((c) => ({
          schoolClassId: c.schoolClassId,
          sectionId: c.sectionId,
          subjectId: c.subjectId,
        })),
      },
      select: { schoolClassId: true, sectionId: true, subjectId: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.schoolClassId}:${e.sectionId}:${e.subjectId}`));

    const toCreate = validCombos.filter((c) => !existingKeys.has(`${c.schoolClassId}:${c.sectionId}:${c.subjectId}`));
    const duplicates = validCombos.filter((c) => existingKeys.has(`${c.schoolClassId}:${c.sectionId}:${c.subjectId}`));

    const maxMarks = parseFloat(maximumMarks);
    const date = defaultDate ? new Date(defaultDate) : null;

    let createdCount = 0;
    if (toCreate.length > 0) {
      const result = await prisma.assessment.createMany({
        data: toCreate.map((c) => ({
          name,
          categoryId,
          academicSessionId,
          semesterId,
          schoolClassId: c.schoolClassId,
          sectionId: c.sectionId,
          subjectId: c.subjectId,
          maximumMarks: maxMarks,
          defaultDate: date,
          submissionStatus: 'APPROVED',
          publicationStatus: 'DRAFT',
        })),
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    res.status(201).json({
      created: createdCount,
      skipped: duplicates.length + (validCombos.length - toCreate.length - duplicates.length),
      duplicates: duplicates.length,
      invalid: invalid.length,
      invalidDetails: invalid,
      total: combinations.length,
    });
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
        defaultDate: defaultDate ? new Date(defaultDate) : null,
        submissionStatus: 'APPROVED',
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
 * Bulk update submission status for selected assessments
 */
const bulkUpdateAssessmentStatus = async (req, res, next) => {
  try {
    const { submissionStatus } = req.body;

    if (!['DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED'].includes(submissionStatus)) {
      return res.status(400).json({ error: 'Invalid submissionStatus' });
    }

    const where = getBulkSelectionWhere(req.body);
    const result = await prisma.assessment.updateMany({
      where,
      data: { submissionStatus },
    });

    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update editable assessment fields for selected assessments
 */
const bulkUpdateAssessments = async (req, res, next) => {
  try {
    const { maximumMarks, defaultDate, clearDefaultDate } = req.body;
    const data = {};

    if (maximumMarks !== undefined && maximumMarks !== null && maximumMarks !== '') {
      const marks = parseFloat(maximumMarks);
      if (!Number.isFinite(marks) || marks < 0) {
        return res.status(400).json({ error: 'Maximum marks must be a non-negative number' });
      }
      data.maximumMarks = marks;
    }

    if (clearDefaultDate === true || defaultDate === null) {
      data.defaultDate = null;
    } else if (defaultDate !== undefined && defaultDate !== '') {
      const date = new Date(defaultDate);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      data.defaultDate = date;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const where = getBulkSelectionWhere(req.body);
    const result = await prisma.assessment.updateMany({ where, data });

    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk delete selected assessments and their marks entries
 */
const bulkDeleteAssessments = async (req, res, next) => {
  try {
    const where = getBulkSelectionWhere(req.body);
    const assessments = await prisma.assessment.findMany({
      where,
      select: { id: true },
    });
    const ids = assessments.map((assessment) => assessment.id);

    if (ids.length === 0) {
      return res.json({ deleted: 0 });
    }

    const [, result] = await prisma.$transaction([
      prisma.marksEntry.deleteMany({ where: { assessmentId: { in: ids } } }),
      prisma.assessment.deleteMany({ where: { id: { in: ids } } }),
    ]);

    res.json({ deleted: result.count });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an assessment's date. Admins can update any assessment;
 * teachers can only update assessments they are assigned to.
 */
const updateAssessmentDate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { defaultDate } = req.body;

    if (defaultDate !== undefined && defaultDate !== null && defaultDate !== '' && Number.isNaN(new Date(defaultDate).getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const assessment = await prisma.assessment.findUnique({ where: { id } });
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (req.user.role !== 'ADMIN') {
      const profile = req.user.teacherProfile;
      if (!profile) {
        return res.status(403).json({ error: 'Teacher profile not found' });
      }
      const assignment = await prisma.teacherAssignment.findFirst({
        where: {
          teacherId: profile.id,
          subjectId: assessment.subjectId,
          academicSessionId: assessment.academicSessionId,
          OR: [{ semesterId: assessment.semesterId }, { semesterId: null }],
          schoolClassId: assessment.schoolClassId,
          sectionId: assessment.sectionId,
          isActive: true,
        },
      });
      if (!assignment) {
        return res.status(403).json({ error: 'You are not assigned to this assessment' });
      }
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: { defaultDate: defaultDate ? new Date(defaultDate) : null },
      include: {
        category: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        subject: true,
      },
    });

    res.json(updated);
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
  getEligibleSubjects,
  createAssessment,
  bulkCreateAssessments,
  bulkUpdateAssessmentStatus,
  bulkUpdateAssessments,
  bulkDeleteAssessments,
  updateAssessment,
  updateAssessmentDate,
  deleteAssessment,
};

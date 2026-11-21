const prisma = require('../config/database');

/**
 * Get all academic sessions
 */
const getAcademicSessions = async (req, res, next) => {
  try {
    const sessions = await prisma.academicSession.findMany({
      orderBy: { startDate: 'desc' },
    });

    res.json(sessions);
  } catch (error) {
    next(error);
  }
};

/**
 * Create academic session
 */
const createAcademicSession = async (req, res, next) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;

    const session = await prisma.academicSession.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

/**
 * Update academic session
 */
const updateAcademicSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const session = await prisma.academicSession.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(session);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete academic session (only if it has no dependent records)
 */
const deleteAcademicSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dependentCounts = await Promise.all([
      prisma.semester.count({ where: { academicSessionId: id } }),
      prisma.studentEnrollment.count({ where: { academicSessionId: id } }),
      prisma.assessment.count({ where: { academicSessionId: id } }),
    ]);

    if (dependentCounts.some((count) => count > 0)) {
      const error = new Error('Cannot delete session with existing semesters, enrollments, or assessments');
      error.statusCode = 409;
      throw error;
    }

    await prisma.academicSession.delete({ where: { id } });
    res.json({ message: 'Academic session deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all semesters
 */
const getSemesters = async (req, res, next) => {
  try {
    const { academicSessionId } = req.query;

    const where = academicSessionId ? { academicSessionId } : {};

    const semesters = await prisma.semester.findMany({
      where,
      include: {
        academicSession: true,
      },
      orderBy: { startDate: 'desc' },
    });

    res.json(semesters);
  } catch (error) {
    next(error);
  }
};

/**
 * Create semester
 */
const createSemester = async (req, res, next) => {
  try {
    const { name, academicSessionId, startDate, endDate, isActive, visibleToClassTeachers, visibleToSubjectTeachers } = req.body;

    const semester = await prisma.semester.create({
      data: {
        name,
        academicSessionId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
        visibleToClassTeachers: visibleToClassTeachers !== undefined ? visibleToClassTeachers : true,
        visibleToSubjectTeachers: visibleToSubjectTeachers !== undefined ? visibleToSubjectTeachers : true,
      },
    });

    res.status(201).json(semester);
  } catch (error) {
    next(error);
  }
};

/**
 * Update semester
 */
const updateSemester = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive, visibleToClassTeachers, visibleToSubjectTeachers } = req.body;

    const semester = await prisma.semester.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
        ...(visibleToClassTeachers !== undefined && { visibleToClassTeachers }),
        ...(visibleToSubjectTeachers !== undefined && { visibleToSubjectTeachers }),
      },
    });

    res.json(semester);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete semester (only if it has no dependent records)
 */
const deleteSemester = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dependentCounts = await Promise.all([
      prisma.studentEnrollment.count({ where: { semesterId: id } }),
      prisma.assessment.count({ where: { semesterId: id } }),
      prisma.teacherAssignment.count({ where: { semesterId: id } }),
      prisma.classTeacherAssignment.count({ where: { semesterId: id } }),
    ]);

    if (dependentCounts.some((count) => count > 0)) {
      const error = new Error('Cannot delete semester with existing enrollments, assessments, or assignments');
      error.statusCode = 409;
      throw error;
    }

    await prisma.semester.delete({ where: { id } });
    res.json({ message: 'Semester deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all classes
 */
const getClasses = async (req, res, next) => {
  try {
    const classes = await prisma.schoolClass.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    res.json(classes);
  } catch (error) {
    next(error);
  }
};

/**
 * Create class
 */
const createClass = async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body;

    const schoolClass = await prisma.schoolClass.create({
      data: {
        name,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(schoolClass);
  } catch (error) {
    next(error);
  }
};

/**
 * Update class
 */
const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sortOrder } = req.body;

    const schoolClass = await prisma.schoolClass.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    res.json(schoolClass);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete class (only if it has no sections or dependent records)
 */
const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sectionCount = await prisma.section.count({ where: { schoolClassId: id } });
    if (sectionCount > 0) {
      const error = new Error('Cannot delete class with existing sections. Delete the sections first.');
      error.statusCode = 409;
      throw error;
    }

    await prisma.schoolClass.delete({ where: { id } });
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all sections
 */
const getSections = async (req, res, next) => {
  try {
    const { schoolClassId } = req.query;

    const where = schoolClassId ? { schoolClassId } : {};

    const sections = await prisma.section.findMany({
      where,
      include: {
        schoolClass: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(sections);
  } catch (error) {
    next(error);
  }
};

/**
 * Create section
 */
const createSection = async (req, res, next) => {
  try {
    const { name, schoolClassId } = req.body;

    const section = await prisma.section.create({
      data: {
        name,
        schoolClassId,
      },
    });

    res.status(201).json(section);
  } catch (error) {
    next(error);
  }
};

/**
 * Update section
 */
const updateSection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, schoolClassId } = req.body;

    const section = await prisma.section.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(schoolClassId && { schoolClassId }),
      },
      include: { schoolClass: true },
    });

    res.json(section);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete section (only if it has no dependent records)
 */
const deleteSection = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dependentCounts = await Promise.all([
      prisma.studentEnrollment.count({ where: { sectionId: id } }),
      prisma.assessment.count({ where: { sectionId: id } }),
      prisma.teacherAssignment.count({ where: { sectionId: id } }),
      prisma.classTeacherAssignment.count({ where: { sectionId: id } }),
    ]);

    if (dependentCounts.some((count) => count > 0)) {
      const error = new Error('Cannot delete section with existing enrollments, assessments, or assignments');
      error.statusCode = 409;
      throw error;
    }

    await prisma.section.delete({ where: { id } });
    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all subjects
 */
const getSubjects = async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    res.json(subjects);
  } catch (error) {
    next(error);
  }
};

/**
 * Create subject
 */
const createSubject = async (req, res, next) => {
  try {
    const { name, code, sortOrder } = req.body;

    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(subject);
  } catch (error) {
    next(error);
  }
};

/**
 * Update subject
 */
const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, sortOrder } = req.body;

    const subject = await prisma.subject.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    res.json(subject);
  } catch (error) {
    next(error);
  }
};

/**
 * Get class-wise subject mappings
 */
const getClassSubjects = async (req, res, next) => {
  try {
    const { schoolClassId } = req.query;
    const mappings = await prisma.classSubject.findMany({
      where: schoolClassId ? { schoolClassId } : {},
      include: { schoolClass: true, subject: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(mappings);
  } catch (error) {
    next(error);
  }
};

/**
 * Set subjects for a class (replaces existing mapping)
 */
const setClassSubjects = async (req, res, next) => {
  try {
    const { schoolClassId, subjectIds } = req.body;

    if (!schoolClassId) {
      return res.status(400).json({ error: 'schoolClassId is required' });
    }
    if (!Array.isArray(subjectIds)) {
      return res.status(400).json({ error: 'subjectIds must be an array' });
    }

    const schoolClass = await prisma.schoolClass.findUnique({ where: { id: schoolClassId } });
    if (!schoolClass) {
      return res.status(400).json({ error: 'Class not found' });
    }

    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true },
    });
    const validIds = new Set(subjects.map((s) => s.id));
    const uniqueIds = [...new Set(subjectIds)].filter((id) => validIds.has(id));

    await prisma.$transaction([
      prisma.classSubject.deleteMany({ where: { schoolClassId } }),
      prisma.classSubject.createMany({
        data: uniqueIds.map((subjectId) => ({ schoolClassId, subjectId })),
        skipDuplicates: true,
      }),
    ]);

    const mappings = await prisma.classSubject.findMany({
      where: { schoolClassId },
      include: { subject: true },
    });

    res.json(mappings);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete subject (only if it has no dependent records)
 */
const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dependentCounts = await Promise.all([
      prisma.assessment.count({ where: { subjectId: id } }),
      prisma.teacherAssignment.count({ where: { subjectId: id } }),
      prisma.resultSnapshot.count({ where: { subjectId: id } }),
    ]);

    if (dependentCounts.some((count) => count > 0)) {
      const error = new Error('Cannot delete subject with existing assessments, assignments, or results');
      error.statusCode = 409;
      throw error;
    }

    await prisma.subject.delete({ where: { id } });
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAcademicSessions,
  createAcademicSession,
  updateAcademicSession,
  deleteAcademicSession,
  getSemesters,
  createSemester,
  updateSemester,
  deleteSemester,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getClassSubjects,
  setClassSubjects,
};

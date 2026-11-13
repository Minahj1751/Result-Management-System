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
    const { name, academicSessionId, startDate, endDate, isActive } = req.body;

    const semester = await prisma.semester.create({
      data: {
        name,
        academicSessionId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.status(201).json(semester);
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

module.exports = {
  getAcademicSessions,
  createAcademicSession,
  updateAcademicSession,
  getSemesters,
  createSemester,
  getClasses,
  createClass,
  updateClass,
  getSections,
  createSection,
  getSubjects,
  createSubject,
  updateSubject,
};

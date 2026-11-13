const prisma = require('../config/database');

/**
 * Get all students
 */
const getStudents = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, page = 1, limit = 50, search, includeInactive } = req.query;

    const enrollmentConditions = [];
    if (academicSessionId) enrollmentConditions.push({ academicSessionId });
    if (semesterId) enrollmentConditions.push({ semesterId });
    if (schoolClassId) enrollmentConditions.push({ schoolClassId });
    if (sectionId) enrollmentConditions.push({ sectionId });

    const where = {
      ...(includeInactive !== 'true' ? { isActive: true } : {}),
      ...(enrollmentConditions.length > 0 && {
        enrollments: { some: { AND: enrollmentConditions } },
      }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentId: { contains: search, mode: 'insensitive' } },
          { admissionNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          enrollments: {
            where: {
              ...(academicSessionId && { academicSessionId }),
              ...(semesterId && { semesterId }),
              ...(schoolClassId && { schoolClassId }),
              ...(sectionId && { sectionId }),
            },
            include: {
              academicSession: true,
              semester: true,
              schoolClass: true,
              section: true,
            },
          },
        },
        orderBy: { studentId: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create student
 */
const createStudent = async (req, res, next) => {
  try {
    const { studentId, admissionNumber, fullName, dateOfBirth, guardianName, guardianPhone } = req.body;

    const student = await prisma.student.create({
      data: {
        studentId,
        admissionNumber,
        fullName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        guardianName,
        guardianPhone,
        isActive: true,
      },
    });

    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
};

/**
 * Get student by ID
 */
const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            academicSession: true,
            semester: true,
            schoolClass: true,
            section: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    next(error);
  }
};

/**
 * Update student
 */
const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, dateOfBirth, guardianName, guardianPhone, isActive } = req.body;

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(guardianName && { guardianName }),
        ...(guardianPhone && { guardianPhone }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(student);
  } catch (error) {
    next(error);
  }
};

/**
 * Create student enrollment
 */
const createEnrollment = async (req, res, next) => {
  try {
    const { studentId, academicSessionId, semesterId, schoolClassId, sectionId, rollNumber } = req.body;

    const roll = parseInt(rollNumber, 10);
    if (!Number.isInteger(roll) || roll < 1) {
      return res.status(400).json({ error: 'Roll number must be a positive integer' });
    }

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        rollNumber: roll,
        isActive: true,
      },
      include: {
        student: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    res.status(201).json(enrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * Update student enrollment
 */
const updateEnrollment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rollNumber, isActive } = req.body;

    const enrollment = await prisma.studentEnrollment.update({
      where: { id },
      data: {
        ...(rollNumber !== undefined && { rollNumber: parseInt(rollNumber, 10) }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        student: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    res.json(enrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete student enrollment
 */
const deleteEnrollment = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.studentEnrollment.delete({ where: { id } });
    res.json({ message: 'Enrollment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  createStudent,
  getStudentById,
  updateStudent,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
};

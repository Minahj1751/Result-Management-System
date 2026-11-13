const bcrypt = require('bcrypt');
const prisma = require('../config/database');

/**
 * Get all teachers
 */
const getTeachers = async (req, res, next) => {
  try {
    const teachers = await prisma.user.findMany({
      where: {
        role: {
          in: ['SUBJECT_TEACHER', 'CLASS_TEACHER'],
        },
      },
      include: {
        teacherProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Remove password hashes
    const teachersWithoutPasswords = teachers.map((teacher) => {
      const { passwordHash, ...teacherWithoutPassword } = teacher;
      return teacherWithoutPassword;
    });

    res.json(teachersWithoutPasswords);
  } catch (error) {
    next(error);
  }
};

/**
 * Create teacher
 */
const createTeacher = async (req, res, next) => {
  try {
    const { email, password, fullName, role, employeeId, phone, designation, dateOfBirth, address } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

    const teacher = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role,
        isActive: true,
        teacherProfile: {
          create: {
            fullName,
            employeeId,
            phone,
            designation,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            address,
          },
        },
      },
      include: {
        teacherProfile: true,
      },
    });

    const { passwordHash: _, ...teacherWithoutPassword } = teacher;

    res.status(201).json(teacherWithoutPassword);
  } catch (error) {
    next(error);
  }
};

/**
 * Get teacher by ID
 */
const getTeacherById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.user.findUnique({
      where: { id },
      include: {
        teacherProfile: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const { passwordHash, ...teacherWithoutPassword } = teacher;

    res.json(teacherWithoutPassword);
  } catch (error) {
    next(error);
  }
};

/**
 * Update teacher
 */
const updateTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, employeeId, phone, designation, dateOfBirth, address } = req.body;

    const teacher = await prisma.user.update({
      where: { id },
      data: {
        teacherProfile: {
          update: {
            ...(fullName && { fullName }),
            ...(employeeId && { employeeId }),
            ...(phone && { phone }),
            ...(designation && { designation }),
            ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
            ...(address && { address }),
          },
        },
      },
      include: {
        teacherProfile: true,
      },
    });

    const { passwordHash, ...teacherWithoutPassword } = teacher;

    res.json(teacherWithoutPassword);
  } catch (error) {
    next(error);
  }
};

/**
 * Get teacher assignments
 */
const getTeacherAssignments = async (req, res, next) => {
  try {
    const { teacherId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;

    const where = {
      ...(teacherId && { teacherId }),
      ...(academicSessionId && { academicSessionId }),
      ...(semesterId && { semesterId }),
      ...(schoolClassId && { schoolClassId }),
      ...(sectionId && { sectionId }),
    };

    const assignments = await prisma.teacherAssignment.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        subject: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

/**
 * Create teacher assignment
 */
const createTeacherAssignment = async (req, res, next) => {
  try {
    const { teacherId, subjectId, academicSessionId, semesterId, schoolClassId, sectionId, startDate, endDate } = req.body;

    const assignment = await prisma.teacherAssignment.create({
      data: {
        teacherId,
        subjectId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
      },
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        subject: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
};

/**
 * Update teacher assignment
 */
const updateTeacherAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, endDate } = req.body;

    const assignment = await prisma.teacherAssignment.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        subject: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    res.json(assignment);
  } catch (error) {
    next(error);
  }
};

/**
 * Get class teacher assignments
 */
const getClassTeacherAssignments = async (req, res, next) => {
  try {
    const { teacherId, academicSessionId, semesterId, schoolClassId, sectionId } = req.query;

    const where = {
      ...(teacherId && { teacherId }),
      ...(academicSessionId && { academicSessionId }),
      ...(semesterId && { semesterId }),
      ...(schoolClassId && { schoolClassId }),
      ...(sectionId && { sectionId }),
    };

    const assignments = await prisma.classTeacherAssignment.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

/**
 * Create class teacher assignment
 */
const createClassTeacherAssignment = async (req, res, next) => {
  try {
    const { teacherId, academicSessionId, semesterId, schoolClassId, sectionId, startDate, endDate } = req.body;

    const assignment = await prisma.classTeacherAssignment.create({
      data: {
        teacherId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
      },
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
};

/**
 * Update class teacher assignment
 */
const updateClassTeacherAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, endDate } = req.body;

    const assignment = await prisma.classTeacherAssignment.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
      },
    });

    res.json(assignment);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeachers,
  createTeacher,
  getTeacherById,
  updateTeacher,
  getTeacherAssignments,
  createTeacherAssignment,
  updateTeacherAssignment,
  getClassTeacherAssignments,
  createClassTeacherAssignment,
  updateClassTeacherAssignment,
};

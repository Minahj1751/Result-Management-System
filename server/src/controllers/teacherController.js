const bcrypt = require('bcrypt');
const prisma = require('../config/database');

/**
 * Get all teachers
 */
const getTeachers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, includeInactive } = req.query;

    const where = {
      role: {
        in: ['SUBJECT_TEACHER', 'CLASS_TEACHER'],
      },
      ...(role && ['SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(role) && { role }),
      ...(includeInactive !== 'true' ? { isActive: true } : {}),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { teacherProfile: { fullName: { contains: search, mode: 'insensitive' } } },
          { teacherProfile: { employeeId: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const [teachers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          teacherProfile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    // Remove password hashes
    const teachersWithoutPasswords = teachers.map((teacher) => {
      const { passwordHash, ...teacherWithoutPassword } = teacher;
      return teacherWithoutPassword;
    });

    res.json({
      teachers: teachersWithoutPasswords,
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
 * Bulk activate/deactivate teachers (by user id)
 */
const bulkUpdateTeacherStatus = async (req, res, next) => {
  try {
    const { ids, isActive } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const result = await prisma.user.updateMany({
      where: {
        id: { in: ids },
        role: { in: ['SUBJECT_TEACHER', 'CLASS_TEACHER'] },
      },
      data: { isActive },
    });

    res.json({ updated: result.count });
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
    const { fullName, employeeId, phone, designation, dateOfBirth, address, isActive, email, role } = req.body;

    const userUpdate = {};
    if (email) userUpdate.email = email.toLowerCase();
    if (role && ['SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(role)) userUpdate.role = role;
    if (isActive !== undefined) userUpdate.isActive = Boolean(isActive);

    const teacher = await prisma.user.update({
      where: { id },
      data: {
        ...userUpdate,
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

    // Non-admin teachers can only see their own assignments
    const effectiveTeacherId = req.user.role === 'ADMIN'
      ? teacherId
      : (req.user.teacherProfile?.id || '__none__');

    const where = {
      teacherId: effectiveTeacherId,
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
 * Bulk create teacher assignments.
 * Body: { teacherId, academicSessionId, semesterId, startDate, endDate?,
 *         entries: [{ subjectId, schoolClassId, sectionId }] }
 * Skips combinations that already exist.
 */
const bulkCreateTeacherAssignments = async (req, res, next) => {
  try {
    const { teacherId, academicSessionId, semesterId, startDate, endDate, entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries must be a non-empty array' });
    }
    if (entries.length > 500) {
      return res.status(400).json({ error: 'Too many entries (max 500)' });
    }

    // Validate teacher exists
    const teacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      return res.status(400).json({ error: 'Teacher not found' });
    }

    // Validate session/semester
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester || semester.academicSessionId !== academicSessionId) {
      return res.status(400).json({ error: 'Semester does not belong to the selected session' });
    }

    // Validate subjects and class/section pairs
    const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
    const classIds = [...new Set(entries.map((e) => e.schoolClassId))];
    const [subjects, classes, sections] = await Promise.all([
      prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
      prisma.schoolClass.findMany({ where: { id: { in: classIds } } }),
      prisma.section.findMany({ where: { schoolClassId: { in: classIds } }, select: { id: true, schoolClassId: true } }),
    ]);
    const validSubjectIds = new Set(subjects.map((s) => s.id));
    const validClassIds = new Set(classes.map((c) => c.id));
    const validSectionKeys = new Set(sections.map((s) => `${s.schoolClassId}:${s.id}`));

    const seen = new Set();
    const validEntries = [];
    const invalid = [];
    for (const entry of entries) {
      const { subjectId, schoolClassId, sectionId } = entry;
      const key = `${subjectId}:${schoolClassId}:${sectionId}`;
      if (seen.has(key)) {
        invalid.push({ ...entry, reason: 'Duplicate in request' });
        continue;
      }
      seen.add(key);
      if (!validSubjectIds.has(subjectId)) invalid.push({ ...entry, reason: 'Invalid subject' });
      else if (!validClassIds.has(schoolClassId)) invalid.push({ ...entry, reason: 'Invalid class' });
      else if (!validSectionKeys.has(`${schoolClassId}:${sectionId}`)) invalid.push({ ...entry, reason: 'Section does not belong to class' });
      else validEntries.push({ subjectId, schoolClassId, sectionId });
    }

    // Find existing assignments to skip
    const existing = await prisma.teacherAssignment.findMany({
      where: {
        teacherId,
        academicSessionId,
        semesterId,
        OR: validEntries.map((e) => ({
          subjectId: e.subjectId,
          schoolClassId: e.schoolClassId,
          sectionId: e.sectionId,
        })),
      },
      select: { subjectId: true, schoolClassId: true, sectionId: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.subjectId}:${e.schoolClassId}:${e.sectionId}`));

    const toCreate = validEntries.filter(
      (e) => !existingKeys.has(`${e.subjectId}:${e.schoolClassId}:${e.sectionId}`)
    );

    let createdCount = 0;
    if (toCreate.length > 0) {
      const result = await prisma.teacherAssignment.createMany({
        data: toCreate.map((e) => ({
          teacherId,
          subjectId: e.subjectId,
          academicSessionId,
          semesterId,
          schoolClassId: e.schoolClassId,
          sectionId: e.sectionId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          isActive: true,
        })),
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    res.status(201).json({
      created: createdCount,
      skipped: validEntries.length - toCreate.length,
      invalid: invalid.length,
      invalidDetails: invalid,
      total: entries.length,
    });
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
 * Delete teacher assignment
 */
const deleteTeacherAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.teacherAssignment.delete({ where: { id } });
    res.json({ message: 'Teacher assignment deleted successfully' });
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

    // Non-admin teachers can only see their own assignments
    const effectiveTeacherId = req.user.role === 'ADMIN'
      ? teacherId
      : (req.user.teacherProfile?.id || '__none__');

    const where = {
      teacherId: effectiveTeacherId,
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

/**
 * Delete class teacher assignment
 */
const deleteClassTeacherAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.classTeacherAssignment.delete({ where: { id } });
    res.json({ message: 'Class teacher assignment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeachers,
  bulkUpdateTeacherStatus,
  createTeacher,
  getTeacherById,
  updateTeacher,
  getTeacherAssignments,
  createTeacherAssignment,
  bulkCreateTeacherAssignments,
  updateTeacherAssignment,
  getClassTeacherAssignments,
  createClassTeacherAssignment,
  updateClassTeacherAssignment,
  deleteClassTeacherAssignment,
  deleteTeacherAssignment,
};

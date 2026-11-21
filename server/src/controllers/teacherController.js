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
      // Session-level assignments (semesterId NULL) apply to every semester
      ...(semesterId && { OR: [{ semesterId }, { semesterId: null }] }),
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
        semesterId: semesterId || null,
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
    const { teacherId, academicSessionId, semesterId: semesterIdRaw, startDate, endDate, entries } = req.body;
    const semesterId = semesterIdRaw || null;

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

    // Validate session/semester (semesterId optional = all terms in session)
    if (semesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester || semester.academicSessionId !== academicSessionId) {
        return res.status(400).json({ error: 'Semester does not belong to the selected session' });
      }
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
 * Bulk create class teacher assignments (one teacher per class-section pair).
 * Body: { academicSessionId, semesterId, startDate, endDate?,
 *         entries: [{ teacherId, schoolClassId, sectionId }] }
 * Skips combinations that already exist.
 */
const bulkCreateClassTeacherAssignments = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId: semesterIdRaw, startDate, endDate, entries } = req.body;
    const semesterId = semesterIdRaw || null;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries must be a non-empty array' });
    }
    if (entries.length > 500) {
      return res.status(400).json({ error: 'Too many entries (max 500)' });
    }

    if (semesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester || semester.academicSessionId !== academicSessionId) {
        return res.status(400).json({ error: 'Semester does not belong to the selected session' });
      }
    }

    const teacherIds = [...new Set(entries.map((e) => e.teacherId))];
    const classIds = [...new Set(entries.map((e) => e.schoolClassId))];
    const [teachers, classes, sections] = await Promise.all([
      prisma.teacherProfile.findMany({ where: { id: { in: teacherIds } }, select: { id: true } }),
      prisma.schoolClass.findMany({ where: { id: { in: classIds } }, select: { id: true } }),
      prisma.section.findMany({ where: { schoolClassId: { in: classIds } }, select: { id: true, schoolClassId: true } }),
    ]);
    const validTeacherIds = new Set(teachers.map((t) => t.id));
    const validClassIds = new Set(classes.map((c) => c.id));
    const validSectionKeys = new Set(sections.map((s) => `${s.schoolClassId}:${s.id}`));

    const seen = new Set();
    const validEntries = [];
    const invalid = [];
    for (const entry of entries) {
      const { teacherId, schoolClassId, sectionId } = entry;
      const key = `${teacherId}:${schoolClassId}:${sectionId}`;
      if (seen.has(key)) {
        invalid.push({ ...entry, reason: 'Duplicate in request' });
        continue;
      }
      seen.add(key);
      if (!teacherId) invalid.push({ ...entry, reason: 'Teacher is required' });
      else if (!validTeacherIds.has(teacherId)) invalid.push({ ...entry, reason: 'Invalid teacher' });
      else if (!validClassIds.has(schoolClassId)) invalid.push({ ...entry, reason: 'Invalid class' });
      else if (!validSectionKeys.has(`${schoolClassId}:${sectionId}`)) invalid.push({ ...entry, reason: 'Section does not belong to class' });
      else validEntries.push({ teacherId, schoolClassId, sectionId });
    }

    // Fetch all existing assignments for the selected pairs in this session/semester
    const pairConditions = [...new Set(validEntries.map((e) => `${e.schoolClassId}:${e.sectionId}`))].map((key) => {
      const [schoolClassId, sectionId] = key.split(':');
      return { schoolClassId, sectionId };
    });
    const existing = await prisma.classTeacherAssignment.findMany({
      where: {
        academicSessionId,
        semesterId,
        OR: pairConditions,
      },
    });
    const existingByPair = new Map();
    for (const row of existing) {
      const key = `${row.schoolClassId}:${row.sectionId}`;
      if (!existingByPair.has(key)) existingByPair.set(key, []);
      existingByPair.get(key).push(row);
    }

    let createdCount = 0;
    let skippedCount = 0;
    for (const entry of validEntries) {
      const pairKey = `${entry.schoolClassId}:${entry.sectionId}`;
      const rows = existingByPair.get(pairKey) || [];

      // Already assigned to this teacher and active -> skip
      if (rows.some((r) => r.isActive && r.teacherId === entry.teacherId)) {
        skippedCount++;
        continue;
      }

      // Deactivate any other active class teacher(s) for this pair
      for (const row of rows) {
        if (row.isActive && row.teacherId !== entry.teacherId) {
          await prisma.classTeacherAssignment.update({
            where: { id: row.id },
            data: { isActive: false },
          });
          row.isActive = false;
        }
      }

      // Reactivate an inactive row for the same teacher if present, else create
      const inactiveSame = rows.find((r) => !r.isActive && r.teacherId === entry.teacherId);
      if (inactiveSame) {
        await prisma.classTeacherAssignment.update({
          where: { id: inactiveSame.id },
          data: {
            isActive: true,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
          },
        });
      } else {
        await prisma.classTeacherAssignment.create({
          data: {
            teacherId: entry.teacherId,
            academicSessionId,
            semesterId,
            schoolClassId: entry.schoolClassId,
            sectionId: entry.sectionId,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            isActive: true,
          },
        });
      }
      createdCount++;
    }

    res.status(201).json({
      created: createdCount,
      skipped: skippedCount,
      invalid: invalid.length,
      invalidDetails: invalid,
      total: entries.length,
    });
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
      // Session-level assignments (semesterId NULL) apply to every semester
      ...(semesterId && { OR: [{ semesterId }, { semesterId: null }] }),
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
        semesterId: semesterId || null,
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

/**
 * Set subject teachers for a class-section at once.
 * Body: { academicSessionId, semesterId?, schoolClassId, sectionId, startDate?,
 *         entries: [{ subjectId, teacherId }] }
 * teacherId null/empty deactivates the assignment for that subject.
 */
const setClassSubjectTeachers = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId: semesterIdRaw, schoolClassId, sectionId, startDate, entries } = req.body;
    const semesterId = semesterIdRaw || null;

    if (!academicSessionId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'academicSessionId, schoolClassId and sectionId are required' });
    }
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries must be an array' });
    }
    if (entries.length > 200) {
      return res.status(400).json({ error: 'Too many entries (max 200)' });
    }

    const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
    if (!session) {
      return res.status(400).json({ error: 'Academic session not found' });
    }

    if (semesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester || semester.academicSessionId !== academicSessionId) {
        return res.status(400).json({ error: 'Semester does not belong to the selected session' });
      }
    }

    const [schoolClass, section] = await Promise.all([
      prisma.schoolClass.findUnique({ where: { id: schoolClassId } }),
      prisma.section.findUnique({ where: { id: sectionId } }),
    ]);
    if (!schoolClass) {
      return res.status(400).json({ error: 'Class not found' });
    }
    if (!section || section.schoolClassId !== schoolClassId) {
      return res.status(400).json({ error: 'Section does not belong to the selected class' });
    }

    const subjectIds = [...new Set(entries.map((e) => e.subjectId).filter(Boolean))];
    const teacherIds = [...new Set(entries.map((e) => e.teacherId).filter(Boolean))];
    const [classSubjects, subjects, teachers] = await Promise.all([
      prisma.classSubject.findMany({
        where: { schoolClassId, subjectId: { in: subjectIds } },
        select: { subjectId: true },
      }),
      prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true } }),
      prisma.teacherProfile.findMany({ where: { id: { in: teacherIds } }, select: { id: true } }),
    ]);
    const mappedSubjectIds = new Set(classSubjects.map((cs) => cs.subjectId));
    const validSubjectIds = new Set(subjects.map((s) => s.id));
    const validTeacherIds = new Set(teachers.map((t) => t.id));

    const seen = new Set();
    const normalized = [];
    const invalid = [];
    for (const entry of entries) {
      const subjectId = entry.subjectId;
      const teacherId = entry.teacherId || null;
      if (seen.has(subjectId)) {
        invalid.push({ subjectId, reason: 'Duplicate subject in request' });
        continue;
      }
      seen.add(subjectId);
      if (!subjectId || !validSubjectIds.has(subjectId)) invalid.push({ subjectId, reason: 'Invalid subject' });
      else if (!mappedSubjectIds.has(subjectId)) invalid.push({ subjectId, reason: 'Subject is not mapped to this class' });
      else if (teacherId && !validTeacherIds.has(teacherId)) invalid.push({ subjectId, reason: 'Invalid teacher' });
      else normalized.push({ subjectId, teacherId });
    }

    let created = 0;
    let reactivated = 0;
    let deactivated = 0;
    let skipped = 0;

    for (const { subjectId, teacherId } of normalized) {
      const existing = await prisma.teacherAssignment.findMany({
        where: { subjectId, academicSessionId, semesterId, schoolClassId, sectionId },
      });

      if (!teacherId) {
        for (const row of existing.filter((r) => r.isActive)) {
          await prisma.teacherAssignment.update({ where: { id: row.id }, data: { isActive: false } });
          deactivated += 1;
        }
        continue;
      }

      const sameTeacher = existing.find((r) => r.teacherId === teacherId);
      for (const row of existing.filter((r) => r.teacherId !== teacherId && r.isActive)) {
        await prisma.teacherAssignment.update({ where: { id: row.id }, data: { isActive: false } });
        deactivated += 1;
      }

      if (sameTeacher?.isActive) {
        skipped += 1;
      } else if (sameTeacher) {
        await prisma.teacherAssignment.update({
          where: { id: sameTeacher.id },
          data: {
            isActive: true,
            startDate: startDate ? new Date(startDate) : sameTeacher.startDate,
            endDate: null,
          },
        });
        reactivated += 1;
      } else {
        await prisma.teacherAssignment.create({
          data: {
            teacherId,
            subjectId,
            academicSessionId,
            semesterId,
            schoolClassId,
            sectionId,
            startDate: startDate ? new Date(startDate) : new Date(),
            isActive: true,
          },
        });
        created += 1;
      }
    }

    res.json({
      created,
      reactivated,
      deactivated,
      skipped,
      invalid: invalid.length,
      invalidDetails: invalid,
    });
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
  setClassSubjectTeachers,
  getClassTeacherAssignments,
  createClassTeacherAssignment,
  bulkCreateClassTeacherAssignments,
  updateClassTeacherAssignment,
  deleteClassTeacherAssignment,
  deleteTeacherAssignment,
};

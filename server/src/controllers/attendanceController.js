const prisma = require('../config/database');

/**
 * Get attendance records
 */
const getAttendanceRecords = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId, studentId } = req.query;

    const where = {
      ...(academicSessionId && { academicSessionId }),
      ...(semesterId && { semesterId }),
      ...(schoolClassId && { schoolClassId }),
      ...(sectionId && { sectionId }),
      ...(studentId && { studentId }),
    };

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where,
      include: {
        student: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(attendanceRecords);
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance for a class (for class teacher)
 */
const getClassAttendance = async (req, res, next) => {
  try {
    const { academicSessionId, semesterId, schoolClassId, sectionId } = req.query;

    if (!academicSessionId || !semesterId || !schoolClassId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get enrolled students
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        isActive: true,
      },
      include: {
        student: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

    // Get existing attendance records
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
      },
    });

    // Create a map of studentId to attendance record
    const attendanceMap = new Map();
    attendanceRecords.forEach((record) => {
      attendanceMap.set(record.studentId, record);
    });

    // Combine enrollments with attendance
    const studentsWithAttendance = enrollments.map((enrollment) => {
      const attendance = attendanceMap.get(enrollment.studentId);
      return {
        student: enrollment.student,
        enrollment,
        attendance: attendance || null,
      };
    });

    res.json({
      students: studentsWithAttendance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update attendance record
 */
const upsertAttendance = async (req, res, next) => {
  try {
    const {
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      totalWorkingDays,
      daysAttended,
    } = req.body;

    // Validate attendance values
    if (totalWorkingDays < 0 || !Number.isInteger(totalWorkingDays)) {
      return res.status(400).json({ error: 'Total working days must be a non-negative integer' });
    }

    if (daysAttended < 0 || !Number.isInteger(daysAttended)) {
      return res.status(400).json({ error: 'Days attended must be a non-negative integer' });
    }

    if (daysAttended > totalWorkingDays) {
      return res.status(400).json({ error: 'Days attended cannot exceed total working days' });
    }

    const attendanceRecord = await prisma.attendanceRecord.upsert({
      where: {
        studentId_academicSessionId_semesterId_schoolClassId_sectionId: {
          studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
        },
      },
      update: {
        totalWorkingDays,
        daysAttended,
        teacherId: req.user.teacherProfile.id,
      },
      create: {
        studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        totalWorkingDays,
        daysAttended,
        teacherId: req.user.teacherProfile.id,
      },
      include: {
        student: true,
        academicSession: true,
        semester: true,
        schoolClass: true,
        section: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
    });

    // Calculate percentage
    let percentage = null;
    if (totalWorkingDays > 0) {
      percentage = (daysAttended / totalWorkingDays) * 100;
    }

    res.json({
      ...attendanceRecord,
      percentage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk upsert attendance records
 */
const bulkUpsertAttendance = async (req, res, next) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const results = [];
    const errors = [];

    for (const entry of entries) {
      try {
        const {
          studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
          totalWorkingDays,
          daysAttended,
        } = entry;

        // Validate attendance values
        if (totalWorkingDays < 0 || !Number.isInteger(totalWorkingDays)) {
          errors.push({ entry, error: 'Total working days must be a non-negative integer' });
          continue;
        }

        if (daysAttended < 0 || !Number.isInteger(daysAttended)) {
          errors.push({ entry, error: 'Days attended must be a non-negative integer' });
          continue;
        }

        if (daysAttended > totalWorkingDays) {
          errors.push({ entry, error: 'Days attended cannot exceed total working days' });
          continue;
        }

        const attendanceRecord = await prisma.attendanceRecord.upsert({
          where: {
            studentId_academicSessionId_semesterId_schoolClassId_sectionId: {
              studentId,
              academicSessionId,
              semesterId,
              schoolClassId,
              sectionId,
            },
          },
          update: {
            totalWorkingDays,
            daysAttended,
            teacherId: req.user.teacherProfile.id,
          },
          create: {
            studentId,
            academicSessionId,
            semesterId,
            schoolClassId,
            sectionId,
            totalWorkingDays,
            daysAttended,
            teacherId: req.user.teacherProfile.id,
          },
          include: {
            student: true,
          },
        });

        // Calculate percentage
        let percentage = null;
        if (totalWorkingDays > 0) {
          percentage = (daysAttended / totalWorkingDays) * 100;
        }

        results.push({
          ...attendanceRecord,
          percentage,
        });
      } catch (error) {
        errors.push({ entry, error: error.message });
      }
    }

    res.json({
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceRecords,
  getClassAttendance,
  upsertAttendance,
  bulkUpsertAttendance,
};

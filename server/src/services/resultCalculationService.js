const prisma = require('../config/database');

/**
 * Calculate result for a student in a subject
 */
const calculateStudentSubjectResult = async (studentId, academicSessionId, semesterId, schoolClassId, sectionId, subjectId) => {
  try {
    // Get all assessments for this subject
    const assessments = await prisma.assessment.findMany({
      where: {
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        subjectId,
      },
      include: {
        category: true,
        marksEntries: {
          where: { studentId },
        },
      },
    });

    if (assessments.length === 0) {
      return null;
    }

    // Group by category
    const categoryResults = {};
    let totalWeightedMarks = 0;
    let totalWeightage = 0;

    for (const assessment of assessments) {
      const categoryCode = assessment.category.code;
      const marksEntry = assessment.marksEntries[0];

      if (!categoryResults[categoryCode]) {
        categoryResults[categoryCode] = {
          categoryName: assessment.category.name,
          categoryWeightage: parseFloat(assessment.category.weightage),
          totalMaximumMarks: 0,
          totalObtainedMarks: 0,
          assessments: [],
        };
      }

      const category = categoryResults[categoryCode];
      category.assessments.push({
        assessmentId: assessment.id,
        name: assessment.name,
        maximumMarks: parseFloat(assessment.maximumMarks),
        marksObtained: marksEntry ? parseFloat(marksEntry.marksObtained || 0) : null,
        status: marksEntry ? marksEntry.status : 'PENDING',
        date: marksEntry?.individualDate || assessment.defaultDate,
      });

      const isAbsent = marksEntry?.status === 'ABSENT';
      const isExempt = marksEntry?.status === 'EXEMPTED' || marksEntry?.status === 'NOT_APPLICABLE';
      const hasMarks = marksEntry && marksEntry.marksObtained !== null && marksEntry.marksObtained !== undefined;

      if (isAbsent) {
        // Absent counts as 0 obtained but the maximum still counts in the denominator
        category.totalMaximumMarks += parseFloat(assessment.maximumMarks);
      } else if (!isExempt && hasMarks) {
        category.totalMaximumMarks += parseFloat(assessment.maximumMarks);
        category.totalObtainedMarks += parseFloat(marksEntry.marksObtained);
      }
      // EXEMPTED / NOT_APPLICABLE / no marks entry: excluded from both numerator and denominator
    }

    // Calculate category percentages and weighted marks
    for (const categoryCode in categoryResults) {
      const category = categoryResults[categoryCode];
      if (category.totalMaximumMarks > 0) {
        category.percentage = (category.totalObtainedMarks / category.totalMaximumMarks) * 100;
        category.weightedMarks = (category.percentage * category.categoryWeightage) / 100;
        totalWeightedMarks += category.weightedMarks;
        totalWeightage += category.categoryWeightage;
      }
    }

    // Get grading policy
    const gradingPolicy = await prisma.gradingPolicy.findFirst({
      where: { isActive: true },
      include: {
        gradeScales: {
          orderBy: { minPercentage: 'desc' },
        },
      },
    });

    // Calculate final percentage and grade
    let finalPercentage = 0;
    let grade = null;
    let gradePoint = null;

    if (totalWeightage > 0) {
      // Normalize by the total weightage of categories that actually have marks,
      // so the result is correct even when weightages don't sum to exactly 100.
      finalPercentage = (totalWeightedMarks * 100) / totalWeightage;
    }

    if (gradingPolicy && gradingPolicy.gradeScales.length > 0) {
      for (const gradeScale of gradingPolicy.gradeScales) {
        if (finalPercentage >= parseFloat(gradeScale.minPercentage) && finalPercentage <= parseFloat(gradeScale.maxPercentage)) {
          grade = gradeScale.grade;
          gradePoint = gradeScale.gradePoint ? parseFloat(gradeScale.gradePoint) : null;
          break;
        }
      }
    }

    return {
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      subjectId,
      categoryResults,
      totalWeightedMarks,
      totalWeightage,
      finalPercentage,
      grade,
      gradePoint,
    };
  } catch (error) {
    console.error('Error calculating result:', error);
    throw error;
  }
};

/**
 * Calculate results for all students in a class
 */
const calculateClassResults = async (academicSessionId, semesterId, schoolClassId, sectionId) => {
  try {
    // Get enrolled students: semester-specific + session-level roster, deduped
    const enrollmentRows = await prisma.studentEnrollment.findMany({
      where: {
        academicSessionId,
        schoolClassId,
        sectionId,
        isActive: true,
        OR: [{ semesterId }, { semesterId: null }],
      },
      include: {
        student: true,
      },
    });
    const enrollmentByStudent = new Map();
    enrollmentRows
      .sort((a, b) => (a.semesterId ? 0 : 1) - (b.semesterId ? 0 : 1))
      .forEach((e) => {
        if (!enrollmentByStudent.has(e.studentId)) enrollmentByStudent.set(e.studentId, e);
      });
    const enrollments = [...enrollmentByStudent.values()].sort(
      (a, b) => (a.rollNumber ?? 999999) - (b.rollNumber ?? 999999)
    );

    // Get all subjects for this class
    const subjects = await prisma.subject.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const results = [];

    for (const enrollment of enrollments) {
      const studentResults = {
        student: enrollment.student,
        enrollment,
        subjects: [],
      };

      for (const subject of subjects) {
        const subjectResult = await calculateStudentSubjectResult(
          enrollment.studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
          subject.id
        );

        if (subjectResult) {
          studentResults.subjects.push({
            subject,
            result: subjectResult,
          });
        }
      }

      results.push(studentResults);
    }

    return results;
  } catch (error) {
    console.error('Error calculating class results:', error);
    throw error;
  }
};

/**
 * Finalize result snapshot
 */
const finalizeResultSnapshot = async (studentId, academicSessionId, semesterId, schoolClassId, sectionId, subjectId, finalizedBy) => {
  try {
    const calculation = await calculateStudentSubjectResult(
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      subjectId
    );

    if (!calculation) {
      throw new Error('No assessments found for this subject');
    }

    // Get subject name
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    // Create or update result snapshot
    const snapshot = await prisma.resultSnapshot.upsert({
      where: {
        studentId_academicSessionId_semesterId_schoolClassId_sectionId_subjectId: {
          studentId,
          academicSessionId,
          semesterId,
          schoolClassId,
          sectionId,
          subjectId,
        },
      },
      update: {
        totalMarks: Number(calculation.finalPercentage.toFixed(2)),
        maximumMarks: 100,
        percentage: calculation.finalPercentage,
        grade: calculation.grade,
        gradePoint: calculation.gradePoint,
        jsonData: JSON.stringify(calculation),
        status: 'FINALIZED',
        finalizedBy,
        finalizedAt: new Date(),
      },
      create: {
        studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        subjectId,
        totalMarks: Number(calculation.finalPercentage.toFixed(2)),
        maximumMarks: 100,
        percentage: calculation.finalPercentage,
        grade: calculation.grade,
        gradePoint: calculation.gradePoint,
        jsonData: JSON.stringify(calculation),
        status: 'FINALIZED',
        finalizedBy,
        finalizedAt: new Date(),
      },
    });

    return snapshot;
  } catch (error) {
    console.error('Error finalizing result snapshot:', error);
    throw error;
  }
};

/**
 * Get result snapshot for marksheet generation
 */
const getResultSnapshot = async (studentId, academicSessionId, semesterId, schoolClassId, sectionId) => {
  try {
    const snapshots = await prisma.resultSnapshot.findMany({
      where: {
        studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        status: 'FINALIZED',
      },
      include: {
        subject: true,
      },
      orderBy: {
        subject: { sortOrder: 'asc' },
      },
    });

    return snapshots;
  } catch (error) {
    console.error('Error getting result snapshots:', error);
    throw error;
  }
};

/**
 * Build marksheet rows live from assessments/marks (no finalized snapshot needed).
 * Returns snapshot-shaped objects: { subject, percentage, grade, gradePoint, jsonData }.
 * Subjects without any entered marks get null percentage/grade so the PDF shows N/A.
 */
const getStudentMarksheetSnapshots = async (studentId, academicSessionId, semesterId, schoolClassId, sectionId) => {
  // Prefer class-wise subject mapping; fall back to subjects that have assessments
  const classSubjects = await prisma.classSubject.findMany({
    where: { schoolClassId },
    include: { subject: true },
  });

  let subjects;
  if (classSubjects.length > 0) {
    subjects = classSubjects.map((cs) => cs.subject);
  } else {
    const assessmentRows = await prisma.assessment.findMany({
      where: { academicSessionId, semesterId, schoolClassId, sectionId },
      include: { subject: true },
    });
    const seen = new Set();
    subjects = [];
    assessmentRows.forEach((a) => {
      if (a.subject && !seen.has(a.subject.id)) {
        seen.add(a.subject.id);
        subjects.push(a.subject);
      }
    });
  }

  subjects.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

  const snapshots = [];
  for (const subject of subjects) {
    const calculation = await calculateStudentSubjectResult(
      studentId, academicSessionId, semesterId, schoolClassId, sectionId, subject.id
    );
    if (!calculation) continue; // no assessments for this subject

    const hasResult = calculation.totalWeightage > 0;
    snapshots.push({
      subject,
      percentage: hasResult ? calculation.finalPercentage : null,
      grade: hasResult ? calculation.grade : null,
      gradePoint: hasResult ? calculation.gradePoint : null,
      jsonData: JSON.stringify(calculation),
    });
  }

  return snapshots;
};

/**
 * Compute overall result summary across subject snapshots for marksheets.
 * Returns average percentage, GPA (mean of grade points), overall grade,
 * and pass/fail status. Pass requires every graded subject to be non-fail.
 */
const computeOverallSummary = (snapshots) => {
  const graded = snapshots.filter((s) => s.percentage !== null && s.percentage !== undefined);
  if (graded.length === 0) {
    return { averagePercentage: null, gpa: null, overallGrade: null, resultStatus: 'N/A' };
  }

  const averagePercentage =
    graded.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / graded.length;

  const withGradePoint = graded.filter((s) => s.gradePoint !== null && s.gradePoint !== undefined);
  const gpa = withGradePoint.length > 0
    ? withGradePoint.reduce((sum, s) => sum + parseFloat(s.gradePoint), 0) / withGradePoint.length
    : null;

  // Overall grade from the active grading scale using average percentage
  // (re-fetched by caller if needed; here we reuse the lowest/best matching grade)
  const failed = graded.some((s) => (s.grade || '').toUpperCase() === 'F');
  const resultStatus = failed ? 'FAIL' : 'PASS';

  return {
    averagePercentage: Number(averagePercentage.toFixed(2)),
    gpa: gpa !== null ? Number(gpa.toFixed(2)) : null,
    overallGrade: null, // filled by caller using grading policy if desired
    resultStatus,
  };
};

module.exports = {
  calculateStudentSubjectResult,
  calculateClassResults,
  finalizeResultSnapshot,
  getResultSnapshot,
  getStudentMarksheetSnapshots,
  computeOverallSummary,
};

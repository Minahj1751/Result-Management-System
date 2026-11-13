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

      if (marksEntry && marksEntry.marksObtained !== null && marksEntry.status !== 'ABSENT' && marksEntry.status !== 'EXEMPTED') {
        category.totalMaximumMarks += parseFloat(assessment.maximumMarks);
        category.totalObtainedMarks += parseFloat(marksEntry.marksObtained);
      }
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
      finalPercentage = totalWeightedMarks; // Weighted marks are already percentages
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
    // Get all enrolled students
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
        totalMarks: calculation.totalWeightedMarks,
        maximumMarks: calculation.totalWeightage,
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
        totalMarks: calculation.totalWeightedMarks,
        maximumMarks: calculation.totalWeightage,
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

module.exports = {
  calculateStudentSubjectResult,
  calculateClassResults,
  finalizeResultSnapshot,
  getResultSnapshot,
};

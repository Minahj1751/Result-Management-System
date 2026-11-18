const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const demoDateFor = (assessment, semester) => {
  const fallback = assessment.createdAt ? new Date(assessment.createdAt) : new Date();
  if (!semester?.startDate) return fallback;

  const start = new Date(semester.startDate);
  const semesterEnd = semester.endDate ? new Date(semester.endDate) : start;
  const today = new Date();
  const latest = semesterEnd < today ? semesterEnd : today;
  const effectiveEnd = latest > start ? latest : start;
  const dayMs = 24 * 60 * 60 * 1000;
  const spanDays = Math.max(1, Math.floor((effectiveEnd - start) / dayMs));
  const offsetDays = hashString(assessment.id) % spanDays;
  const hour = 9 + (hashString(`${assessment.id}:hour`) % 7);

  const date = new Date(start);
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date > today ? today : date;
};

const demoMarksFor = (assessment) => {
  const maximumMarks = parseFloat(assessment.maximumMarks) || 0;
  const percentage = 45 + (hashString(`${assessment.id}:marks`) % 51);
  return Math.round(((maximumMarks * percentage) / 100) * 100) / 100;
};

const groupKey = (item) => [
  item.academicSessionId,
  item.schoolClassId,
  item.sectionId,
].join('|');

const subjectAssignmentKey = (item) => [
  item.subjectId,
  item.academicSessionId,
  item.schoolClassId,
  item.sectionId,
].join('|');

const classTeacherKey = (item) => [
  item.academicSessionId,
  item.schoolClassId,
  item.sectionId,
].join('|');

const semesterMatchRank = (candidateSemesterId, targetSemesterId) =>
  candidateSemesterId === targetSemesterId ? 0 : 1;

async function main() {
  console.log('Generating demo assessment dates and marks...');

  const [assessments, enrollments, teacherAssignments, classTeacherAssignments, teacherProfiles, semesters, existingMarks] = await Promise.all([
    prisma.assessment.findMany({
      select: {
        id: true,
        name: true,
        academicSessionId: true,
        semesterId: true,
        schoolClassId: true,
        sectionId: true,
        subjectId: true,
        maximumMarks: true,
        defaultDate: true,
        createdAt: true,
      },
    }),
    prisma.studentEnrollment.findMany({
      where: { isActive: true },
      select: {
        studentId: true,
        academicSessionId: true,
        semesterId: true,
        schoolClassId: true,
        sectionId: true,
      },
    }),
    prisma.teacherAssignment.findMany({
      where: { isActive: true },
      select: {
        teacherId: true,
        subjectId: true,
        academicSessionId: true,
        semesterId: true,
        schoolClassId: true,
        sectionId: true,
        createdAt: true,
      },
    }),
    prisma.classTeacherAssignment.findMany({
      where: { isActive: true },
      select: {
        teacherId: true,
        academicSessionId: true,
        semesterId: true,
        schoolClassId: true,
        sectionId: true,
        createdAt: true,
      },
    }),
    prisma.teacherProfile.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.semester.findMany({
      select: { id: true, startDate: true, endDate: true },
    }),
    prisma.marksEntry.findMany({
      select: { studentId: true, assessmentId: true },
    }),
  ]);

  const semesterById = new Map(semesters.map((semester) => [semester.id, semester]));
  const fallbackTeacherId = teacherProfiles[0]?.id || null;
  const existingMarkKeys = new Set(existingMarks.map((mark) => `${mark.studentId}:${mark.assessmentId}`));

  const enrollmentsByGroup = new Map();
  for (const enrollment of enrollments) {
    const key = groupKey(enrollment);
    if (!enrollmentsByGroup.has(key)) enrollmentsByGroup.set(key, []);
    enrollmentsByGroup.get(key).push(enrollment);
  }

  const rosterFor = (assessment) => {
    const candidates = (enrollmentsByGroup.get(groupKey(assessment)) || [])
      .filter((enrollment) => enrollment.semesterId === assessment.semesterId || enrollment.semesterId === null);

    const byStudent = new Map();
    for (const enrollment of candidates) {
      const existing = byStudent.get(enrollment.studentId);
      if (!existing || (enrollment.semesterId && !existing.semesterId)) {
        byStudent.set(enrollment.studentId, enrollment);
      }
    }
    return [...byStudent.values()];
  };

  const teacherAssignmentsByKey = new Map();
  for (const assignment of teacherAssignments) {
    const key = subjectAssignmentKey(assignment);
    if (!teacherAssignmentsByKey.has(key)) teacherAssignmentsByKey.set(key, []);
    teacherAssignmentsByKey.get(key).push(assignment);
  }

  const classTeachersByKey = new Map();
  for (const assignment of classTeacherAssignments) {
    const key = classTeacherKey(assignment);
    if (!classTeachersByKey.has(key)) classTeachersByKey.set(key, []);
    classTeachersByKey.get(key).push(assignment);
  }

  const teacherFor = (assessment) => {
    const subjectCandidates = (teacherAssignmentsByKey.get(subjectAssignmentKey(assessment)) || [])
      .filter((assignment) => assignment.semesterId === assessment.semesterId || assignment.semesterId === null)
      .sort((a, b) =>
        semesterMatchRank(a.semesterId, assessment.semesterId) - semesterMatchRank(b.semesterId, assessment.semesterId) ||
        a.createdAt - b.createdAt
      );
    if (subjectCandidates[0]) return { teacherId: subjectCandidates[0].teacherId, source: 'subject' };

    const classCandidates = (classTeachersByKey.get(classTeacherKey(assessment)) || [])
      .filter((assignment) => assignment.semesterId === assessment.semesterId || assignment.semesterId === null)
      .sort((a, b) =>
        semesterMatchRank(a.semesterId, assessment.semesterId) - semesterMatchRank(b.semesterId, assessment.semesterId) ||
        a.createdAt - b.createdAt
      );
    if (classCandidates[0]) return { teacherId: classCandidates[0].teacherId, source: 'class-teacher' };

    return fallbackTeacherId ? { teacherId: fallbackTeacherId, source: 'fallback' } : null;
  };

  const dateUpdates = [];
  const marksData = [];
  let assessmentsWithoutRoster = 0;
  let assessmentsWithoutTeacher = 0;
  let existingSkipped = 0;
  const teacherSourceCounts = { subject: 0, 'class-teacher': 0, fallback: 0 };

  for (const assessment of assessments) {
    const roster = rosterFor(assessment);
    if (roster.length === 0) {
      assessmentsWithoutRoster += 1;
      continue;
    }

    const teacher = teacherFor(assessment);
    if (!teacher) {
      assessmentsWithoutTeacher += 1;
      continue;
    }
    teacherSourceCounts[teacher.source] += 1;

    if (!assessment.defaultDate) {
      dateUpdates.push({
        id: assessment.id,
        defaultDate: demoDateFor(assessment, semesterById.get(assessment.semesterId)),
      });
    }

    for (const enrollment of roster) {
      const key = `${enrollment.studentId}:${assessment.id}`;
      if (existingMarkKeys.has(key)) {
        existingSkipped += 1;
        continue;
      }
      marksData.push({
        studentId: enrollment.studentId,
        assessmentId: assessment.id,
        marksObtained: demoMarksFor(assessment),
        status: 'PENDING',
        remarks: 'Demo mark',
        teacherId: teacher.teacherId,
      });
    }
  }

  console.log(`Assessments: ${assessments.length}`);
  console.log(`Assessment dates to fill: ${dateUpdates.length}`);
  console.log(`Marks entries to create: ${marksData.length}`);
  console.log(`Existing marks skipped: ${existingSkipped}`);
  console.log(`Assessments without roster: ${assessmentsWithoutRoster}`);
  console.log(`Assessments without teacher: ${assessmentsWithoutTeacher}`);
  console.log('Teacher sources:', teacherSourceCounts);

  for (let i = 0; i < dateUpdates.length; i += 50) {
    const chunk = dateUpdates.slice(i, i + 50);
    await prisma.$transaction(
      chunk.map((update) => prisma.assessment.update({
        where: { id: update.id },
        data: { defaultDate: update.defaultDate },
      }))
    );
  }

  let marksCreated = 0;
  for (let i = 0; i < marksData.length; i += 500) {
    const chunk = marksData.slice(i, i + 500);
    const result = await prisma.marksEntry.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    marksCreated += result.count;
  }

  console.log(`Dates updated: ${dateUpdates.length}`);
  console.log(`Marks created: ${marksCreated}`);
  console.log('Demo marks generation completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

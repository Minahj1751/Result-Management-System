const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EXAM_CODES = new Set(['TERM_EXAM', 'EXAM', 'FINAL_EXAM']);

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const demoMarksFor = (assessment, studentId) => {
  const maximumMarks = parseFloat(assessment.maximumMarks) || 0;
  // Deterministic per student+assessment, spread across 40-98%
  const percentage = 40 + (hashString(`${assessment.id}:${studentId}:exam`) % 59);
  return Math.round(((maximumMarks * percentage) / 100) * 100) / 100;
};

const DEMO_REMARKS = [
  'A sincere and regular student. Keep practicing.',
  'Shows good improvement this semester. Focus on time management.',
  'Participates actively in class. Encourage more revision.',
  'Consistent performance. Needs to work harder on weak topics.',
  'Excellent attitude and discipline. Keep it up.',
  'Steady progress observed. More practice in weaker areas needed.',
];

const groupKey = (a) => [a.academicSessionId, a.semesterId, a.schoolClassId, a.sectionId, a.subjectId].join('|');
// Enrollments/assignments may be session-level (semesterId NULL) while
// assessments carry a concrete semesterId — scope keys ignore semesterId.
const scopeKey = (a) => [a.academicSessionId, a.schoolClassId, a.sectionId].join('|');
const subjectAssignmentKey = (a) => [a.subjectId, a.academicSessionId, a.schoolClassId, a.sectionId].join('|');
const classTeacherKey = (a) => [a.academicSessionId, a.schoolClassId, a.sectionId].join('|');

const isExamCategory = (code) => EXAM_CODES.has(String(code || '').toUpperCase());

async function main() {
  console.log('Seeding semester exam demo data...');

  const [assessments, enrollments, teacherAssignments, classTeacherAssignments, teacherProfiles, semesters, existingMarks, existingRemarks] = await Promise.all([
    prisma.assessment.findMany({
      include: { category: true, subject: true },
    }),
    prisma.studentEnrollment.findMany({ where: { isActive: true } }),
    prisma.teacherAssignment.findMany({ where: { isActive: true } }),
    prisma.classTeacherAssignment.findMany({ where: { isActive: true } }),
    prisma.teacherProfile.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
    prisma.semester.findMany({ select: { id: true, startDate: true, endDate: true } }),
    prisma.marksEntry.findMany({ select: { studentId: true, assessmentId: true } }),
    prisma.studentRemark.findMany({ select: { studentId: true, academicSessionId: true, semesterId: true, schoolClassId: true, sectionId: true } }),
  ]);

  const semesterById = new Map(semesters.map((s) => [s.id, s]));
  const examCategory = await prisma.assessmentCategory.findFirst({
    where: { code: 'TERM_EXAM' },
  });
  if (!examCategory) throw new Error('TERM_EXAM category not found — run seed first');

  const fallbackTeacherId = teacherProfiles[0]?.id || null;
  const existingMarkKeys = new Set(existingMarks.map((m) => `${m.studentId}:${m.assessmentId}`));
  const existingRemarkKeys = new Set(existingRemarks.map((r) =>
    [r.studentId, r.academicSessionId, r.semesterId, r.schoolClassId, r.sectionId].join('|')));

  // ---------- 1. Create missing TERM_EXAM assessments ----------
  const scopesWithContinuous = new Set();
  const scopesWithExam = new Set();
  for (const a of assessments) {
    if (isExamCategory(a.category?.code)) scopesWithExam.add(groupKey(a));
    else scopesWithContinuous.add(groupKey(a));
  }

  const missingExamScopes = [...scopesWithContinuous].filter((k) => !scopesWithExam.has(k));
  let examsCreated = 0;

  for (const key of missingExamScopes) {
    const sample = assessments.find((a) => groupKey(a) === key);
    if (!sample) continue;

    const semester = semesterById.get(sample.semesterId);
    const defaultDate = semester?.endDate && new Date(semester.endDate) < new Date()
      ? semester.endDate
      : new Date();

    try {
      await prisma.assessment.create({
        data: {
          name: 'Term Exam',
          categoryId: examCategory.id,
          academicSessionId: sample.academicSessionId,
          semesterId: sample.semesterId,
          schoolClassId: sample.schoolClassId,
          sectionId: sample.sectionId,
          subjectId: sample.subjectId,
          maximumMarks: 100,
          defaultDate,
          submissionStatus: 'SUBMITTED',
        },
      });
      examsCreated += 1;
    } catch (e) {
      // unique constraint — already exists under a different name
      if (e.code !== 'P2002') throw e;
    }
  }
  console.log(`Term Exam assessments created: ${examsCreated}`);

  // Reload assessments so new exams are included
  const allAssessments = await prisma.assessment.findMany({ include: { category: true } });
  const examAssessments = allAssessments.filter((a) => isExamCategory(a.category?.code));
  console.log(`Total exam assessments: ${examAssessments.length}`);

  // ---------- 2. Roster + teacher helpers ----------
  const enrollmentsByScope = new Map();
  for (const e of enrollments) {
    const key = scopeKey(e);
    if (!enrollmentsByScope.has(key)) enrollmentsByScope.set(key, []);
    enrollmentsByScope.get(key).push(e);
  }

  const rosterFor = (assessment) => {
    const candidates = (enrollmentsByScope.get(scopeKey(assessment)) || [])
      .filter((e) => e.semesterId === assessment.semesterId || e.semesterId === null);
    const byStudent = new Map();
    for (const e of candidates) {
      const existing = byStudent.get(e.studentId);
      if (!existing || (e.semesterId && !existing.semesterId)) byStudent.set(e.studentId, e);
    }
    return [...byStudent.values()];
  };

  const teacherAssignmentsByKey = new Map();
  for (const t of teacherAssignments) {
    const key = subjectAssignmentKey(t);
    if (!teacherAssignmentsByKey.has(key)) teacherAssignmentsByKey.set(key, []);
    teacherAssignmentsByKey.get(key).push(t);
  }
  const classTeachersByKey = new Map();
  for (const t of classTeacherAssignments) {
    const key = classTeacherKey(t);
    if (!classTeachersByKey.has(key)) classTeachersByKey.set(key, []);
    classTeachersByKey.get(key).push(t);
  }

  const rank = (semId, target) => (semId === target ? 0 : 1);
  const teacherFor = (a) => {
    const subj = (teacherAssignmentsByKey.get(subjectAssignmentKey(a)) || [])
      .filter((t) => t.semesterId === a.semesterId || t.semesterId === null)
      .sort((x, y) => rank(x.semesterId, a.semesterId) - rank(y.semesterId, a.semesterId) || x.createdAt - y.createdAt);
    if (subj[0]) return subj[0].teacherId;
    const cls = (classTeachersByKey.get(classTeacherKey(a)) || [])
      .filter((t) => t.semesterId === a.semesterId || t.semesterId === null)
      .sort((x, y) => rank(x.semesterId, a.semesterId) - rank(y.semesterId, a.semesterId) || x.createdAt - y.createdAt);
    if (cls[0]) return cls[0].teacherId;
    return fallbackTeacherId;
  };

  // ---------- 3. Exam marks entries ----------
  const marksData = [];
  let skippedExisting = 0;
  for (const assessment of examAssessments) {
    const teacherId = teacherFor(assessment);
    if (!teacherId) continue;
    for (const enrollment of rosterFor(assessment)) {
      const key = `${enrollment.studentId}:${assessment.id}`;
      if (existingMarkKeys.has(key)) { skippedExisting += 1; continue; }
      marksData.push({
        studentId: enrollment.studentId,
        assessmentId: assessment.id,
        marksObtained: demoMarksFor(assessment, enrollment.studentId),
        status: 'PENDING',
        remarks: 'Demo exam mark',
        teacherId,
      });
    }
  }

  let marksCreated = 0;
  for (let i = 0; i < marksData.length; i += 500) {
    const result = await prisma.marksEntry.createMany({ data: marksData.slice(i, i + 500), skipDuplicates: true });
    marksCreated += result.count;
  }
  console.log(`Exam marks created: ${marksCreated} (skipped existing: ${skippedExisting})`);

  // ---------- 4. Class teacher remarks ----------
  const remarkData = [];
  const remarkScopes = new Map(); // "session|class|section|semesterId" -> scopeKey
  for (const a of allAssessments) {
    const key = `${scopeKey(a)}|${a.semesterId}`;
    if (!remarkScopes.has(key)) remarkScopes.set(key, a);
  }

  for (const [key, sample] of remarkScopes) {
    const [academicSessionId, schoolClassId, sectionId, semesterId] = key.split('|');
    const roster = (enrollmentsByScope.get(scopeKey(sample)) || [])
      .filter((e) => e.semesterId === semesterId || e.semesterId === null);
    const byStudent = new Map();
    for (const e of roster) {
      const existing = byStudent.get(e.studentId);
      if (!existing || (e.semesterId && !existing.semesterId)) byStudent.set(e.studentId, e);
    }

    let idx = 0;
    for (const enrollment of byStudent.values()) {
      const rKey = [enrollment.studentId, academicSessionId, semesterId, schoolClassId, sectionId].join('|');
      if (existingRemarkKeys.has(rKey)) continue;
      remarkData.push({
        studentId: enrollment.studentId,
        academicSessionId,
        semesterId,
        schoolClassId,
        sectionId,
        remarks: DEMO_REMARKS[idx % DEMO_REMARKS.length],
      });
      idx += 1;
    }
  }

  let remarksCreated = 0;
  for (const r of remarkData) {
    try {
      await prisma.studentRemark.create({ data: r });
      remarksCreated += 1;
    } catch (e) {
      if (e.code !== 'P2002') throw e;
    }
  }
  console.log(`Student remarks created: ${remarksCreated}`);

  // ---------- 5. Demo rule variety: Grade 1 -> Mathematics uses BEST1 ----------
  const grade1 = await prisma.schoolClass.findFirst({ where: { name: 'Grade 1' } });
  const math = await prisma.subject.findFirst({ where: { name: 'Mathematics' } });
  if (grade1 && math) {
    const updated = await prisma.classSubject.updateMany({
      where: { schoolClassId: grade1.id, subjectId: math.id },
      data: { assessmentRule: 'BEST1' },
    });
    if (updated.count > 0) console.log('Set Grade 1 Mathematics CW/HW rule -> BEST1 (demo)');
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

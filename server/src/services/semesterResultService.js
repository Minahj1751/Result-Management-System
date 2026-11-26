const prisma = require('../config/database');
const { EXAM_MODES, MAX_MARKS_BY_MODE, ENTRY_MAX_MARKS_BY_MODE, getClassExamMode } = require('../utils/examMode');

/**
 * Semester Examination result calculation.
 *
 * Standard classes (Grade 4+), per subject per student:
 *   Class Test  -> best 2 of N assessments -> 20 marks
 *   Class Work  -> rule-based (best 2 avg / best 1)  -> 10 marks
 *   Home Work   -> rule-based (best 2 avg / best 1)  -> 10 marks
 *   Term Exam   -> all exam-category assessments aggregated -> 60 marks
 *   Total       -> out of 100
 *
 * Primary classes (Grade 1-3): no term exam.
 *   CT -> 40, CW -> 20, HW -> 20 = Class Marks (80);
 *   Attendance marks (20, direct entry) complete the 100-mark total.
 *
 * Direct Term Exam entry overrides this: Grade 4+ stores one combined
 * Class Work mark (out of 40, in classWorkMarks) + Term Exam (60);
 * Grade 1-3 stores CT/CW/HW + Attendance as before.
 *
 * This is intentionally separate from resultCalculationService so the
 * existing assessment marksheet keeps working unchanged.
 */

const EXAM_CATEGORY_CODES = new Set(['TERM_EXAM', 'EXAM', 'FINAL_EXAM']);
const ASSESSMENT_RULES = new Set(['BEST2_AVG', 'BEST1']);
const DEFAULT_RULE = 'BEST2_AVG';

const norm = (value) => String(value || '').trim().toUpperCase();

/**
 * Classify an assessment category into CT / CW / HW / EXAM / OTHER.
 * Matches on category code first, then on the category name.
 */
const getCategoryKind = (category) => {
  if (!category) return 'OTHER';
  const code = norm(category.code);
  if (code === 'CT' || code === 'CLASS_TEST' || code === 'CLASSTEST') return 'CT';
  if (code === 'CW' || code === 'CLASSWORK' || code === 'CLASS_WORK') return 'CW';
  if (code === 'HW' || code === 'HOMEWORK' || code === 'HOME_WORK') return 'HW';
  if (EXAM_CATEGORY_CODES.has(code)) return 'EXAM';

  const name = norm(category.name).replace(/[\s_-]+/g, '');
  if (name.includes('CLASSTEST')) return 'CT';
  if (name.includes('CLASSWORK')) return 'CW';
  if (name.includes('HOMEWORK')) return 'HW';
  if (name.includes('EXAM')) return 'EXAM';
  return 'OTHER';
};

const isExemptStatus = (status) => status === 'EXEMPTED' || status === 'NOT_APPLICABLE';

/**
 * Eligible candidates for "best N" selection.
 * ABSENT counts as 0 obtained (the assessment was held, student scored 0).
 * EXEMPTED / NOT_APPLICABLE / missing entries are excluded entirely.
 */
const getCandidates = (assessments, studentId) => {
  const candidates = [];
  for (const assessment of assessments) {
    const entry = (assessment.marksEntries || []).find((e) => e.studentId === studentId);
    if (!entry) continue;
    if (isExemptStatus(entry.status)) continue;

    const maximumMarks = parseFloat(assessment.maximumMarks) || 0;
    const obtained = entry.status === 'ABSENT'
      ? 0
      : (entry.marksObtained !== null && entry.marksObtained !== undefined
        ? parseFloat(entry.marksObtained)
        : null);
    if (obtained === null) continue;

    candidates.push({
      assessment,
      obtained,
      maximumMarks,
      date: entry.individualDate || assessment.defaultDate,
      name: assessment.name,
    });
  }
  // Best = highest raw marks; ties broken by higher max, earlier date, name
  candidates.sort((a, b) =>
    b.obtained - a.obtained ||
    b.maximumMarks - a.maximumMarks ||
    new Date(a.date || 0) - new Date(b.date || 0) ||
    String(a.name).localeCompare(String(b.name))
  );
  return candidates;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Percentage score for a group of assessments.
 * mode 'best2sum': best 2 by raw marks, summed (Class Test)
 * mode 'best2avg': best 2 by raw marks, average divided by 2 (rounded) (CW/HW rule A)
 * mode 'best1':    best 1 by raw marks (CW/HW rule B)
 * mode 'aggregate': sum obtained / sum max over all candidates (term exam)
 */
const scoreGroup = (candidates, mode) => {
  if (candidates.length === 0) return null;

  if (mode === 'aggregate') {
    const max = candidates.reduce((s, c) => s + c.maximumMarks, 0);
    if (max <= 0) return null;
    const obtained = candidates.reduce((s, c) => s + c.obtained, 0);
    return { percentage: (obtained / max) * 100, used: candidates.length, selected: candidates.map(describeCandidate) };
  }

  if (mode === 'best2sum') {
    const selected = candidates.slice(0, 2);
    const max = selected.reduce((s, c) => s + c.maximumMarks, 0);
    if (max <= 0) return null;
    const obtained = selected.reduce((s, c) => s + c.obtained, 0);
    return { percentage: (obtained / max) * 100, used: selected.length, selected: selected.map(describeCandidate) };
  }

  const count = mode === 'best1' ? 1 : 2;
  const selected = candidates.slice(0, count);
  const max = selected.reduce((s, c) => s + c.maximumMarks, 0);
  if (max <= 0) return null;

  let mark;
  let effectiveMax;
  if (mode === 'best1' || selected.length === 1) {
    mark = selected[0].obtained;
    effectiveMax = selected[0].maximumMarks;
  } else {
    // best 2: sum the marks and divide by 2 (rounded), same for max marks
    mark = Math.round((selected[0].obtained + selected[1].obtained) / 2);
    effectiveMax = Math.round((selected[0].maximumMarks + selected[1].maximumMarks) / 2);
  }

  if (effectiveMax <= 0) return null;
  return { percentage: (mark / effectiveMax) * 100, used: selected.length, selected: selected.map(describeCandidate), mark, effectiveMax };
};

const describeCandidate = (c) => ({
  assessmentId: c.assessment.id,
  name: c.assessment.name,
  maximumMarks: c.maximumMarks,
  marksObtained: c.obtained,
  date: c.date,
});

/**
 * Resolve the CW/HW rule for a class+subject.
 * ClassSubject.assessmentRule wins; anything else falls back to BEST2_AVG.
 */
const getAssessmentRule = async (schoolClassId, subjectId) => {
  const mapping = await prisma.classSubject.findUnique({
    where: { schoolClassId_subjectId: { schoolClassId, subjectId } },
    select: { assessmentRule: true },
  });
  const rule = mapping?.assessmentRule;
  return ASSESSMENT_RULES.has(rule) ? rule : DEFAULT_RULE;
};

const getGradingPolicy = async () => prisma.gradingPolicy.findFirst({
  where: { isActive: true },
  include: { gradeScales: { orderBy: { minPercentage: 'desc' } } },
});

const gradeFor = (percentage, gradingPolicy) => {
  if (!gradingPolicy) return { grade: null, gradePoint: null };
  for (const scale of gradingPolicy.gradeScales) {
    if (percentage >= parseFloat(scale.minPercentage) && percentage <= parseFloat(scale.maxPercentage)) {
      return {
        grade: scale.grade,
        gradePoint: scale.gradePoint !== null && scale.gradePoint !== undefined ? parseFloat(scale.gradePoint) : null,
      };
    }
  }
  return { grade: null, gradePoint: null };
};

/**
 * Calculate the semester examination result for one student + subject.
 * Returns null when the subject has no eligible assessments at all.
 */
const calculateStudentSubjectSemesterResult = async (
  studentId, academicSessionId, semesterId, schoolClassId, sectionId, subjectId, examMode = null
) => {
  const mode = examMode || (await getClassExamMode(schoolClassId)).mode;
  const isPrimary = mode === EXAM_MODES.PRIMARY;
  const maxMarks = MAX_MARKS_BY_MODE[mode];

  // Direct Term Exam entry takes precedence over assessment-based marks.
  // Standard: Class Work (40, stored in classWorkMarks) + Term Exam (60) = 100.
  //   Rows saved before the combined Class Work column may still carry
  //   separate CT/CW/HW values — they are summed into Class Marks.
  // Primary:   CT (40) + CW (20) + HW (20) = Class Marks (80); Attendance (20).
  const directMark = await prisma.termExamMark.findUnique({
    where: {
      termExamMark_unique: {
        studentId, academicSessionId, semesterId, schoolClassId, sectionId, subjectId,
      },
    },
  });

  if (directMark) {
    const toN = (v) => (v === null || v === undefined ? 0 : parseFloat(v));
    const classTestMarks = toN(directMark.classTestMarks);
    const classWorkMarks = toN(directMark.classWorkMarks);
    const homeWorkMarks = toN(directMark.homeWorkMarks);
    const examMarks = toN(directMark.termExamMarks);
    const attendanceMarks = toN(directMark.attendanceMarks);

    const classMarks = round2(classTestMarks + classWorkMarks + homeWorkMarks); // out of 40 (std) / 80 (primary)
    const totalMarks = round2(classMarks + (isPrimary ? attendanceMarks : examMarks)); // out of 100
    const percentage = round2(totalMarks);

    const gradingPolicy = await getGradingPolicy();
    const { grade, gradePoint } = gradeFor(percentage, gradingPolicy);

    const entryMaxMarks = ENTRY_MAX_MARKS_BY_MODE[mode] || maxMarks;
    const part = (marks, max) => ({
      percentage: max > 0 ? round2((marks / max) * 100) : null,
      marks,
      used: 1,
      selected: [],
    });

    return {
      studentId,
      academicSessionId,
      semesterId,
      schoolClassId,
      sectionId,
      subjectId,
      assessmentRule: null,
      directEntry: true,
      examMode: mode,
      isPrimary,
      breakdown: isPrimary
        ? {
            classTest: part(classTestMarks, entryMaxMarks.classTestMarks),
            classWork: part(classWorkMarks, entryMaxMarks.classWorkMarks),
            homeWork: part(homeWorkMarks, entryMaxMarks.homeWorkMarks),
            exam: null,
            attendance: part(attendanceMarks, entryMaxMarks.attendanceMarks),
          }
        : {
            classTest: part(classTestMarks, entryMaxMarks.classTestMarks),
            classWork: part(classWorkMarks, entryMaxMarks.classWorkMarks),
            homeWork: part(homeWorkMarks, entryMaxMarks.homeWorkMarks),
            exam: part(examMarks, entryMaxMarks.termExamMarks),
          },
      classMarks,
      examMarks: isPrimary ? null : examMarks,
      attendanceMarks: isPrimary ? attendanceMarks : null,
      totalMarks,
      percentage,
      grade,
      gradePoint,
    };
  }

  const assessments = await prisma.assessment.findMany({
    where: { academicSessionId, semesterId, schoolClassId, sectionId, subjectId },
    include: { category: true, marksEntries: true },
  });

  if (assessments.length === 0) return null;

  const byKind = { CT: [], CW: [], HW: [], EXAM: [] };
  for (const assessment of assessments) {
    const kind = getCategoryKind(assessment.category);
    if (byKind[kind]) byKind[kind].push(assessment);
  }

  const rule = await getAssessmentRule(schoolClassId, subjectId);
  const cwHwMode = rule === 'BEST1' ? 'best1' : 'best2avg';

  const ct = scoreGroup(getCandidates(byKind.CT, studentId), 'best2sum');
  const cw = scoreGroup(getCandidates(byKind.CW, studentId), cwHwMode);
  const hw = scoreGroup(getCandidates(byKind.HW, studentId), cwHwMode);
  // Primary classes have no term exam — exam-category assessments are ignored.
  const exam = isPrimary ? null : scoreGroup(getCandidates(byKind.EXAM, studentId), 'aggregate');

  if (!ct && !cw && !hw && !exam) return null;

  // Scale each portion to its fixed weight.
  // Standard: CT->20, CW->10, HW->10, EXAM->60 (Class Marks 40 + Exam 60)
  // Primary:   CT->40, CW->20, HW->20 (Class Marks 80; attendance added via direct entry)
  const weights = isPrimary
    ? { ct: maxMarks.classTestMarks, cw: maxMarks.classWorkMarks, hw: maxMarks.homeWorkMarks, exam: 0 }
    : { ct: maxMarks.classTestMarks, cw: maxMarks.classWorkMarks, hw: maxMarks.homeWorkMarks, exam: maxMarks.termExamMarks };

  const classTestMarks = ct ? round2((ct.percentage * weights.ct) / 100) : 0;
  const classWorkMarks = cw ? round2((cw.percentage * weights.cw) / 100) : 0;
  const homeWorkMarks = hw ? round2((hw.percentage * weights.hw) / 100) : 0;
  const examMarks = exam ? round2((exam.percentage * weights.exam) / 100) : 0;

  const classMarks = round2(classTestMarks + classWorkMarks + homeWorkMarks); // out of 40 (std) / 80 (primary)
  const totalMarks = round2(classMarks + (isPrimary ? 0 : examMarks)); // out of 100
  const percentage = round2(totalMarks);

  const gradingPolicy = await getGradingPolicy();
  const { grade, gradePoint } = gradeFor(percentage, gradingPolicy);

  return {
    studentId,
    academicSessionId,
    semesterId,
    schoolClassId,
    sectionId,
    subjectId,
    assessmentRule: rule,
    examMode: mode,
    isPrimary,
    breakdown: {
      classTest: ct ? { ...ct, marks: classTestMarks } : null,
      classWork: cw ? { ...cw, marks: classWorkMarks } : null,
      homeWork: hw ? { ...hw, marks: homeWorkMarks } : null,
      exam: exam ? { ...exam, marks: examMarks } : null,
      attendance: null,
    },
    classMarks,   // out of 40 (std) / 80 (primary)
    examMarks: isPrimary ? null : examMarks, // out of 60
    attendanceMarks: null,
    totalMarks,   // out of 100
    percentage,   // same as totalMarks (out of 100)
    grade,
    gradePoint,
  };
};

/**
 * Subjects applicable to a student: class-wise mapping when present,
 * otherwise subjects that have assessments; restricted by StudentSubject
 * selection when the student has explicit subject rows.
 */
const getStudentSubjects = async (studentId, academicSessionId, semesterId, schoolClassId, sectionId) => {
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

  // Include subjects that only have direct Term Exam marks
  const termExamSubjectRows = await prisma.termExamMark.findMany({
    where: { academicSessionId, semesterId, schoolClassId, sectionId },
    select: { subjectId: true },
    distinct: ['subjectId'],
  });
  const knownIds = new Set(subjects.map((s) => s.id));
  const extraIds = termExamSubjectRows.map((r) => r.subjectId).filter((id) => !knownIds.has(id));
  if (extraIds.length > 0) {
    const extraSubjects = await prisma.subject.findMany({ where: { id: { in: extraIds } } });
    subjects.push(...extraSubjects);
  }

  subjects.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

  const selections = await prisma.studentSubject.findMany({
    where: { studentId, academicSessionId, schoolClassId, sectionId },
    select: { subjectId: true },
  });
  if (selections.length > 0) {
    const allowed = new Set(selections.map((s) => s.subjectId));
    subjects = subjects.filter((s) => allowed.has(s.id));
  }

  return subjects;
};

/**
 * Full semester result for one student across all their subjects.
 * subjectResults: [{ subject, result }]
 */
const calculateStudentSemesterResult = async (
  studentId, academicSessionId, semesterId, schoolClassId, sectionId, examMode = null
) => {
  const mode = examMode || (await getClassExamMode(schoolClassId)).mode;
  const subjects = await getStudentSubjects(studentId, academicSessionId, semesterId, schoolClassId, sectionId);
  const subjectResults = [];

  for (const subject of subjects) {
    const result = await calculateStudentSubjectSemesterResult(
      studentId, academicSessionId, semesterId, schoolClassId, sectionId, subject.id, mode
    );
    if (result) subjectResults.push({ subject, result });
  }

  return subjectResults;
};

/**
 * Results for every enrolled student in a section.
 * Also computes the highest total marks per subject across the section
 * (used for the "Highest Marks Obtained" column on the report card).
 */
const calculateSectionSemesterResults = async (academicSessionId, semesterId, schoolClassId, sectionId) => {
  const { mode: examMode } = await getClassExamMode(schoolClassId);

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
      academicSession: true,
      semester: true,
      schoolClass: true,
      section: true,
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

  const studentResults = [];
  const highestBySubject = new Map();

  for (const enrollment of enrollments) {
    const subjectResults = await calculateStudentSemesterResult(
      enrollment.studentId, academicSessionId, semesterId, schoolClassId, sectionId, examMode
    );
    studentResults.push({ student: enrollment.student, enrollment, subjectResults });

    for (const { subject, result } of subjectResults) {
      const current = highestBySubject.get(subject.id);
      if (!current || result.totalMarks > current) {
        highestBySubject.set(subject.id, result.totalMarks);
      }
    }
  }

  return { students: studentResults, highestBySubject };
};

/**
 * Overall summary across a student's subject results.
 */
const computeSemesterSummary = async (subjectResults) => {
  const graded = subjectResults.filter((s) => s.result.totalMarks !== null && s.result.totalMarks !== undefined);
  if (graded.length === 0) {
    return { totalMarks: null, percentage: null, gpa: null, overallGrade: null, resultStatus: 'N/A' };
  }

  const totalMarks = graded.reduce((sum, s) => sum + s.result.totalMarks, 0);
  const percentage = round2(totalMarks / graded.length);

  const withGradePoint = graded.filter((s) => s.result.gradePoint !== null && s.result.gradePoint !== undefined);
  const gpa = withGradePoint.length > 0
    ? round2(withGradePoint.reduce((sum, s) => sum + s.result.gradePoint, 0) / withGradePoint.length)
    : null;

  const gradingPolicy = await getGradingPolicy();
  const { grade: overallGrade } = gradeFor(percentage, gradingPolicy);

  const failed = graded.some((s) => (s.result.grade || '').toUpperCase() === 'F');
  const resultStatus = failed ? 'FAIL' : 'PASS';

  return { totalMarks: round2(totalMarks), percentage, gpa, overallGrade, resultStatus };
};

module.exports = {
  getCategoryKind,
  getAssessmentRule,
  calculateStudentSubjectSemesterResult,
  calculateStudentSemesterResult,
  calculateSectionSemesterResults,
  computeSemesterSummary,
  ASSESSMENT_RULES,
  DEFAULT_RULE,
};

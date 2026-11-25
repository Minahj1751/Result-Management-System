import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { teacherAPI } from '../../api/teacherService';
import { termExamAPI } from '../../api/termExamService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Table from '../../components/Table';
import { filterVisibleAssignments, filterVisibleSemesters } from '../../utils/semesterVisibility';

const MARK_FIELDS = [
  { key: 'classTestMarks', label: 'CT', maxKey: 'classTestMarks' },
  { key: 'classWorkMarks', label: 'CW', maxKey: 'classWorkMarks' },
  { key: 'homeWorkMarks', label: 'HW', maxKey: 'homeWorkMarks' },
  { key: 'termExamMarks', label: 'Term Exam', maxKey: 'termExamMarks' },
];

const toNumber = (v) => (v === null || v === undefined || v === '' ? null : parseFloat(v));

export default function TermExamEntry() {
  const [myAssignments, setMyAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [maxMarks, setMaxMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({
    academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', subjectId: '',
  });
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [sections, setSections] = useState([]);
  const [classSubjectIds, setClassSubjectIds] = useState([]);
  const [marks, setMarks] = useState({}); // studentId -> { classTestMarks, classWorkMarks, homeWorkMarks, termExamMarks }
  const [studentSearch, setStudentSearch] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState('');

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const [sessionsData, assignments] = await Promise.all([
        academicAPI.getSessions(),
        teacherAPI.getTeacherAssignments(),
      ]);
      setSessions(sessionsData);
      const active = filterVisibleAssignments(assignments.filter((a) => a.isActive));
      setMyAssignments(active);

      if (active.length > 0) {
        const first = active[0];
        setFilter({
          academicSessionId: first.academicSessionId,
          semesterId: first.semesterId,
          schoolClassId: first.schoolClassId,
          sectionId: first.sectionId,
          subjectId: first.subjectId,
        });
        const [sems, secs, classSubs] = await Promise.all([
          academicAPI.getSemesters(first.academicSessionId),
          academicAPI.getSections(first.schoolClassId),
          academicAPI.getClassSubjects(first.schoolClassId),
        ]);
        setSemesters(filterVisibleSemesters(sems));
        setSections(secs);
        setClassSubjectIds((classSubs || []).map((m) => m.subjectId || m.subject?.id).filter(Boolean));
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await termExamAPI.getMarks(cleanParams(filter));
      setStudents(data.students || []);
      setMaxMarks(data.maxMarks || {});

      const initialMarks = {};
      data.students.forEach((s) => {
        const m = s.marks;
        initialMarks[s.student.id] = {
          classTestMarks: m?.classTestMarks ?? '',
          classWorkMarks: m?.classWorkMarks ?? '',
          homeWorkMarks: m?.homeWorkMarks ?? '',
          termExamMarks: m?.termExamMarks ?? '',
        };
      });
      setMarks(initialMarks);
      setStudentSearch('');
      setSavedSnapshot(JSON.stringify(initialMarks));
    } catch (error) {
      alert(error.response?.data?.error || 'Error loading students');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = (key, value) => {
    const newFilter = { ...filter, [key]: value };
    setFilter(newFilter);

    if (key === 'academicSessionId') {
      academicAPI.getSemesters(value).then((sems) => setSemesters(filterVisibleSemesters(sems)));
      setFilter((f) => ({ ...f, semesterId: '' }));
    }
    if (key === 'schoolClassId') {
      academicAPI.getSections(value).then(setSections);
      academicAPI.getClassSubjects(value)
        .then((mappings) => setClassSubjectIds((mappings || []).map((m) => m.subjectId || m.subject?.id).filter(Boolean)))
        .catch(() => setClassSubjectIds([]));
      setFilter((f) => ({ ...f, sectionId: '', subjectId: '' }));
    }
  };

  const setMark = (studentId, field, value) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const rowTotal = (studentId) => {
    const m = marks[studentId] || {};
    return ['classTestMarks', 'classWorkMarks', 'homeWorkMarks', 'termExamMarks']
      .reduce((sum, f) => sum + (toNumber(m[f]) ?? 0), 0);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const entries = students.map((s) => ({
        studentId: s.student.id,
        classTestMarks: '', classWorkMarks: '', homeWorkMarks: '', termExamMarks: '',
        ...marks[s.student.id],
      }));
      const result = await termExamAPI.bulkUpsert({ ...cleanParams(filter), entries });
      const errorMsg = result.errors?.length ? ` — ${result.errors.length} errors: ${result.errors[0].error}` : '';
      alert(`Saved: ${result.successCount} entries, ${result.errorCount} errors${errorMsg}`);
      loadStudents();
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving marks');
    } finally {
      setSaving(false);
    }
  };

  const assignmentMatches = (a, scope) =>
    (!scope.academicSessionId || a.academicSessionId === scope.academicSessionId) &&
    (!scope.semesterId || !a.semesterId || a.semesterId === scope.semesterId) &&
    (!scope.schoolClassId || a.schoolClassId === scope.schoolClassId) &&
    (!scope.sectionId || a.sectionId === scope.sectionId) &&
    (!scope.subjectId || a.subjectId === scope.subjectId);

  const toOptions = (list, valueKey, labelFn) =>
    [...new Map(list.map((a) => [a[valueKey], a])).values()]
      .map((a) => ({ value: a[valueKey], label: labelFn(a) }));

  const classOptions = toOptions(
    myAssignments.filter((a) => assignmentMatches(a, {
      academicSessionId: filter.academicSessionId,
      semesterId: filter.semesterId,
    })),
    'schoolClassId',
    (a) => a.schoolClass?.name || 'Class'
  );

  const sectionOptions = toOptions(
    myAssignments.filter((a) => assignmentMatches(a, {
      academicSessionId: filter.academicSessionId,
      semesterId: filter.semesterId,
      schoolClassId: filter.schoolClassId,
    })),
    'sectionId',
    (a) => a.section?.name || 'Section'
  );

  const subjectOptions = toOptions(
    myAssignments.filter((a) => assignmentMatches(a, {
      academicSessionId: filter.academicSessionId,
      semesterId: filter.semesterId,
      schoolClassId: filter.schoolClassId,
      sectionId: filter.sectionId,
    })),
    'subjectId',
    (a) => a.subject?.name || 'Subject'
  ).filter((o) => classSubjectIds.length === 0 || classSubjectIds.includes(o.value));

  const q = studentSearch.trim().toLowerCase();
  const visibleStudents = q
    ? students.filter((s) =>
        (s.student?.fullName || '').toLowerCase().includes(q) ||
        (s.student?.studentId || '').toLowerCase().includes(q) ||
        String(s.enrollment?.rollNumber ?? '').includes(q))
    : students;

  const hasUnsavedChanges = savedSnapshot !== JSON.stringify(marks);
  const invalidMarks = students.some((s) => {
    const m = marks[s.student?.id] || {};
    return MARK_FIELDS.some(({ key, maxKey }) => {
      const v = toNumber(m[key]);
      return v !== null && (!Number.isFinite(v) || v < 0 || v > parseFloat(maxMarks[maxKey] || Infinity));
    });
  });

  const columns = [
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
    ...MARK_FIELDS.map(({ key, label, maxKey }) => ({
      key,
      label: `${label} (${maxMarks[maxKey] ?? '-'})`,
      render: (val, row) => (
        <Input type="number" step="0.01" min="0" max={maxMarks[maxKey]}
          value={marks[row.student?.id]?.[key] ?? ''}
          onChange={(e) => setMark(row.student.id, key, e.target.value)}
          className="w-24" />
      ),
    })),
    {
      key: 'total', label: 'Total',
      render: (val, row) => {
        const anyFilled = MARK_FIELDS.some(({ key }) => toNumber(marks[row.student?.id]?.[key]) !== null);
        return anyFilled ? rowTotal(row.student.id) : '';
      },
    },
  ];

  const filtersReady = filter.academicSessionId && filter.semesterId && filter.schoolClassId && filter.sectionId && filter.subjectId;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Term Exam</h1>

      {myAssignments.length === 0 ? (
        <Card><p className="text-gray-600">No subject assignments found. Contact the administrator.</p></Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Select placeholder="Session" value={filter.academicSessionId}
                onChange={(e) => handleAssignmentChange('academicSessionId', e.target.value)}
                options={[...new Map(myAssignments.map((a) => [a.academicSessionId, a.academicSession])).values()]
                  .map((s) => ({ value: s.id, label: s.name }))} />
              <Select placeholder="Semester" value={filter.semesterId}
                onChange={(e) => handleAssignmentChange('semesterId', e.target.value)}
                options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
              <Select placeholder="Class" value={filter.schoolClassId}
                onChange={(e) => handleAssignmentChange('schoolClassId', e.target.value)}
                options={classOptions} />
              <Select placeholder="Section" value={filter.sectionId}
                onChange={(e) => handleAssignmentChange('sectionId', e.target.value)}
                options={sectionOptions} />
              <Select placeholder="Subject" value={filter.subjectId}
                onChange={(e) => handleAssignmentChange('subjectId', e.target.value)}
                options={subjectOptions} />
            </div>
            <div className="mt-4">
              <Button onClick={loadStudents} disabled={loading || !filtersReady}>
                {loading ? 'Loading...' : 'Load Students'}
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                CT (max 20) + CW (max 10) + HW (max 10) = Class Marks (40); Term Exam (max 60) = Exam Marks.
              </p>
            </div>
          </Card>

          {students.length > 0 && (
            <Card title="Term Exam Marks Entry">
              {loading ? <div className="text-center py-8">Loading...</div> : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Input
                      placeholder="Search by name, ID or roll..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="max-w-xs"
                    />
                    <span className="text-sm text-gray-600">
                      Showing {visibleStudents.length} of {students.length} students
                    </span>
                    {hasUnsavedChanges && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Unsaved changes
                      </span>
                    )}
                    {invalidMarks && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                        Some marks exceed the maximum or are invalid
                      </span>
                    )}
                  </div>
                  <Table columns={columns} data={visibleStudents} emptyMessage="No students match your search" />
                  <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
                    <div className="text-sm text-gray-600">{students.length} students</div>
                    <Button onClick={handleSubmit} disabled={saving || invalidMarks}>{saving ? 'Saving...' : 'Save All Marks'}</Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

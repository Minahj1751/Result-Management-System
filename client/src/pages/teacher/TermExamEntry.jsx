import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { teacherAPI } from '../../api/teacherService';
import { termExamAPI } from '../../api/termExamService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import { filterVisibleAssignments, filterVisibleSemesters } from '../../utils/semesterVisibility';

// Grade 4+: single combined Class Work mark (40) + Term Exam (60) = 100
const STANDARD_FIELDS = [
  { key: 'classWorkMarks', label: 'Class Work', maxKey: 'classWorkMarks' },
  { key: 'termExamMarks', label: 'Term Exam', maxKey: 'termExamMarks' },
];

// Grade 1-3 (primary): no term exam — CT(40) + CW(20) + HW(20) = Class Marks(80) + Attendance(20)
const PRIMARY_FIELDS = [
  { key: 'classTestMarks', label: 'CT', maxKey: 'classTestMarks' },
  { key: 'classWorkMarks', label: 'CW', maxKey: 'classWorkMarks' },
  { key: 'homeWorkMarks', label: 'HW', maxKey: 'homeWorkMarks' },
  { key: 'attendanceMarks', label: 'Attendance', maxKey: 'attendanceMarks' },
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
  const [marks, setMarks] = useState({}); // studentId -> mark fields depend on exam mode
  const [mode, setMode] = useState('STANDARD');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
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
      setMode(data.mode || 'STANDARD');
      const isPrimary = data.mode === 'PRIMARY';

      const initialMarks = {};
      data.students.forEach((s) => {
        const m = s.marks;
        // Rows saved before the combined Class Work column may still carry
        // separate CT/CW/HW values — fold them into the Class Work input so
        // the total is preserved when the row is next saved.
        const isLegacySplit = !isPrimary && m && (m.classTestMarks != null || m.homeWorkMarks != null);
        initialMarks[s.student.id] = {
          classTestMarks: isPrimary ? (m?.classTestMarks ?? '') : '',
          classWorkMarks: isPrimary
            ? (m?.classWorkMarks ?? '')
            : isLegacySplit
              ? String((toNumber(m.classTestMarks) ?? 0) + (toNumber(m.classWorkMarks) ?? 0) + (toNumber(m.homeWorkMarks) ?? 0))
              : (m?.classWorkMarks ?? ''),
          homeWorkMarks: isPrimary ? (m?.homeWorkMarks ?? '') : '',
          termExamMarks: isPrimary ? '' : (m?.termExamMarks ?? ''),
          attendanceMarks: isPrimary ? (m?.attendanceMarks ?? '') : '',
        };
      });
      setMarks(initialMarks);
      setStudentSearch('');
      setSelectedStudentId((prev) => {
        const ids = (data.students || []).map((s) => s.student.id);
        return prev && ids.includes(prev) ? prev : (ids[0] || '');
      });
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

  const markFields = mode === 'PRIMARY' ? PRIMARY_FIELDS : STANDARD_FIELDS;

  const rowTotal = (studentId) => {
    const m = marks[studentId] || {};
    return markFields
      .reduce((sum, f) => sum + (toNumber(m[f.key]) ?? 0), 0);
  };

  const handleSubmit = async () => {
    if (!selectedStudentId) return;
    try {
      setSaving(true);
      const entry = {
        studentId: selectedStudentId,
        classTestMarks: '', classWorkMarks: '', homeWorkMarks: '', termExamMarks: '', attendanceMarks: '',
        ...marks[selectedStudentId],
      };
      const result = await termExamAPI.bulkUpsert({ ...cleanParams(filter), entries: [entry] });
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

  // Auto-select the section when the teacher only has one option for the scope
  const sectionOptionsKey = sectionOptions.map((o) => o.value).join(',');
  useEffect(() => {
    if (!filter.sectionId && sectionOptions.length === 1) {
      setFilter((f) => ({ ...f, sectionId: sectionOptions[0].value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionOptionsKey, filter.sectionId]);

  const q = studentSearch.trim().toLowerCase();
  const visibleStudents = q
    ? students.filter((s) =>
        (s.student?.fullName || '').toLowerCase().includes(q) ||
        (s.student?.studentId || '').toLowerCase().includes(q) ||
        String(s.enrollment?.rollNumber ?? '').includes(q))
    : students;

  const studentOptions = visibleStudents.map((s) => ({
    value: s.student.id,
    label: `${s.student?.fullName || 'Student'} — Roll ${s.enrollment?.rollNumber ?? '-'} — ${s.student?.studentId || ''}`,
  }));

  const selectedStudent = students.find((s) => s.student?.id === selectedStudentId) || null;

  const hasUnsavedChanges = savedSnapshot !== JSON.stringify(marks);
  const invalidMarks = (() => {
    if (!selectedStudentId) return false;
    const m = marks[selectedStudentId] || {};
    return markFields.some(({ key, maxKey }) => {
      const v = toNumber(m[key]);
      return v !== null && (!Number.isFinite(v) || v < 0 || v > parseFloat(maxMarks[maxKey] || Infinity));
    });
  })();

  const selectedAnyFilled = selectedStudent
    ? markFields.some(({ key }) => toNumber(marks[selectedStudent.id]?.[key]) !== null)
    : false;

  const filtersReady = filter.academicSessionId && filter.semesterId && filter.schoolClassId && filter.sectionId && filter.subjectId;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Term Exam</h1>

      {myAssignments.length === 0 ? (
        <Card><p className="text-gray-600">No subject assignments found. Contact the administrator.</p></Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                {mode === 'PRIMARY'
                  ? 'CT (max 40) + CW (max 20) + HW (max 20) = Class Marks (80); Attendance (max 20). Total = 100. Grade 1-3 has no term exam.'
                  : 'Class Work (max 40) + Term Exam (max 60) = 100.'}
              </p>
            </div>
          </Card>

          {students.length > 0 && (
            <Card title={mode === 'PRIMARY' ? 'Class Marks & Attendance Entry' : 'Term Exam Marks Entry'}>
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
                      {visibleStudents.length} of {students.length} students
                    </span>
                    {hasUnsavedChanges && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Unsaved changes
                      </span>
                    )}
                    {invalidMarks && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                        Marks exceed the maximum or are invalid
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Select Student"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      options={studentOptions}
                      placeholder={studentOptions.length ? 'Choose a student' : 'No students match'}
                    />
                  </div>
                  {selectedStudent ? (
                    <>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {markFields.map(({ key, label, maxKey }) => (
                          <Input
                            key={key}
                            label={`${label} (max ${maxMarks[maxKey] ?? '-'})`}
                            type="number" step="0.01" min="0" max={maxMarks[maxKey]}
                            value={marks[selectedStudent.id]?.[key] ?? ''}
                            onChange={(e) => setMark(selectedStudent.id, key, e.target.value)}
                          />
                        ))}
                        <div>
                          <span className="ui-field-label">Total</span>
                          <div className="ui-input border-gray-300 bg-gray-50 text-gray-700">
                            {selectedAnyFilled ? rowTotal(selectedStudent.id) : ''}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
                        <div className="text-sm text-gray-600">
                          {selectedStudent.student?.fullName} — Roll {selectedStudent.enrollment?.rollNumber ?? '-'}
                        </div>
                        <Button onClick={handleSubmit} disabled={saving || invalidMarks || !selectedStudentId}>
                          {saving ? 'Saving...' : 'Save Marks'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">Select a student to enter marks.</p>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

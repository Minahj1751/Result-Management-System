import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { teacherAPI } from '../../api/teacherService';
import { assessmentAPI } from '../../api/assessmentService';
import { marksAPI } from '../../api/marksService';
import { exportAPI } from '../../api/exportService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import { filterVisibleAssignments, filterVisibleSemesters } from '../../utils/semesterVisibility';

const EXAM_CATEGORY_CODES = new Set(['TERM_EXAM', 'EXAM', 'FINAL_EXAM']);
const isExamAssessment = (a) => EXAM_CATEGORY_CODES.has(String(a?.category?.code || '').toUpperCase());

export default function MarksEntry() {
  const [myAssignments, setMyAssignments] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({
    academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', subjectId: '',
  });
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [sections, setSections] = useState([]);
  const [classSubjectIds, setClassSubjectIds] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [marks, setMarks] = useState({});
  const [statuses, setStatuses] = useState({});
  const [individualDates, setIndividualDates] = useState({});
  const [assessmentDate, setAssessmentDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);
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

      // Pre-fill filter from first assignment
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
        loadAssessmentsFor(first);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const loadAssessmentsFor = async (assignment) => {
    try {
      setLoading(true);
      const data = await assessmentAPI.getAssessments(cleanParams({
        academicSessionId: assignment.academicSessionId,
        // Session-level assignments apply to whichever semester is selected
        semesterId: filter.semesterId || assignment.semesterId,
        schoolClassId: assignment.schoolClassId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
        limit: 100,
      }));
      setAssessments(data.assessments || []);
      setSelectedAssessment(null);
      setStudents([]);
    } catch (error) {
      console.error('Error loading assessments:', error);
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

  const loadStudentsForAssessment = async (assessment) => {
    try {
      setLoading(true);
      const data = await marksAPI.getAssessmentMarks(assessment.id);
      setStudents(data.students || []);
      setSelectedAssessment(data.assessment);

      const initialMarks = {};
      const initialStatuses = {};
      const initialDates = {};
      data.students.forEach((student) => {
        if (student.marks) {
          initialMarks[student.student.id] = student.marks.marksObtained;
          initialStatuses[student.student.id] = student.marks.status;
          initialDates[student.student.id] = student.marks.individualDate?.split('T')[0] || '';
        }
      });
      setMarks(initialMarks);
      setStatuses(initialStatuses);
      setIndividualDates(initialDates);
      setAssessmentDate(data.assessment.defaultDate?.split('T')[0] || '');
      setStudentSearch('');
      setSelectedStudentId((prev) => {
        const ids = (data.students || []).map((s) => s.student.id);
        return prev && ids.includes(prev) ? prev : (ids[0] || '');
      });
      setSavedSnapshot(JSON.stringify({ m: initialMarks, s: initialStatuses, d: initialDates }));
    } catch (error) {
      alert(error.response?.data?.error || 'Error loading students');
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentDateSave = async () => {
    try {
      setSavingDate(true);
      const updated = await assessmentAPI.updateAssessmentDate(selectedAssessment.id, assessmentDate || null);
      setSelectedAssessment(updated);
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating assessment date');
    } finally {
      setSavingDate(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStudentId || !selectedAssessment) return;
    try {
      setSaving(true);
      const entry = {
        studentId: selectedStudentId,
        assessmentId: selectedAssessment.id,
        marksObtained: marks[selectedStudentId] !== undefined && marks[selectedStudentId] !== '' ? marks[selectedStudentId] : null,
        status: statuses[selectedStudentId] || 'PENDING',
        individualDate: individualDates[selectedStudentId] || null,
      };
      const result = await marksAPI.bulkUpsert([entry]);
      const errorMsg = result.errors?.length ? ` — ${result.errors.length} errors: ${result.errors[0].error}` : '';
      alert(`Saved: ${result.successCount} entries, ${result.errorCount} errors${errorMsg}`);
      loadStudentsForAssessment(selectedAssessment);
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving marks');
    } finally {
      setSaving(false);
    }
  };

  const showDates = !!selectedAssessment && !isExamAssessment(selectedAssessment);

  const selectedStudentStatus = statuses[selectedStudentId] || 'PENDING';
  const marksDisabled = ['ABSENT', 'EXEMPTED'].includes(selectedStudentStatus);

  // Filter options are scoped to the teacher's own assignments and narrowed
  // by the filters already selected (session -> class -> section -> subject).
  // Session-level assignments (semesterId null) apply to every semester.
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

  const hasUnsavedChanges = savedSnapshot !== JSON.stringify({ m: marks, s: statuses, d: individualDates });
  const invalidMarks = (() => {
    if (!selectedStudentId) return false;
    const v = marks[selectedStudentId];
    return v !== undefined && v !== '' && (!Number.isFinite(parseFloat(v)) || parseFloat(v) < 0 || parseFloat(v) > parseFloat(selectedAssessment?.maximumMarks || Infinity));
  })();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marks Entry</h1>

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
              <Button onClick={() => {
                const assignment = myAssignments.find((a) =>
                  a.academicSessionId === filter.academicSessionId &&
                  (!a.semesterId || a.semesterId === filter.semesterId) &&
                  a.schoolClassId === filter.schoolClassId &&
                  a.sectionId === filter.sectionId &&
                  a.subjectId === filter.subjectId
                );
                if (assignment) loadAssessmentsFor(assignment);
                else alert('No assignment matches the selected filters');
              }} disabled={loading}>
                {loading ? 'Loading...' : 'Load Assessments'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportAPI.marks(cleanParams(filter)).catch(() => alert('Error exporting marks'))}
              >
                Export Marks
              </Button>
            </div>
          </Card>

          {assessments.length > 0 && (
            <Card className="mb-6">
              <Select
                label="Select Assessment"
                value={selectedAssessment?.id || ''}
                onChange={(e) => {
                  const assessment = assessments.find((a) => a.id === e.target.value);
                  if (assessment) loadStudentsForAssessment(assessment);
                  else { setSelectedAssessment(null); setStudents([]); }
                }}
                options={assessments.map((a) => ({
                  value: a.id,
                  label: `${a.name} — ${a.category?.name || 'Assessment'} (Max: ${a.maximumMarks})`,
                }))}
              />
            </Card>
          )}

          {students.length > 0 && selectedAssessment && (
            <Card title={`Marks Entry — ${selectedAssessment.name} (Max: ${selectedAssessment.maximumMarks})`}>
              {loading ? <div className="text-center py-8">Loading...</div> : (
                <>
                  {showDates && (
                    <div className="mb-4 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="ui-field-label">Assessment Date</label>
                        <Input type="date" value={assessmentDate}
                          onChange={(e) => setAssessmentDate(e.target.value)}
                          className="w-40" />
                      </div>
                      <Button size="sm" variant="secondary" onClick={handleAssessmentDateSave} disabled={savingDate}>
                        {savingDate ? 'Saving...' : 'Save Date'}
                      </Button>
                      <span className="text-xs text-gray-500">The date this assessment was taken for this class & subject.</span>
                    </div>
                  )}
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
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input
                          label={`Marks Obtained (max ${selectedAssessment?.maximumMarks ?? '-'})`}
                          type="number" step="0.01" min="0" max={selectedAssessment?.maximumMarks}
                          value={marks[selectedStudent.id] ?? ''}
                          onChange={(e) => setMarks({ ...marks, [selectedStudent.id]: e.target.value })}
                          disabled={marksDisabled}
                        />
                        <Select
                          label="Status"
                          value={selectedStudentStatus}
                          onChange={(e) => setStatuses({ ...statuses, [selectedStudent.id]: e.target.value })}
                          options={[
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'ABSENT', label: 'Absent' },
                            { value: 'EXEMPTED', label: 'Exempted' },
                            { value: 'NOT_APPLICABLE', label: 'N/A' },
                          ]}
                        />
                        {showDates && (
                          <Input
                            label="Date Override"
                            type="date"
                            value={individualDates[selectedStudent.id] || ''}
                            onChange={(e) => setIndividualDates({ ...individualDates, [selectedStudent.id]: e.target.value })}
                          />
                        )}
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

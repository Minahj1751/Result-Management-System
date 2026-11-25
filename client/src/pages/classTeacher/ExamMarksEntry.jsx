import { useState, useEffect } from 'react';
import { teacherAPI } from '../../api/teacherService';
import { academicAPI } from '../../api/academicService';
import { assessmentAPI } from '../../api/assessmentService';
import { marksAPI } from '../../api/marksService';
import { remarkAPI } from '../../api/remarkService';
import { studentAPI } from '../../api/studentService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Table from '../../components/Table';
import { filterVisibleAssignments, filterVisibleSemesters } from '../../utils/semesterVisibility';

const EXAM_CATEGORY_CODES = new Set(['TERM_EXAM', 'EXAM', 'FINAL_EXAM']);
const isExamAssessment = (a) => EXAM_CATEGORY_CODES.has(String(a.category?.code || '').toUpperCase());

export default function ExamMarksEntry() {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [examAssessments, setExamAssessments] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [statuses, setStatuses] = useState({});
  const [remarks, setRemarks] = useState({});
  const [remarkStudents, setRemarkStudents] = useState([]);
  const [remarkSavingId, setRemarkSavingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId) || null;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const classAssignments = await teacherAPI.getClassTeacherAssignments();
      const active = filterVisibleAssignments((classAssignments || []).filter((a) => a.isActive));
      setAssignments(active);
      if (active.length > 0) {
        await selectAssignment(active[0]);
      }
    } catch (error) {
      console.error('Error loading class teacher assignments:', error);
    }
  };

  const scopeParams = (assignment = selectedAssignment, semesterId = selectedSemesterId) => ({
    academicSessionId: assignment?.academicSessionId,
    semesterId,
    schoolClassId: assignment?.schoolClassId,
    sectionId: assignment?.sectionId,
  });

  const loadExamAssessments = async (assignment, semesterId) => {
    if (!assignment || !semesterId) return;
    try {
      setLoading(true);
      setSelectedAssessment(null);
      setStudents([]);
      const data = await assessmentAPI.getAssessments({
        ...scopeParams(assignment, semesterId),
        limit: 200,
      });
      setExamAssessments((data.assessments || []).filter(isExamAssessment));
    } catch (error) {
      console.error('Error loading exam assessments:', error);
      setExamAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRemarks = async (assignment, semesterId) => {
    if (!assignment || !semesterId) return;
    try {
      const studentsRes = await studentAPI.getStudents({ ...scopeParams(assignment, semesterId), limit: 500 });
      const list = studentsRes.students || studentsRes || [];
      setRemarkStudents(list.map((s) => ({
        student: s,
        enrollment: (s.enrollments || []).find((e) => e.semesterId === semesterId) || s.enrollments?.[0] || {},
      })));
    } catch (error) {
      console.error('Error loading remark students:', error);
    }
    try {
      const data = await remarkAPI.getSectionRemarks(scopeParams(assignment, semesterId));
      const map = {};
      (data || []).forEach((r) => { map[r.studentId] = r.remarks || ''; });
      setRemarks(map);
    } catch (error) {
      console.error('Error loading remarks:', error);
    }
  };

  const selectAssignment = async (assignment) => {
    if (!assignment) return;
    setSelectedAssignmentId(assignment.id);
    setExamAssessments([]);
    setSelectedAssessment(null);
    setStudents([]);
    try {
      const sems = await academicAPI.getSemesters(assignment.academicSessionId);
      const semesterList = filterVisibleSemesters(sems || []);
      setSemesters(semesterList);
      const semesterId = assignment.semesterId || semesterList[0]?.id || '';
      setSelectedSemesterId(semesterId);
      loadExamAssessments(assignment, semesterId);
      loadRemarks(assignment, semesterId);
    } catch (error) {
      console.error('Error loading semesters:', error);
    }
  };

  const handleAssignmentChange = (e) => {
    selectAssignment(assignments.find((a) => a.id === e.target.value));
  };

  const handleSemesterChange = (e) => {
    const semesterId = e.target.value;
    setSelectedSemesterId(semesterId);
    loadExamAssessments(selectedAssignment, semesterId);
    loadRemarks(selectedAssignment, semesterId);
  };

  const loadStudentsForAssessment = async (assessment) => {
    try {
      setLoading(true);
      const data = await marksAPI.getAssessmentMarks(assessment.id);
      setStudents(data.students || []);
      setSelectedAssessment(data.assessment);

      const initialMarks = {};
      const initialStatuses = {};
      data.students.forEach((student) => {
        if (student.marks) {
          initialMarks[student.student.id] = student.marks.marksObtained;
          initialStatuses[student.student.id] = student.marks.status;
        }
      });
      setMarks(initialMarks);
      setStatuses(initialStatuses);
      setStudentSearch('');
    } catch (error) {
      alert(error.response?.data?.error || 'Error loading students');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const entries = students.map((student) => ({
        studentId: student.student.id,
        assessmentId: selectedAssessment.id,
        marksObtained: marks[student.student.id] !== undefined && marks[student.student.id] !== '' ? marks[student.student.id] : null,
        status: statuses[student.student.id] || 'PENDING',
      }));
      const result = await marksAPI.bulkUpsert(entries);
      const errorMsg = result.errors?.length ? ` — ${result.errors.length} errors: ${result.errors[0].error}` : '';
      alert(`Saved: ${result.successCount} entries, ${result.errorCount} errors${errorMsg}`);
      loadStudentsForAssessment(selectedAssessment);
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving marks');
    } finally {
      setSaving(false);
    }
  };

  const saveRemark = async (studentId) => {
    try {
      setRemarkSavingId(studentId);
      await remarkAPI.upsertRemark({
        ...scopeParams(),
        studentId,
        remarks: remarks[studentId] || '',
      });
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving remark');
    } finally {
      setRemarkSavingId(null);
    }
  };

  const q = studentSearch.trim().toLowerCase();
  const visibleStudents = q
    ? students.filter((s) =>
        (s.student?.fullName || '').toLowerCase().includes(q) ||
        (s.student?.studentId || '').toLowerCase().includes(q) ||
        String(s.enrollment?.rollNumber ?? '').includes(q))
    : students;

  const invalidMarks = students.some((s) => {
    const v = marks[s.student?.id];
    return v !== undefined && v !== '' && (!Number.isFinite(parseFloat(v)) || parseFloat(v) < 0 || parseFloat(v) > parseFloat(selectedAssessment?.maximumMarks || Infinity));
  });

  const markColumns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
    {
      key: 'marks', label: 'Marks Obtained',
      render: (val, row) => (
        <Input type="number" step="0.01" min="0" max={selectedAssessment?.maximumMarks}
          value={marks[row.student?.id] ?? ''}
          onChange={(e) => setMarks({ ...marks, [row.student.id]: e.target.value })}
          className="w-24"
          disabled={['ABSENT', 'EXEMPTED'].includes(statuses[row.student?.id])} />
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (val, row) => (
        <Select value={statuses[row.student?.id] || 'PENDING'}
          onChange={(e) => setStatuses({ ...statuses, [row.student.id]: e.target.value })}
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'ABSENT', label: 'Absent' },
            { value: 'EXEMPTED', label: 'Exempted' },
            { value: 'NOT_APPLICABLE', label: 'N/A' },
          ]}
          className="w-32" />
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Exam Marks &amp; Remarks</h1>

      {assignments.length === 0 ? (
        <Card><p className="text-gray-600">No class teacher assignment found. Contact the administrator.</p></Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Assigned Class" value={selectedAssignmentId}
                onChange={handleAssignmentChange}
                options={assignments.map((a) => ({
                  value: a.id,
                  label: `${a.schoolClass?.name || 'Class'} — ${a.section?.name || 'Section'}`,
                }))} />
              <Select label="Semester" value={selectedSemesterId}
                onChange={handleSemesterChange}
                options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
              <div className="flex items-end">
                <Button onClick={() => loadExamAssessments(selectedAssignment, selectedSemesterId)} disabled={loading || !selectedSemesterId}>
                  {loading ? 'Loading...' : 'Load Exam Assessments'}
                </Button>
              </div>
            </div>
          </Card>

          {examAssessments.length > 0 && (
            <Card className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Term Exam Assessments</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {examAssessments.map((assessment) => (
                  <button key={assessment.id} onClick={() => loadStudentsForAssessment(assessment)}
                    className={`p-4 border rounded-md text-left transition-colors ${
                      selectedAssessment?.id === assessment.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div className="font-medium">{assessment.name}</div>
                    <div className="text-sm text-gray-600">{assessment.subject?.name} — {assessment.category?.name}</div>
                    <div className="text-sm text-gray-600">Max: {assessment.maximumMarks} | {assessment.submissionStatus}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {students.length > 0 && selectedAssessment && (
            <Card className="mb-6" title={`Exam Marks — ${selectedAssessment.name} (${selectedAssessment.subject?.name}, Max: ${selectedAssessment.maximumMarks})`}>
              {loading ? <div className="text-center py-8">Loading...</div> : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Input placeholder="Search by name, ID or roll..." value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)} className="max-w-xs" />
                    <span className="text-sm text-gray-600">Showing {visibleStudents.length} of {students.length} students</span>
                    {invalidMarks && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                        Some marks exceed the maximum or are invalid
                      </span>
                    )}
                  </div>
                  <Table columns={markColumns} data={visibleStudents} emptyMessage="No students match your search" />
                  <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
                    <div className="text-sm text-gray-600">{students.length} students</div>
                    <Button onClick={handleSubmit} disabled={saving || invalidMarks}>{saving ? 'Saving...' : 'Save All Marks'}</Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {selectedAssignment && selectedSemesterId && (
            <Card title="Class Teacher Remarks">
              <p className="text-sm text-gray-500 mb-4">Remarks shown on the Semester Examination Report card for each student.</p>
              <Table
                columns={[
                  { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
                  { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
                  { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
                  {
                    key: 'remarks', label: 'Remarks',
                    render: (val, row) => (
                      <Input value={remarks[row.student?.id] || ''}
                        onChange={(e) => setRemarks({ ...remarks, [row.student.id]: e.target.value })}
                        className="w-72" placeholder="Write remark..." />
                    ),
                  },
                  {
                    key: 'actions', label: '',
                    render: (val, row) => (
                      <Button size="sm" variant="secondary" onClick={() => saveRemark(row.student?.id)} disabled={remarkSavingId === row.student?.id}>
                        {remarkSavingId === row.student?.id ? '...' : 'Save'}
                      </Button>
                    ),
                  },
                ]}
                data={remarkStudents}
                emptyMessage="No students loaded"
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

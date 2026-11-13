import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { teacherAPI } from '../../api/teacherService';
import { assessmentAPI } from '../../api/assessmentService';
import { marksAPI } from '../../api/marksService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Table from '../../components/Table';

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
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [marks, setMarks] = useState({});
  const [statuses, setStatuses] = useState({});
  const [individualDates, setIndividualDates] = useState({});

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const [sessionsData, assignments] = await Promise.all([
        academicAPI.getSessions(),
        teacherAPI.getTeacherAssignments(),
      ]);
      setSessions(sessionsData);
      const active = assignments.filter((a) => a.isActive);
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
        const [sems, secs] = await Promise.all([
          academicAPI.getSemesters(first.academicSessionId),
          academicAPI.getSections(first.schoolClassId),
        ]);
        setSemesters(sems);
        setSections(secs);
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
        semesterId: assignment.semesterId,
        schoolClassId: assignment.schoolClassId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
      }));
      setAssessments(data);
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
      academicAPI.getSemesters(value).then(setSemesters);
      setFilter((f) => ({ ...f, semesterId: '' }));
    }
    if (key === 'schoolClassId') {
      academicAPI.getSections(value).then(setSections);
      setFilter((f) => ({ ...f, sectionId: '' }));
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
        individualDate: individualDates[student.student.id] || null,
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

  const columns = [
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
    {
      key: 'individualDate', label: 'Date Override',
      render: (val, row) => (
        <Input type="date" value={individualDates[row.student?.id] || ''}
          onChange={(e) => setIndividualDates({ ...individualDates, [row.student.id]: e.target.value })}
          className="w-36" />
      ),
    },
  ];

  // Available filter options restricted to my assignments
  const mySubjects = [...new Map(myAssignments.map((a) => [a.subjectId, a.subject])).values()];
  const myClasses = [...new Map(myAssignments.map((a) => [`${a.schoolClassId}-${a.sectionId}`, a])).values()];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marks Entry</h1>

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
                options={[...new Map(myAssignments.map((a) => [a.schoolClassId, a.schoolClass])).values()]
                  .map((c) => ({ value: c.id, label: c.name }))} />
              <Select placeholder="Section" value={filter.sectionId}
                onChange={(e) => handleAssignmentChange('sectionId', e.target.value)}
                options={sections.map((s) => ({ value: s.id, label: s.name }))} />
              <Select placeholder="Subject" value={filter.subjectId}
                onChange={(e) => handleAssignmentChange('subjectId', e.target.value)}
                options={mySubjects.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            <div className="mt-4">
              <Button onClick={() => {
                const assignment = myAssignments.find((a) =>
                  a.academicSessionId === filter.academicSessionId &&
                  a.semesterId === filter.semesterId &&
                  a.schoolClassId === filter.schoolClassId &&
                  a.sectionId === filter.sectionId &&
                  a.subjectId === filter.subjectId
                );
                if (assignment) loadAssessmentsFor(assignment);
                else alert('No assignment matches the selected filters');
              }} disabled={loading}>
                {loading ? 'Loading...' : 'Load Assessments'}
              </Button>
            </div>
          </Card>

          {assessments.length > 0 && (
            <Card className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Assessment</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assessments.map((assessment) => (
                  <button key={assessment.id} onClick={() => loadStudentsForAssessment(assessment)}
                    className={`p-4 border rounded-md text-left transition-colors ${
                      selectedAssessment?.id === assessment.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div className="font-medium">{assessment.name}</div>
                    <div className="text-sm text-gray-600">{assessment.category?.name}</div>
                    <div className="text-sm text-gray-600">Max: {assessment.maximumMarks} | {assessment.submissionStatus}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {students.length > 0 && selectedAssessment && (
            <Card title={`Marks Entry — ${selectedAssessment.name} (Max: ${selectedAssessment.maximumMarks})`}>
              {loading ? <div className="text-center py-8">Loading...</div> : (
                <>
                  <Table columns={columns} data={students} />
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-600">{students.length} students</div>
                    <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save All Marks'}</Button>
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

import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function MarksEntry() {
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filter, setFilter] = useState({
    academicSessionId: '',
    semesterId: '',
    schoolClassId: '',
    sectionId: '',
    subjectId: '',
  });
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [marks, setMarks] = useState({});
  const [statuses, setStatuses] = useState({});
  const [individualDates, setIndividualDates] = useState({});

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [sessions, classes, subjects] = await Promise.all([
        academicAPI.getSessions(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
      ]);
      setSessions(sessions);
      setClasses(classes);
      setSubjects(subjects);
      setSemesters([]);
      setSections([]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const handleSessionChange = async (academicSessionId) => {
    setFilter({ ...filter, academicSessionId });
    if (academicSessionId) {
      const semesters = await academicAPI.getSemesters(academicSessionId);
      setSemesters(semesters);
    }
  };

  const handleClassChange = async (schoolClassId) => {
    setFilter({ ...filter, schoolClassId });
    if (schoolClassId) {
      const sections = await academicAPI.getSections(schoolClassId);
      setSections(sections);
    }
  };

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/assessments', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setAssessments(data);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsForAssessment = async (assessmentId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/marks/assessment/${assessmentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setStudents(data.students || []);
      setSelectedAssessment(data.assessment);
      
      // Initialize marks from existing data
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
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, value) => {
    setMarks({ ...marks, [studentId]: value });
  };

  const handleStatusChange = (studentId, value) => {
    setStatuses({ ...statuses, [studentId]: value });
  };

  const handleDateChange = (studentId, value) => {
    setIndividualDates({ ...individualDates, [studentId]: value });
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const entries = students.map((student) => ({
        studentId: student.student.id,
        assessmentId: selectedAssessment.id,
        marksObtained: marks[student.student.id] || null,
        status: statuses[student.student.id] || 'PENDING',
        individualDate: individualDates[student.student.id] || null,
      }));

      const response = await fetch('http://localhost:5000/api/marks/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ entries }),
      });
      const result = await response.json();
      alert(`Saved: ${result.successCount} entries, ${result.errorCount} errors`);
      loadStudentsForAssessment(selectedAssessment.id);
    } catch (error) {
      console.error('Error saving marks:', error);
      alert('Error saving marks');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
    {
      key: 'marks',
      label: 'Marks Obtained',
      render: (val, row) => (
        <Input
          type="number"
          step="0.01"
          value={marks[row.student?.id] || ''}
          onChange={(e) => handleMarkChange(row.student?.id, e.target.value)}
          className="w-24"
          disabled={statuses[row.student?.id] === 'ABSENT' || statuses[row.student?.id] === 'EXEMPTED'}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => (
        <Select
          value={statuses[row.student?.id] || 'PENDING'}
          onChange={(e) => handleStatusChange(row.student?.id, e.target.value)}
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'ABSENT', label: 'Absent' },
            { value: 'EXEMPTED', label: 'Exempted' },
            { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
          ]}
          className="w-32"
        />
      ),
    },
    {
      key: 'individualDate',
      label: 'Date Override',
      render: (val, row) => (
        <Input
          type="date"
          value={individualDates[row.student?.id] || ''}
          onChange={(e) => handleDateChange(row.student?.id, e.target.value)}
          className="w-36"
        />
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marks Entry</h1>
      
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            placeholder="Select Session"
            value={filter.academicSessionId}
            onChange={(e) => handleSessionChange(e.target.value)}
            options={sessions?.map((s) => ({ value: s.id, label: s.name })) || []}
          />
          <Select
            placeholder="Select Semester"
            value={filter.semesterId}
            onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })}
            options={semesters?.map((s) => ({ value: s.id, label: s.name })) || []}
          />
          <Select
            placeholder="Select Class"
            value={filter.schoolClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            options={classes?.map((c) => ({ value: c.id, label: c.name })) || []}
          />
          <Select
            placeholder="Select Section"
            value={filter.sectionId}
            onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })}
            options={sections?.map((s) => ({ value: s.id, label: s.name })) || []}
          />
          <Select
            placeholder="Select Subject"
            value={filter.subjectId}
            onChange={(e) => setFilter({ ...filter, subjectId: e.target.value })}
            options={subjects?.map((s) => ({ value: s.id, label: s.name })) || []}
          />
        </div>
        <div className="mt-4">
          <Button onClick={loadAssessments}>Load Assessments</Button>
        </div>
      </Card>

      {assessments.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assessments.map((assessment) => (
              <button
                key={assessment.id}
                onClick={() => loadStudentsForAssessment(assessment.id)}
                className={`p-4 border rounded-md text-left transition-colors ${
                  selectedAssessment?.id === assessment.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{assessment.name}</div>
                <div className="text-sm text-gray-600">{assessment.category?.name}</div>
                <div className="text-sm text-gray-600">Max: {assessment.maximumMarks}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {students.length > 0 && selectedAssessment && (
        <Card title={`Marks Entry - ${selectedAssessment.name} (Max: ${selectedAssessment.maximumMarks})`}>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              <Table columns={columns} data={students} />
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {students.length} students loaded
                </div>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save All Marks'}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

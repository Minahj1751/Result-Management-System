import { useState, useEffect } from 'react';
import { teacherAPI } from '../../api/teacherService';
import { academicAPI } from '../../api/academicService';
import { studentAPI } from '../../api/studentService';
import { pdfAPI } from '../../api/pdfService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { filterVisibleAssignments, filterVisibleSemesters } from '../../utils/semesterVisibility';

export default function ClassTeacherMarksheetPreview() {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewStudent, setPreviewStudent] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [missingMarks, setMissingMarks] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

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

  const loadStudents = async (assignment = selectedAssignment, semesterId = selectedSemesterId) => {
    if (!assignment || !semesterId) return;
    try {
      setLoading(true);
      const data = await studentAPI.getStudents({
        academicSessionId: assignment.academicSessionId,
        semesterId,
        schoolClassId: assignment.schoolClassId,
        sectionId: assignment.sectionId,
        limit: 500,
      });
      setStudents(data.students || data || []);
    } catch (error) {
      alert(error.response?.data?.error || 'Error loading students');
    } finally {
      setLoading(false);
    }
  };

  const selectAssignment = async (assignment) => {
    if (!assignment) return;
    setSelectedAssignmentId(assignment.id);
    setStudents([]);
    try {
      const sems = await academicAPI.getSemesters(assignment.academicSessionId);
      const semesterList = filterVisibleSemesters(sems || []);
      setSemesters(semesterList);
      const semesterId = assignment.semesterId || semesterList[0]?.id || '';
      setSelectedSemesterId(semesterId);
      await loadStudents(assignment, semesterId);
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
    loadStudents(selectedAssignment, semesterId);
  };

  const openPreview = async (student) => {
    if (!selectedAssignment || !selectedSemesterId) return;
    try {
      setPreviewLoadingId(student.id);
      setPreviewStudent(student);
      setPreviewHtml('');
      setMissingMarks(null);

      const params = {
        studentId: student.id,
        academicSessionId: selectedAssignment.academicSessionId,
        semesterId: selectedSemesterId,
        schoolClassId: selectedAssignment.schoolClassId,
        sectionId: selectedAssignment.sectionId,
      };

      const [html, missing] = await Promise.all([
        pdfAPI.getStudentMarksheetPreview(params),
        pdfAPI.getStudentMissingMarks(params),
      ]);
      setPreviewHtml(html);
      setMissingMarks(missing);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert(error.response?.data?.error || 'Error generating preview');
      setPreviewStudent(null);
      setPreviewHtml('');
      setMissingMarks(null);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const closePreview = () => {
    setPreviewStudent(null);
    setPreviewHtml('');
    setMissingMarks(null);
  };

  const columns = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'fullName', label: 'Name' },
    {
      key: 'rollNumber',
      label: 'Roll',
      render: (val, row) => row.enrollments?.[0]?.rollNumber ?? '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <Button size="sm" onClick={() => openPreview(row)} disabled={previewLoadingId === row.id}>
          {previewLoadingId === row.id ? '...' : 'Preview'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marksheet Preview</h1>

      <Card className="mb-6">
        {assignments.length === 0 ? (
          <p className="text-gray-600">No class teacher assignment found. Contact the administrator.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select
                label="Assigned Class"
                value={selectedAssignmentId}
                onChange={handleAssignmentChange}
                options={assignments.map((a) => ({
                  value: a.id,
                  label: `${a.schoolClass?.name || 'Class'} — ${a.section?.name || 'Section'}`,
                }))}
              />
              <Select
                label="Semester"
                value={selectedSemesterId}
                onChange={handleSemesterChange}
                options={semesters.map((s) => ({ value: s.id, label: s.name }))}
              />
              <div className="flex items-end md:col-span-2">
                <Button onClick={() => loadStudents()} disabled={loading || !selectedAssignment || !selectedSemesterId}>
                  {loading ? 'Loading...' : 'Reload Students'}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Preview shows the marksheet and subjects with missing marks for the selected student.
            </p>
          </>
        )}
      </Card>

      {students.length > 0 && (
        <Card title="Students">
          <Table columns={columns} data={students} />
          <div className="mt-4 text-sm text-gray-600">{students.length} students loaded.</div>
        </Card>
      )}

      <Modal
        isOpen={!!previewStudent}
        onClose={closePreview}
        title={`Preview — ${previewStudent?.fullName || ''}`}
        panelClassName="sm:max-w-6xl sm:w-full"
      >
        {previewLoadingId ? (
          <div className="text-center py-8">Loading preview...</div>
        ) : (
          <>
            {missingMarks && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-semibold text-amber-800">
                  Missing marks: {missingMarks.totalMissing}
                </div>
                {missingMarks.subjects?.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">
                    {missingMarks.subjects.map((subject) => (
                      <li key={subject.subjectId}>
                        <span className="font-medium">{subject.subjectName}</span>
                        {' — '}
                        {subject.missingCount} assessment(s): {subject.assessments.map((a) => a.name).join(', ')}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-green-700">No missing marks found.</p>
                )}
              </div>
            )}
            {previewHtml ? (
              <iframe title="Marksheet preview" srcDoc={previewHtml} className="w-full h-[75vh] border border-gray-200 rounded-md bg-white" />
            ) : (
              <p className="text-sm text-gray-600">Preview is not available.</p>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={closePreview}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}

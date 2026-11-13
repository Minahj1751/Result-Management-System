import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function PDFGeneration() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filter, setFilter] = useState({
    academicSessionId: '',
    semesterId: '',
    schoolClassId: '',
    sectionId: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [sessions, classes] = await Promise.all([
        academicAPI.getSessions(),
        academicAPI.getClasses(),
      ]);
      setSessions(sessions);
      setClasses(classes);
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

  const loadStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/students', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filter,
      });
      const data = await response.json();
      setStudents(data.students || data);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadIndividualPDF = async (studentId, studentName) => {
    try {
      setGenerating(true);
      const response = await fetch(
        `http://localhost:5000/api/pdf/student?studentId=${studentId}&academicSessionId=${filter.academicSessionId}&semesterId=${filter.semesterId}&schoolClassId=${filter.schoolClassId}&sectionId=${filter.sectionId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marksheet_${studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error downloading PDF');
    } finally {
      setGenerating(false);
    }
  };

  const downloadBulkPDF = async () => {
    try {
      setGeneratingBulk(true);
      const response = await fetch(
        `http://localhost:5000/api/pdf/class?academicSessionId=${filter.academicSessionId}&semesterId=${filter.semesterId}&schoolClassId=${filter.schoolClassId}&sectionId=${filter.sectionId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marksheets_${filter.schoolClassId}_${filter.sectionId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert('Bulk PDF download started. This may take a moment for large classes.');
    } catch (error) {
      console.error('Error downloading bulk PDF:', error);
      alert('Error downloading bulk PDF');
    } finally {
      setGeneratingBulk(false);
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <Button
          onClick={() => downloadIndividualPDF(row.student?.id, row.student?.fullName)}
          disabled={generating}
          size="sm"
        >
          {generating ? '...' : 'Download PDF'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">PDF Marksheet Generation</h1>
      
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={loadStudents} disabled={loading}>
            {loading ? 'Loading...' : 'Load Students'}
          </Button>
          {students.length > 0 && (
            <Button onClick={downloadBulkPDF} disabled={generatingBulk} variant="success">
              {generatingBulk ? 'Generating...' : 'Download All (ZIP)'}
            </Button>
          )}
        </div>
      </Card>

      {students.length > 0 && (
        <Card title="Students">
          <Table columns={columns} data={students} />
          <div className="mt-4 text-sm text-gray-600">
            {students.length} students loaded. Click "Download PDF" for individual marksheets or "Download All" for a ZIP archive.
          </div>
        </Card>
      )}
    </div>
  );
}

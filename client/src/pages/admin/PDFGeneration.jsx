import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { studentAPI } from '../../api/studentService';
import { pdfAPI } from '../../api/pdfService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function PDFGeneration() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filter, setFilter] = useState({ academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '' });

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const [sessionsData, classesData] = await Promise.all([academicAPI.getSessions(), academicAPI.getClasses()]);
      setSessions(sessionsData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const handleSessionChange = async (academicSessionId) => {
    setFilter((f) => ({ ...f, academicSessionId, semesterId: '' }));
    setSemesters(academicSessionId ? await academicAPI.getSemesters(academicSessionId) : []);
  };

  const handleClassChange = async (schoolClassId) => {
    setFilter((f) => ({ ...f, schoolClassId, sectionId: '' }));
    setSections(schoolClassId ? await academicAPI.getSections(schoolClassId) : []);
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await studentAPI.getStudents({ ...cleanParams(filter), limit: 200 });
      setStudents(data.students || []);
    } catch (error) {
      alert('Error loading students');
    } finally {
      setLoading(false);
    }
  };

  const downloadIndividualPDF = async (student) => {
    try {
      setGeneratingId(student.id);
      await pdfAPI.downloadStudentMarksheet(
        { ...cleanParams(filter), studentId: student.id },
        `marksheet_${student.studentId}.pdf`
      );
    } catch (error) {
      alert('Error generating marksheet. Ensure results are finalized first.');
    } finally {
      setGeneratingId(null);
    }
  };

  const downloadBulkPDF = async () => {
    try {
      setGeneratingBulk(true);
      await pdfAPI.downloadClassMarksheets(cleanParams(filter), 'marksheets.zip');
    } catch (error) {
      alert('Error generating bulk PDFs');
    } finally {
      setGeneratingBulk(false);
    }
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
        <Button onClick={() => downloadIndividualPDF(row)} disabled={generatingId === row.id} size="sm">
          {generatingId === row.id ? '...' : 'Download PDF'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">PDF Marksheet Generation</h1>
      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select placeholder="Select Session" value={filter.academicSessionId} onChange={(e) => handleSessionChange(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Class" value={filter.schoolClassId} onChange={(e) => handleClassChange(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Select Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={loadStudents} disabled={loading}>{loading ? 'Loading...' : 'Load Students'}</Button>
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
            {students.length} students loaded. Results must be finalized before marksheets can be generated.
          </div>
        </Card>
      )}
    </div>
  );
}

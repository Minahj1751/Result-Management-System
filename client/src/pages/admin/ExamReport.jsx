import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { studentAPI } from '../../api/studentService';
import { pdfAPI } from '../../api/pdfService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { fitPreviewHtml } from '../../utils/fitPreviewHtml';

export default function ExamReport() {
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filter, setFilter] = useState({ academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '' });
  const [previewStudent, setPreviewStudent] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

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
    const secs = schoolClassId ? await academicAPI.getSections(schoolClassId) : [];
    setSections(secs);
    setFilter((f) => ({ ...f, schoolClassId, sectionId: secs.length === 1 ? secs[0].id : '' }));
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await studentAPI.getStudents({ ...cleanParams(filter), limit: 500 });
      setStudents(data.students || []);
      setSelectedIds(new Set());
    } catch (error) {
      alert('Error loading students');
    } finally {
      setLoading(false);
    }
  };

  const openPreview = async (student) => {
    try {
      setPreviewLoadingId(student.id);
      setPreviewStudent(student);
      setPreviewHtml('');
      const html = await pdfAPI.getExamReportPreview({ ...cleanParams(filter), studentId: student.id });
      setPreviewHtml(fitPreviewHtml(html));
    } catch (error) {
      console.error('Error generating preview:', error);
      alert(error.response?.data?.error || 'Error generating preview');
      setPreviewStudent(null);
      setPreviewHtml('');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const closePreview = () => {
    setPreviewStudent(null);
    setPreviewHtml('');
  };

  const downloadIndividualPDF = async (student) => {
    try {
      setGeneratingId(student.id);
      await pdfAPI.downloadExamReport(
        { ...cleanParams(filter), studentId: student.id },
        `exam_report_${student.studentId}.pdf`
      );
    } catch (error) {
      alert(error.response?.data?.error || 'Error generating exam report. Please try again.');
    } finally {
      setGeneratingId(null);
    }
  };

  const downloadBulkPDF = async () => {
    try {
      setGeneratingBulk(true);
      const studentIds = selectedIds.size > 0 ? [...selectedIds].join(',') : undefined;
      await pdfAPI.downloadClassExamReports(
        { ...cleanParams(filter), studentIds },
        selectedIds.size > 0 ? `exam_reports_selected_${selectedIds.size}.zip` : 'exam_reports.zip'
      );
    } catch (error) {
      alert(error.response?.data?.error || 'Error generating bulk exam reports');
    } finally {
      setGeneratingBulk(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  };

  const columns = [
    {
      key: 'select', label: '',
      render: (val, row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="w-4 h-4 text-blue-600" />
      ),
    },
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
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openPreview(row)} disabled={previewLoadingId === row.id}>
            Preview
          </Button>
          <Button onClick={() => downloadIndividualPDF(row)} disabled={generatingId === row.id} size="sm">
            {generatingId === row.id ? '...' : 'Download PDF'}
          </Button>
        </div>
      ),
    },
  ];

  const filtersReady = filter.academicSessionId && filter.semesterId && filter.schoolClassId && filter.sectionId;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Exam Report Card</h1>
      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select placeholder="Select Session" value={filter.academicSessionId} onChange={(e) => handleSessionChange(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Class" value={filter.schoolClassId} onChange={(e) => handleClassChange(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Select Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={loadStudents} disabled={loading || !filtersReady}>{loading ? 'Loading...' : 'Load Students'}</Button>
          {students.length > 0 && (
            <Button onClick={downloadBulkPDF} disabled={generatingBulk} variant="success">
              {generatingBulk ? 'Generating...' : selectedIds.size > 0 ? `Download Selected (${selectedIds.size})` : 'Download All (ZIP)'}
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Report card: Grade 4+ — Class Marks 40% (CT best-2, CW/HW rule-based) + Exam Marks 60%. Grade 1-3 — CT(40) + CW(20) + HW(20) = Class Marks(80) + Attendance(20), no term exam. Requires Term Exam marks entry and class teacher remarks.
        </p>
      </Card>
      {students.length > 0 && (
        <Card title="Students">
          <div className="mb-3">
            <label className="text-sm text-gray-600 inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600" />
              Select all loaded students
            </label>
          </div>
          <Table columns={columns} data={students} />
          <div className="mt-4 text-sm text-gray-600">
            {students.length} students loaded.
          </div>
        </Card>
      )}

      <Modal isOpen={!!previewStudent} onClose={closePreview} title={`Exam Report Preview — ${previewStudent?.fullName || ''}`} panelClassName="sm:max-w-4xl sm:w-full">
        {previewLoadingId ? (
          <div className="text-center py-8">Loading preview...</div>
        ) : previewHtml ? (
          <iframe title="Exam report preview" srcDoc={previewHtml} className="w-full h-[75vh] border border-gray-200 rounded-md bg-white" />
        ) : (
          <p className="text-sm text-gray-600">Preview is not available.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={closePreview}>Close</Button>
          <Button
            onClick={() => {
              const student = previewStudent;
              closePreview();
              if (student) downloadIndividualPDF(student);
            }}
            disabled={!previewHtml}
          >
            Download PDF
          </Button>
        </div>
      </Modal>
    </div>
  );
}

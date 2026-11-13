import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { resultAPI } from '../../api/resultService';
import { exportAPI } from '../../api/exportService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function ResultsManagement() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
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

  const calculateResults = async () => {
    try {
      setLoading(true);
      const data = await resultAPI.calculateClass(cleanParams(filter));
      setResults(data);
    } catch (error) {
      alert(error.response?.data?.error || 'Error calculating results');
    } finally {
      setLoading(false);
    }
  };

  const finalizeResults = async () => {
    try {
      setFinalizing(true);
      const result = await resultAPI.finalizeBulk(cleanParams(filter));
      alert(`Finalized: ${result.successCount} results, ${result.errorCount} errors`);
      calculateResults();
    } catch (error) {
      alert(error.response?.data?.error || 'Error finalizing results');
    } finally {
      setFinalizing(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportAPI.results(cleanParams(filter));
    } catch (error) {
      alert('Error exporting results');
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'subjects', label: 'Subject Results', render: (val, row) => (
      <div className="text-sm">
        {(row.subjects || []).map((sub, idx) => (
          <div key={idx} className="mb-1">
            {sub.subject?.name}: {sub.result?.grade || 'N/A'} ({sub.result?.finalPercentage?.toFixed(2) || 0}%)
          </div>
        ))}
      </div>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Results Management</h1>
      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select placeholder="Select Session" value={filter.academicSessionId} onChange={(e) => handleSessionChange(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Class" value={filter.schoolClassId} onChange={(e) => handleClassChange(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Select Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Button onClick={calculateResults} disabled={loading}>{loading ? 'Calculating...' : 'Calculate Results'}</Button>
          {results.length > 0 && (
            <>
              <Button onClick={finalizeResults} disabled={finalizing} variant="success">{finalizing ? 'Finalizing...' : 'Finalize All Results'}</Button>
              <Button onClick={handleExport} variant="secondary">Export to Excel</Button>
            </>
          )}
        </div>
      </Card>
      {results.length > 0 && (
        <Card title="Class Results">
          <Table columns={columns} data={results} />
        </Card>
      )}
    </div>
  );
}

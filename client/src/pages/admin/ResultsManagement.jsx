import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { resultAPI } from '../../api/resultService';
import { exportAPI } from '../../api/exportService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import MultiSelect from '../../components/MultiSelect';
import Select from '../../components/Select';
import Table from '../../components/Table';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function ResultsManagement() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [filter, setFilter] = useState({ academicSessionId: '', semesterId: '', schoolClassId: '', sectionIds: [] });
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const [sessionsData, classesData, sectionsData] = await Promise.all([
        academicAPI.getSessions(),
        academicAPI.getClasses(),
        academicAPI.getSections(),
      ]);
      setSessions(sessionsData);
      setClasses(classesData);
      setAllSections(sectionsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && !(Array.isArray(v) && v.length === 0)));

  const classSections = filter.schoolClassId
    ? allSections.filter((s) => s.schoolClassId === filter.schoolClassId)
    : [];

  const sectionOptions = classSections.map((s) => ({ value: s.id, label: s.name }));

  const handleSessionChange = async (academicSessionId) => {
    setFilter((f) => ({ ...f, academicSessionId, semesterId: '', sectionIds: [] }));
    setSemesters(academicSessionId ? await academicAPI.getSemesters(academicSessionId) : []);
  };

  const handleClassChange = (schoolClassId) => {
    setFilter((f) => ({ ...f, schoolClassId, sectionIds: [] }));
  };

  const params = () => cleanParams({
    academicSessionId: filter.academicSessionId,
    semesterId: filter.semesterId,
    schoolClassId: filter.schoolClassId,
    sectionIds: filter.sectionIds.join(','),
    sectionId: filter.sectionIds[0] || '',
  });

  const calculateResults = async () => {
    try {
      setLoading(true);
      const data = await resultAPI.calculateClass(params());
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      alert(error.response?.data?.error || 'Error calculating results');
    } finally {
      setLoading(false);
    }
  };

  const finalizeResults = async () => {
    try {
      setFinalizing(true);
      const result = await resultAPI.finalizeBulk(params());
      alert(`Finalized: ${result.successCount} results, ${result.errorCount} errors`);
      calculateResults();
    } catch (error) {
      alert(error.response?.data?.error || 'Error finalizing results');
    } finally {
      setFinalizing(false);
      setConfirmFinalize(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportAPI.results({
        academicSessionId: filter.academicSessionId,
        semesterId: filter.semesterId,
        schoolClassId: filter.schoolClassId,
        sectionId: filter.sectionIds.length === 1 ? filter.sectionIds[0] : undefined,
      });
    } catch (error) {
      alert('Error exporting results');
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'section', label: 'Section', render: (val, row) => row.enrollment?.section?.name || '' },
    { key: 'subjects', label: 'Subject Results', render: (val, row) => (
      <div className="text-sm">
        {(row.subjects || []).map((sub, idx) => (
          <div key={idx} className="mb-1">
            {sub.subject?.name}: {sub.result?.grade || 'N/A'} ({sub.result?.finalPercentage != null ? Math.round(sub.result.finalPercentage) : 0}%)
          </div>
        ))}
      </div>
    )},
  ];

  const filtersReady = filter.academicSessionId && filter.semesterId && filter.schoolClassId && filter.sectionIds.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Results Management</h1>
      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select placeholder="Select Session" value={filter.academicSessionId} onChange={(e) => handleSessionChange(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Select Class" value={filter.schoolClassId} onChange={(e) => handleClassChange(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <MultiSelect
            label="Sections"
            options={sectionOptions}
            value={filter.sectionIds}
            onChange={(v) => setFilter((f) => ({ ...f, sectionIds: v }))}
            placeholder={filter.schoolClassId ? 'Select sections...' : 'Select a class first'}
            disabled={!filter.schoolClassId}
            emptyMessage="No sections for this class"
          />
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Button onClick={calculateResults} disabled={loading || !filtersReady}>
            {loading ? 'Calculating...' : `Calculate Results${filter.sectionIds.length > 1 ? ` (${filter.sectionIds.length} sections)` : ''}`}
          </Button>
          {results.length > 0 && (
            <>
              <Button onClick={() => setConfirmFinalize(true)} disabled={finalizing} variant="success">
                {finalizing ? 'Finalizing...' : 'Finalize Results'}
              </Button>
              <Button onClick={handleExport} variant="secondary">Export to Excel</Button>
            </>
          )}
        </div>
      </Card>
      {results.length > 0 && (
        <Card title={`Class Results — ${results.length} student(s)`}>
          <Table columns={columns} data={results} emptyMessage="No results" />
        </Card>
      )}

      <ConfirmDialog
        isOpen={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        onConfirm={finalizeResults}
        title="Finalize Results"
        message={`Finalize calculated results for ${filter.sectionIds.length} section(s)? This will create finalized result snapshots used for marksheets.`}
        confirmLabel="Finalize"
        danger={false}
      />
    </div>
  );
}

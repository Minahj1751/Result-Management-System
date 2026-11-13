import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
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

  const calculateResults = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/results/calculate-class', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filter,
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error calculating results:', error);
    } finally {
      setLoading(false);
    }
  };

  const finalizeResults = async () => {
    try {
      setFinalizing(true);
      const response = await fetch('http://localhost:5000/api/results/finalize-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(filter),
      });
      const result = await response.json();
      alert(`Finalized: ${result.successCount} results, ${result.errorCount} errors`);
      calculateResults();
    } catch (error) {
      console.error('Error finalizing results:', error);
      alert('Error finalizing results');
    } finally {
      setFinalizing(false);
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'subjects', label: 'Subjects', render: (val, row) => {
      const subjects = row.subjects || [];
      return (
        <div className="text-sm">
          {subjects.map((sub, idx) => (
            <div key={idx} className="mb-1">
              {sub.subject?.name}: {sub.result?.grade || 'N/A'} ({sub.result?.percentage?.toFixed(2) || 0}%)
            </div>
          ))}
        </div>
      );
    }},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Results Management</h1>
      
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
          <Button onClick={calculateResults} disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate Results'}
          </Button>
          {results.length > 0 && (
            <Button onClick={finalizeResults} disabled={finalizing} variant="success">
              {finalizing ? 'Finalizing...' : 'Finalize All Results'}
            </Button>
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

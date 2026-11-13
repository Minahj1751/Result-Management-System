import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { teacherAPI } from '../../api/teacherService';
import { attendanceAPI } from '../../api/attendanceService';
import { exportAPI } from '../../api/exportService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function AttendanceManagement() {
  const [myAssignments, setMyAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '' });
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [sections, setSections] = useState([]);
  const [totalWorkingDays, setTotalWorkingDays] = useState(0);
  const [daysAttended, setDaysAttended] = useState({});

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const [sessionsData, assignments] = await Promise.all([
        academicAPI.getSessions(),
        teacherAPI.getClassTeacherAssignments(),
      ]);
      setSessions(sessionsData);
      const active = assignments.filter((a) => a.isActive);
      setMyAssignments(active);

      if (active.length > 0) {
        const first = active[0];
        setFilter({
          academicSessionId: first.academicSessionId,
          semesterId: first.semesterId,
          schoolClassId: first.schoolClassId,
          sectionId: first.sectionId,
        });
        const [sems, secs] = await Promise.all([
          academicAPI.getSemesters(first.academicSessionId),
          academicAPI.getSections(first.schoolClassId),
        ]);
        setSemesters(sems);
        setSections(secs);
        loadStudents(first);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const loadStudents = async (assignment) => {
    const params = assignment
      ? {
          academicSessionId: assignment.academicSessionId,
          semesterId: assignment.semesterId,
          schoolClassId: assignment.schoolClassId,
          sectionId: assignment.sectionId,
        }
      : cleanParams(filter);
    try {
      setLoading(true);
      const data = await attendanceAPI.getClassAttendance(params);
      const list = data.students || [];
      setStudents(list);

      let workingDays = 0;
      const attended = {};
      list.forEach((s) => {
        if (s.attendance) {
          if (s.attendance.totalWorkingDays > workingDays) workingDays = s.attendance.totalWorkingDays;
          attended[s.student.id] = s.attendance.daysAttended;
        }
      });
      setTotalWorkingDays(workingDays);
      setDaysAttended(attended);
    } catch (error) {
      alert(error.response?.data?.error || 'Error loading attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (key, value) => {
    const newFilter = { ...filter, [key]: value };
    setFilter(newFilter);
    if (key === 'academicSessionId') {
      setSemesters(value ? await academicAPI.getSemesters(value) : []);
      setFilter((f) => ({ ...f, semesterId: '' }));
    }
    if (key === 'schoolClassId') {
      setSections(value ? await academicAPI.getSections(value) : []);
      setFilter((f) => ({ ...f, sectionId: '' }));
    }
  };

  const pct = (attended) => (totalWorkingDays > 0 ? ((attended / totalWorkingDays) * 100).toFixed(1) : '0.0');

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const entries = students.map((s) => ({
        studentId: s.student.id,
        academicSessionId: filter.academicSessionId,
        semesterId: filter.semesterId,
        schoolClassId: filter.schoolClassId,
        sectionId: filter.sectionId,
        totalWorkingDays,
        daysAttended: daysAttended[s.student.id] || 0,
      }));
      const result = await attendanceAPI.bulkUpsert(entries);
      const firstErr = result.errors?.[0]?.error;
      alert(`Saved: ${result.successCount} entries, ${result.errorCount} errors${firstErr ? ` — ${firstErr}` : ''}`);
      loadStudents();
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportAPI.attendance(cleanParams(filter));
    } catch (error) {
      alert('Error exporting attendance');
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
    {
      key: 'daysAttended', label: 'Days Attended',
      render: (val, row) => {
        const attended = daysAttended[row.student?.id] || 0;
        return (
          <div className="flex items-center gap-2">
            <Input type="number" min="0" max={totalWorkingDays} value={attended}
              onChange={(e) => setDaysAttended({ ...daysAttended, [row.student.id]: parseInt(e.target.value) || 0 })}
              className="w-24" />
            <span className="text-sm text-gray-600">{pct(attended)}%</span>
          </div>
        );
      },
    },
  ];

  const myClasses = [...new Map(myAssignments.map((a) => [`${a.schoolClassId}-${a.sectionId}`, a])).values()];
  const mySessions = [...new Map(myAssignments.map((a) => [a.academicSessionId, a.academicSession])).values()];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attendance Management</h1>

      {myAssignments.length === 0 ? (
        <Card><p className="text-gray-600">No class teacher assignment found. Contact the administrator.</p></Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Select placeholder="Session" value={filter.academicSessionId} onChange={(e) => handleFilterChange('academicSessionId', e.target.value)} options={mySessions.map((s) => ({ value: s.id, label: s.name }))} />
              <Select placeholder="Semester" value={filter.semesterId} onChange={(e) => handleFilterChange('semesterId', e.target.value)} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
              <Select placeholder="Class" value={filter.schoolClassId} onChange={(e) => handleFilterChange('schoolClassId', e.target.value)} options={[...new Map(myAssignments.map((a) => [a.schoolClassId, a.schoolClass])).values()].map((c) => ({ value: c.id, label: c.name }))} />
              <Select placeholder="Section" value={filter.sectionId} onChange={(e) => handleFilterChange('sectionId', e.target.value)} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => {
                const assignment = myAssignments.find((a) =>
                  a.academicSessionId === filter.academicSessionId &&
                  a.semesterId === filter.semesterId &&
                  a.schoolClassId === filter.schoolClassId &&
                  a.sectionId === filter.sectionId
                );
                if (assignment) loadStudents(assignment);
                else loadStudents();
              }} disabled={loading}>
                {loading ? 'Loading...' : 'Load Students'}
              </Button>
              {students.length > 0 && <Button variant="secondary" onClick={handleExport}>Export to Excel</Button>}
            </div>
          </Card>

          {students.length > 0 && (
            <>
              <Card className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Total Working Days</h3>
                <Input type="number" min="0" value={totalWorkingDays}
                  onChange={(e) => setTotalWorkingDays(parseInt(e.target.value) || 0)} className="w-32" />
              </Card>
              <Card title="Attendance Entry">
                {loading ? <div className="text-center py-8">Loading...</div> : (
                  <>
                    <Table columns={columns} data={students} />
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm text-gray-600">{students.length} students</div>
                      <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save Attendance'}</Button>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

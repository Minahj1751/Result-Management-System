import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function AttendanceManagement() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [attendance, setAttendance] = useState({
    totalWorkingDays: 0,
    daysAttended: {},
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

  const loadStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/attendance/class', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filter,
      });
      const data = await response.json();
      setStudents(data.students || []);
      
      // Initialize attendance from existing data
      const initialAttendance = { totalWorkingDays: 0, daysAttended: {} };
      data.students.forEach((student) => {
        if (student.attendance) {
          initialAttendance.totalWorkingDays = student.attendance.totalWorkingDays;
          initialAttendance.daysAttended[student.student.id] = student.attendance.daysAttended;
        }
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId, value) => {
    const intValue = parseInt(value) || 0;
    const maxValue = attendance.totalWorkingDays;
    if (intValue <= maxValue) {
      setAttendance({
        ...attendance,
        daysAttended: { ...attendance.daysAttended, [studentId]: intValue },
      });
    }
  };

  const calculatePercentage = (attended, total) => {
    if (total === 0) return 0;
    return ((attended / total) * 100).toFixed(2);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const entries = students.map((student) => ({
        studentId: student.student.id,
        academicSessionId: filter.academicSessionId,
        semesterId: filter.semesterId,
        schoolClassId: filter.schoolClassId,
        sectionId: filter.sectionId,
        totalWorkingDays: attendance.totalWorkingDays,
        daysAttended: attendance.daysAttended[student.student.id] || 0,
      }));

      const response = await fetch('http://localhost:5000/api/attendance/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ entries }),
      });
      const result = await response.json();
      alert(`Saved: ${result.successCount} entries, ${result.errorCount} errors`);
      loadStudents();
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error saving attendance');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID', render: (val, row) => row.student?.studentId },
    { key: 'fullName', label: 'Name', render: (val, row) => row.student?.fullName },
    { key: 'rollNumber', label: 'Roll', render: (val, row) => row.enrollment?.rollNumber },
    {
      key: 'daysAttended',
      label: 'Days Attended',
      render: (val, row) => {
        const attended = attendance.daysAttended[row.student?.id] || 0;
        const percentage = calculatePercentage(attended, attendance.totalWorkingDays);
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={attended}
              onChange={(e) => handleAttendanceChange(row.student?.id, e.target.value)}
              className="w-24"
              max={attendance.totalWorkingDays}
            />
            <span className="text-sm text-gray-600">{percentage}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attendance Management</h1>
      
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
        <div className="mt-4">
          <Button onClick={loadStudents}>Load Students</Button>
        </div>
      </Card>

      {students.length > 0 && (
        <>
          <Card className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Total Working Days</h3>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={attendance.totalWorkingDays}
                onChange={(e) => setAttendance({ ...attendance, totalWorkingDays: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm text-gray-600">Enter the total working days for this period</span>
            </div>
          </Card>

          <Card title="Attendance Entry">
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
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

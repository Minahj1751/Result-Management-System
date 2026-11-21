import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { teacherAPI } from '../api/teacherService';
import { academicAPI } from '../api/academicService';
import { attendanceAPI } from '../api/attendanceService';
import { studentAPI } from '../api/studentService';
import Card from '../components/Card';

export default function ClassTeacherDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({ students: 0, avgAttendance: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const classAssignments = await teacherAPI.getClassTeacherAssignments();
      const active = classAssignments.filter((a) => a.isActive);
      setAssignments(active);

      if (active.length > 0) {
        const a = active[0];
        const [studentsRes, records] = await Promise.all([
          studentAPI.getStudents({
            academicSessionId: a.academicSessionId,
            semesterId: a.semesterId,
            schoolClassId: a.schoolClassId,
            sectionId: a.sectionId,
          }),
          attendanceAPI.getRecords({
            academicSessionId: a.academicSessionId,
            semesterId: a.semesterId,
            schoolClassId: a.schoolClassId,
            sectionId: a.sectionId,
          }),
        ]);
        const students = studentsRes.students || studentsRes;
        const withDays = records.filter((r) => r.totalWorkingDays > 0);
        const avg = withDays.length
          ? withDays.reduce((s, r) => s + (r.daysAttended / r.totalWorkingDays) * 100, 0) / withDays.length
          : null;
        setStats({ students: students.length, avgAttendance: avg });
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state"><span className="loading-spinner" />Loading your dashboard…</div>;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <p className="dashboard-eyebrow">Your classroom workspace</p>
        <h1 className="text-2xl font-bold text-gray-900">Class Teacher Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">A friendly overview of your class and its attendance.</p>
      </header>

      {assignments.length === 0 ? (
        <Card>
          <p className="text-gray-600">No class teacher assignment found. Contact the administrator.</p>
        </Card>
      ) : (
        <>
          <div className="stat-grid gap-5 mb-6">
            <Card className="stat-card accent-blue text-center !p-4">
              <p className="text-sm text-gray-500">Assigned Class</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {assignments[0].schoolClass?.name} — {assignments[0].section?.name}
              </p>
            </Card>
            <Card className="stat-card accent-green text-center !p-4">
              <p className="text-sm text-gray-500">Students</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.students}</p>
            </Card>
            <Card className="stat-card accent-purple text-center !p-4">
              <p className="text-sm text-gray-500">Avg Attendance</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {stats.avgAttendance !== null ? `${stats.avgAttendance.toFixed(1)}%` : '-'}
              </p>
            </Card>
          </div>

          <Card title="Class Details" className="mb-6">
            <ul className="divide-y divide-gray-100">
              {assignments.map((a) => (
                <li key={a.id} className="py-2 text-sm text-gray-800">
                  {a.schoolClass?.name} {a.section?.name} — {a.semester?.name} ({a.academicSession?.name})
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/class-teacher/attendance"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
            >
              Go to Attendance
            </Link>
            <Link
              to="/class-teacher/marksheet-preview"
              className="inline-block bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 text-sm"
            >
              Preview Marksheet
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

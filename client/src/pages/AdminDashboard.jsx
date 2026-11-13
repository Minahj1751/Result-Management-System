import { Link } from 'react-router-dom';
import { teacherAPI } from '../api/teacherService';
import { studentAPI } from '../api/studentService';
import { academicAPI } from '../api/academicService';
import { assessmentAPI } from '../api/assessmentService';
import Card from '../components/Card';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalSubjects: 0,
    totalSessions: 0,
    totalSemesters: 0,
    totalAssessments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [studentsRes, teachers, classes, subjects, sessions] = await Promise.all([
        studentAPI.getStudents({ limit: 1 }),
        teacherAPI.getTeachers(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
        academicAPI.getSessions(),
      ]);
      const activeSession = sessions.find((s) => s.isActive) || sessions[0];
      const [semesters, assessments] = activeSession
        ? await Promise.all([
            academicAPI.getSemesters(activeSession.id),
            assessmentAPI.getAssessments({ academicSessionId: activeSession.id }),
          ])
        : [[], []];

      setStats({
        totalStudents: studentsRes.pagination?.total ?? (studentsRes.students?.length || 0),
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalSubjects: subjects.length,
        totalSessions: sessions.length,
        totalSemesters: semesters.length,
        totalAssessments: assessments.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, color: 'text-blue-600', accent: 'accent-blue' },
    { label: 'Total Teachers', value: stats.totalTeachers, color: 'text-green-600', accent: 'accent-green' },
    { label: 'Total Classes', value: stats.totalClasses, color: 'text-purple-600', accent: 'accent-purple' },
    { label: 'Total Subjects', value: stats.totalSubjects, color: 'text-orange-600', accent: 'accent-orange' },
    { label: 'Sessions', value: stats.totalSessions, color: 'text-indigo-600', accent: 'accent-indigo' },
    { label: 'Semesters (active)', value: stats.totalSemesters, color: 'text-teal-600', accent: 'accent-teal' },
    { label: 'Assessments', value: stats.totalAssessments, color: 'text-pink-600', accent: 'accent-pink' },
  ];

  const quickActions = [
    { label: 'Add Student', to: '/admin/students' },
    { label: 'Add Teacher', to: '/admin/teachers' },
    { label: 'Import Students', to: '/admin/import' },
    { label: 'Manage Assessments', to: '/admin/assessments' },
    { label: 'View Results', to: '/admin/results' },
    { label: 'Generate PDFs', to: '/admin/pdf' },
    { label: 'Sessions & Semesters', to: '/admin/sessions' },
    { label: 'Classes & Sections', to: '/admin/classes' },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <p className="dashboard-eyebrow">School overview</p>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">A quick look at the people and learning activity across your school.</p>
      </header>
      <div className="stat-grid gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className={`stat-card text-center !p-4 ${s.accent}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="quick-action p-4 text-sm text-center"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

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
    { label: 'Total Students', value: stats.totalStudents, color: 'text-blue-600' },
    { label: 'Total Teachers', value: stats.totalTeachers, color: 'text-green-600' },
    { label: 'Total Classes', value: stats.totalClasses, color: 'text-purple-600' },
    { label: 'Total Subjects', value: stats.totalSubjects, color: 'text-orange-600' },
    { label: 'Sessions', value: stats.totalSessions, color: 'text-indigo-600' },
    { label: 'Semesters (active)', value: stats.totalSemesters, color: 'text-teal-600' },
    { label: 'Assessments', value: stats.totalAssessments, color: 'text-pink-600' },
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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className="text-center !p-4">
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
              className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-sm text-center transition-colors"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

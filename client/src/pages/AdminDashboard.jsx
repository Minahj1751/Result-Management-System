import { useState, useEffect } from 'react';
import { teacherAPI } from '../api/teacherService';
import { studentAPI } from '../api/studentService';
import { academicAPI } from '../api/academicService';
import Card from '../components/Card';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalSubjects: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [students, teachers, classes, subjects] = await Promise.all([
        studentAPI.getStudents(),
        teacherAPI.getTeachers(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
      ]);
      setStats({
        totalStudents: students.length || (students.students?.length || 0),
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalSubjects: subjects.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Total Students</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalStudents}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Total Teachers</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalTeachers}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Total Classes</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalClasses}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Total Subjects</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.totalSubjects}</p>
        </Card>
      </div>
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-sm transition-colors">
            Add Student
          </button>
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-sm transition-colors">
            Add Teacher
          </button>
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-sm transition-colors">
            Import Students
          </button>
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-sm transition-colors">
            Generate Reports
          </button>
        </div>
      </Card>
    </div>
  );
}

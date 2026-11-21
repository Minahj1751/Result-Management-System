import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { teacherAPI } from '../api/teacherService';
import { academicAPI } from '../api/academicService';
import { assessmentAPI } from '../api/assessmentService';
import { marksAPI } from '../api/marksService';
import Card from '../components/Card';
import { filterVisibleAssignments } from '../utils/semesterVisibility';

const getUser = () => JSON.parse(localStorage.getItem('user') || '{}');

export default function TeacherDashboard() {
  const user = getUser();
  const teacherProfileId = user.teacherProfile?.id;
  const [assignments, setAssignments] = useState([]);
  const [classAssignments, setClassAssignments] = useState([]);
  const [pendingCount, setPendingCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subjectAssignments, classTeacherAssignments] = await Promise.all([
        teacherAPI.getTeacherAssignments(),
        teacherAPI.getClassTeacherAssignments(),
      ]);
      setAssignments(filterVisibleAssignments(subjectAssignments.filter((a) => a.isActive)));
      setClassAssignments(filterVisibleAssignments(classTeacherAssignments.filter((a) => a.isActive)));

      // Pending marks: assessments matching my assignments that aren't fully entered
      if (subjectAssignments.length > 0) {
        const first = subjectAssignments[0];
        const assessmentsRes = await assessmentAPI.getAssessments({
          academicSessionId: first.academicSessionId,
          semesterId: first.semesterId,
          schoolClassId: first.schoolClassId,
          sectionId: first.sectionId,
          subjectId: first.subjectId,
          limit: 100,
        });
        const assessments = assessmentsRes.assessments || assessmentsRes;
        const entries = await marksAPI.getEntries({ teacherId: teacherProfileId });
        const enteredAssessmentIds = new Set(entries.map((e) => e.assessmentId));
        setPendingCount(assessments.filter((a) => !enteredAssessmentIds.has(a.id)).length);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state"><span className="loading-spinner" />Loading your dashboard…</div>;

  const label = (a) =>
    `${a.subject?.name || ''} — ${a.schoolClass?.name || ''} ${a.section?.name || ''} (${a.semester?.name || ''}, ${a.academicSession?.name || ''})`;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <p className="dashboard-eyebrow">Your teaching workspace</p>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">Your assignments and assessment progress, all together.</p>
      </header>
      <div className="stat-grid gap-5 mb-6">
        <Card className="stat-card accent-blue text-center !p-4">
          <p className="text-sm text-gray-500">Subject Assignments</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{assignments.length}</p>
        </Card>
        <Card className="stat-card accent-green text-center !p-4">
          <p className="text-sm text-gray-500">Class Teacher Of</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{classAssignments.length}</p>
        </Card>
        <Card className="stat-card accent-orange text-center !p-4">
          <p className="text-sm text-gray-500">Assessments Pending</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{pendingCount ?? '-'}</p>
        </Card>
      </div>

      <Card title="My Subject Assignments" className="mb-6">
        {assignments.length === 0 ? (
          <p className="text-gray-600">No subject assignments found.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {assignments.map((a) => (
              <li key={a.id} className="py-2 text-sm text-gray-800">{label(a)}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Class Teacher Assignments">
        {classAssignments.length === 0 ? (
          <p className="text-gray-600">No class teacher assignments found.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {classAssignments.map((a) => (
              <li key={a.id} className="py-2 text-sm text-gray-800">
                {a.schoolClass?.name} {a.section?.name} — {a.semester?.name} ({a.academicSession?.name})
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Link
          to="/teacher/marks"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          Go to Marks Entry
        </Link>
      </div>
    </div>
  );
}

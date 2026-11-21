import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './layouts/MainLayout';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ClassTeacherDashboard from './pages/ClassTeacherDashboard';
import TeacherManagement from './pages/admin/TeacherManagement';
import StudentManagement from './pages/admin/StudentManagement';
import ClassManagement from './pages/admin/ClassManagement';
import SectionManagement from './pages/admin/SectionManagement';
import SubjectManagement from './pages/admin/SubjectManagement';
import SessionManagement from './pages/admin/SessionManagement';
import AssessmentManagement from './pages/admin/AssessmentManagement';
import ResultsManagement from './pages/admin/ResultsManagement';
import PDFGeneration from './pages/admin/PDFGeneration';
import ExcelImport from './pages/admin/ExcelImport';
import MarksEntry from './pages/teacher/MarksEntry';
import AttendanceManagement from './pages/classTeacher/AttendanceManagement';
import ClassTeacherMarksheetPreview from './pages/classTeacher/MarksheetPreview';
import StudentSubjects from './pages/classTeacher/StudentSubjects';
import './style.css';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const ROLE_HOME = {
  ADMIN: '/admin/dashboard',
  SUBJECT_TEACHER: '/teacher/dashboard',
  CLASS_TEACHER: '/class-teacher/dashboard',
};

const ProtectedRoute = ({ children, roles }) => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  if (token && user) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }
  return children;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="teachers" element={<TeacherManagement />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="classes" element={<ClassManagement />} />
          <Route path="sections" element={<SectionManagement />} />
          <Route path="subjects" element={<SubjectManagement />} />
          <Route path="sessions" element={<SessionManagement />} />
          <Route path="assessments" element={<AssessmentManagement />} />
          <Route path="results" element={<ResultsManagement />} />
          <Route path="pdf" element={<PDFGeneration />} />
          <Route path="import" element={<ExcelImport />} />
        </Route>
        <Route
          path="/teacher/*"
          element={
            <ProtectedRoute roles={['SUBJECT_TEACHER', 'CLASS_TEACHER']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="marks" element={<MarksEntry />} />
        </Route>
        <Route
          path="/class-teacher/*"
          element={
            <ProtectedRoute roles={['CLASS_TEACHER', 'SUBJECT_TEACHER']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<ClassTeacherDashboard />} />
          <Route path="attendance" element={<AttendanceManagement />} />
          <Route path="marksheet-preview" element={<ClassTeacherMarksheetPreview />} />
          <Route path="student-subjects" element={<StudentSubjects />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/authService';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await authAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getNavItems = () => {
    if (user.role === 'ADMIN') {
      return [
        { path: '/admin/dashboard', label: 'Dashboard' },
        { path: '/admin/sessions', label: 'Sessions' },
        { path: '/admin/teachers', label: 'Teachers' },
        { path: '/admin/students', label: 'Students' },
        { path: '/admin/classes', label: 'Classes' },
        { path: '/admin/sections', label: 'Sections' },
        { path: '/admin/subjects', label: 'Subjects' },
        { path: '/admin/assessments', label: 'Assessments' },
        { path: '/admin/results', label: 'Results' },
        { path: '/admin/pdf', label: 'PDF Generation' },
        { path: '/admin/import', label: 'Excel Import' },
      ];
    }

    if (user.role === 'SUBJECT_TEACHER') {
      return [
        { path: '/teacher/dashboard', label: 'Dashboard' },
        { path: '/teacher/marks', label: 'Marks Entry' },
      ];
    }

    if (user.role === 'CLASS_TEACHER') {
      return [
        { path: '/class-teacher/dashboard', label: 'Dashboard' },
        { path: '/teacher/marks', label: 'Marks Entry' },
        { path: '/class-teacher/attendance', label: 'Attendance' },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">The New School Dhaka</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.teacherProfile?.fullName || user.email}
              </span>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-screen">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>

      <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm">{passwordError}</div>}
          {passwordMessage && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">{passwordMessage}</div>}
          <Input label="Current Password" type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
          <Input label="New Password" type="password" name="newPassword" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required />
          <Input label="Confirm New Password" type="password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsPasswordModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={passwordLoading}>{passwordLoading ? 'Saving...' : 'Change Password'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

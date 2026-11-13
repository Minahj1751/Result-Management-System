import { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/authService';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  SUBJECT_TEACHER: 'Subject teacher',
  CLASS_TEACHER: 'Class teacher',
};

const NAV_ITEMS = {
  ADMIN: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '⌂' },
    { path: '/admin/sessions', label: 'Sessions', icon: '◷' },
    { path: '/admin/teachers', label: 'Teachers', icon: '♙' },
    { path: '/admin/students', label: 'Students', icon: '♧' },
    { path: '/admin/classes', label: 'Classes', icon: '▦' },
    { path: '/admin/sections', label: 'Sections', icon: '◫' },
    { path: '/admin/subjects', label: 'Subjects', icon: '◇' },
    { path: '/admin/assessments', label: 'Assessments', icon: '✓' },
    { path: '/admin/results', label: 'Results', icon: '▤' },
    { path: '/admin/pdf', label: 'PDF Generation', icon: '▧' },
    { path: '/admin/import', label: 'Excel Import', icon: '⇧' },
  ],
  SUBJECT_TEACHER: [
    { path: '/teacher/dashboard', label: 'Dashboard', icon: '⌂' },
    { path: '/teacher/marks', label: 'Marks Entry', icon: '✓' },
  ],
  CLASS_TEACHER: [
    { path: '/class-teacher/dashboard', label: 'Dashboard', icon: '⌂' },
    { path: '/teacher/marks', label: 'Marks Entry', icon: '✓' },
    { path: '/class-teacher/attendance', label: 'Attendance', icon: '◷' },
  ],
};

export default function MainLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const navItems = NAV_ITEMS[user.role] || [];
  const displayName = user.teacherProfile?.fullName || user.email || 'School user';

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsMobileNavOpen((open) => !open)}
          >
            {isMobileNavOpen ? '×' : '☰'}
          </button>
          <Link className="brand-lockup" to={NAV_ITEMS[user.role]?.[0]?.path || '/login'}>
            <span className="brand-mark" aria-hidden="true">✦</span>
            <span>
              <span className="brand-name block">The New School Dhaka</span>
              <span className="brand-caption block">Result Management System</span>
            </span>
          </Link>
        </div>
        <div className="topbar-actions">
          <div className="profile-summary">
            <span className="profile-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
            <span>
              <span className="profile-name block">{displayName}</span>
              <span className="profile-role block">{ROLE_LABELS[user.role] || 'School user'}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="topbar-button"
          >
            Change password
          </button>
          <button type="button" onClick={handleLogout} className="topbar-button topbar-button-logout">
            Log out
          </button>
        </div>
      </header>

      <div className="workspace">
        {isMobileNavOpen && (
          <button
            type="button"
            className="mobile-nav-scrim"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}
        <aside className={`sidebar ${isMobileNavOpen ? 'sidebar-open' : ''}`}>
          <p className="sidebar-label">Workspace</p>
          <nav id="primary-navigation" className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end
                onClick={() => setIsMobileNavOpen(false)}
                className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
              >
                <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">A brighter way to manage every result.</div>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Change password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm" role="alert">{passwordError}</div>}
          {passwordMessage && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm" role="status">{passwordMessage}</div>}
          <Input label="Current password" type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required autoComplete="current-password" />
          <Input label="New password" type="password" name="newPassword" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required autoComplete="new-password" />
          <Input label="Confirm new password" type="password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required autoComplete="new-password" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsPasswordModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={passwordLoading}>{passwordLoading ? 'Saving...' : 'Change password'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

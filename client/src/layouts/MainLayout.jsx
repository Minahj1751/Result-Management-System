import { Outlet, Link, useLocation } from 'react-router-dom';

export default function MainLayout() {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
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
    </div>
  );
}

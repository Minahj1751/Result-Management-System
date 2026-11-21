import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/authService';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.login(formData.email, formData.password);

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));

      const redirectPath = {
        ADMIN: '/admin/dashboard',
        SUBJECT_TEACHER: '/teacher/dashboard',
        CLASS_TEACHER: '/class-teacher/dashboard',
      }[result.user.role] || '/';

      navigate(redirectPath);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-intro" aria-label="School result management">
        <div className="login-intro-content">
          <div className="login-kicker"><span aria-hidden="true">✦</span> The New School Dhaka</div>
          <h1>Every achievement, in one place.</h1>
          <p className="login-intro-copy">
            A clearer, more connected way for our school community to manage learning,
            celebrate progress, and keep every result moving forward.
          </p>
          <div className="login-feature-list" aria-label="Platform features">
            <span className="login-feature">Student progress</span>
            <span className="login-feature">Assessment insights</span>
            <span className="login-feature">Attendance tracking</span>
          </div>
        </div>
        <div className="login-intro-footer login-intro-content">
          Result Management System · A brighter school day starts here.
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <img src="/Logo.png" alt="The New School Dhaka" className="mb-5 h-16 w-16 object-contain" />
          <h2>Welcome back</h2>
          <p className="login-card-subtitle">Sign in to continue to your school workspace.</p>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm" role="alert">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="ui-field-label">Email address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="username"
                required
                className="ui-input"
                placeholder="your.email@newschooldhaka.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className="ui-field-label">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
                className="ui-input"
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? 'Signing in…' : 'Sign in to workspace'}
            </button>
          </form>

          <div className="demo-credentials">
            <strong>Demo access</strong><br />
            Admin: admin@newschooldhaka.edu / Admin@123<br />
            Teacher: teacher1@newschooldhaka.edu / Teacher@123
          </div>
        </div>
      </section>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function SessionManagement() {
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [isEditSession, setIsEditSession] = useState(false);
  const [isEditSemester, setIsEditSemester] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingSemesterId, setEditingSemesterId] = useState(null);
  const [sessionForm, setSessionForm] = useState({ name: '', startDate: '', endDate: '', isActive: true });
  const [semesterForm, setSemesterForm] = useState({ name: '', academicSessionId: '', startDate: '', endDate: '', isActive: true, visibleToClassTeachers: true, visibleToSubjectTeachers: true });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await academicAPI.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSemesters = async (sessionId) => {
    try {
      const data = await academicAPI.getSemesters(sessionId);
      setSemesters(data);
    } catch (error) {
      console.error('Error loading semesters:', error);
    }
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditSession) {
        await academicAPI.updateSession(editingId, sessionForm);
      } else {
        await academicAPI.createSession(sessionForm);
      }
      setIsSessionModalOpen(false);
      setSessionForm({ name: '', startDate: '', endDate: '', isActive: true });
      setIsEditSession(false);
      setEditingId(null);
      loadSessions();
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error saving session');
    }
  };

  const handleSemesterSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditSemester) {
        await academicAPI.updateSemester(editingSemesterId, semesterForm);
      } else {
        await academicAPI.createSemester(semesterForm);
      }
      setIsSemesterModalOpen(false);
      setSemesterForm({ name: '', academicSessionId: '', startDate: '', endDate: '', isActive: true, visibleToClassTeachers: true, visibleToSubjectTeachers: true });
      setIsEditSemester(false);
      setEditingSemesterId(null);
      loadSemesters(semesterForm.academicSessionId);
    } catch (error) {
      console.error('Error saving semester:', error);
      alert(error.response?.data?.error || 'Error saving semester');
    }
  };

  const handleEditSemester = (semester) => {
    setSemesterForm({
      name: semester.name,
      academicSessionId: semester.academicSessionId,
      startDate: semester.startDate.split('T')[0],
      endDate: semester.endDate.split('T')[0],
      isActive: semester.isActive,
      visibleToClassTeachers: semester.visibleToClassTeachers !== false,
      visibleToSubjectTeachers: semester.visibleToSubjectTeachers !== false,
    });
    setEditingSemesterId(semester.id);
    setIsEditSemester(true);
    setIsSemesterModalOpen(true);
  };

  const handleDeleteSession = async (session) => {
    if (!confirm(`Delete session "${session.name}"? This only works if it has no semesters, enrollments, or assessments.`)) return;
    try {
      await academicAPI.deleteSession(session.id);
      loadSessions();
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting session');
    }
  };

  const handleDeleteSemester = async (semester) => {
    if (!confirm(`Delete semester "${semester.name}"?`)) return;
    try {
      await academicAPI.deleteSemester(semester.id);
      loadSemesters(semester.academicSessionId);
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting semester');
    }
  };

  const handleEditSession = (session) => {
    setSessionForm({
      name: session.name,
      startDate: session.startDate.split('T')[0],
      endDate: session.endDate.split('T')[0],
      isActive: session.isActive,
    });
    setEditingId(session.id);
    setIsEditSession(true);
    setIsSessionModalOpen(true);
  };

  const handleToggleSessionStatus = async (session) => {
    try {
      await academicAPI.updateSession(session.id, { isActive: !session.isActive });
      loadSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      alert('Error updating session status');
    }
  };

  const sessionColumns = [
    { key: 'name', label: 'Session Name' },
    { key: 'startDate', label: 'Start Date', render: (val) => new Date(val).toLocaleDateString() },
    { key: 'endDate', label: 'End Date', render: (val) => new Date(val).toLocaleDateString() },
    {
      key: 'isActive',
      label: 'Status',
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleEditSession(row)}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleToggleSessionStatus(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDeleteSession(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const semesterColumns = [
    { key: 'name', label: 'Semester Name' },
    { key: 'startDate', label: 'Start Date', render: (val) => new Date(val).toLocaleDateString() },
    { key: 'endDate', label: 'End Date', render: (val) => new Date(val).toLocaleDateString() },
    {
      key: 'isActive',
      label: 'Status',
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'visibility',
      label: 'Teacher Visibility',
      render: (val, row) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className={row.visibleToClassTeachers !== false ? 'text-green-700' : 'text-gray-400'}>
            Class Teacher: {row.visibleToClassTeachers !== false ? 'Visible' : 'Hidden'}
          </span>
          <span className={row.visibleToSubjectTeachers !== false ? 'text-green-700' : 'text-gray-400'}>
            Subject Teacher: {row.visibleToSubjectTeachers !== false ? 'Visible' : 'Hidden'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleEditSemester(row)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDeleteSemester(row)}>Delete</Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Academic Session Management</h1>
      
      <Card
        title="Sessions"
        actions={<Button onClick={() => setIsSessionModalOpen(true)}>Add Session</Button>}
      >
        <Table columns={sessionColumns} data={sessions} />
      </Card>

      {sessions.length > 0 && (
        <Card
          title="Semesters"
          actions={
            <Button onClick={() => {
              setSemesterForm({ ...semesterForm, academicSessionId: sessions[0].id });
              setIsSemesterModalOpen(true);
            }} disabled={!sessions[0]?.id}
          >
            Add Semester
          </Button>
          }
          className="mt-6"
        >
          <Select
            placeholder="Select Session to view semesters"
            value={semesterForm.academicSessionId}
            onChange={(e) => loadSemesters(e.target.value)}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
            className="mb-4"
          />
          <Table columns={semesterColumns} data={semesters} emptyMessage="Select a session to view semesters" />
        </Card>
      )}

      {/* Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title={isEditSession ? 'Edit Session' : 'Add Session'}>
        <form onSubmit={handleSessionSubmit} className="space-y-4">
          <Input
            label="Session Name"
            name="name"
            value={sessionForm.name}
            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            required
          />
          <Input
            label="Start Date"
            type="date"
            name="startDate"
            value={sessionForm.startDate}
            onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
            required
          />
          <Input
            label="End Date"
            type="date"
            name="endDate"
            value={sessionForm.endDate}
            onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
            required
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={sessionForm.isActive}
              onChange={(e) => setSessionForm({ ...sessionForm, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditSession ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Semester Modal */}
      <Modal isOpen={isSemesterModalOpen} onClose={() => setIsSemesterModalOpen(false)} title={isEditSemester ? 'Edit Semester' : 'Add Semester'}>
        <form onSubmit={handleSemesterSubmit} className="space-y-4">
          <Select
            label="Session"
            value={semesterForm.academicSessionId}
            onChange={(e) => setSemesterForm({ ...semesterForm, academicSessionId: e.target.value })}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
            required
            disabled={isEditSemester}
          />
          <Input
            label="Semester Name"
            name="name"
            value={semesterForm.name}
            onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })}
            required
          />
          <Input
            label="Start Date"
            type="date"
            name="startDate"
            value={semesterForm.startDate}
            onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
            required
          />
          <Input
            label="End Date"
            type="date"
            name="endDate"
            value={semesterForm.endDate}
            onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
            required
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={semesterForm.isActive}
              onChange={(e) => setSemesterForm({ ...semesterForm, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="border-t border-gray-200 pt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Teacher Visibility</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={semesterForm.visibleToClassTeachers}
                  onChange={(e) => setSemesterForm({ ...semesterForm, visibleToClassTeachers: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                Visible to Class Teachers
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={semesterForm.visibleToSubjectTeachers}
                  onChange={(e) => setSemesterForm({ ...semesterForm, visibleToSubjectTeachers: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                Visible to Subject Teachers
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsSemesterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditSemester ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

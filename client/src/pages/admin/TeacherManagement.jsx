import { useState, useEffect } from 'react';
import { teacherAPI } from '../../api/teacherService';
import { academicAPI } from '../../api/academicService';
import { authAPI } from '../../api/authService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

const emptyForm = { email: '', password: '', fullName: '', role: 'SUBJECT_TEACHER', employeeId: '', phone: '', designation: '' };
const emptyAssignment = { teacherId: '', subjectId: '', academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', startDate: new Date().toISOString().split('T')[0] };
const emptyClassAssignment = { teacherId: '', academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', startDate: new Date().toISOString().split('T')[0] };

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [classAssignments, setClassAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isClassAssignModalOpen, setIsClassAssignModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [classAssignmentForm, setClassAssignmentForm] = useState(emptyClassAssignment);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [teachersData, sa, ca, sessionsData, classesData, subjectsData] = await Promise.all([
        teacherAPI.getTeachers(),
        teacherAPI.getTeacherAssignments(),
        teacherAPI.getClassTeacherAssignments(),
        academicAPI.getSessions(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
      ]);
      setTeachers(teachersData);
      setSubjectAssignments(sa);
      setClassAssignments(ca);
      setSessions(sessionsData);
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSemesters = async (sid) => setSemesters(sid ? await academicAPI.getSemesters(sid) : []);
  const loadSections = async (cid) => setSections(cid ? await academicAPI.getSections(cid) : []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        const { email, password, role, ...profile } = formData;
        await teacherAPI.updateTeacher(editingId, { ...profile, isActive: undefined });
      } else {
        await teacherAPI.createTeacher(formData);
      }
      setIsModalOpen(false);
      setFormData(emptyForm);
      setIsEdit(false);
      setEditingId(null);
      loadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving teacher');
    }
  };

  const handleEdit = (teacher) => {
    setFormData({
      email: teacher.email,
      password: '',
      fullName: teacher.teacherProfile?.fullName || '',
      role: teacher.role,
      employeeId: teacher.teacherProfile?.employeeId || '',
      phone: teacher.teacherProfile?.phone || '',
      designation: teacher.teacherProfile?.designation || '',
    });
    setEditingId(teacher.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (teacher) => {
    try {
      await authAPI.toggleAccountStatus(teacher.id, !teacher.isActive);
      loadAll();
    } catch (error) {
      alert('Error updating teacher status');
    }
  };

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    try {
      await teacherAPI.createTeacherAssignment(assignmentForm);
      setIsAssignModalOpen(false);
      setAssignmentForm(emptyAssignment);
      loadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating assignment');
    }
  };

  const handleClassAssignmentSubmit = async (e) => {
    e.preventDefault();
    try {
      await teacherAPI.createClassTeacherAssignment(classAssignmentForm);
      setIsClassAssignModalOpen(false);
      setClassAssignmentForm(emptyClassAssignment);
      loadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating class teacher assignment');
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      await teacherAPI.updateTeacherAssignment(id, { isActive: false });
      loadAll();
    } catch (error) {
      alert('Error removing assignment');
    }
  };

  const handleDeleteClassAssignment = async (id) => {
    if (!confirm('Delete this class teacher assignment?')) return;
    try {
      await teacherAPI.updateClassTeacherAssignment(id, { isActive: false });
      loadAll();
    } catch (error) {
      alert('Error removing assignment');
    }
  };

  const teacherName = (id) => teachers.find((t) => t.teacherProfile?.id === id)?.teacherProfile?.fullName || id;

  const teacherColumns = [
    { key: 'email', label: 'Email' },
    { key: 'fullName', label: 'Full Name', render: (v, row) => row.teacherProfile?.fullName },
    { key: 'role', label: 'Role', render: (v) => v === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher' },
    { key: 'employeeId', label: 'Emp ID', render: (v, row) => row.teacherProfile?.employeeId || '-' },
    { key: 'phone', label: 'Phone', render: (v, row) => row.teacherProfile?.phone || '-' },
    {
      key: 'isActive', label: 'Status',
      render: (val) => <span className={`px-2 py-1 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{val ? 'Active' : 'Inactive'}</span>,
    },
    {
      key: 'actions', label: 'Actions',
      render: (v, row) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleEdit(row)}>Edit</Button>
          <Button size="sm" variant={row.isActive ? 'secondary' : 'success'} onClick={() => handleToggleStatus(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  const assignmentColumns = [
    { key: 'teacherId', label: 'Teacher', render: (v) => teacherName(v) },
    { key: 'subject', label: 'Subject', render: (v, row) => row.subject?.name },
    { key: 'schoolClass', label: 'Class', render: (v, row) => `${row.schoolClass?.name} - ${row.section?.name}` },
    { key: 'semester', label: 'Semester', render: (v, row) => `${row.semester?.name} (${row.academicSession?.name})` },
    { key: 'isActive', label: 'Status', render: (v) => <span className={`px-2 py-1 rounded-full text-xs ${v ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: 'Actions', render: (v, row) => row.isActive && <Button size="sm" variant="danger" onClick={() => handleDeleteAssignment(row.id)}>Remove</Button> },
  ];

  const classAssignmentColumns = [
    { key: 'teacherId', label: 'Teacher', render: (v) => teacherName(v) },
    { key: 'schoolClass', label: 'Class', render: (v, row) => `${row.schoolClass?.name} - ${row.section?.name}` },
    { key: 'semester', label: 'Semester', render: (v, row) => `${row.semester?.name} (${row.academicSession?.name})` },
    { key: 'isActive', label: 'Status', render: (v) => <span className={`px-2 py-1 rounded-full text-xs ${v ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: 'Actions', render: (v, row) => row.isActive && <Button size="sm" variant="danger" onClick={() => handleDeleteClassAssignment(row.id)}>Remove</Button> },
  ];

  const assignmentFields = (form, setForm, isClassTeacher) => (
    <>
      <Select label="Teacher" value={form.teacherId} required onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
        options={teachers.filter((t) => t.teacherProfile).map((t) => ({ value: t.teacherProfile.id, label: `${t.teacherProfile.fullName} (${t.email})` }))} />
      <Select label="Session" value={form.academicSessionId} required onChange={async (e) => { setForm({ ...form, academicSessionId: e.target.value, semesterId: '' }); await loadSemesters(e.target.value); }}
        options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
      <Select label="Semester" value={form.semesterId} required onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
        options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
      <Select label="Class" value={form.schoolClassId} required onChange={async (e) => { setForm({ ...form, schoolClassId: e.target.value, sectionId: '' }); await loadSections(e.target.value); }}
        options={classes.map((c) => ({ value: c.id, label: c.name }))} />
      <Select label="Section" value={form.sectionId} required onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
        options={sections.map((s) => ({ value: s.id, label: s.name }))} />
      {!isClassTeacher && (
        <Select label="Subject" value={form.subjectId} required onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
          options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
      )}
      <Input label="Start Date" type="date" value={form.startDate} required onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setIsAssignModalOpen(false); setIsClassAssignModalOpen(false); }}>Cancel</Button>
        <Button type="submit">Assign</Button>
      </div>
    </>
  );

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teacher Management</h1>

      <Card title="Teachers" actions={<Button onClick={() => { setIsEdit(false); setFormData(emptyForm); setIsModalOpen(true); }}>Add Teacher</Button>} className="mb-6">
        <Table columns={teacherColumns} data={teachers} />
      </Card>

      <Card title="Subject Assignments" actions={<Button onClick={() => { setAssignmentForm(emptyAssignment); setIsAssignModalOpen(true); }}>Add Assignment</Button>} className="mb-6">
        <Table columns={assignmentColumns} data={subjectAssignments} emptyMessage="No assignments" />
      </Card>

      <Card title="Class Teacher Assignments" actions={<Button onClick={() => { setClassAssignmentForm(emptyClassAssignment); setIsClassAssignModalOpen(true); }}>Assign Class Teacher</Button>}>
        <Table columns={classAssignmentColumns} data={classAssignments} emptyMessage="No class teacher assignments" />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Teacher' : 'Add Teacher'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" name="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isEdit} />
          {!isEdit && <Input label="Password" type="password" name="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />}
          <Input label="Full Name" name="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
          <Select label="Role" name="role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={[{ value: 'SUBJECT_TEACHER', label: 'Subject Teacher' }, { value: 'CLASS_TEACHER', label: 'Class Teacher' }]} required disabled={isEdit} />
          <Input label="Employee ID" name="employeeId" value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
          <Input label="Phone" name="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          <Input label="Designation" name="designation" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Add Subject Assignment">
        <form onSubmit={handleAssignmentSubmit} className="space-y-4">{assignmentFields(assignmentForm, setAssignmentForm, false)}</form>
      </Modal>

      <Modal isOpen={isClassAssignModalOpen} onClose={() => setIsClassAssignModalOpen(false)} title="Assign Class Teacher">
        <form onSubmit={handleClassAssignmentSubmit} className="space-y-4">{assignmentFields(classAssignmentForm, setClassAssignmentForm, true)}</form>
      </Modal>
    </div>
  );
}

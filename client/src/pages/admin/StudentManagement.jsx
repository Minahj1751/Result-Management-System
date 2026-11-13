import { useState, useEffect } from 'react';
import { studentAPI } from '../../api/studentService';
import { academicAPI } from '../../api/academicService';
import { exportAPI } from '../../api/exportService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

const emptyStudent = { studentId: '', admissionNumber: '', fullName: '', dateOfBirth: '', guardianName: '', guardianPhone: '' };
const emptyEnrollment = { studentId: '', academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', rollNumber: '' };

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [enrollingStudent, setEnrollingStudent] = useState(null);
  const [filter, setFilter] = useState({ search: '', academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '' });
  const [formData, setFormData] = useState(emptyStudent);
  const [enrollmentForm, setEnrollmentForm] = useState(emptyEnrollment);

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { loadData(); }, [filter.academicSessionId, filter.semesterId, filter.schoolClassId, filter.sectionId]);

  const loadInitial = async () => {
    try {
      const [sessionsData, classesData] = await Promise.all([academicAPI.getSessions(), academicAPI.getClasses()]);
      setSessions(sessionsData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== ''));
      const data = await studentAPI.getStudents(params);
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const handleSessionFilter = async (academicSessionId) => {
    setFilter((f) => ({ ...f, academicSessionId, semesterId: '' }));
    setSemesters(academicSessionId ? await academicAPI.getSemesters(academicSessionId) : []);
  };

  const handleClassFilter = async (schoolClassId) => {
    setFilter((f) => ({ ...f, schoolClassId, sectionId: '' }));
    setSections(schoolClassId ? await academicAPI.getSections(schoolClassId) : []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        const { studentId, admissionNumber, dateOfBirth, ...rest } = formData;
        await studentAPI.updateStudent(editingId, {
          ...rest,
          ...(dateOfBirth ? { dateOfBirth } : {}),
        });
      } else {
        await studentAPI.createStudent(formData);
      }
      setIsModalOpen(false);
      setFormData(emptyStudent);
      setIsEdit(false);
      setEditingId(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving student');
    }
  };

  const handleEdit = (student) => {
    setFormData({
      studentId: student.studentId,
      admissionNumber: student.admissionNumber || '',
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth?.split('T')[0] || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
    });
    setEditingId(student.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (student) => {
    try {
      await studentAPI.updateStudent(student.id, { isActive: !student.isActive });
      loadData();
    } catch (error) {
      alert('Error updating student status');
    }
  };

  const openEnrollment = async (student) => {
    setEnrollingStudent(student);
    setEnrollmentForm({ ...emptyEnrollment, studentId: student.id });
    const [sems, secs] = await Promise.all([
      enrollmentForm.academicSessionId ? academicAPI.getSemesters(enrollmentForm.academicSessionId) : Promise.resolve([]),
      Promise.resolve([]),
    ]);
    setSemesters(sems);
    setSections(secs);
    setIsEnrollmentModalOpen(true);
  };

  const handleEnrollmentSubmit = async (e) => {
    e.preventDefault();
    try {
      await studentAPI.createEnrollment({
        ...enrollmentForm,
        rollNumber: parseInt(enrollmentForm.rollNumber),
      });
      setIsEnrollmentModalOpen(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating enrollment');
    }
  };

  const handleExport = async () => {
    try {
      await exportAPI.students(cleanParams(filter));
    } catch (error) {
      alert('Error exporting students');
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'admissionNumber', label: 'Admission No', render: (v) => v || '-' },
    {
      key: 'enrollment', label: 'Class',
      render: (val, row) => {
        const e = (row.enrollments || [])[0];
        return e ? `${e.schoolClass?.name} - ${e.section?.name} (Roll ${e.rollNumber})` : '-';
      },
    },
    { key: 'guardianName', label: 'Guardian', render: (v) => v || '-' },
    { key: 'guardianPhone', label: 'Phone', render: (v) => v || '-' },
    {
      key: 'isActive', label: 'Status',
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      render: (val, row) => (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => handleEdit(row)}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => openEnrollment(row)}>Enroll</Button>
          <Button size="sm" variant={row.isActive ? 'secondary' : 'success'} onClick={() => handleToggleStatus(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Student Management</h1>

      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Input placeholder="Search name / ID..." value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && loadData()} />
          <Select placeholder="Session" value={filter.academicSessionId} onChange={(e) => handleSessionFilter(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Class" value={filter.schoolClassId} onChange={(e) => handleClassFilter(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
          <div className="flex gap-2">
            <Button onClick={loadData}>Search</Button>
            <Button variant="secondary" onClick={handleExport}>Export</Button>
          </div>
        </div>
      </Card>

      <Card title="Students" actions={<Button onClick={() => { setIsEdit(false); setFormData(emptyStudent); setIsModalOpen(true); }}>Add Student</Button>}>
        {loading ? <div className="text-center py-8">Loading...</div> : <Table columns={columns} data={students} />}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Student' : 'Add Student'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Student ID" name="studentId" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} required disabled={isEdit} />
          <Input label="Admission Number" name="admissionNumber" value={formData.admissionNumber} onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })} />
          <Input label="Full Name" name="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
          <Input label="Date of Birth" type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
          <Input label="Guardian Name" name="guardianName" value={formData.guardianName} onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })} />
          <Input label="Guardian Phone" name="guardianPhone" value={formData.guardianPhone} onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEnrollmentModalOpen} onClose={() => setIsEnrollmentModalOpen(false)} title={`Enroll ${enrollingStudent?.fullName || ''}`}>
        <form onSubmit={handleEnrollmentSubmit} className="space-y-4">
          <Select label="Session" value={enrollmentForm.academicSessionId} required
            onChange={async (e) => {
              const sid = e.target.value;
              setEnrollmentForm({ ...enrollmentForm, academicSessionId: sid, semesterId: '' });
              setSemesters(sid ? await academicAPI.getSemesters(sid) : []);
            }}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Semester" value={enrollmentForm.semesterId} required
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, semesterId: e.target.value })}
            options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Class" value={enrollmentForm.schoolClassId} required
            onChange={async (e) => {
              const cid = e.target.value;
              setEnrollmentForm({ ...enrollmentForm, schoolClassId: cid, sectionId: '' });
              setSections(cid ? await academicAPI.getSections(cid) : []);
            }}
            options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Section" value={enrollmentForm.sectionId} required
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, sectionId: e.target.value })}
            options={sections.map((s) => ({ value: s.id, label: s.name }))} />
          <Input label="Roll Number" type="number" name="rollNumber" value={enrollmentForm.rollNumber} required
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, rollNumber: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsEnrollmentModalOpen(false)}>Cancel</Button>
            <Button type="submit">Enroll</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

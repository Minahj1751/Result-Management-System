import { useState, useEffect } from 'react';
import { studentAPI } from '../../api/studentService';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState({ search: '', academicSessionId: '', schoolClassId: '' });
  const [formData, setFormData] = useState({
    studentId: '',
    admissionNumber: '',
    fullName: '',
    guardianName: '',
    guardianPhone: '',
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentsData, sessionsData, classesData] = await Promise.all([
        studentAPI.getStudents(filter),
        academicAPI.getSessions(),
        academicAPI.getClasses(),
      ]);
      setStudents(studentsData.students || studentsData);
      setSessions(sessionsData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = async (schoolClassId) => {
    setFilter({ ...filter, schoolClassId });
    if (schoolClassId) {
      const sectionsData = await academicAPI.getSections(schoolClassId);
      setSections(sectionsData);
    } else {
      setSections([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await studentAPI.updateStudent(editingId, formData);
      } else {
        await studentAPI.createStudent(formData);
      }
      setIsModalOpen(false);
      setFormData({
        studentId: '',
        admissionNumber: '',
        fullName: '',
        guardianName: '',
        guardianPhone: '',
      });
      setIsEdit(false);
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Error saving student:', error);
      alert('Error saving student');
    }
  };

  const handleEdit = (student) => {
    setFormData({
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
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
      console.error('Error updating student:', error);
      alert('Error updating student status');
    }
  };

  const handleDelete = async (studentId) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await studentAPI.updateStudent(studentId, { isActive: false });
      loadData();
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Error deleting student');
    }
  };

  const columns = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'admissionNumber', label: 'Admission No' },
    { key: 'guardianName', label: 'Guardian' },
    { key: 'guardianPhone', label: 'Guardian Phone' },
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
          <Button size="sm" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleToggleStatus(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Student Management</h1>
      
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search by name or ID..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <Select
            placeholder="Select Session"
            value={filter.academicSessionId}
            onChange={(e) => setFilter({ ...filter, academicSessionId: e.target.value })}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="Select Class"
            value={filter.schoolClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Button onClick={loadData}>Search</Button>
        </div>
      </Card>

      <Card
        title="Students"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>Add Student</Button>
        }
      >
        <Table columns={columns} data={students} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Student' : 'Add Student'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Student ID"
            name="studentId"
            value={formData.studentId}
            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
            required
            disabled={isEdit}
          />
          <Input
            label="Admission Number"
            name="admissionNumber"
            value={formData.admissionNumber}
            onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
            required
          />
          <Input
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />
          <Input
            label="Guardian Name"
            name="guardianName"
            value={formData.guardianName}
            onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
          />
          <Input
            label="Guardian Phone"
            name="guardianPhone"
            value={formData.guardianPhone}
            onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

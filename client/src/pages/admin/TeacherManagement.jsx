import { useState, useEffect } from 'react';
import { teacherAPI } from '../../api/teacherService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'SUBJECT_TEACHER',
    employeeId: '',
    phone: '',
    designation: '',
  });

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const data = await teacherAPI.getTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await teacherAPI.updateTeacher(editingId, formData);
      } else {
        await teacherAPI.createTeacher(formData);
      }
      setIsModalOpen(false);
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'SUBJECT_TEACHER',
        employeeId: '',
        phone: '',
        designation: '',
      });
      setIsEdit(false);
      setEditingId(null);
      loadTeachers();
    } catch (error) {
      console.error('Error saving teacher:', error);
      alert('Error saving teacher');
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
      await teacherAPI.updateTeacher(teacher.id, { isActive: !teacher.isActive });
      loadTeachers();
    } catch (error) {
      console.error('Error updating teacher:', error);
      alert('Error updating teacher status');
    }
  };

  const handleDelete = async (teacherId) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    try {
      await teacherAPI.updateTeacher(teacherId, { isActive: false });
      loadTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      alert('Error deleting teacher');
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'fullName', label: 'Full Name', render: (val, row) => row.teacherProfile?.fullName },
    { key: 'role', label: 'Role' },
    { key: 'employeeId', label: 'Employee ID', render: (val, row) => row.teacherProfile?.employeeId },
    { key: 'phone', label: 'Phone', render: (val, row) => row.teacherProfile?.phone },
    { key: 'designation', label: 'Designation', render: (val, row) => row.teacherProfile?.designation },
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teacher Management</h1>
      <Card
        title="Teachers"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>Add Teacher</Button>
        }
      >
        <Table columns={columns} data={teachers} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Teacher' : 'Add Teacher'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            name="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={isEdit}
          />
          {!isEdit && (
            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          )}
          <Input
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />
          <Select
            label="Role"
            name="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={[
              { value: 'SUBJECT_TEACHER', label: 'Subject Teacher' },
              { value: 'CLASS_TEACHER', label: 'Class Teacher' },
            ]}
            required
          />
          <Input
            label="Employee ID"
            name="employeeId"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
          />
          <Input
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Designation"
            name="designation"
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
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

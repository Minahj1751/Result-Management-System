import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Table from '../../components/Table';

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', sortOrder: 0 });

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await academicAPI.getClasses();
      setClasses(data);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await academicAPI.updateClass(editingId, formData);
      } else {
        await academicAPI.createClass(formData);
      }
      setIsModalOpen(false);
      setFormData({ name: '', sortOrder: 0 });
      setIsEdit(false);
      setEditingId(null);
      loadClasses();
    } catch (error) {
      console.error('Error saving class:', error);
      alert('Error saving class');
    }
  };

  const handleEdit = (classItem) => {
    setFormData({
      name: classItem.name,
      sortOrder: classItem.sortOrder,
    });
    setEditingId(classItem.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (classId) => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      alert('Delete functionality requires backend implementation');
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Error deleting class');
    }
  };

  const columns = [
    { key: 'name', label: 'Class Name' },
    { key: 'sortOrder', label: 'Sort Order' },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleEdit(row)}>
            Edit
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Class Management</h1>
      <Card
        title="Classes"
        actions={<Button onClick={() => setIsModalOpen(true)}>Add Class</Button>}
      >
        <Table columns={columns} data={classes} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Class' : 'Add Class'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Class Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Sort Order"
            type="number"
            name="sortOrder"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
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

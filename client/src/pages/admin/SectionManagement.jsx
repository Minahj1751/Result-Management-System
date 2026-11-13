import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function SectionManagement() {
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState({ schoolClassId: '' });
  const [formData, setFormData] = useState({ name: '', schoolClassId: '' });

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (filter.schoolClassId) {
      loadSections();
    }
  }, [filter]);

  const loadClasses = async () => {
    try {
      const data = await academicAPI.getClasses();
      setClasses(data);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadSections = async () => {
    try {
      setLoading(true);
      const data = await academicAPI.getSections(filter.schoolClassId);
      setSections(data);
    } catch (error) {
      console.error('Error loading sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await academicAPI.createSection(formData);
      setIsModalOpen(false);
      setFormData({ name: '', schoolClassId: '' });
      setIsEdit(false);
      setEditingId(null);
      loadSections();
    } catch (error) {
      console.error('Error saving section:', error);
      alert('Error saving section');
    }
  };

  const handleEdit = (section) => {
    setFormData({
      name: section.name,
      schoolClassId: section.schoolClassId,
    });
    setEditingId(section.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    try {
      alert('Delete functionality requires backend implementation');
    } catch (error) {
      console.error('Error deleting section:', error);
      alert('Error deleting section');
    }
  };

  const columns = [
    { key: 'name', label: 'Section Name' },
    { key: 'schoolClass', label: 'Class', render: (val, row) => row.schoolClass?.name },
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Section Management</h1>
      
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            placeholder="Select Class"
            value={filter.schoolClassId}
            onChange={(e) => setFilter({ schoolClassId: e.target.value })}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </Card>

      <Card
        title="Sections"
        actions={<Button onClick={() => setIsModalOpen(true)} disabled={!filter.schoolClassId}>Add Section</Button>}
      >
        <Table columns={columns} data={sections} emptyMessage="Select a class to view sections" />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Section' : 'Add Section'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Class"
            value={formData.schoolClassId}
            onChange={(e) => setFormData({ ...formData, schoolClassId: e.target.value })}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            required
            disabled={isEdit}
          />
          <Input
            label="Section Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
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

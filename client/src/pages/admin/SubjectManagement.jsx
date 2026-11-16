import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { exportAPI } from '../../api/exportService';
import { importAPI } from '../../api/importService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import MultiSelect from '../../components/MultiSelect';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', sortOrder: 0 });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [isClassSubjectOpen, setIsClassSubjectOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await academicAPI.getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Error loading subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await academicAPI.updateSubject(editingId, formData);
      } else {
        await academicAPI.createSubject(formData);
      }
      setIsModalOpen(false);
      setFormData({ name: '', code: '', sortOrder: 0 });
      setIsEdit(false);
      setEditingId(null);
      loadSubjects();
    } catch (error) {
      console.error('Error saving subject:', error);
      alert('Error saving subject');
    }
  };

  const handleEdit = (subject) => {
    setFormData({
      name: subject.name,
      code: subject.code,
      sortOrder: subject.sortOrder,
    });
    setEditingId(subject.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleExportSubjects = async () => {
    try {
      await exportAPI.subjects();
    } catch (error) {
      alert('Error exporting subjects');
    }
  };

  const resetImport = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportMessage('');
    setImportLoading(false);
  };

  const handleImportPreview = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportMessage('');
    try {
      const data = await importAPI.previewSubjects(importFile);
      setImportPreview(data);
    } catch (error) {
      setImportMessage(error.response?.data?.error || 'Error reading file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmSubjectImport = async () => {
    if (!importPreview?.validation?.validRows?.length) return;
    setImportLoading(true);
    setImportMessage('');
    try {
      const rows = importPreview.validation.validRows.map((r) => r.data);
      const data = await importAPI.confirmSubjects(rows);
      setImportMessage(`Import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
      setImportPreview(null);
      setImportFile(null);
      loadSubjects();
    } catch (error) {
      setImportMessage(error.response?.data?.error || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const openClassSubjects = async () => {
    try {
      const [classesData, mappings] = await Promise.all([
        academicAPI.getClasses(),
        academicAPI.getClassSubjects(),
      ]);
      setClasses(classesData);
      setClassSubjects(mappings);
      setSelectedClassId('');
      setSelectedSubjectIds([]);
      setIsClassSubjectOpen(true);
    } catch (error) {
      console.error('Error loading class subjects:', error);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    const mapped = classSubjects.filter((m) => m.schoolClassId === classId).map((m) => m.subjectId);
    setSelectedSubjectIds(mapped);
  };

  const handleSaveClassSubjects = async () => {
    try {
      const mappings = await academicAPI.setClassSubjects(selectedClassId, selectedSubjectIds);
      setClassSubjects((prev) => [
        ...prev.filter((m) => m.schoolClassId !== selectedClassId),
        ...mappings,
      ]);
      alert('Class subjects saved');
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving class subjects');
    }
  };

  const handleDelete = async (subjectId) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await academicAPI.deleteSubject(subjectId);
      loadSubjects();
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting subject');
    }
  };

  const columns = [
    { key: 'name', label: 'Subject Name' },
    { key: 'code', label: 'Code' },
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subject Management</h1>
      <Card
        title="Subjects"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openClassSubjects}>Class Subjects</Button>
            <Button variant="secondary" onClick={() => { resetImport(); setIsImportModalOpen(true); }}>Import</Button>
            <Button variant="secondary" onClick={handleExportSubjects}>Export</Button>
            <Button onClick={() => setIsModalOpen(true)}>Add Subject</Button>
          </div>
        }
      >
        <Table columns={columns} data={subjects} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEdit ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Subject Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Code"
            name="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
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

      <Modal isOpen={isImportModalOpen} onClose={resetImport} title="Import Subjects from Excel">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {importMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">{importMessage}</div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Step 1: Download Template</h3>
            <p className="text-xs text-gray-500 mb-2">Download the Excel template and fill it with subject data.</p>
            <Button size="sm" variant="secondary" onClick={() => importAPI.downloadSubjectTemplate()}>Download Template</Button>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Step 2: Upload File</h3>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => { setImportFile(e.target.files[0] || null); setImportPreview(null); setImportMessage(''); }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>
          {importFile && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Step 3: Preview</h3>
              <Button size="sm" onClick={handleImportPreview} disabled={importLoading}>{importLoading ? 'Loading...' : 'Preview Import'}</Button>
            </div>
          )}
          {importPreview && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 p-3 rounded"><p className="text-xs text-gray-600">Total Rows</p><p className="text-xl font-bold text-blue-600">{importPreview.validation.totalRows}</p></div>
                <div className="bg-green-50 p-3 rounded"><p className="text-xs text-gray-600">Valid Rows</p><p className="text-xl font-bold text-green-600">{importPreview.validation.validRows.length}</p></div>
                <div className="bg-red-50 p-3 rounded"><p className="text-xs text-gray-600">Invalid Rows</p><p className="text-xl font-bold text-red-600">{importPreview.validation.invalidRows.length}</p></div>
              </div>
              {importPreview.validation.invalidRows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Invalid Rows:</h4>
                  <div className="max-h-40 overflow-y-auto">
                    {importPreview.validation.invalidRows.map((row, idx) => (
                      <div key={idx} className="text-xs text-red-600 mb-1">Row {row.rowNumber}: {row.errors.join(', ')}</div>
                    ))}
                  </div>
                </div>
              )}
              {importPreview.validation.validRows.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={handleConfirmSubjectImport} disabled={importLoading}>{importLoading ? 'Importing...' : 'Confirm Import'}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isClassSubjectOpen} onClose={() => setIsClassSubjectOpen(false)} title="Class-wise Subject Selection">
        <div className="space-y-4">
          <Select label="Class" value={selectedClassId} required
            onChange={(e) => handleClassChange(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          {selectedClassId && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subjects for this class</label>
                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubjectIds.includes(s.id)}
                        onChange={(e) => setSelectedSubjectIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )}
                        className="w-4 h-4 text-blue-600"
                      />
                      {s.name}{s.code ? ` (${s.code})` : ''}
                    </label>
                  ))}
                  {subjects.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">No subjects found</p>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{selectedSubjectIds.length} subject(s) selected</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsClassSubjectOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveClassSubjects} disabled={selectedSubjectIds.length === 0}>Save</Button>
              </div>
            </>
          )}
          {classSubjects.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Current Mapping</h4>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {classes.map((c) => {
                  const names = classSubjects.filter((m) => m.schoolClassId === c.id).map((m) => m.subject?.name).filter(Boolean);
                  if (names.length === 0) return null;
                  return <div key={c.id} className="text-sm"><span className="font-medium">{c.name}:</span> {names.join(', ')}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

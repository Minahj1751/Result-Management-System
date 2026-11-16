import { useState, useEffect, useCallback } from 'react';
import { studentAPI } from '../../api/studentService';
import { academicAPI } from '../../api/academicService';
import { exportAPI } from '../../api/exportService';
import { importAPI } from '../../api/importService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import SearchInput from '../../components/SearchInput';
import Select from '../../components/Select';
import Table from '../../components/Table';
import BulkActionToolbar from '../../components/BulkActionToolbar';
import ConfirmDialog from '../../components/ConfirmDialog';

const emptyStudent = { studentId: '', admissionNumber: '', fullName: '', dateOfBirth: '', guardianName: '', guardianPhone: '' };

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState({ search: '', academicSessionId: '', schoolClassId: '', sectionId: '' });
  const [formData, setFormData] = useState(emptyStudent);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(null); // 'activate' | 'deactivate'
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { loadData(1); }, [filter.academicSessionId, filter.schoolClassId, filter.sectionId]);
  useEffect(() => { setSelectedIds(new Set()); }, [filter, pagination.page, pagination.limit]);

  const loadInitial = async () => {
    try {
      const [sessionsData, classesData] = await Promise.all([academicAPI.getSessions(), academicAPI.getClasses()]);
      setSessions(sessionsData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const loadData = useCallback(async (pageOverride, limitOverride) => {
    try {
      setLoading(true);
      const params = cleanParams({
        ...filter,
        page: pageOverride ?? pagination.page,
        limit: limitOverride ?? pagination.limit,
      });
      const data = await studentAPI.getStudents(params);
      setStudents(data.students || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, pagination.page, pagination.limit]);

  const handleSearch = (search) => {
    setFilter((f) => ({ ...f, search }));
  };

  const handleSessionFilter = (academicSessionId) => {
    setFilter((f) => ({ ...f, academicSessionId }));
  };

  const handleClassFilter = async (schoolClassId) => {
    setFilter((f) => ({ ...f, schoolClassId, sectionId: '' }));
    setSections(schoolClassId ? await academicAPI.getSections(schoolClassId) : []);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPageSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        const next = new Set(prev);
        students.forEach((s) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      students.forEach((s) => next.add(s.id));
      return next;
    });
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
      const data = await importAPI.preview(importFile);
      setImportPreview(data);
    } catch (error) {
      setImportMessage(error.response?.data?.error || 'Error reading file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.validation?.validRows?.length) return;
    setImportLoading(true);
    setImportMessage('');
    try {
      const rows = importPreview.validation.validRows.map((r) => r.data);
      const data = await importAPI.confirm(rows);
      setImportMessage(`Import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
      setImportPreview(null);
      setImportFile(null);
      loadData(1);
    } catch (error) {
      setImportMessage(error.response?.data?.error || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportAPI.students(cleanParams({
        ...filter,
        ids: selectedIds.size > 0 ? [...selectedIds].join(',') : undefined,
      }));
    } catch (error) {
      alert('Error exporting students');
    }
  };

  const handleBulkStatus = async () => {
    try {
      const result = await studentAPI.bulkUpdateStatus([...selectedIds], bulkConfirm === 'activate');
      alert(`Updated ${result.updated} student(s)`);
      setSelectedIds(new Set());
      setBulkConfirm(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating students');
    }
  };

  const columns = [
    {
      key: 'select', label: '',
      render: (val, row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="w-4 h-4 text-blue-600" />
      ),
    },
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SearchInput placeholder="Search name / ID..." value={filter.search} onSearch={handleSearch} />
          <Select placeholder="Session" value={filter.academicSessionId} onChange={(e) => handleSessionFilter(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Class" value={filter.schoolClassId} onChange={(e) => handleClassFilter(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport}>
              {selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export All'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Students" actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { resetImport(); setIsImportModalOpen(true); }}>Import</Button>
          <Button onClick={() => { setIsEdit(false); setFormData(emptyStudent); setIsModalOpen(true); }}>Add Student</Button>
        </div>
      }>
        {loading ? <div className="text-center py-8">Loading...</div> : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-gray-600 inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600" />
                Select all on this page
              </label>
            </div>
            <Table columns={columns} data={students} emptyMessage="No students match the current filters" />
            <Pagination
              pagination={pagination}
              onPageChange={(p) => loadData(p)}
              onLimitChange={(l) => loadData(1, l)}
            />
          </>
        )}
      </Card>

      <BulkActionToolbar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button size="sm" variant="success" onClick={() => setBulkConfirm('activate')}>Activate</Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkConfirm('deactivate')}>Deactivate</Button>
      </BulkActionToolbar>

      <ConfirmDialog
        isOpen={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={handleBulkStatus}
        title={bulkConfirm === 'activate' ? 'Activate Students' : 'Deactivate Students'}
        message={`${bulkConfirm === 'activate' ? 'Activate' : 'Deactivate'} ${selectedIds.size} selected student(s)?`}
        confirmLabel={bulkConfirm === 'activate' ? 'Activate' : 'Deactivate'}
        danger={bulkConfirm === 'deactivate'}
      />

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

      <Modal isOpen={isImportModalOpen} onClose={resetImport} title="Import Students from Excel">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {importMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">{importMessage}</div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Step 1: Download Template</h3>
            <p className="text-xs text-gray-500 mb-2">Download the Excel template and fill it with student data.</p>
            <Button size="sm" variant="secondary" onClick={() => importAPI.downloadTemplate()}>Download Template</Button>
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
                  <Button onClick={handleConfirmImport} disabled={importLoading}>{importLoading ? 'Importing...' : 'Confirm Import'}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

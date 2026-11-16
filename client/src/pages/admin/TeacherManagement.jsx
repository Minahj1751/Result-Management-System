import { useState, useEffect, useCallback } from 'react';
import { teacherAPI } from '../../api/teacherService';
import { academicAPI } from '../../api/academicService';
import { exportAPI } from '../../api/exportService';
import { importAPI } from '../../api/importService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import MultiSelect from '../../components/MultiSelect';
import Pagination from '../../components/Pagination';
import SearchInput from '../../components/SearchInput';
import Select from '../../components/Select';
import Table from '../../components/Table';
import BulkActionToolbar from '../../components/BulkActionToolbar';
import ConfirmDialog from '../../components/ConfirmDialog';

const emptyForm = { email: '', password: '', fullName: '', role: 'SUBJECT_TEACHER', employeeId: '', phone: '', designation: '' };
const emptyClassAssignment = { teacherId: '', academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', startDate: new Date().toISOString().split('T')[0] };
const emptyBulkAssignment = { teacherId: '', academicSessionId: '', semesterId: '', startDate: new Date().toISOString().split('T')[0], subjectIds: [], pairValues: [] };

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [classAssignments, setClassAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [assignFilter, setAssignFilter] = useState({ academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '' });
  const [assignSections, setAssignSections] = useState([]);
  const [classSubjectList, setClassSubjectList] = useState([]);
  const [subjectTeachers, setSubjectTeachers] = useState({});
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMessage, setAssignMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isClassAssignModalOpen, setIsClassAssignModalOpen] = useState(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [isBulkClassAssignOpen, setIsBulkClassAssignOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [classAssignmentForm, setClassAssignmentForm] = useState(emptyClassAssignment);
  const [bulkAssignmentForm, setBulkAssignmentForm] = useState(emptyBulkAssignment);
  const [bulkClassForm, setBulkClassForm] = useState({ academicSessionId: '', semesterId: '', startDate: new Date().toISOString().split('T')[0], selections: {} });
  const [bulkResult, setBulkResult] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => { loadInitial(); loadTeachers(1); }, []);
  useEffect(() => { setSelectedIds(new Set()); }, [pagination.page, pagination.limit, search]);

  const loadInitial = async () => {
    try {
      const [sa, ca, sessionsData, classesData, subjectsData, allSecs, allTeachersData] = await Promise.all([
        teacherAPI.getTeacherAssignments(),
        teacherAPI.getClassTeacherAssignments(),
        academicAPI.getSessions(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
        academicAPI.getSections(),
        teacherAPI.getTeachers({ limit: 200, includeInactive: 'true' }),
      ]);
      setSubjectAssignments(sa);
      setClassAssignments(ca);
      setSessions(sessionsData);
      setClasses(classesData);
      setSubjects(subjectsData);
      setAllSections(allSecs);
      setAllTeachers(allTeachersData.teachers || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadTeachers = useCallback(async (pageOverride, limitOverride) => {
    try {
      setLoading(true);
      const data = await teacherAPI.getTeachers({
        page: pageOverride ?? pagination.page,
        limit: limitOverride ?? pagination.limit,
        search: search || undefined,
        includeInactive: 'true',
      });
      setTeachers(data.teachers || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  const loadSemesters = async (sid) => setSemesters(sid ? await academicAPI.getSemesters(sid) : []);
  const loadSections = async (cid) => setSections(cid ? await academicAPI.getSections(cid) : []);

  const handleSearch = (value) => {
    setSearch(value);
    // debounce handled by SearchInput; reload on next render via effect below
  };

  useEffect(() => {
    const t = setTimeout(() => loadTeachers(1), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadAll = async () => {
    await Promise.all([loadTeachers(), loadInitial()]);
  };

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
      loadTeachers();
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
      await teacherAPI.updateTeacher(teacher.id, { isActive: !teacher.isActive });
      loadTeachers();
    } catch (error) {
      alert('Error updating teacher status');
    }
  };

  const handleClassAssignmentSubmit = async (e) => {
    e.preventDefault();
    try {
      await teacherAPI.createClassTeacherAssignment(classAssignmentForm);
      setIsClassAssignModalOpen(false);
      setClassAssignmentForm(emptyClassAssignment);
      reloadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating class teacher assignment');
    }
  };

  const handleDeleteClassAssignment = async (id) => {
    if (!confirm('Deactivate this class teacher assignment?')) return;
    try {
      await teacherAPI.updateClassTeacherAssignment(id, { isActive: false });
      reloadAll();
    } catch (error) {
      alert('Error removing assignment');
    }
  };

  const handleReactivateAssignment = async (id, isClassTeacher) => {
    try {
      if (isClassTeacher) {
        await teacherAPI.updateClassTeacherAssignment(id, { isActive: true });
      } else {
        await teacherAPI.updateTeacherAssignment(id, { isActive: true });
      }
      reloadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error reactivating assignment');
    }
  };

  const handlePermanentDeleteAssignment = async (id, isClassTeacher) => {
    if (!confirm('Permanently delete this assignment record? This cannot be undone.')) return;
    try {
      if (isClassTeacher) {
        await teacherAPI.deleteClassTeacherAssignment(id);
      } else {
        await teacherAPI.deleteTeacherAssignment(id);
      }
      reloadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting assignment');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPageSelected = teachers.length > 0 && teachers.every((t) => selectedIds.has(t.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) teachers.forEach((t) => next.delete(t.id));
      else teachers.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const handleBulkStatus = async () => {
    try {
      const result = await teacherAPI.bulkUpdateStatus([...selectedIds], bulkConfirm === 'activate');
      alert(`Updated ${result.updated} teacher(s)`);
      setSelectedIds(new Set());
      setBulkConfirm(null);
      loadTeachers();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating teachers');
    }
  };

  // Bulk subject assignment
  const bulkPairOptions = classes.flatMap((cls) =>
    allSections.filter((s) => s.schoolClassId === cls.id).map((sec) => ({
      value: `${cls.id}:${sec.id}`,
      label: `${cls.name} - ${sec.name}`,
    }))
  );

  // All class-section pairs for bulk class teacher assignment
  const classSectionPairs = classes.flatMap((cls) =>
    allSections.filter((s) => s.schoolClassId === cls.id).map((sec) => ({
      key: `${cls.id}:${sec.id}`,
      schoolClassId: cls.id,
      sectionId: sec.id,
      label: `${cls.name} - ${sec.name}`,
    }))
  );

  // Currently active class teacher per pair for the selected session/semester
  const currentClassTeacherByPair = {};
  classAssignments.forEach((a) => {
    if (a.isActive && a.academicSessionId === bulkClassForm.academicSessionId && a.semesterId === bulkClassForm.semesterId) {
      currentClassTeacherByPair[`${a.schoolClassId}:${a.sectionId}`] = a.teacherId;
    }
  });

  const teacherOptions = allTeachers.filter((t) => t.teacherProfile).map((t) => ({
    value: t.teacherProfile.id,
    label: `${t.teacherProfile.fullName} (${t.email})`,
  }));

  // Subject assignment by class filter
  const handleAssignSessionChange = async (e) => {
    const academicSessionId = e.target.value;
    setAssignFilter({ ...assignFilter, academicSessionId, semesterId: '' });
    await loadSemesters(academicSessionId);
  };

  const handleAssignClassChange = async (e) => {
    const schoolClassId = e.target.value;
    setAssignFilter({ ...assignFilter, schoolClassId, sectionId: '' });
    setAssignSections([]);
    setClassSubjectList([]);
    setAssignMessage('');
    if (!schoolClassId) return;
    const [secs, mappings] = await Promise.all([
      academicAPI.getSections(schoolClassId),
      academicAPI.getClassSubjects(schoolClassId),
    ]);
    setAssignSections(secs || []);
    setClassSubjectList(
      (mappings || [])
        .map((m) => m.subject)
        .filter(Boolean)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    );
  };

  // Prefill currently assigned teachers when session/semester/class/section are selected
  useEffect(() => {
    const { academicSessionId, semesterId, schoolClassId, sectionId } = assignFilter;
    setSubjectTeachers({});
    if (!academicSessionId || !schoolClassId || !sectionId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const rows = await teacherAPI.getTeacherAssignments({
          academicSessionId,
          schoolClassId,
          sectionId,
          ...(semesterId && { semesterId }),
        });
        if (cancelled) return;
        const map = {};
        rows
          .filter((a) => a.isActive && (a.semesterId || null) === (semesterId || null))
          .forEach((a) => { map[a.subjectId] = a.teacherId; });
        setSubjectTeachers(map);
      } catch (error) {
        console.error('Error loading subject assignments:', error);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignFilter.academicSessionId, assignFilter.semesterId, assignFilter.schoolClassId, assignFilter.sectionId]);

  const assignEntries = classSubjectList
    .filter((s) => subjectTeachers[s.id] !== undefined)
    .map((s) => ({ subjectId: s.id, teacherId: subjectTeachers[s.id] || null }));

  const handleSaveSubjectTeachers = async () => {
    const { academicSessionId, semesterId, schoolClassId, sectionId } = assignFilter;
    if (!academicSessionId || !schoolClassId || !sectionId) {
      alert('Select session, class and section first');
      return;
    }
    if (assignEntries.length === 0) {
      alert('No changes to save');
      return;
    }
    setAssignSaving(true);
    setAssignMessage('');
    try {
      const result = await teacherAPI.setClassSubjectTeachers({
        academicSessionId,
        semesterId: semesterId || null,
        schoolClassId,
        sectionId,
        startDate: new Date().toISOString().split('T')[0],
        entries: assignEntries,
      });
      setAssignMessage(
        `Saved: ${result.created} assigned, ${result.reactivated} reactivated, ${result.deactivated} unassigned, ${result.skipped} unchanged.` +
        (result.invalid ? ` ${result.invalid} invalid skipped.` : '')
      );
      reloadAll();
    } catch (error) {
      setAssignMessage(error.response?.data?.error || 'Error saving assignments');
    } finally {
      setAssignSaving(false);
    }
  };

  const openBulkClassAssign = () => {
    setBulkClassForm({ academicSessionId: '', semesterId: '', startDate: new Date().toISOString().split('T')[0], selections: {} });
    setIsBulkClassAssignOpen(true);
  };

  const handleBulkClassAssignSubmit = async (e) => {
    e.preventDefault();
    const entries = classSectionPairs
      .map((p) => ({
        teacherId: bulkClassForm.selections[p.key] || currentClassTeacherByPair[p.key] || '',
        schoolClassId: p.schoolClassId,
        sectionId: p.sectionId,
      }))
      .filter((en) => en.teacherId);
    if (entries.length === 0) {
      alert('Select a teacher for at least one class');
      return;
    }
    try {
      const result = await teacherAPI.bulkCreateClassTeacherAssignments({
        academicSessionId: bulkClassForm.academicSessionId,
        semesterId: bulkClassForm.semesterId,
        startDate: bulkClassForm.startDate,
        entries,
      });
      setBulkResult(result);
      setIsBulkClassAssignOpen(false);
      reloadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating assignments');
    }
  };

  const handleBulkAssignSubmit = async (e) => {
    e.preventDefault();
    try {
      const entries = [];
      bulkAssignmentForm.pairValues.forEach((pv) => {
        const [schoolClassId, sectionId] = pv.split(':');
        bulkAssignmentForm.subjectIds.forEach((subjectId) => {
          entries.push({ subjectId, schoolClassId, sectionId });
        });
      });
      const result = await teacherAPI.bulkCreateTeacherAssignments({
        teacherId: bulkAssignmentForm.teacherId,
        academicSessionId: bulkAssignmentForm.academicSessionId,
        semesterId: bulkAssignmentForm.semesterId,
        startDate: bulkAssignmentForm.startDate,
        entries,
      });
      setBulkResult(result);
      setIsBulkAssignModalOpen(false);
      setBulkAssignmentForm(emptyBulkAssignment);
      reloadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating assignments');
    }
  };

  const handleExportTeachers = async () => {
    try {
      await exportAPI.teachers({ includeInactive: 'true', search: search || undefined });
    } catch (error) {
      alert('Error exporting teachers');
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
      const data = await importAPI.previewTeachers(importFile);
      setImportPreview(data);
    } catch (error) {
      setImportMessage(error.response?.data?.error || 'Error reading file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmTeacherImport = async () => {
    if (!importPreview?.validation?.validRows?.length) return;
    setImportLoading(true);
    setImportMessage('');
    try {
      const rows = importPreview.validation.validRows.map((r) => r.data);
      const data = await importAPI.confirmTeachers(rows);
      setImportMessage(`Import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
      setImportPreview(null);
      setImportFile(null);
      loadTeachers(1);
    } catch (error) {
      setImportMessage(error.response?.data?.error || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const teacherName = (id) => teachers.find((t) => t.teacherProfile?.id === id)?.teacherProfile?.fullName
    || subjectAssignments.find((a) => a.teacherId === id)?.teacher?.teacherProfile?.fullName || id;

  const teacherColumns = [
    {
      key: 'select', label: '',
      render: (val, row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="w-4 h-4 text-blue-600" />
      ),
    },
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

  const classAssignmentColumns = [
    { key: 'teacherId', label: 'Teacher', render: (v, row) => row.teacher?.teacherProfile?.fullName || teacherName(v) },
    { key: 'schoolClass', label: 'Class', render: (v, row) => `${row.schoolClass?.name} - ${row.section?.name}` },
    { key: 'semester', label: 'Semester', render: (v, row) => `${row.semester?.name} (${row.academicSession?.name})` },
    { key: 'isActive', label: 'Status', render: (v) => <span className={`px-2 py-1 rounded-full text-xs ${v ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: 'Actions', render: (v, row) => (
      <div className="flex gap-2">
        {row.isActive ? (
          <Button size="sm" variant="danger" onClick={() => handleDeleteClassAssignment(row.id)}>Remove</Button>
        ) : (
          <>
            <Button size="sm" variant="success" onClick={() => handleReactivateAssignment(row.id, true)}>Activate</Button>
            <Button size="sm" variant="danger" onClick={() => handlePermanentDeleteAssignment(row.id, true)}>Delete</Button>
          </>
        )}
      </div>
    ) },
  ];

  const assignmentFields = (form, setForm, isClassTeacher) => (
    <>
      <Select label="Teacher" value={form.teacherId} required onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
        options={teachers.filter((t) => t.teacherProfile).map((t) => ({ value: t.teacherProfile.id, label: `${t.teacherProfile.fullName} (${t.email})` }))} />
      <Select label="Session" value={form.academicSessionId} required onChange={async (e) => { setForm({ ...form, academicSessionId: e.target.value, semesterId: '' }); await loadSemesters(e.target.value); }}
        options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
      <Select label="Semester (optional — all terms)" value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
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
        <Button variant="secondary" onClick={() => setIsClassAssignModalOpen(false)}>Cancel</Button>
        <Button type="submit">Assign</Button>
      </div>
    </>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teacher Management</h1>

      {bulkResult && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
          Bulk assignment complete: {bulkResult.created} created, {bulkResult.skipped} skipped (duplicates), {bulkResult.invalid} invalid.
          <button className="ml-3 underline" onClick={() => setBulkResult(null)}>Dismiss</button>
        </div>
      )}

      <Card title="Teachers" actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { resetImport(); setIsImportModalOpen(true); }}>Import</Button>
          <Button variant="secondary" onClick={handleExportTeachers}>Export</Button>
          <Button onClick={() => { setIsEdit(false); setFormData(emptyForm); setIsModalOpen(true); }}>Add Teacher</Button>
        </div>
      } className="mb-6">
        <div className="mb-4">
          <SearchInput placeholder="Search by name, email or employee ID..." value={search} onChange={handleSearch} className="max-w-sm" />
        </div>
        {loading ? <div className="text-center py-8">Loading...</div> : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-gray-600 inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600" />
                Select all on this page
              </label>
            </div>
            <Table columns={teacherColumns} data={teachers} emptyMessage="No teachers found" />
            <Pagination pagination={pagination} onPageChange={(p) => loadTeachers(p)} onLimitChange={(l) => loadTeachers(1, l)} />
          </>
        )}
      </Card>

      <BulkActionToolbar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button size="sm" variant="success" onClick={() => setBulkConfirm('activate')}>Activate</Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkConfirm('deactivate')}>Deactivate</Button>
      </BulkActionToolbar>

      <Card title="Subject Assignments" actions={
        <Button variant="secondary" onClick={() => { setBulkAssignmentForm(emptyBulkAssignment); setIsBulkAssignModalOpen(true); }}>Bulk Assign</Button>
      } className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Select label="Session" value={assignFilter.academicSessionId} required
            onChange={handleAssignSessionChange}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Semester (optional — all terms)" value={assignFilter.semesterId}
            onChange={(e) => setAssignFilter({ ...assignFilter, semesterId: e.target.value })}
            options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Class" value={assignFilter.schoolClassId} required
            onChange={handleAssignClassChange}
            options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Section" value={assignFilter.sectionId} required
            onChange={(e) => setAssignFilter({ ...assignFilter, sectionId: e.target.value })}
            options={assignSections.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        {assignMessage && (
          <div className="mb-3 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">{assignMessage}</div>
        )}
        {!assignFilter.schoolClassId ? (
          <p className="text-sm text-gray-500">Select a class to view its subjects.</p>
        ) : classSubjectList.length === 0 ? (
          <p className="text-sm text-gray-500">No subjects are mapped to this class yet.</p>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
              {classSubjectList.map((subject) => (
                <div key={subject.id} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 text-sm text-gray-700">{subject.name}</span>
                  <div className="flex-1">
                    <Select
                      value={subjectTeachers[subject.id] || ''}
                      onChange={(e) => setSubjectTeachers({ ...subjectTeachers, [subject.id]: e.target.value || null })}
                      options={teacherOptions}
                      placeholder="— Unassigned —"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 gap-3">
              <p className="text-xs text-gray-500">
                {!assignFilter.academicSessionId || !assignFilter.sectionId
                  ? 'Select session and section to save assignments.'
                  : 'Choose a teacher for each subject, then save. "— Unassigned —" removes the assignment.'}
              </p>
              <Button onClick={handleSaveSubjectTeachers}
                disabled={assignSaving || !assignFilter.academicSessionId || !assignFilter.sectionId || assignEntries.length === 0}>
                {assignSaving ? 'Saving...' : 'Save Assignments'}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card title="Class Teacher Assignments" actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openBulkClassAssign}>Assign All Classes</Button>
          <Button onClick={() => { setClassAssignmentForm(emptyClassAssignment); setIsClassAssignModalOpen(true); }}>Assign Class Teacher</Button>
        </div>
      }>
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

      <Modal isOpen={isClassAssignModalOpen} onClose={() => setIsClassAssignModalOpen(false)} title="Assign Class Teacher">
        <form onSubmit={handleClassAssignmentSubmit} className="space-y-4">{assignmentFields(classAssignmentForm, setClassAssignmentForm, true)}</form>
      </Modal>

      <Modal isOpen={isBulkAssignModalOpen} onClose={() => setIsBulkAssignModalOpen(false)} title="Bulk Subject Assignment">
        <form onSubmit={handleBulkAssignSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <Select label="Teacher" value={bulkAssignmentForm.teacherId} required
            onChange={(e) => setBulkAssignmentForm({ ...bulkAssignmentForm, teacherId: e.target.value })}
            options={teachers.filter((t) => t.teacherProfile).map((t) => ({ value: t.teacherProfile.id, label: `${t.teacherProfile.fullName} (${t.email})` }))} />
          <Select label="Session" value={bulkAssignmentForm.academicSessionId} required
            onChange={async (e) => { setBulkAssignmentForm({ ...bulkAssignmentForm, academicSessionId: e.target.value, semesterId: '' }); await loadSemesters(e.target.value); }}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Semester (optional — all terms)" value={bulkAssignmentForm.semesterId}
            onChange={(e) => setBulkAssignmentForm({ ...bulkAssignmentForm, semesterId: e.target.value })}
            options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Input label="Start Date" type="date" value={bulkAssignmentForm.startDate} required
            onChange={(e) => setBulkAssignmentForm({ ...bulkAssignmentForm, startDate: e.target.value })} />
          <MultiSelect label="Subjects" required
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={bulkAssignmentForm.subjectIds}
            onChange={(v) => setBulkAssignmentForm({ ...bulkAssignmentForm, subjectIds: v })}
            placeholder="Select subjects..." />
          <MultiSelect label="Class Sections" required
            options={bulkPairOptions}
            value={bulkAssignmentForm.pairValues}
            onChange={(v) => setBulkAssignmentForm({ ...bulkAssignmentForm, pairValues: v })}
            placeholder="Select class sections..." />
          <p className="text-xs text-gray-500">
            Creates {bulkAssignmentForm.subjectIds.length * bulkAssignmentForm.pairValues.length} assignment(s).
            Existing duplicates are skipped automatically.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsBulkAssignModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!bulkAssignmentForm.teacherId || !bulkAssignmentForm.academicSessionId || bulkAssignmentForm.subjectIds.length === 0 || bulkAssignmentForm.pairValues.length === 0}>
              Create Assignments
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={resetImport} title="Import Teachers from Excel">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {importMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">{importMessage}</div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Step 1: Download Template</h3>
            <p className="text-xs text-gray-500 mb-2">Download the Excel template and fill it with teacher data.</p>
            <Button size="sm" variant="secondary" onClick={() => importAPI.downloadTeacherTemplate()}>Download Template</Button>
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
                  <Button onClick={handleConfirmTeacherImport} disabled={importLoading}>{importLoading ? 'Importing...' : 'Confirm Import'}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isBulkClassAssignOpen} onClose={() => setIsBulkClassAssignOpen(false)} title="Assign Class Teachers to All Classes">
        <form onSubmit={handleBulkClassAssignSubmit} className="space-y-4">
          <Select label="Session" value={bulkClassForm.academicSessionId} required
            onChange={async (e) => { setBulkClassForm({ ...bulkClassForm, academicSessionId: e.target.value, semesterId: '', selections: {} }); await loadSemesters(e.target.value); }}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Semester (optional — all terms)" value={bulkClassForm.semesterId}
            onChange={(e) => setBulkClassForm({ ...bulkClassForm, semesterId: e.target.value })}
            options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Input label="Start Date" type="date" value={bulkClassForm.startDate} required
            onChange={(e) => setBulkClassForm({ ...bulkClassForm, startDate: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Teachers</label>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
              {classSectionPairs.length === 0 && (
                <p className="text-sm text-gray-500">No classes/sections found. Create classes and sections first.</p>
              )}
              {classSectionPairs.map((p) => (
                <div key={p.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-gray-700">{p.label}</span>
                  <Select
                    value={bulkClassForm.selections[p.key] || currentClassTeacherByPair[p.key] || ''}
                    onChange={(e) => setBulkClassForm({ ...bulkClassForm, selections: { ...bulkClassForm.selections, [p.key]: e.target.value } })}
                    options={teacherOptions}
                    placeholder="— Select teacher —"
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Selecting a different teacher replaces the current class teacher for that class-section.
            Pairs left unchanged keep their existing teacher.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsBulkClassAssignOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!bulkClassForm.academicSessionId}>Assign</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={handleBulkStatus}
        title={bulkConfirm === 'activate' ? 'Activate Teachers' : 'Deactivate Teachers'}
        message={`${bulkConfirm === 'activate' ? 'Activate' : 'Deactivate'} ${selectedIds.size} selected teacher account(s)?`}
        confirmLabel={bulkConfirm === 'activate' ? 'Activate' : 'Deactivate'}
        danger={bulkConfirm === 'deactivate'}
      />
    </div>
  );
}

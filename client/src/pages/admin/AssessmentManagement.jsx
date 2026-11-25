import { useState, useEffect, useMemo } from 'react';
import { academicAPI } from '../../api/academicService';
import { assessmentAPI } from '../../api/assessmentService';
import { exportAPI } from '../../api/exportService';
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

const emptyCategory = { name: '', code: '', weightage: '' };
const STEP_LABELS = ['Assessment Info', 'Classes & Sections', 'Subjects', 'Preview'];

export default function AssessmentManagement() {
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isEditAssessment, setIsEditAssessment] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [filter, setFilter] = useState({
    academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', subjectId: '', categoryId: '', search: '',
  });
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [assessmentForm, setAssessmentForm] = useState({
    name: '', categoryId: '', academicSessionId: '', semesterId: '', maximumMarks: '', defaultDate: '',
  });

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedPairs, setSelectedPairs] = useState([]); // [{schoolClassId, sectionId}]
  const [selectedSubjects, setSelectedSubjects] = useState([]); // subject ids
  const [eligibleMap, setEligibleMap] = useState({}); // "classId:sectionId" -> [subjectIds]
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({ maximumMarks: '', defaultDate: '', clearDefaultDate: false });

  const [formSemesters, setFormSemesters] = useState([]);
  const [formSections, setFormSections] = useState([]);
  const [editForm, setEditForm] = useState({ maximumMarks: '', defaultDate: '' });

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const [categoriesData, sessionsData, classesData, subjectsData, allSectionsData] = await Promise.all([
        assessmentAPI.getCategories(),
        academicAPI.getSessions(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
        academicAPI.getSections(),
      ]);
      setCategories(categoriesData);
      setSessions(sessionsData);
      setClasses(classesData);
      setSubjects(subjectsData);
      setAllSections(allSectionsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

  const loadAssessments = async (pageOverride, limitOverride) => {
    try {
      setLoading(true);
      const data = await assessmentAPI.getAssessments(cleanParams({
        ...filter,
        page: pageOverride ?? pagination.page,
        limit: limitOverride ?? pagination.limit,
      }));
      setAssessments(data.assessments || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Error loading assessments:', error);
      alert('Error loading assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.academicSessionId, filter.semesterId, filter.schoolClassId, filter.sectionId, filter.subjectId, filter.categoryId, filter.search]);

  useEffect(() => { setSelectedIds(new Set()); }, [pagination.page, pagination.limit]);

  useEffect(() => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setSelectAllMatching(false);
  }, [filter.academicSessionId, filter.semesterId, filter.schoolClassId, filter.sectionId, filter.subjectId, filter.categoryId, filter.search]);

  const handleSearch = (search) => {
    setFilter((f) => ({ ...f, search }));
  };

  const loadSectionsForFilter = async (schoolClassId) => {
    setFilter((f) => ({ ...f, schoolClassId, sectionId: '' }));
    const secs = schoolClassId ? await academicAPI.getSections(schoolClassId) : [];
    setFormSections([]);
    return secs;
  };

  // ---------- Category modal ----------
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await assessmentAPI.createCategory(categoryForm);
      setIsCategoryModalOpen(false);
      setCategoryForm(emptyCategory);
      setCategories(await assessmentAPI.getCategories());
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating category');
    }
  };

  // ---------- Assessment wizard ----------
  const resetWizard = () => {
    setStep(0);
    setSelectedPairs([]);
    setSelectedSubjects([]);
    setEligibleMap({});
    setBulkResult(null);
    setAssessmentForm({ name: '', categoryId: '', academicSessionId: '', semesterId: '', maximumMarks: '', defaultDate: '' });
    setFormSemesters([]);
  };

  const openAssessmentModal = async (assessment = null) => {
    if (assessment) {
      setIsEditAssessment(true);
      setEditingAssessmentId(assessment.id);
      setEditForm({
        maximumMarks: assessment.maximumMarks,
        defaultDate: assessment.defaultDate?.split('T')[0] || '',
      });
      setAssessmentForm({
        name: assessment.name,
        categoryId: assessment.categoryId,
        academicSessionId: assessment.academicSessionId,
        semesterId: assessment.semesterId,
        maximumMarks: assessment.maximumMarks,
        defaultDate: assessment.defaultDate?.split('T')[0] || '',
      });
    } else {
      setIsEditAssessment(false);
      setEditingAssessmentId(null);
      resetWizard();
    }
    setIsAssessmentModalOpen(true);
  };

  const handleSessionChange = async (sid) => {
    setAssessmentForm((f) => ({ ...f, academicSessionId: sid, semesterId: '' }));
    setFormSemesters(sid ? await academicAPI.getSemesters(sid) : []);
    setSelectedPairs([]);
    setSelectedSubjects([]);
    setEligibleMap({});
  };

  const sectionsForClass = (classId) => allSections.filter((s) => s.schoolClassId === classId);

  const togglePair = (schoolClassId, sectionId) => {
    const key = `${schoolClassId}:${sectionId}`;
    setSelectedPairs((prev) => {
      const exists = prev.some((p) => p.schoolClassId === schoolClassId && p.sectionId === sectionId);
      return exists ? prev.filter((p) => !(p.schoolClassId === schoolClassId && p.sectionId === sectionId)) : [...prev, { schoolClassId, sectionId }];
    });
    // Reset eligibility for removed pair; will refetch when moving forward
    if (selectedPairs.some((p) => p.schoolClassId === schoolClassId && p.sectionId === sectionId)) {
      setEligibleMap((m) => { const n = { ...m }; delete n[key]; return n; });
    }
  };

  const toggleClassAllSections = (classId, checked) => {
    const secs = sectionsForClass(classId);
    setSelectedPairs((prev) => {
      const without = prev.filter((p) => p.schoolClassId !== classId);
      return checked ? [...without, ...secs.map((s) => ({ schoolClassId: classId, sectionId: s.id }))] : without;
    });
  };

  const classSelectedCount = (classId) =>
    sectionsForClass(classId).filter((s) => selectedPairs.some((p) => p.schoolClassId === classId && p.sectionId === s.id)).length;

  // Load eligibility when entering step 2 (subjects)
  useEffect(() => {
    if (step === 2 && selectedPairs.length > 0 && assessmentForm.academicSessionId && assessmentForm.semesterId) {
      const missing = selectedPairs.filter((p) => !eligibleMap[`${p.schoolClassId}:${p.sectionId}`]);
      if (missing.length > 0) {
        setEligibilityLoading(true);
        assessmentAPI.getEligibleSubjects({
          academicSessionId: assessmentForm.academicSessionId,
          semesterId: assessmentForm.semesterId,
          pairs: JSON.stringify(missing),
        }).then((data) => {
          const next = { ...eligibleMap };
          (data.pairs || []).forEach((p) => {
            next[`${p.schoolClassId}:${p.sectionId}`] = p.subjectIds;
          });
          setEligibleMap(next);
        }).catch(() => {
          // Fall back: mark all pairs as eligible for all subjects
          const next = { ...eligibleMap };
          missing.forEach((p) => { next[`${p.schoolClassId}:${p.sectionId}`] = subjects.map((s) => s.id); });
          setEligibleMap(next);
        }).finally(() => setEligibilityLoading(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedPairs, assessmentForm.academicSessionId, assessmentForm.semesterId]);

  // Subjects eligible for at least one selected pair (union)
  const availableSubjects = useMemo(() => {
    if (selectedPairs.length === 0) return [];
    const union = new Set();
    let anyKnown = false;
    selectedPairs.forEach((p) => {
      const ids = eligibleMap[`${p.schoolClassId}:${p.sectionId}`];
      if (ids) { anyKnown = true; ids.forEach((id) => union.add(id)); }
    });
    if (!anyKnown) return subjects;
    return subjects.filter((s) => union.has(s.id));
  }, [selectedPairs, eligibleMap, subjects]);

  // Valid combinations for preview: pair x subject where subject is eligible for that pair
  const validCombinations = useMemo(() => {
    const combos = [];
    const skippedIneligible = [];
    selectedPairs.forEach((p) => {
      const eligible = eligibleMap[`${p.schoolClassId}:${p.sectionId}`];
      selectedSubjects.forEach((subjectId) => {
        const isEligible = !eligible || eligible.includes(subjectId);
        const combo = { ...p, subjectId };
        if (isEligible) combos.push(combo);
        else skippedIneligible.push(combo);
      });
    });
    return { combos, skippedIneligible };
  }, [selectedPairs, selectedSubjects, eligibleMap]);

  const pairLabel = (p) => {
    const cls = classes.find((c) => c.id === p.schoolClassId);
    const sec = allSections.find((s) => s.id === p.sectionId);
    return `${cls?.name || '?'}-${sec?.name || '?'}`;
  };

  const canProceed = () => {
    if (step === 0) return assessmentForm.name && assessmentForm.categoryId && assessmentForm.academicSessionId && assessmentForm.semesterId && assessmentForm.maximumMarks;
    if (step === 1) return selectedPairs.length > 0;
    if (step === 2) return selectedSubjects.length > 0;
    return true;
  };

  const handleBulkSubmit = async () => {
    try {
      setLoading(true);
      const result = await assessmentAPI.bulkCreateAssessments({
        name: assessmentForm.name,
        categoryId: assessmentForm.categoryId,
        academicSessionId: assessmentForm.academicSessionId,
        semesterId: assessmentForm.semesterId,
        maximumMarks: assessmentForm.maximumMarks,
        defaultDate: assessmentForm.defaultDate,
        combinations: validCombinations.combos,
      });
      setBulkResult(result);
      loadAssessments(1);
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await assessmentAPI.updateAssessment(editingAssessmentId, editForm);
      setIsAssessmentModalOpen(false);
      loadAssessments();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating assessment');
    }
  };

  const handleDeleteAssessment = async () => {
    try {
      await assessmentAPI.deleteAssessment(deleteTarget.id);
      setDeleteTarget(null);
      loadAssessments();
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting assessment');
    }
  };

  const handleStatusChange = async (assessment, submissionStatus) => {
    try {
      await assessmentAPI.updateAssessment(assessment.id, { submissionStatus });
      loadAssessments();
    } catch (error) {
      alert('Error updating status');
    }
  };

  const isAssessmentSelected = (id) => (selectAllMatching ? !excludedIds.has(id) : selectedIds.has(id));
  const selectedCount = selectAllMatching ? Math.max(pagination.total - excludedIds.size, 0) : selectedIds.size;

  const toggleSelect = (id) => {
    if (selectAllMatching) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPageSelected = assessments.length > 0 && assessments.every((a) => isAssessmentSelected(a.id));
  const toggleSelectAll = () => {
    if (selectAllMatching) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (allPageSelected) assessments.forEach((a) => next.add(a.id));
        else assessments.forEach((a) => next.delete(a.id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) assessments.forEach((a) => next.delete(a.id));
      else assessments.forEach((a) => next.add(a.id));
      return next;
    });
  };

  const toggleSelectAllMatching = () => {
    setSelectAllMatching((prev) => !prev);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setSelectAllMatching(false);
  };

  const buildSelectionPayload = () => {
    if (selectAllMatching) {
      return {
        selectAll: true,
        filters: cleanParams({ ...filter }),
        excludedIds: [...excludedIds],
      };
    }
    return { ids: [...selectedIds] };
  };

  const openBulkEditModal = () => {
    setBulkEditForm({ maximumMarks: '', defaultDate: '', clearDefaultDate: false });
    setIsBulkEditModalOpen(true);
  };

  const handleBulkEditSubmit = async (e) => {
    e.preventDefault();
    const hasMaximumMarks = bulkEditForm.maximumMarks !== '';
    const hasDefaultDate = bulkEditForm.defaultDate !== '';

    if (!hasMaximumMarks && !hasDefaultDate && !bulkEditForm.clearDefaultDate) {
      alert('Enter at least one field to update');
      return;
    }
    if (hasMaximumMarks && (!Number.isFinite(parseFloat(bulkEditForm.maximumMarks)) || parseFloat(bulkEditForm.maximumMarks) < 0)) {
      alert('Maximum marks must be a non-negative number');
      return;
    }

    const payload = buildSelectionPayload();
    if (hasMaximumMarks) payload.maximumMarks = bulkEditForm.maximumMarks;
    if (bulkEditForm.clearDefaultDate) payload.clearDefaultDate = true;
    else if (hasDefaultDate) payload.defaultDate = bulkEditForm.defaultDate;

    try {
      const result = await assessmentAPI.bulkUpdateAssessments(payload);
      alert(`Updated ${result.updated} assessment(s)`);
      setIsBulkEditModalOpen(false);
      clearSelection();
      loadAssessments();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating assessments');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const result = await assessmentAPI.bulkDeleteAssessments(buildSelectionPayload());
      alert(`Deleted ${result.deleted} assessment(s)`);
      clearSelection();
      loadAssessments(1);
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting assessments');
    }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatusValue) {
      alert('Select a status first');
      return;
    }
    try {
      const result = await assessmentAPI.bulkUpdateStatus({
        ...buildSelectionPayload(),
        submissionStatus: bulkStatusValue,
      });
      alert(`Updated ${result.updated} assessment(s)`);
      setBulkStatusValue('');
      clearSelection();
      loadAssessments();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating assessments');
    }
  };

  const categoryColumns = [
    { key: 'name', label: 'Category Name' },
    { key: 'code', label: 'Code' },
    { key: 'weightage', label: 'Weightage (%)', render: (val) => `${val}%` },
  ];

  const assessmentColumns = [
    {
      key: 'select', label: '',
      render: (val, row) => (
        <input type="checkbox" checked={isAssessmentSelected(row.id)} onChange={() => toggleSelect(row.id)} className="w-4 h-4 text-blue-600" />
      ),
    },
    { key: 'name', label: 'Assessment' },
    { key: 'category', label: 'Category', render: (val, row) => row.category?.name },
    { key: 'subject', label: 'Subject', render: (val, row) => row.subject?.name },
    { key: 'schoolClass', label: 'Class', render: (val, row) => row.schoolClass?.name },
    { key: 'section', label: 'Section', render: (val, row) => row.section?.name },
    { key: 'maximumMarks', label: 'Max' },
    { key: 'marksCount', label: 'Marks', render: (val, row) => row._count?.marksEntries ?? 0 },
    { key: 'defaultDate', label: 'Date', render: (val) => (val ? new Date(val).toLocaleDateString() : 'TBD') },
    {
      key: 'submissionStatus',
      label: 'Status',
      render: (val, row) => (
        <Select
          value={val}
          onChange={(e) => handleStatusChange(row, e.target.value)}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'REVIEWED', label: 'Reviewed' },
            { value: 'APPROVED', label: 'Approved' },
          ]}
          className="w-32"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openAssessmentModal(row)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(row)}>Delete</Button>
        </div>
      ),
    },
  ];

  const selectedPairOptions = classes.flatMap((cls) =>
    sectionsForClass(cls.id).map((sec) => ({
      value: `${cls.id}:${sec.id}`,
      label: `${cls.name} - ${sec.name}`,
    }))
  );
  const selectedPairValues = selectedPairs.map((p) => `${p.schoolClassId}:${p.sectionId}`);

  const sessionName = sessions.find((s) => s.id === assessmentForm.academicSessionId)?.name;
  const semesterName = formSemesters.find((s) => s.id === assessmentForm.semesterId)?.name;
  const categoryName = categories.find((c) => c.id === assessmentForm.categoryId)?.name;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assessment Management</h1>

      <Card title="Assessment Categories" actions={<Button onClick={() => setIsCategoryModalOpen(true)}>Add Category</Button>} className="mb-6">
        <Table columns={categoryColumns} data={categories} />
      </Card>

      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <SearchInput placeholder="Search assessments..." value={filter.search} onSearch={handleSearch} />
          <Select placeholder="Session" value={filter.academicSessionId}
            onChange={async (e) => {
              const sid = e.target.value;
              setFilter((f) => ({ ...f, academicSessionId: sid, semesterId: '' }));
              setSemesters(sid ? await academicAPI.getSemesters(sid) : []);
            }}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Class" value={filter.schoolClassId}
            onChange={async (e) => {
              const cid = e.target.value;
              const secs = cid ? await academicAPI.getSections(cid) : [];
              setFormSections(secs);
              setFilter((f) => ({ ...f, schoolClassId: cid, sectionId: secs.length === 1 ? secs[0].id : '' }));
            }}
            options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={formSections.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Subject" value={filter.subjectId} onChange={(e) => setFilter({ ...filter, subjectId: e.target.value })} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Category" value={filter.categoryId} onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openAssessmentModal()}>+ New Assessment (Bulk)</Button>
          <Button
            variant="secondary"
            onClick={() => exportAPI.assessments(cleanParams(filter)).catch(() => alert('Error exporting assessments'))}
          >
            Export to Excel
          </Button>
        </div>
      </Card>

      <Card title="Assessments">
        {loading ? <div className="text-center py-8">Loading...</div> : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="text-sm text-gray-600 inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600" />
                Select all on this page
              </label>
              {pagination.total > 0 && (
                <label className="text-sm text-gray-600 inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectAllMatching} onChange={toggleSelectAllMatching} className="w-4 h-4 text-blue-600" />
                  Select all {pagination.total} matching assessment(s)
                </label>
              )}
              {selectAllMatching && excludedIds.size > 0 && (
                <span className="text-xs text-gray-500">{excludedIds.size} excluded</span>
              )}
            </div>
            <Table columns={assessmentColumns} data={assessments} emptyMessage="No assessments match the current filters" />
            <Pagination
              pagination={pagination}
              onPageChange={(p) => loadAssessments(p)}
              onLimitChange={(l) => loadAssessments(1, l)}
            />
          </>
        )}
      </Card>

      <BulkActionToolbar count={selectedCount} onClear={clearSelection}>
        <Select value={bulkStatusValue} onChange={(e) => setBulkStatusValue(e.target.value)}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'REVIEWED', label: 'Reviewed' },
            { value: 'APPROVED', label: 'Approved' },
          ]}
          placeholder="Set status..."
          className="w-40" />
        <Button size="sm" onClick={handleBulkStatus} disabled={!bulkStatusValue}>Apply</Button>
        <Button size="sm" variant="secondary" onClick={openBulkEditModal}>Edit</Button>
        <Button size="sm" variant="danger" onClick={() => setIsBulkDeleteOpen(true)}>Delete</Button>
      </BulkActionToolbar>

      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Add Assessment Category">
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          <Input label="Category Name" name="name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
          <Input label="Code" name="code" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} required />
          <Input label="Weightage (%)" type="number" name="weightage" value={categoryForm.weightage} onChange={(e) => setCategoryForm({ ...categoryForm, weightage: e.target.value })} required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      {/* Edit assessment modal */}
      <Modal isOpen={isAssessmentModalOpen && isEditAssessment} onClose={() => setIsAssessmentModalOpen(false)} title="Edit Assessment">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input label="Assessment Name" value={assessmentForm.name} disabled />
          <Input label="Maximum Marks" type="number" name="maximumMarks" value={editForm.maximumMarks}
            onChange={(e) => setEditForm({ ...editForm, maximumMarks: e.target.value })} required />
          <Input label="Default Date" type="date" name="defaultDate" value={editForm.defaultDate}
            onChange={(e) => setEditForm({ ...editForm, defaultDate: e.target.value })} required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAssessmentModalOpen(false)}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>

      {/* Bulk edit modal */}
      <Modal isOpen={isBulkEditModalOpen} onClose={() => setIsBulkEditModalOpen(false)} title={`Edit ${selectedCount} Assessment${selectedCount === 1 ? '' : 's'}`}>
        <form onSubmit={handleBulkEditSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">Leave a field blank to keep its current value.</p>
          <Input label="Maximum Marks" type="number" name="bulkMaximumMarks" value={bulkEditForm.maximumMarks}
            onChange={(e) => setBulkEditForm({ ...bulkEditForm, maximumMarks: e.target.value })} />
          <Input label="Assessment Date" type="date" name="bulkDefaultDate" value={bulkEditForm.defaultDate}
            onChange={(e) => setBulkEditForm({ ...bulkEditForm, defaultDate: e.target.value, clearDefaultDate: false })}
            disabled={bulkEditForm.clearDefaultDate} />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={bulkEditForm.clearDefaultDate}
              onChange={(e) => setBulkEditForm({ ...bulkEditForm, clearDefaultDate: e.target.checked, defaultDate: e.target.checked ? '' : bulkEditForm.defaultDate })}
              className="w-4 h-4 text-blue-600" />
            Clear assessment date
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsBulkEditModalOpen(false)}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Assessments"
        message={`Delete ${selectedCount} assessment(s)? Existing marks entries for these assessments will also be deleted.`}
        confirmLabel="Delete"
      />

      {/* Bulk creation wizard modal */}
      <Modal
        isOpen={isAssessmentModalOpen && !isEditAssessment}
        onClose={() => setIsAssessmentModalOpen(false)}
        title={`New Assessment — ${assessmentForm.name || 'Bulk Create'}`}
      >
        {bulkResult ? (
          <div className="space-y-4">
            <div className="ui-summary">
              <div className="ui-summary-row"><span className="ui-summary-label">Created</span><span className="ui-summary-value text-green-600">{bulkResult.created}</span></div>
              <div className="ui-summary-row"><span className="ui-summary-label">Skipped (duplicates)</span><span className="ui-summary-value text-yellow-600">{bulkResult.duplicates}</span></div>
              <div className="ui-summary-row"><span className="ui-summary-label">Invalid</span><span className="ui-summary-value text-red-600">{bulkResult.invalid}</span></div>
              <div className="ui-summary-row"><span className="ui-summary-label">Total requested</span><span className="ui-summary-value">{bulkResult.total}</span></div>
            </div>
            {bulkResult.invalidDetails?.length > 0 && (
              <div className="max-h-40 overflow-y-auto text-xs text-red-600">
                {bulkResult.invalidDetails.map((d, i) => (
                  <div key={i}>• {d.reason}: class {d.schoolClassId?.slice(0, 6)}…, section {d.sectionId?.slice(0, 6)}…, subject {d.subjectId?.slice(0, 6)}…</div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => { setIsAssessmentModalOpen(false); resetWizard(); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="ui-steps">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className={`ui-step ${step === i ? 'ui-step-active' : step > i ? 'ui-step-done' : ''}`}>
                  <span className="ui-step-number">{step > i ? '✓' : i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <Input label="Assessment Name" name="name" placeholder="e.g. CT-1" value={assessmentForm.name}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, name: e.target.value })} required />
                <Select label="Assessment Category" value={assessmentForm.categoryId}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, categoryId: e.target.value })}
                  options={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.weightage}%)` }))} required />
                <Select label="Academic Session" value={assessmentForm.academicSessionId}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  options={sessions.map((s) => ({ value: s.id, label: s.name }))} required />
                <Select label="Semester" value={assessmentForm.semesterId}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, semesterId: e.target.value })}
                  options={formSemesters.map((s) => ({ value: s.id, label: s.name }))} required />
                <Input label="Maximum Marks" type="number" name="maximumMarks" value={assessmentForm.maximumMarks}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, maximumMarks: e.target.value })} required />
                <Input label="Assessment Date (optional — teacher sets it during mark entry)" type="date" name="defaultDate" value={assessmentForm.defaultDate}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, defaultDate: e.target.value })} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                <p className="text-sm text-gray-600">Select the class sections this assessment applies to.</p>
                {classes.map((cls) => {
                  const secs = sectionsForClass(cls.id);
                  const count = classSelectedCount(cls.id);
                  return (
                    <div key={cls.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800">{cls.name}</span>
                        <label className="text-xs text-blue-600 cursor-pointer inline-flex items-center gap-1">
                          <input type="checkbox"
                            checked={secs.length > 0 && count === secs.length}
                            onChange={(e) => toggleClassAllSections(cls.id, e.target.checked)} />
                          All sections ({count}/{secs.length})
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {secs.length === 0 && <span className="text-xs text-gray-400">No sections</span>}
                        {secs.map((sec) => {
                          const checked = selectedPairs.some((p) => p.schoolClassId === cls.id && p.sectionId === sec.id);
                          return (
                            <label key={sec.id} className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={() => togglePair(cls.id, sec.id)} className="w-4 h-4 text-blue-600" />
                              {sec.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-500">{selectedPairs.length} class-section(s) selected</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Select subjects. Only subjects eligible for the selected class sections are shown.
                  {eligibilityLoading && <span className="text-blue-600"> Loading eligibility…</span>}
                </p>
                <MultiSelect
                  label="Subjects"
                  options={availableSubjects.map((s) => ({ value: s.id, label: s.name }))}
                  value={selectedSubjects}
                  onChange={setSelectedSubjects}
                  placeholder="Select subjects..."
                  loading={eligibilityLoading}
                  emptyMessage="No eligible subjects for the selected classes"
                  required
                />
                {selectedSubjects.length > 0 && (
                  <p className="text-xs text-gray-500">{selectedSubjects.length} subject(s) selected</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="ui-summary">
                  <div className="ui-summary-row"><span className="ui-summary-label">Assessment</span><span className="ui-summary-value">{assessmentForm.name}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Category</span><span className="ui-summary-value">{categoryName}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Session</span><span className="ui-summary-value">{sessionName}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Semester</span><span className="ui-summary-value">{semesterName}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Max Marks</span><span className="ui-summary-value">{assessmentForm.maximumMarks}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Date</span><span className="ui-summary-value">{assessmentForm.defaultDate || 'Set by teacher at mark entry'}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Classes/Sections</span><span className="ui-summary-value">{selectedPairs.length}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Subjects</span><span className="ui-summary-value">{selectedSubjects.length}</span></div>
                  <div className="ui-summary-row"><span className="ui-summary-label">Valid combinations</span><span className="ui-summary-value text-blue-700">{validCombinations.combos.length}</span></div>
                </div>
                {validCombinations.skippedIneligible.length > 0 && (
                  <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    {validCombinations.skippedIneligible.length} combination(s) skipped because the subject is not eligible for that class section.
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Class-Section</th>
                        <th className="text-left p-2">Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validCombinations.combos.slice(0, 200).map((c, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="p-2">{pairLabel(c)}</td>
                          <td className="p-2">{subjects.find((s) => s.id === c.subjectId)?.name}</td>
                        </tr>
                      ))}
                      {validCombinations.combos.length > 200 && (
                        <tr><td colSpan="2" className="p-2 text-gray-400">…and {validCombinations.combos.length - 200} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="ui-wizard-nav">
              <Button variant="secondary" onClick={() => (step === 0 ? setIsAssessmentModalOpen(false) : setStep(step - 1))}>
                {step === 0 ? 'Cancel' : 'Back'}
              </Button>
              {step < 3 ? (
                <Button onClick={() => {
                  if (step === 0 && selectedPairs.length === 0) {
                    setSelectedPairs(classes.flatMap((cls) =>
                      sectionsForClass(cls.id).map((sec) => ({ schoolClassId: cls.id, sectionId: sec.id }))
                    ));
                  }
                  setStep(step + 1);
                }} disabled={!canProceed()}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleBulkSubmit} disabled={loading || validCombinations.combos.length === 0}>
                  {loading ? 'Creating...' : `Create ${validCombinations.combos.length} Assessment${validCombinations.combos.length === 1 ? '' : 's'}`}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteAssessment}
        title="Delete Assessment"
        message={`Delete "${deleteTarget?.name}" for ${deleteTarget?.schoolClass?.name}-${deleteTarget?.section?.name} / ${deleteTarget?.subject?.name}? Existing marks entries for this assessment will also be deleted.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

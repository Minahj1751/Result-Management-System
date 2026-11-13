import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
import { assessmentAPI } from '../../api/assessmentService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Table from '../../components/Table';

export default function AssessmentManagement() {
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isEditAssessment, setIsEditAssessment] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [filter, setFilter] = useState({
    academicSessionId: '', semesterId: '', schoolClassId: '', sectionId: '', subjectId: '', categoryId: '',
  });
  const [formSemesters, setFormSemesters] = useState([]);
  const [formSections, setFormSections] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', weightage: '' });
  const [assessmentForm, setAssessmentForm] = useState({
    name: '', categoryId: '', academicSessionId: '', semesterId: '', schoolClassId: '',
    sectionId: '', subjectId: '', maximumMarks: '', defaultDate: '',
  });

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

  const loadSemestersForFilter = async (academicSessionId) => {
    setFilter((f) => ({ ...f, academicSessionId, semesterId: '' }));
    setSemesters(academicSessionId ? await academicAPI.getSemesters(academicSessionId) : []);
  };

  const loadSectionsForFilter = async (schoolClassId) => {
    setFilter((f) => ({ ...f, schoolClassId, sectionId: '' }));
    setSections(schoolClassId ? await academicAPI.getSections(schoolClassId) : []);
  };

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const data = await assessmentAPI.getAssessments(cleanParams(filter));
      setAssessments(data);
    } catch (error) {
      console.error('Error loading assessments:', error);
      alert('Error loading assessments');
    } finally {
      setLoading(false);
    }
  };

  const openAssessmentModal = async (assessment = null) => {
    if (assessment) {
      setIsEditAssessment(true);
      setEditingAssessmentId(assessment.id);
      setAssessmentForm({
        name: assessment.name,
        categoryId: assessment.categoryId,
        academicSessionId: assessment.academicSessionId,
        semesterId: assessment.semesterId,
        schoolClassId: assessment.schoolClassId,
        sectionId: assessment.sectionId,
        subjectId: assessment.subjectId,
        maximumMarks: assessment.maximumMarks,
        defaultDate: assessment.defaultDate?.split('T')[0] || '',
      });
      const [sems, secs] = await Promise.all([
        academicAPI.getSemesters(assessment.academicSessionId),
        academicAPI.getSections(assessment.schoolClassId),
      ]);
      setFormSemesters(sems);
      setFormSections(secs);
    } else {
      setIsEditAssessment(false);
      setEditingAssessmentId(null);
      setAssessmentForm({
        name: '', categoryId: '', academicSessionId: '', semesterId: '', schoolClassId: '',
        sectionId: '', subjectId: '', maximumMarks: '', defaultDate: '',
      });
      setSelectedPairs([]);
      setFormSemesters([]);
      setFormSections([]);
    }
    setIsAssessmentModalOpen(true);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await assessmentAPI.createCategory(categoryForm);
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', code: '', weightage: '' });
      setCategories(await assessmentAPI.getCategories());
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating category');
    }
  };

  const togglePair = (schoolClassId, sectionId) => {
    setSelectedPairs((prev) => {
      const exists = prev.some((p) => p.schoolClassId === schoolClassId && p.sectionId === sectionId);
      return exists
        ? prev.filter((p) => !(p.schoolClassId === schoolClassId && p.sectionId === sectionId))
        : [...prev, { schoolClassId, sectionId }];
    });
  };

  const handleAssessmentSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditAssessment) {
        const { academicSessionId, semesterId, schoolClassId, sectionId, subjectId, categoryId, ...rest } = assessmentForm;
        await assessmentAPI.updateAssessment(editingAssessmentId, rest);
      } else {
        if (selectedPairs.length === 0) {
          alert('Please select at least one class and section');
          return;
        }
        const base = {
          name: assessmentForm.name,
          categoryId: assessmentForm.categoryId,
          academicSessionId: assessmentForm.academicSessionId,
          semesterId: assessmentForm.semesterId,
          subjectId: assessmentForm.subjectId,
          maximumMarks: assessmentForm.maximumMarks,
          defaultDate: assessmentForm.defaultDate,
        };
        const results = await Promise.allSettled(
          selectedPairs.map((pair) =>
            assessmentAPI.createAssessment({ ...base, schoolClassId: pair.schoolClassId, sectionId: pair.sectionId })
          )
        );
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
          alert(`${results.length - failed.length} created, ${failed.length} failed (possibly duplicates)`);
        }
      }
      setIsAssessmentModalOpen(false);
      loadAssessments();
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving assessment');
    }
  };

  const handleDeleteAssessment = async (id) => {
    if (!confirm('Delete this assessment and its marks entries?')) return;
    try {
      await assessmentAPI.deleteAssessment(id);
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

  const categoryColumns = [
    { key: 'name', label: 'Category Name' },
    { key: 'code', label: 'Code' },
    { key: 'weightage', label: 'Weightage (%)', render: (val) => `${val}%` },
  ];

  const assessmentColumns = [
    { key: 'name', label: 'Assessment' },
    { key: 'category', label: 'Category', render: (val, row) => row.category?.name },
    { key: 'subject', label: 'Subject', render: (val, row) => row.subject?.name },
    { key: 'schoolClass', label: 'Class', render: (val, row) => row.schoolClass?.name },
    { key: 'section', label: 'Section', render: (val, row) => row.section?.name },
    { key: 'maximumMarks', label: 'Max' },
    { key: 'defaultDate', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
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
          <Button size="sm" variant="danger" onClick={() => handleDeleteAssessment(row.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assessment Management</h1>

      <Card title="Assessment Categories" actions={<Button onClick={() => setIsCategoryModalOpen(true)}>Add Category</Button>} className="mb-6">
        <Table columns={categoryColumns} data={categories} />
      </Card>

      <Card className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Assessments</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Select placeholder="Session" value={filter.academicSessionId} onChange={(e) => loadSemestersForFilter(e.target.value)} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Semester" value={filter.semesterId} onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })} options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Class" value={filter.schoolClassId} onChange={(e) => loadSectionsForFilter(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          <Select placeholder="Section" value={filter.sectionId} onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Subject" value={filter.subjectId} onChange={(e) => setFilter({ ...filter, subjectId: e.target.value })} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
          <Select placeholder="Category" value={filter.categoryId} onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={loadAssessments} disabled={loading}>{loading ? 'Loading...' : 'Load Assessments'}</Button>
          <Button variant="secondary" onClick={() => openAssessmentModal()}>Add Assessment</Button>
        </div>
      </Card>

      {assessments.length > 0 && (
        <Card title="Assessments">
          <Table columns={assessmentColumns} data={assessments} />
        </Card>
      )}

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

      <Modal isOpen={isAssessmentModalOpen} onClose={() => setIsAssessmentModalOpen(false)} title={isEditAssessment ? 'Edit Assessment' : 'Add Assessment'}>
        <form onSubmit={handleAssessmentSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <Input label="Assessment Name" name="name" value={assessmentForm.name} onChange={(e) => setAssessmentForm({ ...assessmentForm, name: e.target.value })} required />
          <Select label="Category" value={assessmentForm.categoryId} onChange={(e) => setAssessmentForm({ ...assessmentForm, categoryId: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} required />
          {isEditAssessment ? (
            <>
              <Input label="Maximum Marks" type="number" name="maximumMarks" value={assessmentForm.maximumMarks} onChange={(e) => setAssessmentForm({ ...assessmentForm, maximumMarks: e.target.value })} required />
              <Input label="Default Date" type="date" name="defaultDate" value={assessmentForm.defaultDate} onChange={(e) => setAssessmentForm({ ...assessmentForm, defaultDate: e.target.value })} required />
            </>
          ) : (
            <>
              <Select label="Session" value={assessmentForm.academicSessionId} onChange={async (e) => {
                const sid = e.target.value;
                setAssessmentForm({ ...assessmentForm, academicSessionId: sid, semesterId: '' });
                setFormSemesters(sid ? await academicAPI.getSemesters(sid) : []);
              }} options={sessions.map((s) => ({ value: s.id, label: s.name }))} required />
              <Select label="Semester" value={assessmentForm.semesterId} onChange={(e) => setAssessmentForm({ ...assessmentForm, semesterId: e.target.value })} options={formSemesters.map((s) => ({ value: s.id, label: s.name }))} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classes &amp; Sections <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
                  {classes.map((cls) => {
                    const clsSections = allSections.filter((s) => s.schoolClassId === cls.id);
                    return (
                      <div key={cls.id}>
                        <div className="text-sm font-semibold text-gray-800 mb-1">{cls.name}</div>
                        <div className="flex flex-wrap gap-2 pl-3">
                          {clsSections.length === 0 && <span className="text-xs text-gray-400">No sections</span>}
                          {clsSections.map((sec) => {
                            const checked = selectedPairs.some((p) => p.schoolClassId === cls.id && p.sectionId === sec.id);
                            return (
                              <label key={sec.id} className="inline-flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePair(cls.id, sec.id)}
                                  className="w-4 h-4 text-blue-600"
                                />
                                {sec.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedPairs.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{selectedPairs.length} class-section(s) selected</p>
                )}
              </div>
              <Select label="Subject" value={assessmentForm.subjectId} onChange={(e) => setAssessmentForm({ ...assessmentForm, subjectId: e.target.value })} options={subjects.map((s) => ({ value: s.id, label: s.name }))} required />
              <Input label="Maximum Marks" type="number" name="maximumMarks" value={assessmentForm.maximumMarks} onChange={(e) => setAssessmentForm({ ...assessmentForm, maximumMarks: e.target.value })} required />
              <Input label="Default Date" type="date" name="defaultDate" value={assessmentForm.defaultDate} onChange={(e) => setAssessmentForm({ ...assessmentForm, defaultDate: e.target.value })} required />
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAssessmentModalOpen(false)}>Cancel</Button>
            <Button type="submit">{isEditAssessment ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

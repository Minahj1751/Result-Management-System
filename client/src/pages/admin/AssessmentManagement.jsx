import { useState, useEffect } from 'react';
import { academicAPI } from '../../api/academicService';
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
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [filter, setFilter] = useState({
    academicSessionId: '',
    semesterId: '',
    schoolClassId: '',
    sectionId: '',
    subjectId: '',
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', weightage: '' });
  const [assessmentForm, setAssessmentForm] = useState({
    name: '',
    categoryId: '',
    academicSessionId: '',
    semesterId: '',
    schoolClassId: '',
    sectionId: '',
    subjectId: '',
    maximumMarks: '',
    defaultDate: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [categoriesData, sessionsData, classesData, subjectsData] = await Promise.all([
        academicAPI.getAssessmentCategories(),
        academicAPI.getSessions(),
        academicAPI.getClasses(),
        academicAPI.getSubjects(),
      ]);
      setCategories(categoriesData);
      setSessions(sessionsData);
      setClasses(classesData);
      setSubjects(subjectsData);
      setSemesters([]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const handleSessionChange = async (academicSessionId) => {
    setFilter({ ...filter, academicSessionId });
    if (academicSessionId) {
      const semesters = await academicAPI.getSemesters(academicSessionId);
      setSemesters(semesters);
    }
  };

  const handleClassChange = async (schoolClassId) => {
    setFilter({ ...filter, schoolClassId });
    if (schoolClassId) {
      const sections = await academicAPI.getSections(schoolClassId);
      setSections(sections);
    }
  };

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/assessments', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filter,
      });
      const data = await response.json();
      setAssessments(data);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await academicAPI.createAssessmentCategory(categoryForm);
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', code: '', weightage: '' });
      loadInitialData();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleAssessmentSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:5000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(assessmentForm),
      });
      setIsAssessmentModalOpen(false);
      setAssessmentForm({
        name: '',
        categoryId: '',
        academicSessionId: '',
        semesterId: '',
        schoolClassId: '',
        sectionId: '',
        subjectId: '',
        maximumMarks: '',
        defaultDate: '',
      });
      loadAssessments();
    } catch (error) {
      console.error('Error creating assessment:', error);
    }
  };

  const categoryColumns = [
    { key: 'name', label: 'Category Name' },
    { key: 'code', label: 'Code' },
    { key: 'weightage', label: 'Weightage (%)', render: (val) => `${val}%` },
  ];

  const assessmentColumns = [
    { key: 'name', label: 'Assessment Name' },
    { key: 'category', label: 'Category', render: (val, row) => row.category?.name },
    { key: 'subject', label: 'Subject', render: (val, row) => row.subject?.name },
    { key: 'maximumMarks', label: 'Max Marks' },
    { key: 'defaultDate', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
    { key: 'submissionStatus', label: 'Status' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assessment Management</h1>
      
      {/* Assessment Categories */}
      <Card
        title="Assessment Categories"
        actions={<Button onClick={() => setIsCategoryModalOpen(true)}>Add Category</Button>}
        className="mb-6"
      >
        <Table columns={categoryColumns} data={categories} />
      </Card>

      {/* Filter Section */}
      <Card className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Assessments</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            placeholder="Select Session"
            value={filter.academicSessionId}
            onChange={(e) => handleSessionChange(e.target.value)}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="Select Semester"
            value={filter.semesterId}
            onChange={(e) => setFilter({ ...filter, semesterId: e.target.value })}
            options={semesters.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="Select Class"
            value={filter.schoolClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            placeholder="Select Section"
            value={filter.sectionId}
            onChange={(e) => setFilter({ ...filter, sectionId: e.target.value })}
            options={sections.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="Select Subject"
            value={filter.subjectId}
            onChange={(e) => setFilter({ ...filter, subjectId: e.target.value })}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>
        <div className="mt-4">
          <Button onClick={loadAssessments}>Load Assessments</Button>
        </div>
      </Card>

      {/* Assessments */}
      <Card
        title="Assessments"
        actions={<Button onClick={() => setIsAssessmentModalOpen(true)}>Add Assessment</Button>}
      >
        <Table columns={assessmentColumns} data={assessments} emptyMessage="Select filters and load assessments" />
      </Card>

      {/* Category Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Add Assessment Category">
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          <Input
            label="Category Name"
            name="name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            required
          />
          <Input
            label="Code"
            name="code"
            value={categoryForm.code}
            onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
            required
          />
          <Input
            label="Weightage (%)"
            type="number"
            name="weightage"
            value={categoryForm.weightage}
            onChange={(e) => setCategoryForm({ ...categoryForm, weightage: e.target.value })}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      {/* Assessment Modal */}
      <Modal isOpen={isAssessmentModalOpen} onClose={() => setIsAssessmentModalOpen(false)} title="Add Assessment">
        <form onSubmit={handleAssessmentSubmit} className="space-y-4">
          <Input
            label="Assessment Name"
            name="name"
            value={assessmentForm.name}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, name: e.target.value })}
            required
          />
          <Select
            label="Category"
            value={assessmentForm.categoryId}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, categoryId: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <Select
            label="Session"
            value={assessmentForm.academicSessionId}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, academicSessionId: e.target.value })}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
            required
          />
          <Select
            label="Semester"
            value={assessmentForm.semesterId}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, semesterId: e.target.value })}
            options={semesters.map((s) => ({ value: s.id, label: s.name }))}
            required
          />
          <Select
            label="Class"
            value={assessmentForm.schoolClassId}
            onChange={(e) => {
              setAssessmentForm({ ...assessmentForm, schoolClassId: e.target.value });
              handleClassChange(e.target.value);
            }}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <Select
            label="Section"
            value={assessmentForm.sectionId}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, sectionId: e.target.value })}
            options={sections.map((s) => ({ value: s.id, label: s.name }))}
            required
          />
          <Select
            label="Subject"
            value={assessmentForm.subjectId}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, subjectId: e.target.value })}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            required
          />
          <Input
            label="Maximum Marks"
            type="number"
            name="maximumMarks"
            value={assessmentForm.maximumMarks}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, maximumMarks: e.target.value })}
            required
          />
          <Input
            label="Default Date"
            type="date"
            name="defaultDate"
            value={assessmentForm.defaultDate}
            onChange={(e) => setAssessmentForm({ ...assessmentForm, defaultDate: e.target.value })}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAssessmentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { teacherAPI } from '../../api/teacherService';
import { academicAPI } from '../../api/academicService';
import { studentAPI } from '../../api/studentService';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import MultiSelect from '../../components/MultiSelect';
import { filterVisibleAssignments } from '../../utils/semesterVisibility';

export default function StudentSubjects() {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [students, setStudents] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [selections, setSelections] = useState({}); // studentId -> [subjectId]
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [dirty, setDirty] = useState(false);

  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId) || null;

  const subjectOptions = useMemo(
    () => classSubjects.map((cs) => ({
      value: cs.subject?.id || cs.subjectId,
      label: cs.subject?.name || cs.subjectId,
    })),
    [classSubjects]
  );

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const classAssignments = await teacherAPI.getClassTeacherAssignments();
      const active = filterVisibleAssignments((classAssignments || []).filter((a) => a.isActive));
      setAssignments(active);
      if (active.length > 0) {
        await selectAssignment(active[0]);
      }
    } catch (error) {
      console.error('Error loading class teacher assignments:', error);
    }
  };

  const loadData = async (assignment = selectedAssignment) => {
    if (!assignment) return;
    const { academicSessionId, schoolClassId, sectionId } = assignment;
    try {
      setLoading(true);
      const [studentsRes, classSubs, existing] = await Promise.all([
        studentAPI.getStudents({ academicSessionId, schoolClassId, sectionId, limit: 500 }),
        academicAPI.getClassSubjects(schoolClassId),
        studentAPI.getStudentSubjects({ academicSessionId, schoolClassId, sectionId }),
      ]);

      // Dedupe students (a student may have multiple enrollment rows)
      const seen = new Set();
      const list = (studentsRes.students || studentsRes || []).filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      setStudents(list);
      setClassSubjects(classSubs || []);

      const next = {};
      (existing || []).forEach((row) => {
        if (!next[row.studentId]) next[row.studentId] = [];
        next[row.studentId].push(row.subjectId);
      });
      setSelections(next);
      setDirty(false);
      setStudentSearch('');
    } catch (error) {
      alert(error.response?.data?.error || 'Error loading subject assignments');
    } finally {
      setLoading(false);
    }
  };

  const selectAssignment = async (assignment) => {
    if (!assignment) return;
    setSelectedAssignmentId(assignment.id);
    setStudents([]);
    setClassSubjects([]);
    setSelections({});
    await loadData(assignment);
  };

  const handleAssignmentChange = (e) => {
    selectAssignment(assignments.find((a) => a.id === e.target.value));
  };

  const setStudentSubjects = (studentId, subjectIds) => {
    setSelections((prev) => ({ ...prev, [studentId]: subjectIds }));
    setDirty(true);
  };

  const applyToAll = (subjectIds) => {
    const next = {};
    students.forEach((s) => { next[s.id] = [...subjectIds]; });
    setSelections(next);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedAssignment) return;
    try {
      setSaving(true);
      const payload = {
        academicSessionId: selectedAssignment.academicSessionId,
        schoolClassId: selectedAssignment.schoolClassId,
        sectionId: selectedAssignment.sectionId,
        assignments: students.map((s) => ({
          studentId: s.id,
          subjectIds: selections[s.id] || [],
        })),
      };
      await studentAPI.setStudentSubjects(payload);
      setDirty(false);
      alert('Subject assignments saved.');
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving subject assignments');
    } finally {
      setSaving(false);
    }
  };

  const q = studentSearch.trim().toLowerCase();
  const visibleStudents = q
    ? students.filter((s) =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        String(s.enrollments?.[0]?.rollNumber ?? '').includes(q))
    : students;

  const allSubjectIds = subjectOptions.map((o) => o.value);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Student Subject Assignment</h1>

      <Card className="mb-6">
        {assignments.length === 0 ? (
          <p className="text-gray-600">No class teacher assignment found. Contact the administrator.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Assigned Class"
                value={selectedAssignmentId}
                onChange={handleAssignmentChange}
                options={assignments.map((a) => ({
                  value: a.id,
                  label: `${a.schoolClass?.name || 'Class'} — ${a.section?.name || 'Section'}`,
                }))}
              />
              <div className="flex items-end">
                <Button onClick={() => loadData()} disabled={loading || !selectedAssignment}>
                  {loading ? 'Loading...' : 'Reload'}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Select the subjects each student will appear for on the marksheet.
              Leave a student empty to include all class subjects.
            </p>
          </>
        )}
      </Card>

      {students.length > 0 && (
        <Card title="Subjects per Student">
          {classSubjects.length === 0 ? (
            <p className="text-sm text-gray-600">
              No class-wise subjects configured for this class. Ask the administrator to map subjects under Subject Management.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by name, ID or roll..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="ui-input max-w-xs"
                />
                <span className="text-sm text-gray-600">
                  Showing {visibleStudents.length} of {students.length} students
                </span>
                <Button size="sm" variant="secondary" onClick={() => applyToAll(allSubjectIds)}>
                  Apply all subjects to everyone
                </Button>
                <Button size="sm" variant="secondary" onClick={() => applyToAll([])}>
                  Clear all selections
                </Button>
              </div>

              <div className="space-y-3">
                {visibleStudents.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border border-gray-100 rounded-md p-3"
                  >
                    <div className="md:w-64 shrink-0">
                      <div className="text-sm font-medium text-gray-900">{s.fullName}</div>
                      <div className="text-xs text-gray-500">
                        {s.studentId}
                        {s.enrollments?.[0]?.rollNumber != null && ` · Roll ${s.enrollments[0].rollNumber}`}
                        {selections[s.id]?.length > 0 && ` · ${selections[s.id].length} subject(s)`}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <MultiSelect
                        options={subjectOptions}
                        value={selections[s.id] || []}
                        onChange={(vals) => setStudentSubjects(s.id, vals)}
                        placeholder="All class subjects (default)"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSave} disabled={saving || !dirty}>
                  {saving ? 'Saving...' : 'Save Assignments'}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

import { useState } from 'react';
import { importAPI } from '../../api/importService';
import Button from '../../components/Button';
import Card from '../../components/Card';

const ENTITIES = [
  {
    key: 'students',
    label: 'Students',
    description: 'Student profiles and class enrollment.',
    api: {
      downloadTemplate: importAPI.downloadTemplate,
      preview: importAPI.preview,
      confirm: importAPI.confirm,
    },
    templateName: 'student_import_template.xlsx',
  },
  {
    key: 'teachers',
    label: 'Teachers',
    description: 'Teacher accounts and profiles.',
    api: {
      downloadTemplate: importAPI.downloadTeacherTemplate,
      preview: importAPI.previewTeachers,
      confirm: importAPI.confirmTeachers,
    },
    templateName: 'teacher_import_template.xlsx',
  },
  {
    key: 'subjects',
    label: 'Subjects',
    description: 'Subject master list.',
    api: {
      downloadTemplate: importAPI.downloadSubjectTemplate,
      preview: importAPI.previewSubjects,
      confirm: importAPI.confirmSubjects,
    },
    templateName: 'subject_import_template.xlsx',
  },
  {
    key: 'assessments',
    label: 'Assessments',
    description: 'Assessment definitions (name, category, class, subject, max marks, date). Existing assessments are updated.',
    api: {
      downloadTemplate: importAPI.downloadAssessmentTemplate,
      preview: importAPI.previewAssessments,
      confirm: importAPI.confirmAssessments,
    },
    templateName: 'assessment_import_template.xlsx',
  },
  {
    key: 'marks',
    label: 'Marks',
    description: 'Student marks per assessment. Existing entries are updated.',
    api: {
      downloadTemplate: importAPI.downloadMarksTemplate,
      preview: importAPI.previewMarks,
      confirm: importAPI.confirmMarks,
    },
    templateName: 'marks_import_template.xlsx',
  },
];

function ImportTab({ entity }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMessage('');
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await entity.api.preview(file);
      setPreview(data);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error reading file');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview?.validation?.validRows?.length) return;
    setLoading(true);
    setMessage('');
    try {
      const rows = preview.validation.validRows.map((r) => (r.data !== undefined ? r.data : r));
      const data = await entity.api.confirm(rows);
      const imported = data.importedCount ?? data.imported;
      const failed = data.failedCount ?? (data.errors?.length || 0);
      setMessage(`Import completed: ${imported ?? 'done'}, ${failed} failed`);
      setPreview(null);
      setFile(null);
    } catch (error) {
      const invalid = error.response?.data?.invalidRows;
      setMessage(
        invalid?.length
          ? `${error.response?.data?.error || 'Import failed'} — first issue: ${invalid[0].errors?.join(', ')}`
          : error.response?.data?.error || 'Import failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card className="mb-6">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{entity.description}</p>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Step 1: Download Template</h3>
            <Button onClick={() => entity.api.downloadTemplate()}>Download Template</Button>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Step 2: Upload File</h3>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { setFile(e.target.files[0] || null); setPreview(null); setMessage(''); }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {file && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Step 3: Preview</h3>
              <Button onClick={handlePreview} disabled={loading}>{loading ? 'Loading...' : 'Preview Import'}</Button>
            </div>
          )}
        </div>
      </Card>

      {message && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">{message}</div>
      )}

      {preview && (
        <Card title="Import Preview">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded"><p className="text-sm text-gray-600">Total Rows</p><p className="text-2xl font-bold text-blue-600">{preview.validation.totalRows}</p></div>
              <div className="bg-green-50 p-4 rounded"><p className="text-sm text-gray-600">Valid Rows</p><p className="text-2xl font-bold text-green-600">{preview.validation.validRows.length}</p></div>
              <div className="bg-red-50 p-4 rounded"><p className="text-sm text-gray-600">Invalid Rows</p><p className="text-2xl font-bold text-red-600">{preview.validation.invalidRows.length}</p></div>
            </div>
            {preview.validation.invalidRows.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Invalid Rows:</h4>
                <div className="max-h-48 overflow-y-auto">
                  {preview.validation.invalidRows.map((row, idx) => (
                    <div key={idx} className="text-sm text-red-600 mb-1">Row {row.rowNumber}: {row.errors.join(', ')}</div>
                  ))}
                </div>
              </div>
            )}
            {preview.validation.validRows.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleConfirmImport} disabled={loading}>{loading ? 'Importing...' : 'Confirm Import'}</Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ExcelImport() {
  const [active, setActive] = useState('students');
  const entity = ENTITIES.find((e) => e.key === active);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Excel Import</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => setActive(e.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              active === e.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      <ImportTab key={entity.key} entity={entity} />
    </div>
  );
}

import { useState } from 'react';
import { importAPI } from '../../api/importService';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function ExcelImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await importAPI.preview(file);
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
      const rows = preview.validation.validRows.map((r) => r.data);
      const data = await importAPI.confirm(rows);
      setMessage(`Import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
      setPreview(null);
      setFile(null);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Excel Student Import</h1>
      {message && <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">{message}</div>}

      <Card className="mb-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Step 1: Download Template</h3>
            <p className="text-gray-600 mb-4">Download the Excel template and fill it with student data.</p>
            <Button onClick={() => importAPI.downloadTemplate()}>Download Template</Button>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Step 2: Upload File</h3>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => { setFile(e.target.files[0] || null); setPreview(null); }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>
          {file && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Step 3: Preview</h3>
              <Button onClick={handlePreview} disabled={loading}>{loading ? 'Loading...' : 'Preview Import'}</Button>
            </div>
          )}
        </div>
      </Card>

      {preview && (
        <Card title="Import Preview">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded"><p className="text-sm text-gray-600">Total Rows</p><p className="text-2xl font-bold text-blue-600">{preview.validation.totalRows}</p></div>
              <div className="bg-green-50 p-4 rounded"><p className="text-sm text-gray-600">Valid Rows</p><p className="text-2xl font-bold text-green-600">{preview.validation.validRows.length}</p></div>
              <div className="bg-red-50 p-4 rounded"><p className="text-sm text-gray-600">Invalid Rows</p><p className="text-2xl font-bold text-red-600">{preview.validation.invalidRows.length}</p></div>
              <div className="bg-yellow-50 p-4 rounded"><p className="text-sm text-gray-600">Duplicates</p><p className="text-2xl font-bold text-yellow-600">{preview.validation.duplicateStudentIds.length}</p></div>
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

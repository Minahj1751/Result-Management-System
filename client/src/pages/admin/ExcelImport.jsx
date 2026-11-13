import { useState } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function ExcelImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/import/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      const data = await response.json();
      setPreview(data);
    } catch (error) {
      console.error('Error previewing file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/import/template', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || !preview.validation.validRows.length) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/import/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ validRows: preview.validation.validRows }),
      });
      const data = await response.json();
      alert(`Import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
      setPreview(null);
      setFile(null);
    } catch (error) {
      console.error('Error confirming import:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Excel Student Import</h1>
      
      <Card className="mb-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Step 1: Download Template</h3>
            <p className="text-gray-600 mb-4">Download the Excel template and fill it with student data.</p>
            <Button onClick={handleDownloadTemplate}>Download Template</Button>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Step 2: Upload File</h3>
            <p className="text-gray-600 mb-4">Upload the filled Excel file.</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {file && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Step 3: Preview</h3>
              <p className="text-gray-600 mb-4">Preview the data before importing.</p>
              <Button onClick={handlePreview} disabled={loading}>
                {loading ? 'Loading...' : 'Preview Import'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {preview && (
        <Card title="Import Preview">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-blue-600">{preview.validation.totalRows}</p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <p className="text-sm text-gray-600">Valid Rows</p>
                <p className="text-2xl font-bold text-green-600">{preview.validation.validRows.length}</p>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <p className="text-sm text-gray-600">Invalid Rows</p>
                <p className="text-2xl font-bold text-red-600">{preview.validation.invalidRows.length}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded">
                <p className="text-sm text-gray-600">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600">{preview.validation.duplicateStudentIds.length}</p>
              </div>
            </div>

            {preview.validation.invalidRows.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Invalid Rows:</h4>
                <div className="max-h-48 overflow-y-auto">
                  {preview.validation.invalidRows.map((row, idx) => (
                    <div key={idx} className="text-sm text-red-600 mb-1">
                      Row {row.rowNumber}: {row.errors.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.validation.validRows.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleConfirmImport} disabled={loading}>
                  {loading ? 'Importing...' : 'Confirm Import'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

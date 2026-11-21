import api from './axios';

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const exportAPI = {
  students: async (params = {}) => {
    const response = await api.get('/export/students', { params, responseType: 'blob' });
    downloadBlob(response.data, `students_export_${Date.now()}.xlsx`);
  },
  teachers: async (params = {}) => {
    const response = await api.get('/export/teachers', { params, responseType: 'blob' });
    downloadBlob(response.data, `teachers_export_${Date.now()}.xlsx`);
  },
  subjects: async () => {
    const response = await api.get('/export/subjects', { responseType: 'blob' });
    downloadBlob(response.data, `subjects_export_${Date.now()}.xlsx`);
  },
  attendance: async (params = {}) => {
    const response = await api.get('/export/attendance', { params, responseType: 'blob' });
    downloadBlob(response.data, `attendance_export_${Date.now()}.xlsx`);
  },
  results: async (params = {}) => {
    const response = await api.get('/export/results', { params, responseType: 'blob' });
    downloadBlob(response.data, `results_export_${Date.now()}.xlsx`);
  },
  assessments: async (params = {}) => {
    const response = await api.get('/export/assessments', { params, responseType: 'blob' });
    downloadBlob(response.data, `assessments_export_${Date.now()}.xlsx`);
  },
  marks: async (params = {}) => {
    const response = await api.get('/export/marks', { params, responseType: 'blob' });
    downloadBlob(response.data, `marks_export_${Date.now()}.xlsx`);
  },
};

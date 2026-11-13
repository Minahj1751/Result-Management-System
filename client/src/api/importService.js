import api from './axios';

export const importAPI = {
  downloadTemplate: async () => {
    const response = await api.get('/import/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  preview: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  confirm: async (rows) => {
    const response = await api.post('/import/confirm', { rows });
    return response.data;
  },
};

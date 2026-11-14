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
  downloadTeacherTemplate: async () => {
    const response = await api.get('/import/teachers/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teacher_import_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  previewTeachers: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/teachers/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  confirmTeachers: async (rows) => {
    const response = await api.post('/import/teachers/confirm', { rows });
    return response.data;
  },
  downloadSubjectTemplate: async () => {
    const response = await api.get('/import/subjects/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subject_import_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  previewSubjects: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/subjects/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  confirmSubjects: async (rows) => {
    const response = await api.post('/import/subjects/confirm', { rows });
    return response.data;
  },
};

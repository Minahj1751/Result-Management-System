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

export const pdfAPI = {
  downloadStudentMarksheet: async (params, filename) => {
    const response = await api.get('/pdf/student', {
      params,
      responseType: 'blob',
    });
    downloadBlob(response.data, filename || 'marksheet.pdf');
  },
  downloadClassMarksheets: async (params, filename) => {
    const response = await api.get('/pdf/class', {
      params,
      responseType: 'blob',
    });
    downloadBlob(response.data, filename || 'marksheets.zip');
  },
};

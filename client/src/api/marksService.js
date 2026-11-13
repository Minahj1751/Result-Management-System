import api from './axios';

export const marksAPI = {
  getEntries: async (params = {}) => {
    const response = await api.get('/marks/entries', { params });
    return response.data;
  },
  getAssessmentMarks: async (assessmentId) => {
    const response = await api.get(`/marks/assessment/${assessmentId}`);
    return response.data;
  },
  upsertEntry: async (data) => {
    const response = await api.post('/marks', data);
    return response.data;
  },
  bulkUpsert: async (entries) => {
    const response = await api.post('/marks/bulk', { entries });
    return response.data;
  },
  deleteEntry: async (id) => {
    const response = await api.delete(`/marks/${id}`);
    return response.data;
  },
};

import api from './axios';

export const termExamAPI = {
  getMarks: async (params = {}) => {
    const response = await api.get('/term-exam/marks', { params });
    return response.data;
  },
  bulkUpsert: async (data) => {
    const response = await api.put('/term-exam/marks', data);
    return response.data;
  },
};

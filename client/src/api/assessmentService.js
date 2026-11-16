import api from './axios';

export const assessmentAPI = {
  getCategories: async () => {
    const response = await api.get('/assessments/categories');
    return response.data;
  },
  createCategory: async (data) => {
    const response = await api.post('/assessments/categories', data);
    return response.data;
  },
  updateCategory: async (id, data) => {
    const response = await api.patch(`/assessments/categories/${id}`, data);
    return response.data;
  },
  deleteCategory: async (id) => {
    const response = await api.delete(`/assessments/categories/${id}`);
    return response.data;
  },
  getAssessments: async (params = {}) => {
    const response = await api.get('/assessments', { params });
    return response.data;
  },
  getEligibleSubjects: async (params) => {
    const response = await api.get('/assessments/eligible-subjects', { params });
    return response.data;
  },
  bulkCreateAssessments: async (data) => {
    const response = await api.post('/assessments/bulk', data);
    return response.data;
  },
  createAssessment: async (data) => {
    const response = await api.post('/assessments', data);
    return response.data;
  },
  updateAssessment: async (id, data) => {
    const response = await api.patch(`/assessments/${id}`, data);
    return response.data;
  },
  bulkUpdateStatus: async (ids, submissionStatus) => {
    const response = await api.patch('/assessments/bulk-status', { ids, submissionStatus });
    return response.data;
  },
  updateAssessmentDate: async (id, defaultDate) => {
    const response = await api.patch(`/assessments/${id}/date`, { defaultDate });
    return response.data;
  },
  deleteAssessment: async (id) => {
    const response = await api.delete(`/assessments/${id}`);
    return response.data;
  },
};

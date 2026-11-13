import api from './axios';

export const settingsAPI = {
  getSchoolSettings: async () => {
    const response = await api.get('/settings/school');
    return response.data;
  },
  updateSchoolSettings: async (data) => {
    const response = await api.patch('/settings/school', data);
    return response.data;
  },
  getGradingPolicies: async () => {
    const response = await api.get('/settings/grading-policies');
    return response.data;
  },
  updateGradingPolicy: async (id, data) => {
    const response = await api.patch(`/settings/grading-policies/${id}`, data);
    return response.data;
  },
  upsertGradeScale: async (gradingPolicyId, data) => {
    const response = data.id
      ? await api.patch(`/settings/grade-scales/${data.id}`, data)
      : await api.post(`/settings/grading-policies/${gradingPolicyId}/grade-scales`, data);
    return response.data;
  },
  deleteGradeScale: async (id) => {
    const response = await api.delete(`/settings/grade-scales/${id}`);
    return response.data;
  },
};

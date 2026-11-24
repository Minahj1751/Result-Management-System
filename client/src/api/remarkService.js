import api from './axios';

export const remarkAPI = {
  getSectionRemarks: async (params) => {
    const response = await api.get('/remarks', { params });
    return response.data;
  },
  upsertRemark: async (data) => {
    const response = await api.put('/remarks', data);
    return response.data;
  },
};

import api from './axios';

export const resultAPI = {
  calculateStudent: async (params) => {
    const response = await api.get('/results/calculate', { params });
    return response.data;
  },
  calculateClass: async (params) => {
    const response = await api.get('/results/calculate-class', { params });
    return response.data;
  },
  getSnapshots: async (params) => {
    const response = await api.get('/results/snapshots', { params });
    return response.data;
  },
  finalize: async (data) => {
    const response = await api.post('/results/finalize', data);
    return response.data;
  },
  finalizeBulk: async (data) => {
    const response = await api.post('/results/finalize-bulk', data);
    return response.data;
  },
};

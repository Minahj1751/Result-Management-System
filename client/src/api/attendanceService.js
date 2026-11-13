import api from './axios';

export const attendanceAPI = {
  getRecords: async (params = {}) => {
    const response = await api.get('/attendance/records', { params });
    return response.data;
  },
  getClassAttendance: async (params) => {
    const response = await api.get('/attendance/class', { params });
    return response.data;
  },
  upsert: async (data) => {
    const response = await api.post('/attendance', data);
    return response.data;
  },
  bulkUpsert: async (entries) => {
    const response = await api.post('/attendance/bulk', { entries });
    return response.data;
  },
};

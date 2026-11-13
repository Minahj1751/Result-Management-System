import api from './axios';

export const studentAPI = {
  getStudents: async (params) => {
    const response = await api.get('/students', { params });
    return response.data;
  },
  createStudent: async (data) => {
    const response = await api.post('/students', data);
    return response.data;
  },
  getStudentById: async (id) => {
    const response = await api.get(`/students/${id}`);
    return response.data;
  },
  updateStudent: async (id, data) => {
    const response = await api.patch(`/students/${id}`, data);
    return response.data;
  },
  bulkUpdateStatus: async (ids, isActive) => {
    const response = await api.patch('/students/bulk-status', { ids, isActive });
    return response.data;
  },
  createEnrollment: async (data) => {
    const response = await api.post('/students/enrollments', data);
    return response.data;
  },
  updateEnrollment: async (id, data) => {
    const response = await api.patch(`/students/enrollments/${id}`, data);
    return response.data;
  },
};

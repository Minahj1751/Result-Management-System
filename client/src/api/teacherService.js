import api from './axios';

export const teacherAPI = {
  getTeachers: async () => {
    const response = await api.get('/teachers');
    return response.data;
  },
  createTeacher: async (data) => {
    const response = await api.post('/teachers', data);
    return response.data;
  },
  getTeacherById: async (id) => {
    const response = await api.get(`/teachers/${id}`);
    return response.data;
  },
  updateTeacher: async (id, data) => {
    const response = await api.patch(`/teachers/${id}`, data);
    return response.data;
  },
  getTeacherAssignments: async (params) => {
    const response = await api.get('/teachers/assignments', { params });
    return response.data;
  },
  createTeacherAssignment: async (data) => {
    const response = await api.post('/teachers/assignments', data);
    return response.data;
  },
  updateTeacherAssignment: async (id, data) => {
    const response = await api.patch(`/teachers/assignments/${id}`, data);
    return response.data;
  },
  getClassTeacherAssignments: async (params) => {
    const response = await api.get('/teachers/class-teacher-assignments', { params });
    return response.data;
  },
  createClassTeacherAssignment: async (data) => {
    const response = await api.post('/teachers/class-teacher-assignments', data);
    return response.data;
  },
  updateClassTeacherAssignment: async (id, data) => {
    const response = await api.patch(`/teachers/class-teacher-assignments/${id}`, data);
    return response.data;
  },
};

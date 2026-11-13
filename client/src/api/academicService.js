import api from './axios';

export const academicAPI = {
  // Academic Sessions
  getSessions: async () => {
    const response = await api.get('/academic/sessions');
    return response.data;
  },
  createSession: async (data) => {
    const response = await api.post('/academic/sessions', data);
    return response.data;
  },
  updateSession: async (id, data) => {
    const response = await api.patch(`/academic/sessions/${id}`, data);
    return response.data;
  },

  // Semesters
  getSemesters: async (academicSessionId) => {
    const response = await api.get('/academic/semesters', { params: { academicSessionId } });
    return response.data;
  },
  createSemester: async (data) => {
    const response = await api.post('/academic/semesters', data);
    return response.data;
  },

  // Classes
  getClasses: async () => {
    const response = await api.get('/academic/classes');
    return response.data;
  },
  createClass: async (data) => {
    const response = await api.post('/academic/classes', data);
    return response.data;
  },
  updateClass: async (id, data) => {
    const response = await api.patch(`/academic/classes/${id}`, data);
    return response.data;
  },

  // Sections
  getSections: async (schoolClassId) => {
    const response = await api.get('/academic/sections', { params: { schoolClassId } });
    return response.data;
  },
  createSection: async (data) => {
    const response = await api.post('/academic/sections', data);
    return response.data;
  },

  // Subjects
  getSubjects: async () => {
    const response = await api.get('/academic/subjects');
    return response.data;
  },
  createSubject: async (data) => {
    const response = await api.post('/academic/subjects', data);
    return response.data;
  },
  updateSubject: async (id, data) => {
    const response = await api.patch(`/academic/subjects/${id}`, data);
    return response.data;
  },

  // Assessment Categories
  getAssessmentCategories: async () => {
    const response = await api.get('/assessments/categories');
    return response.data;
  },
  createAssessmentCategory: async (data) => {
    const response = await api.post('/assessments/categories', data);
    return response.data;
  },
};

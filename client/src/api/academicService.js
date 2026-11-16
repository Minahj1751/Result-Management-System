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
  deleteSession: async (id) => {
    const response = await api.delete(`/academic/sessions/${id}`);
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
  updateSemester: async (id, data) => {
    const response = await api.patch(`/academic/semesters/${id}`, data);
    return response.data;
  },
  deleteSemester: async (id) => {
    const response = await api.delete(`/academic/semesters/${id}`);
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
  deleteClass: async (id) => {
    const response = await api.delete(`/academic/classes/${id}`);
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
  updateSection: async (id, data) => {
    const response = await api.patch(`/academic/sections/${id}`, data);
    return response.data;
  },
  deleteSection: async (id) => {
    const response = await api.delete(`/academic/sections/${id}`);
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
  deleteSubject: async (id) => {
    const response = await api.delete(`/academic/subjects/${id}`);
    return response.data;
  },

  // Class-wise subject mapping
  getClassSubjects: async (schoolClassId) => {
    const response = await api.get('/academic/class-subjects', { params: schoolClassId ? { schoolClassId } : {} });
    return response.data;
  },
  setClassSubjects: async (schoolClassId, subjectIds) => {
    const response = await api.put('/academic/class-subjects', { schoolClassId, subjectIds });
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

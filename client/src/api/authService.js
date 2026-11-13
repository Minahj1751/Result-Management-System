import api from './axios';

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  resetPassword: async (userId, newPassword) => {
    const response = await api.post('/auth/reset-password', {
      userId,
      newPassword,
    });
    return response.data;
  },

  toggleAccountStatus: async (userId, isActive) => {
    const response = await api.patch(`/auth/users/${userId}/status`, {
      isActive,
    });
    return response.data;
  },
};

const authService = require('../services/authService');
const prisma = require('../config/database');

/**
 * Login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (client-side token removal)
 */
const logout = async (req, res, next) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password (admin only)
 */
const resetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;

    const result = await authService.resetPassword(userId, newPassword);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Activate/deactivate account (admin only)
 */
const toggleAccountStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getCurrentUser,
  changePassword,
  resetPassword,
  toggleAccountStatus,
};

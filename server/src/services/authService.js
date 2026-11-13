const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

/**
 * Login user
 */
const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      teacherProfile: true,
    },
  });

  const authError = (message) => {
    const error = new Error(message);
    error.statusCode = 401;
    return error;
  };

  if (!user) {
    throw authError('Invalid credentials');
  }

  if (!user.isActive) {
    throw authError('Account is deactivated');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw authError('Invalid credentials');
  }

  const token = generateToken(user.id);

  // Remove password hash from response
  const { passwordHash, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    token,
  };
};

/**
 * Change password
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  return { message: 'Password changed successfully' };
};

/**
 * Reset password (admin-assisted)
 */
const resetPassword = async (userId, newPassword) => {
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  return { message: 'Password reset successfully' };
};

/**
 * Get current user
 */
const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teacherProfile: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const { passwordHash, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

module.exports = {
  generateToken,
  login,
  changePassword,
  resetPassword,
  getCurrentUser,
};

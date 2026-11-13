const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginValidation, changePasswordValidation } = require('../validators/authValidator');

// Public routes
router.post('/login', loginValidation, validate, authController.login);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword);

// Admin only routes
router.post('/reset-password', authenticate, isAdmin, authController.resetPassword);
router.patch('/users/:userId/status', authenticate, isAdmin, authController.toggleAccountStatus);

module.exports = router;

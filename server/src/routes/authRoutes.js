const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginValidation, changePasswordValidation } = require('../validators/authValidator');
const createRateLimiter = require('../middleware/rateLimit');

const loginRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// Public routes
router.post('/login', loginRateLimit, loginValidation, validate, authController.login);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword);

// Admin only routes
router.post('/reset-password', authenticate, isAdmin, authController.resetPassword);
router.patch('/users/:userId/status', authenticate, isAdmin, authController.toggleAccountStatus);

module.exports = router;

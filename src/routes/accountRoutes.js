const express = require('express');
const AccountController = require('../controllers/accountController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { protectedRoute } = require('../middleware/authMiddleware');

const router = express.Router();
const accountController = new AccountController();

// Apply CORS headers to all account routes
router.use((req, res, next) => {
  setCorsHeaders(res, req);
  next();
});

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
  setCorsHeaders(res, req);
  res.status(200).json({ message: 'CORS preflight OK' });
});

/**
 * @route GET /api/user/profile
 * @desc Get user profile information
 * @access Protected
 */
router.get('/profile', protectedRoute(), accountController.getUserProfile.bind(accountController));

/**
 * @route PUT /api/user/profile
 * @desc Update user profile information
 * @access Protected
 */
router.put('/profile', protectedRoute(), accountController.updateUserProfile.bind(accountController));

/**
 * @route PUT /api/user/change-password
 * @desc Change user password
 * @access Protected
 */
router.put('/change-password', protectedRoute(), accountController.changePassword.bind(accountController));

/**
 * @route GET /api/user/subscription
 * @desc Get user subscription information
 * @access Protected
 */
router.get('/subscription', protectedRoute(), accountController.getUserSubscription.bind(accountController));

/**
 * @route POST /api/user/subscription/upgrade
 * @desc Upgrade user subscription
 * @access Protected
 */
router.post('/subscription/upgrade', protectedRoute(), accountController.upgradeSubscription.bind(accountController));

/**
 * @route GET /api/user/usage
 * @desc Get API usage statistics
 * @access Protected
 */
router.get('/usage', protectedRoute(), accountController.getApiUsage.bind(accountController));

/**
 * @route GET /api/user/logs
 * @desc Get request logs
 * @access Protected
 */
router.get('/logs', protectedRoute(), accountController.getRequestLogs.bind(accountController));

/**
 * @route GET /api/user/logs/stats
 * @desc Get user log statistics
 * @access Protected
 */
router.get('/logs/stats', protectedRoute(), accountController.getUserLogStats.bind(accountController));

/**
 * @route GET /api/user/notifications/settings
 * @desc Get notification settings
 * @access Protected
 */
router.get('/notifications/settings', protectedRoute(), accountController.getNotificationSettings.bind(accountController));

/**
 * @route PUT /api/user/notifications/settings
 * @desc Update notification settings
 * @access Protected
 */
router.put('/notifications/settings', protectedRoute(), accountController.updateNotificationSettings.bind(accountController));

module.exports = router;

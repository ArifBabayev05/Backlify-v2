const express = require('express');
const AccountController = require('../controllers/accountController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { protectedRoute } = require('../middleware/authMiddleware');
const apiUsageController = require('../controllers/apiUsageController');

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
 * @route GET /api/user/health
 * @desc Test endpoint to check if account routes are working
 * @access Public
 */
router.get('/health', (req, res) => {
  setCorsHeaders(res, req);
  res.json({
    success: true,
    message: 'Account routes are working!',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /api/user/profile',
      'PUT /api/user/profile', 
      'PUT /api/user/change-password',
      'GET /api/user/subscription',
      'POST /api/user/subscription/upgrade',
      'GET /api/user/usage',
      'GET /api/user/logs',
      'GET /api/user/logs/stats',
      'GET /api/user/notifications/settings',
      'PUT /api/user/notifications/settings'
    ]
  });
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
router.get('/logs', accountController.getRequestLogs.bind(accountController));

/**
 * @route GET /api/user/logs/stats
 * @desc Get user log statistics
 * @access Protected
 */
router.get('/logs/stats', accountController.getUserLogStats.bind(accountController));

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

// ========== API USAGE ROUTES ==========

/**
 * @route GET /api/user/plans
 * @desc Get all available plans
 * @access Public
 */
router.get('/plans', apiUsageController.getPlans.bind(apiUsageController));

/**
 * @route GET /api/user/usage/stats
 * @desc Get usage statistics (admin only)
 * @access Protected
 */
router.get('/usage/stats', protectedRoute(), apiUsageController.getApiUsageStats.bind(apiUsageController));

/**
 * @route POST /api/user/usage/reset
 * @desc Reset monthly usage (admin only)
 * @access Protected
 */
router.post('/usage/reset', protectedRoute(), apiUsageController.resetMonthlyApiUsage.bind(apiUsageController));

module.exports = router;

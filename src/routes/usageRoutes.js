const express = require('express');
const router = express.Router();
const usageController = require('../controllers/usageController');
const authMiddleware = require('../middleware/authMiddleware');
const limitMiddleware = require('../middleware/limitMiddleware');

// Get current user's usage information
router.get('/current', authMiddleware.authenticate, usageController.getCurrentUsage);

// Get all available plans
router.get('/plans', usageController.getPlans);

// Get usage statistics (admin only)
router.get('/stats', 
  authMiddleware.authenticate, 
  usageController.getUsageStats
);

// Reset monthly usage (admin only)
router.post('/reset', 
  authMiddleware.authenticate, 
  usageController.resetMonthlyUsage
);

module.exports = router;

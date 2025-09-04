const express = require('express');
const router = express.Router();
const apiUsageController = require('../controllers/apiUsageController');
const authMiddleware = require('../middleware/authMiddleware');

// Get current API's usage information
router.get('/:apiId/usage', apiUsageController.getApiUsage);

// Get all available plans (public)
router.get('/plans', apiUsageController.getPlans);

// Get API usage statistics (admin only)
router.get('/usage/stats', 
  authMiddleware.authenticate, 
  apiUsageController.getApiUsageStats
);

// Reset monthly API usage (admin only)
router.post('/usage/reset', 
  authMiddleware.authenticate, 
  apiUsageController.resetMonthlyApiUsage
);

module.exports = router;

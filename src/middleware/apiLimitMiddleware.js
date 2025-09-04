const apiUsageService = require('../services/apiUsageService');

class ApiLimitMiddleware {
  /**
   * Check API request limit for public APIs
   */
  checkApiRequestLimit() {
    return async (req, res, next) => {
      try {
        // Extract API ID from URL
        const apiMatch = req.originalUrl.match(/\/api\/([^/]+)/);
        if (!apiMatch || !apiMatch[1]) {
          return next();
        }
        
        const apiId = apiMatch[1];
        const userId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.XAuthUserId;
        
        console.log(`Checking API request limit for API: ${apiId}, User: ${userId}`);
        
        // Check if limit is exceeded
        const limitCheck = await apiUsageService.checkApiRequestLimit(apiId, userId);
        
        if (!limitCheck.allowed) {
          return res.status(403).json({
            success: false,
            message: limitCheck.reason,
            current: limitCheck.current,
            limit: limitCheck.limit
          });
        }
        
        next();
      } catch (error) {
        console.error('Error in API request limit middleware:', error);
        // Allow request to continue if there's an error
        next();
      }
    };
  }

  /**
   * Check project limit for /generate-schema endpoint
   */
  checkProjectLimit() {
    return async (req, res, next) => {
      try {
        const userId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.XAuthUserId;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }
        
        console.log(`Checking project limit for User: ${userId}`);
        
        // Check if limit is exceeded
        const limitCheck = await apiUsageService.checkProjectLimit(userId);
        
        if (!limitCheck.allowed) {
          return res.status(403).json({
            success: false,
            message: limitCheck.reason,
            current: limitCheck.current,
            limit: limitCheck.limit
          });
        }
        
        next();
      } catch (error) {
        console.error('Error in project limit middleware:', error);
        // Allow request to continue if there's an error
        next();
      }
    };
  }
}

module.exports = new ApiLimitMiddleware();
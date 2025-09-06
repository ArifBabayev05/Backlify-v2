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
        
        // Store API info for later increment
        req.apiId = apiId;
        req.userId = userId;
        
        // Intercept the response to increment count on success
        const originalSend = res.send;
        res.send = function(data) {
          // Only increment if response is successful (2xx status)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Increment asynchronously without blocking response
            apiUsageService.incrementApiRequestCount(req.apiId, req.userId, req)
              .catch(error => console.error('Error incrementing API request count:', error));
          }
          return originalSend.call(this, data);
        };
        
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
        
        // Store user info for later increment
        req.userId = userId;
        
        // Intercept the response to increment project count on success
        const originalSend = res.send;
        res.send = function(data) {
          // Only increment if response is successful (2xx status)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Increment asynchronously without blocking response
            apiUsageService.incrementProjectCount(req.userId)
              .catch(error => console.error('Error incrementing project count:', error));
          }
          return originalSend.call(this, data);
        };
        
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
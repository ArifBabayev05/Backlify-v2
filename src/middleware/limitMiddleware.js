const UsageService = require('../services/usageService');

class LimitMiddleware {
  constructor() {
    this.usageService = new UsageService();
  }

  /**
   * Middleware to check API request limits
   * @returns {Function} Express middleware function
   */
  checkRequestLimit() {
    return async (req, res, next) => {
      try {
        // Skip if no user (public endpoints)
        if (!req.user || !req.user.id) {
          return next();
        }

        const userId = req.user.id;
        const userPlan = req.user.plan_id || 'basic';

        // Check if user can make the request
        const checkResult = await this.usageService.canMakeRequest(userId, userPlan);

        if (!checkResult.allowed) {
          return res.status(403).json({
            success: false,
            message: checkResult.message
          });
        }

        // Increment request count
        await this.usageService.incrementRequestCount(userId, userPlan);

        // Add usage info to request for logging
        req.usageInfo = checkResult.usage;

        next();
      } catch (error) {
        console.error('Error in request limit middleware:', error);
        
        // Allow request to continue if there's an error checking limits
        // This prevents the system from breaking if usage service fails
        next();
      }
    };
  }

  /**
   * Middleware to check project creation limits (for /generate-schema)
   * @returns {Function} Express middleware function
   */
  checkProjectLimit() {
    return async (req, res, next) => {
      console.log('🔍 Project limit middleware called for:', req.method, req.originalUrl);
      try {
        // Get user ID from various sources (headers, body, or req.user)
        const userId = req.user?.id || 
                      req.headers['x-user-id'] || 
                      req.headers['X-User-Id'] || 
                      req.body?.XAuthUserId ||
                      req.XAuthUserId;

        // Skip if no user ID found
        if (!userId) {
          console.log('No user ID found, skipping project limit check');
          console.log('Available sources:', {
            'req.user?.id': req.user?.id,
            'req.headers[x-user-id]': req.headers['x-user-id'],
            'req.headers[X-User-Id]': req.headers['X-User-Id'],
            'req.body?.XAuthUserId': req.body?.XAuthUserId,
            'req.XAuthUserId': req.XAuthUserId
          });
          return next();
        }

        // Get user plan from headers or default to basic
        const userPlan = req.user?.plan_id || 
                        req.headers['x-user-plan'] || 
                        req.headers['X-User-Plan'] || 
                        'basic';

        console.log(`Checking project limit for User: ${userId}, Plan: ${userPlan}`);

        // Check if user can create a project
        const checkResult = await this.usageService.canCreateProject(userId, userPlan);

        if (!checkResult.allowed) {
          return res.status(403).json({
            success: false,
            message: checkResult.message
          });
        }

        // Store user info for later increment
        req.userId = userId;
        req.userPlan = userPlan;

        // Intercept the response to increment project count on success
        const originalSend = res.send;
        res.send = function(data) {
          // Only increment if response is successful (2xx status)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Increment asynchronously without blocking response
            this.usageService.incrementProjectCount(req.userId, req.userPlan)
              .catch(error => console.error('Error incrementing project count:', error));
          }
          return originalSend.call(this, data);
        }.bind(this);

        // Add usage info to request for logging
        req.usageInfo = checkResult.usage;

        next();
      } catch (error) {
        console.error('Error in project limit middleware:', error);
        
        // Allow request to continue if there's an error checking limits
        // This prevents the system from breaking if usage service fails
        next();
      }
    };
  }

  /**
   * Middleware to check both limits (for endpoints that do both)
   * @returns {Function} Express middleware function
   */
  checkBothLimits() {
    return async (req, res, next) => {
      try {
        // Skip if no user (public endpoints)
        if (!req.user || !req.user.id) {
          return next();
        }

        const userId = req.user.id;
        const userPlan = req.user.plan_id || 'basic';

        // Check project limit first
        const projectCheck = await this.usageService.canCreateProject(userId, userPlan);
        if (!projectCheck.allowed) {
          return res.status(403).json({
            success: false,
            message: projectCheck.message
          });
        }

        // Check request limit
        const requestCheck = await this.usageService.canMakeRequest(userId, userPlan);
        if (!requestCheck.allowed) {
          return res.status(403).json({
            success: false,
            message: requestCheck.message
          });
        }

        // Increment both counters
        await Promise.all([
          this.usageService.incrementProjectCount(userId, userPlan),
          this.usageService.incrementRequestCount(userId, userPlan)
        ]);

        // Add usage info to request for logging
        req.usageInfo = {
          ...projectCheck.usage,
          requestsCount: requestCheck.usage.requestsCount
        };

        next();
      } catch (error) {
        console.error('Error in both limits middleware:', error);
        
        // Allow request to continue if there's an error checking limits
        next();
      }
    };
  }

  /**
   * Middleware to get usage info without blocking (for info endpoints)
   * @returns {Function} Express middleware function
   */
  getUsageInfo() {
    return async (req, res, next) => {
      try {
        // Skip if no user
        if (!req.user || !req.user.id) {
          return next();
        }

        const userId = req.user.id;
        const userPlan = req.user.plan_id || 'basic';

        // Get usage info without incrementing
        const usage = await this.usageService.getCurrentUsage(userId, userPlan);
        req.usageInfo = usage;

        next();
      } catch (error) {
        console.error('Error getting usage info:', error);
        next();
      }
    };
  }

  /**
   * Middleware to check if user has any plan (not free)
   * @returns {Function} Express middleware function
   */
  requirePaidPlan() {
    return (req, res, next) => {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userPlan = req.user.plan_id || 'basic';
      
      if (userPlan === 'basic') {
        return res.status(403).json({
          success: false,
          message: 'This feature requires a paid plan. Please upgrade your subscription.'
        });
      }

      next();
    };
  }

  /**
   * Middleware to check if user has enterprise plan
   * @returns {Function} Express middleware function
   */
  requireEnterprisePlan() {
    return (req, res, next) => {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userPlan = req.user.plan_id || 'basic';
      
      if (userPlan !== 'enterprise') {
        return res.status(403).json({
          success: false,
          message: 'This feature requires an Enterprise plan. Please upgrade your subscription.'
        });
      }

      next();
    };
  }
}

module.exports = new LimitMiddleware();

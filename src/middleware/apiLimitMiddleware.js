const ApiUsageService = require('../services/apiUsageService');

class ApiLimitMiddleware {
  constructor() {
    this.apiUsageService = new ApiUsageService();
  }

  /**
   * Middleware to check API request limits by API ID
   * @returns {Function} Express middleware function
   */
  checkApiRequestLimit() {
    return async (req, res, next) => {
      try {
        const apiId = req.params.apiId;
        
        if (!apiId) {
          return next();
        }

        // Check if API can make the request
        const checkResult = await this.apiUsageService.canApiMakeRequest(apiId);

        if (!checkResult.allowed) {
          return res.status(403).json({
            success: false,
            message: checkResult.message
          });
        }

        // Increment request count
        await this.apiUsageService.incrementApiRequestCount(apiId);

        // Add usage info to request for logging
        req.apiUsageInfo = checkResult.usage;

        next();
      } catch (error) {
        console.error('Error in API request limit middleware:', error);
        
        // Allow request to continue if there's an error checking limits
        // This prevents the system from breaking if usage service fails
        next();
      }
    };
  }

  /**
   * Middleware to check API project creation limits
   * @returns {Function} Express middleware function
   */
  checkApiProjectLimit() {
    return async (req, res, next) => {
      try {
        const apiId = req.params.apiId;
        
        if (!apiId) {
          return next();
        }

        // Check if API can create a project
        const checkResult = await this.apiUsageService.canApiCreateProject(apiId);

        if (!checkResult.allowed) {
          return res.status(403).json({
            success: false,
            message: checkResult.message
          });
        }

        // Increment project count
        await this.apiUsageService.incrementApiProjectCount(apiId);

        // Add usage info to request for logging
        req.apiUsageInfo = checkResult.usage;

        next();
      } catch (error) {
        console.error('Error in API project limit middleware:', error);
        
        // Allow request to continue if there's an error checking limits
        next();
      }
    };
  }

  /**
   * Middleware to get API usage info without blocking
   * @returns {Function} Express middleware function
   */
  getApiUsageInfo() {
    return async (req, res, next) => {
      try {
        const apiId = req.params.apiId;
        
        if (!apiId) {
          return next();
        }

        // Get usage info without incrementing
        const usage = await this.apiUsageService.getCurrentApiUsage(apiId);
        req.apiUsageInfo = usage;

        next();
      } catch (error) {
        console.error('Error getting API usage info:', error);
        next();
      }
    };
  }

  /**
   * Middleware to check if API owner has any plan (not free)
   * @returns {Function} Express middleware function
   */
  requireApiPaidPlan() {
    return async (req, res, next) => {
      try {
        const apiId = req.params.apiId;
        
        if (!apiId) {
          return next();
        }

        const usage = await this.apiUsageService.getCurrentApiUsage(apiId);
        
        if (usage.userPlan === 'basic') {
          return res.status(403).json({
            success: false,
            message: 'This feature requires a paid plan. Please upgrade your subscription.'
          });
        }

        next();
      } catch (error) {
        console.error('Error checking API paid plan:', error);
        next();
      }
    };
  }

  /**
   * Middleware to check if API owner has enterprise plan
   * @returns {Function} Express middleware function
   */
  requireApiEnterprisePlan() {
    return async (req, res, next) => {
      try {
        const apiId = req.params.apiId;
        
        if (!apiId) {
          return next();
        }

        const usage = await this.apiUsageService.getCurrentApiUsage(apiId);
        
        if (usage.userPlan !== 'enterprise') {
          return res.status(403).json({
            success: false,
            message: 'This feature requires an Enterprise plan. Please upgrade your subscription.'
          });
        }

        next();
      } catch (error) {
        console.error('Error checking API enterprise plan:', error);
        next();
      }
    };
  }
}

module.exports = new ApiLimitMiddleware();

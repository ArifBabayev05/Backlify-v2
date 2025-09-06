/**
 * Plan Middleware
 * Handles X-User-Plan header extraction and validation
 */

class PlanMiddleware {
  constructor() {
    this.validPlans = ['basic', 'pro', 'enterprise'];
    this.planLimits = {
      basic: { projects: 2, requests: 1000 },
      pro: { projects: 10, requests: 10000 },
      enterprise: { projects: -1, requests: -1 } // Unlimited
    };
  }

  /**
   * Extract and validate X-User-Plan header
   * @returns {Function} Express middleware function
   */
  extractUserPlan() {
    return (req, res, next) => {
      try {
        // Extract X-User-Plan header
        const userPlan = req.headers['x-user-plan'] || 
                        req.headers['X-User-Plan'] || 
                        req.headers['X-USER-PLAN'] ||
                        'basic'; // Default to basic plan

        // Validate plan
        if (!this.validPlans.includes(userPlan.toLowerCase())) {
          console.warn(`Invalid user plan: ${userPlan}, defaulting to basic`);
          req.userPlan = 'basic';
        } else {
          req.userPlan = userPlan.toLowerCase();
        }

        // Add plan limits to request for easy access
        req.planLimits = this.planLimits[req.userPlan];

        console.log(`User plan extracted: ${req.userPlan} with limits:`, req.planLimits);
        next();
      } catch (error) {
        console.error('Error extracting user plan:', error);
        // Default to basic plan on error
        req.userPlan = 'basic';
        req.planLimits = this.planLimits.basic;
        next();
      }
    };
  }

  /**
   * Validate that user has sufficient plan for the operation
   * @param {string} operation - 'project' or 'request'
   * @returns {Function} Express middleware function
   */
  validatePlanAccess(operation = 'request') {
    return (req, res, next) => {
      try {
        const userPlan = req.userPlan || 'basic';
        const limits = req.planLimits || this.planLimits.basic;

        // Enterprise plan has unlimited access
        if (userPlan === 'enterprise') {
          return next();
        }

        // Check if operation is allowed for the plan
        if (operation === 'project' && limits.projects === -1) {
          return next(); // Unlimited projects
        }

        if (operation === 'request' && limits.requests === -1) {
          return next(); // Unlimited requests
        }

        // For now, just pass through - actual limit checking will be done by usage middleware
        next();
      } catch (error) {
        console.error('Error validating plan access:', error);
        next();
      }
    };
  }

  /**
   * Get plan limits for a given plan
   * @param {string} planId - Plan ID
   * @returns {Object} Plan limits
   */
  getPlanLimits(planId) {
    return this.planLimits[planId] || this.planLimits.basic;
  }

  /**
   * Check if plan has unlimited access
   * @param {string} planId - Plan ID
   * @returns {boolean} True if unlimited
   */
  isUnlimited(planId) {
    return planId === 'enterprise';
  }
}

module.exports = new PlanMiddleware();

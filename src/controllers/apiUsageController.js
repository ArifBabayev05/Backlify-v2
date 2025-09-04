const ApiUsageService = require('../services/apiUsageService');
const PlanService = require('../services/planService');

class ApiUsageController {
  constructor() {
    this.apiUsageService = new ApiUsageService();
    this.planService = new PlanService();
  }

  /**
   * Get current API's usage information
   * @route GET /api/:apiId/usage
   */
  async getApiUsage(req, res) {
    try {
      const apiId = req.params.apiId;
      
      if (!apiId) {
        return res.status(400).json({
          success: false,
          message: 'API ID is required'
        });
      }

      const usage = await this.apiUsageService.getCurrentApiUsage(apiId);
      const plan = await this.planService.getPlanById(usage.userPlan);

      res.json({
        success: true,
        data: {
          api: {
            id: apiId,
            owner_id: usage.userId,
            plan_id: usage.userPlan,
            plan_name: plan?.name || 'Unknown Plan'
          },
          usage: {
            requests_count: usage.requestsCount,
            projects_count: usage.projectsCount,
            max_requests: usage.maxRequests,
            max_projects: usage.maxProjects,
            is_unlimited: usage.isUnlimited
          },
          limits: {
            requests_remaining: usage.isUnlimited ? 'Unlimited' : Math.max(0, usage.maxRequests - usage.requestsCount),
            projects_remaining: usage.isUnlimited ? 'Unlimited' : Math.max(0, usage.maxProjects - usage.projectsCount),
            requests_percentage: usage.isUnlimited ? 0 : Math.round((usage.requestsCount / usage.maxRequests) * 100),
            projects_percentage: usage.isUnlimited ? 0 : Math.round((usage.projectsCount / usage.maxProjects) * 100)
          }
        }
      });
    } catch (error) {
      console.error('Error getting API usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get API usage information'
      });
    }
  }

  /**
   * Get all available plans
   * @route GET /api/plans
   */
  async getPlans(req, res) {
    try {
      console.log('Getting plans...');
      console.log('this.planService:', this.planService);
      
      if (!this.planService) {
        throw new Error('planService is not initialized');
      }
      
      const plans = await this.planService.getPlans();
      console.log('Plans received:', plans);
      
      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Error getting plans:', error);
      console.error('Full error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get plans information',
        error: error.message
      });
    }
  }

  /**
   * Get API usage statistics (admin only)
   * @route GET /api/usage/stats
   */
  async getApiUsageStats(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user is admin (you can implement your own admin check)
      const isAdmin = req.user.role === 'admin' || req.user.plan_id === 'enterprise';
      
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const userId = req.query.user_id || null;
      const stats = await this.apiUsageService.getApiUsageStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting API usage stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get API usage statistics'
      });
    }
  }

  /**
   * Reset monthly API usage (admin only)
   * @route POST /api/usage/reset
   */
  async resetMonthlyApiUsage(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user is admin
      const isAdmin = req.user.role === 'admin' || req.user.plan_id === 'enterprise';
      
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const success = await this.apiUsageService.resetMonthlyApiUsage();

      if (success) {
        res.json({
          success: true,
          message: 'Monthly API usage reset successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to reset monthly API usage'
        });
      }
    } catch (error) {
      console.error('Error resetting monthly API usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset monthly API usage'
      });
    }
  }
}

module.exports = new ApiUsageController();

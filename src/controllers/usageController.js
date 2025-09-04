const UsageService = require('../services/usageService');
const PlanService = require('../services/planService');

class UsageController {
  constructor() {
    this.usageService = new UsageService();
    this.planService = new PlanService();
  }

  /**
   * Get current user's usage information
   * @route GET /api/usage/current
   */
  async getCurrentUsage(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const userPlan = req.user.plan_id || 'basic';

      const usage = await this.usageService.getCurrentUsage(userId, userPlan);
      const plan = await this.planService.getPlanById(userPlan);

      res.json({
        success: true,
        data: {
          user: {
            id: userId,
            plan_id: userPlan,
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
      console.error('Error getting current usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get usage information'
      });
    }
  }

  /**
   * Get all available plans
   * @route GET /api/usage/plans
   */
  async getPlans(req, res) {
    try {
      const plans = await this.planService.getPlans();
      
      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Error getting plans:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get plans information'
      });
    }
  }

  /**
   * Get usage statistics (admin only)
   * @route GET /api/usage/stats
   */
  async getUsageStats(req, res) {
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
      const stats = await this.usageService.getUsageStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get usage statistics'
      });
    }
  }

  /**
   * Reset monthly usage (admin only)
   * @route POST /api/usage/reset
   */
  async resetMonthlyUsage(req, res) {
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

      const success = await this.usageService.resetMonthlyUsage();

      if (success) {
        res.json({
          success: true,
          message: 'Monthly usage reset successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to reset monthly usage'
        });
      }
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset monthly usage'
      });
    }
  }
}

module.exports = new UsageController();

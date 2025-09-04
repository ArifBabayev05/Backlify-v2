const apiUsageService = require('../services/apiUsageService');
const PlanService = require('../services/planService');

class ApiUsageController {
  constructor() {
    this.planService = new PlanService();
  }

  /**
   * Get API usage information
   */
  async getApiUsage(req, res) {
    try {
      const { apiId } = req.params;
      const userId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.XAuthUserId;
      
      console.log(`Getting API usage for API: ${apiId}, User: ${userId}`);
      
      const stats = await apiUsageService.getApiUsageStats(apiId, userId);
      
      if (!stats) {
        return res.status(500).json({
          success: false,
          message: 'Failed to get API usage information'
        });
      }
      
      // Get user plan and limits
      const userPlan = await apiUsageService.getUserPlan(userId);
      const limits = apiUsageService.getPlanLimits(userPlan);
      
      res.json({
        success: true,
        data: {
          api_id: apiId,
          user_id: userId,
          user_plan: userPlan,
          month_start: stats.month_start,
          requests_count: stats.requests_count,
          projects_count: stats.projects_count,
          limits: limits,
          remaining_requests: limits.requests === -1 ? -1 : Math.max(0, limits.requests - stats.requests_count),
          remaining_projects: limits.projects === -1 ? -1 : Math.max(0, limits.projects - stats.projects_count)
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
   */
  async getPlans(req, res) {
    try {
      console.log('Getting plans...');
      const plans = await this.planService.getPlans();
      console.log('Plans received:', plans);
      
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
   */
  async getApiUsageStats(req, res) {
    try {
      const stats = await apiUsageService.getAdminUsageStats();
      
      if (!stats) {
        return res.status(500).json({
          success: false,
          message: 'Failed to get usage statistics'
        });
      }
      
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
   */
  async resetMonthlyApiUsage(req, res) {
    try {
      // This would typically reset counters, but since we're using api_logs
      // we don't need to reset anything - just return success
      res.json({
        success: true,
        message: 'Usage statistics are automatically reset monthly based on api_logs'
      });
    } catch (error) {
      console.error('Error resetting usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset usage'
      });
    }
  }
}

module.exports = new ApiUsageController();
/**
 * Usage Limit Middleware
 * Handles usage limits based on X-User-Plan header
 */

const ApiUsageService = require('../services/apiUsageService');
const PlanMiddleware = require('./planMiddleware');

class UsageLimitMiddleware {
  constructor() {
    this.apiUsageService = ApiUsageService;
    this.planMiddleware = PlanMiddleware;
  }

  /**
   * Check project creation limits (for /generate-schema)
   * @returns {Function} Express middleware function
   */
  checkProjectLimit() {
    return async (req, res, next) => {
      try {
        const userId = req.XAuthUserId || req.user?.username || 'anonymous';
        
        console.log('=== PROJECT LIMIT CHECK ===');
        console.log('Request headers:', req.headers);
        console.log('req.XAuthUserId:', req.XAuthUserId);
        console.log('req.user:', req.user);
        console.log('Extracted userId:', userId);
        
        // Get user's actual plan from database
        const userPlan = await this.apiUsageService.getUserPlan(userId);
        const limits = this.planMiddleware.getPlanLimits(userPlan);

        console.log(`Checking project limit for user: ${userId}, plan: ${userPlan}`);
        console.log('Plan limits:', limits);

        // Enterprise plan has unlimited access
        if (userPlan === 'enterprise') {
          console.log('Enterprise plan - unlimited project access');
          return next();
        }

        // Get current usage for the user using UsageService
        const UsageService = require('../services/usageService');
        const usageService = new UsageService();
        
        let currentProjects = 0;
        let currentRequests = 0;
        
        try {
          const usage = await usageService.getCurrentUsage(userId, userPlan);
          console.log('Usage from UsageService:', usage);
          
          currentProjects = usage.projectsCount || 0;
          currentRequests = usage.requestsCount || 0;
          
          console.log(`Current usage - Projects: ${currentProjects}, Requests: ${currentRequests}`);
        } catch (usageError) {
          console.error('Error getting usage from UsageService:', usageError);
          // Fallback to api_logs method
          const usage = await this.apiUsageService.getApiUsageStats(null, userId);
          console.log('Usage stats from api_logs:', usage);
          
          currentProjects = usage ? usage.projects_count : 0;
          currentRequests = usage ? usage.requests_count : 0;
          
          console.log(`Current usage (fallback) - Projects: ${currentProjects}, Requests: ${currentRequests}`);
        }

        // Check project limit
        if (currentProjects >= limits.projects) {
          console.log(`Project limit exceeded: ${currentProjects}/${limits.projects}`);
          return res.status(403).json({
            success: false,
            error: 'Project limit exceeded',
            message: `You have reached the maximum number of projects for your ${userPlan} plan (${limits.projects} projects). Please upgrade your plan to create more projects.`,
            current: currentProjects,
            limit: limits.projects,
            plan: userPlan
          });
        }

        console.log(`Project limit check passed: ${currentProjects}/${limits.projects}`);
        
        // Store usage info for later increment after successful generation
        req.usageInfo = {
          userId,
          userPlan,
          currentProjects: currentProjects,
          maxProjects: limits.projects
        };
        
        next();
      } catch (error) {
        console.error('Error checking project limit:', error);
        console.error('Error stack:', error.stack);
        // Allow request to continue if there's an error checking limits
        next();
      }
    };
  }

  /**
   * Check API request limits (for generated API endpoints)
   * @returns {Function} Express middleware function
   */
  checkRequestLimit() {
    return async (req, res, next) => {
      try {
        const userId = req.XAuthUserId || req.user?.username || 'anonymous';
        
        // Get user's actual plan from database
        const userPlan = await this.apiUsageService.getUserPlan(userId);
        const limits = this.planMiddleware.getPlanLimits(userPlan);
        const apiId = req.params.apiId || req.query.apiId;

        console.log(`Checking request limit for user: ${userId}, plan: ${userPlan}, apiId: ${apiId}`);

        // Enterprise plan has unlimited access
        if (userPlan === 'enterprise') {
          console.log('Enterprise plan - unlimited request access');
          return next();
        }

        // Get current usage for the user
        const usage = await this.apiUsageService.getApiUsageStats(apiId, userId);
        
        if (!usage) {
          console.log('Could not retrieve usage stats, allowing request');
          return next();
        }

        // Check request limit
        if (usage.requests_count >= limits.requests) {
          console.log(`Request limit exceeded: ${usage.requests_count}/${limits.requests}`);
          return res.status(403).json({
            success: false,
            error: 'Request limit exceeded',
            message: `You have reached the monthly request limit for your ${userPlan} plan (${limits.requests} requests/month). Please upgrade your plan for more requests.`,
            current: usage.requests_count,
            limit: limits.requests,
            plan: userPlan
          });
        }

        console.log(`Request limit check passed: ${usage.requests_count}/${limits.requests}`);
        next();
      } catch (error) {
        console.error('Error checking request limit:', error);
        // Allow request to continue if there's an error checking limits
        next();
      }
    };
  }

  /**
   * Check both project and request limits (for /create-api-from-schema)
   * @returns {Function} Express middleware function
   */
  checkBothLimits() {
    return async (req, res, next) => {
      try {
        const userId = req.XAuthUserId || req.user?.username || 'anonymous';
        
        // Get user's actual plan from database
        const userPlan = await this.apiUsageService.getUserPlan(userId);
        const limits = this.planMiddleware.getPlanLimits(userPlan);

        console.log(`Checking both limits for user: ${userId}, plan: ${userPlan}`);

        // Enterprise plan has unlimited access
        if (userPlan === 'enterprise') {
          console.log('Enterprise plan - unlimited access');
          return next();
        }

        // Get current usage for the user
        const usage = await this.apiUsageService.getApiUsageStats(null, userId);
        
        if (!usage) {
          console.log('Could not retrieve usage stats, allowing request');
          return next();
        }

        // Check project limit first
        if (usage.projects_count >= limits.projects) {
          console.log(`Project limit exceeded: ${usage.projects_count}/${limits.projects}`);
          return res.status(403).json({
            success: false,
            error: 'Project limit exceeded',
            message: `You have reached the maximum number of projects for your ${userPlan} plan (${limits.projects} projects). Please upgrade your plan to create more projects.`,
            current: usage.projects_count,
            limit: limits.projects,
            plan: userPlan
          });
        }

        // Check request limit
        if (usage.requests_count >= limits.requests) {
          console.log(`Request limit exceeded: ${usage.requests_count}/${limits.requests}`);
          return res.status(403).json({
            success: false,
            error: 'Request limit exceeded',
            message: `You have reached the monthly request limit for your ${userPlan} plan (${limits.requests} requests/month). Please upgrade your plan for more requests.`,
            current: usage.requests_count,
            limit: limits.requests,
            plan: userPlan
          });
        }

        console.log(`Both limits check passed - Projects: ${usage.projects_count}/${limits.projects}, Requests: ${usage.requests_count}/${limits.requests}`);
        next();
      } catch (error) {
        console.error('Error checking both limits:', error);
        // Allow request to continue if there's an error checking limits
        next();
      }
    };
  }

  /**
   * Log usage after successful request
   * @param {string} type - 'project' or 'request'
   * @returns {Function} Express middleware function
   */
  logUsage(type = 'request') {
    return async (req, res, next) => {
      try {
        const userId = req.XAuthUserId || req.user?.username || 'anonymous';
        const userPlan = req.userPlan || 'basic';
        const apiId = req.params.apiId || req.query.apiId;

        // Log the usage
        if (type === 'project') {
          // This will be handled by the existing logging system
          console.log(`Project created by user: ${userId}, plan: ${userPlan}`);
        } else if (type === 'request') {
          // This will be handled by the existing logging system
          console.log(`API request made by user: ${userId}, plan: ${userPlan}, apiId: ${apiId}`);
        }

        next();
      } catch (error) {
        console.error('Error logging usage:', error);
        next();
      }
    };
  }
}

module.exports = new UsageLimitMiddleware();

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

        // Get current usage from logs directly
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        
        // Get logs for the last 30 days to catch any timezone issues
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        // Count projects from logs (successful /create-api-from-schema calls) - filter by user
        const { data: projectLogs, error: projectError } = await supabase
          .from('api_logs')
          .select('*')
          .eq('XAuthUserId', userId)
          .eq('endpoint', '/create-api-from-schema')
          .eq('status_code', 200)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .lte('timestamp', now.toISOString());
        
        const currentProjects = projectLogs ? projectLogs.length : 0;
        
        // Count API requests from logs
        const { data: requestLogs, error: requestError } = await supabase
          .from('api_logs')
          .select('*')
          .eq('XAuthUserId', userId)
          .eq('is_api_request', true)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .lte('timestamp', now.toISOString());
        
        const currentRequests = requestLogs ? requestLogs.length : 0;
        
        console.log(`Current usage from logs - Projects: ${currentProjects}, Requests: ${currentRequests}`);

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
        
        // Skip usage limit check for email routes
        if (req.path.startsWith('/api/email/')) {
          console.log('Skipping usage limit check for email routes');
          return next();
        }
        
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

        // Get current usage from logs directly
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        
        // Get logs for the last 30 days to catch any timezone issues
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        // Count API requests from logs
        const { data: requestLogs, error: requestError } = await supabase
          .from('api_logs')
          .select('*')
          .eq('XAuthUserId', userId)
          .eq('is_api_request', true)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .lte('timestamp', now.toISOString());
        
        const currentRequests = requestLogs ? requestLogs.length : 0;
        
        console.log(`Current requests from logs: ${currentRequests}`);

        // Check request limit
        if (currentRequests >= limits.requests) {
          console.log(`Request limit exceeded: ${currentRequests}/${limits.requests}`);
          return res.status(403).json({
            success: false,
            error: 'Request limit exceeded',
            message: `You have reached the monthly request limit for your ${userPlan} plan (${limits.requests} requests/month). Please upgrade your plan for more requests.`,
            current: currentRequests,
            limit: limits.requests,
            plan: userPlan
          });
        }

        console.log(`Request limit check passed: ${currentRequests}/${limits.requests}`);
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

        // Get current usage from logs directly
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        
        // Get logs for the last 30 days to catch any timezone issues
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        // Count projects from logs (successful /create-api-from-schema calls) - filter by user
        const { data: projectLogs, error: projectError } = await supabase
          .from('api_logs')
          .select('*')
          .eq('XAuthUserId', userId)
          .eq('endpoint', '/create-api-from-schema')
          .eq('status_code', 200)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .lte('timestamp', now.toISOString());
        
        const currentProjects = projectLogs ? projectLogs.length : 0;
        
        // Count API requests from logs
        const { data: requestLogs, error: requestError } = await supabase
          .from('api_logs')
          .select('*')
          .eq('XAuthUserId', userId)
          .eq('is_api_request', true)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .lte('timestamp', now.toISOString());
        
        const currentRequests = requestLogs ? requestLogs.length : 0;
        
        console.log(`Current usage from logs - Projects: ${currentProjects}, Requests: ${currentRequests}`);

        // Check project limit first
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

        // Check request limit
        if (currentRequests >= limits.requests) {
          console.log(`Request limit exceeded: ${currentRequests}/${limits.requests}`);
          return res.status(403).json({
            success: false,
            error: 'Request limit exceeded',
            message: `You have reached the monthly request limit for your ${userPlan} plan (${limits.requests} requests/month). Please upgrade your plan for more requests.`,
            current: currentRequests,
            limit: limits.requests,
            plan: userPlan
          });
        }

        console.log(`Both limits check passed - Projects: ${currentProjects}/${limits.projects}, Requests: ${currentRequests}/${limits.requests}`);
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

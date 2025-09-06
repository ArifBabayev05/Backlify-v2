const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

class ApiUsageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || config.supabase.url,
      process.env.SUPABASE_KEY || config.supabase.key
    );
  }

  /**
   * Get API usage statistics from api_logs table
   */
  async getApiUsageStats(apiId, userId = null) {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Build query for api_logs table
      let query = this.supabase
        .from('api_logs')
        .select('*')
        .gte('timestamp', monthStart.toISOString())
        .eq('is_api_request', true);
      
      if (apiId) {
        query = query.eq('api_id', apiId);
      }
      
      if (userId) {
        query = query.eq('XAuthUserId', userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error getting API usage stats:', error);
        return null;
      }
      
      // Count requests and projects
      const requestsCount = data.filter(log => 
        log.api_id && log.status_code >= 200 && log.status_code < 400
      ).length;
      
      const projectsCount = data.filter(log => 
        log.endpoint === '/generate-schema' && log.status_code >= 200 && log.status_code < 400
      ).length;
      
      return {
        api_id: apiId,
        user_id: userId,
        month_start: monthStart.toISOString(),
        requests_count: requestsCount,
        projects_count: projectsCount,
        total_logs: data.length
      };
    } catch (error) {
      console.error('Error in getApiUsageStats:', error);
      return null;
    }
  }

  /**
   * Check if API request limit is exceeded
   */
  async checkApiRequestLimit(apiId, userId = null) {
    try {
      const stats = await this.getApiUsageStats(apiId, userId);
      if (!stats) {
        return { allowed: true, reason: 'Unable to check limits' };
      }
      
      // Get user plan (simplified - you might want to get this from users table)
      const userPlan = await this.getUserPlan(userId);
      const limits = this.getPlanLimits(userPlan);
      
      if (userPlan === 'enterprise') {
        return { allowed: true, reason: 'Enterprise plan - no limits' };
      }
      
      if (stats.requests_count >= limits.requests) {
        return {
          allowed: false,
          reason: `Monthly request limit exceeded for your current plan (${limits.requests} requests/month)`,
          current: stats.requests_count,
          limit: limits.requests
        };
      }
      
      return { allowed: true, reason: 'Within limits' };
    } catch (error) {
      console.error('Error checking API request limit:', error);
      return { allowed: true, reason: 'Error checking limits' };
    }
  }

  /**
   * Check if project limit is exceeded
   */
  async checkProjectLimit(userId) {
    try {
      const stats = await this.getApiUsageStats(null, userId);
      if (!stats) {
        return { allowed: true, reason: 'Unable to check limits' };
      }
      
      const userPlan = await this.getUserPlan(userId);
      const limits = this.getPlanLimits(userPlan);
      
      if (userPlan === 'enterprise') {
        return { allowed: true, reason: 'Enterprise plan - no limits' };
      }
      
      if (stats.projects_count >= limits.projects) {
        return {
          allowed: false,
          reason: `Project limit exceeded for your current plan (${limits.projects} projects)`,
          current: stats.projects_count,
          limit: limits.projects
        };
      }
      
      return { allowed: true, reason: 'Within limits' };
    } catch (error) {
      console.error('Error checking project limit:', error);
      return { allowed: true, reason: 'Error checking limits' };
    }
  }

  /**
   * Get user plan (simplified - you might want to get this from users table)
   */
  async getUserPlan(userId) {
    try {
      if (!userId) return 'basic';
      
      // Try to get from users table
      const { data, error } = await this.supabase
        .from('users')
        .select('plan_id')
        .eq('id', userId)
        .single();
      
      if (error || !data) {
        return 'basic'; // Default to basic plan
      }
      
      return data.plan_id || 'basic';
    } catch (error) {
      console.error('Error getting user plan:', error);
      return 'basic';
    }
  }

  /**
   * Get plan limits
   */
  getPlanLimits(planId) {
    const limits = {
      basic: { projects: 2, requests: 1000 },
      pro: { projects: 10, requests: 10000 },
      enterprise: { projects: -1, requests: -1 } // Unlimited
    };
    
    return limits[planId] || limits.basic;
  }

  /**
   * Increment API request count for a user
   */
  async incrementApiRequestCount(apiId, userId, req) {
    try {
      if (!userId) return;
      
      const userPlan = await this.getUserPlan(userId);
      const limits = this.getPlanLimits(userPlan);
      
      // Enterprise plan has unlimited access
      if (userPlan === 'enterprise') {
        return;
      }
      
      // Get current usage
      const stats = await this.getApiUsageStats(apiId, userId);
      if (!stats) {
        console.log('Unable to get usage stats for increment');
        return;
      }
      
      // Check if limit would be exceeded
      if (stats.requests_count >= limits.requests) {
        console.log(`API request limit would be exceeded for user ${userId}`);
        return;
      }
      
      // Log the API request (this will be counted in the stats)
      const { error } = await this.supabase
        .from('api_logs')
        .insert({
          api_id: apiId,
          user_id: userId,
          endpoint: req?.originalUrl || '/api/request',
          method: req?.method || 'GET',
          status_code: 200,
          is_api_request: true,
          timestamp: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error logging API request:', error);
      }
    } catch (error) {
      console.error('Error incrementing API request count:', error);
    }
  }

  /**
   * Increment project count for a user
   */
  async incrementProjectCount(userId) {
    try {
      if (!userId) return;
      
      const userPlan = await this.getUserPlan(userId);
      const limits = this.getPlanLimits(userPlan);
      
      // Enterprise plan has unlimited access
      if (userPlan === 'enterprise') {
        return;
      }
      
      // Get current usage
      const stats = await this.getApiUsageStats(null, userId);
      if (!stats) {
        console.log('Unable to get usage stats for project increment');
        return;
      }
      
      // Check if limit would be exceeded
      if (stats.projects_count >= limits.projects) {
        console.log(`Project limit would be exceeded for user ${userId}`);
        return;
      }
      
      // Log the project creation (this will be counted in the stats)
      const { error } = await this.supabase
        .from('api_logs')
        .insert({
          api_id: null,
          user_id: userId,
          endpoint: '/generate-schema',
          method: 'POST',
          status_code: 200,
          is_api_request: false,
          timestamp: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error logging project creation:', error);
      }
    } catch (error) {
      console.error('Error incrementing project count:', error);
    }
  }

  /**
   * Get usage statistics for admin
   */
  async getAdminUsageStats() {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data, error } = await this.supabase
        .from('api_logs')
        .select('*')
        .gte('timestamp', monthStart.toISOString());
      
      if (error) {
        console.error('Error getting admin usage stats:', error);
        return null;
      }
      
      // Group by user and API
      const userStats = {};
      const apiStats = {};
      
      data.forEach(log => {
        const userId = log.XAuthUserId;
        const apiId = log.api_id;
        
        // User stats
        if (!userStats[userId]) {
          userStats[userId] = {
            user_id: userId,
            requests_count: 0,
            projects_count: 0
          };
        }
        
        if (log.is_api_request && log.status_code >= 200 && log.status_code < 400) {
          userStats[userId].requests_count++;
        }
        
        if (log.endpoint === '/generate-schema' && log.status_code >= 200 && log.status_code < 400) {
          userStats[userId].projects_count++;
        }
        
        // API stats
        if (apiId) {
          if (!apiStats[apiId]) {
            apiStats[apiId] = {
              api_id: apiId,
              requests_count: 0,
              user_id: userId
            };
          }
          
          if (log.status_code >= 200 && log.status_code < 400) {
            apiStats[apiId].requests_count++;
          }
        }
      });
      
      return {
        month_start: monthStart.toISOString(),
        user_stats: Object.values(userStats),
        api_stats: Object.values(apiStats),
        total_logs: data.length
      };
    } catch (error) {
      console.error('Error getting admin usage stats:', error);
      return null;
    }
  }
}

module.exports = new ApiUsageService();

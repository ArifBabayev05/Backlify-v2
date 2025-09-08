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
   * Get user plan - handles both string XAuthUserId and UUID user_id
   */
  async getUserPlan(userId) {
    try {
      if (!userId) return 'basic';
      
      // First, try to get user by username (for string XAuthUserId)
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, plan_id')
        .eq('username', userId)
        .single();
      
      if (userError || !user) {
        // If not found by username, try as UUID directly
        const { data: userByUuid, error: uuidError } = await this.supabase
          .from('users')
          .select('id, plan_id')
          .eq('id', userId)
          .single();
        
        if (uuidError || !userByUuid) {
          console.log(`User not found: ${userId}, defaulting to basic plan`);
          return 'basic';
        }
        
        // Use the UUID user
        user = userByUuid;
      }
      
      // Now try to get active subscription for this user (get the most recent one)
      const { data: subscriptions, error: subError } = await this.supabase
        .from('user_subscriptions')
        .select('plan_id, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!subError && subscriptions && subscriptions.length > 0) {
        const subscription = subscriptions[0];
        console.log(`Found active subscription for user ${userId}: ${subscription.plan_id}`);
        return subscription.plan_id || 'basic';
      }
      
      // Fall back to user's plan_id from users table
      if (user.plan_id) {
        console.log(`Using user plan_id for user ${userId}: ${user.plan_id}`);
        return user.plan_id;
      }
      
      // Default to basic plan
      console.log(`No plan found for user ${userId}, defaulting to basic`);
      return 'basic';
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

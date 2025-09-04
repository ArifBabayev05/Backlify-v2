const { createClient } = require('@supabase/supabase-js');
const PlanService = require('./planService');

class ApiUsageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    this.planService = new PlanService();
  }

  /**
   * Get API owner's user ID and plan from API metadata
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} User info with user_id and plan_id
   */
  async getApiOwnerInfo(apiId) {
    try {
      // Get API metadata from the API publisher
      const apiPublisher = require('./apiPublisher');
      const metadata = apiPublisher.getApiMetadata(apiId);
      
      if (!metadata) {
        throw new Error(`API ${apiId} not found`);
      }

      // Get user info from users table
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, plan_id')
        .eq('id', metadata.XAuthUserId)
        .single();

      if (error) {
        console.error('Error getting user info:', error);
        throw error;
      }

      return {
        userId: user.id,
        userPlan: user.plan_id || 'basic'
      };
    } catch (error) {
      console.error('Error getting API owner info:', error);
      throw error;
    }
  }

  /**
   * Get or create API usage record for current month
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} Usage record
   */
  async getOrCreateApiUsage(apiId) {
    try {
      const ownerInfo = await this.getApiOwnerInfo(apiId);
      
      const { data, error } = await this.supabase.rpc('get_or_create_api_usage', {
        p_api_id: apiId,
        p_user_id: ownerInfo.userId,
        p_user_plan: ownerInfo.userPlan
      });

      if (error) {
        console.error('Error getting/creating API usage record:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getOrCreateApiUsage:', error);
      throw error;
    }
  }

  /**
   * Get current usage for an API
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} Current usage data
   */
  async getCurrentApiUsage(apiId) {
    try {
      const ownerInfo = await this.getApiOwnerInfo(apiId);
      const usage = await this.getOrCreateApiUsage(apiId);
      const limits = await this.planService.getPlanLimits(ownerInfo.userPlan);

      return {
        apiId,
        userId: ownerInfo.userId,
        userPlan: ownerInfo.userPlan,
        requestsCount: usage.requests_count || 0,
        projectsCount: usage.projects_count || 0,
        maxRequests: limits.maxRequests,
        maxProjects: limits.maxProjects,
        planName: limits.planName,
        isUnlimited: limits.isUnlimited
      };
    } catch (error) {
      console.error('Error getting current API usage:', error);
      throw error;
    }
  }

  /**
   * Increment request count for an API
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} Updated usage data
   */
  async incrementApiRequestCount(apiId) {
    try {
      const usage = await this.getOrCreateApiUsage(apiId);
      
      const { data, error } = await this.supabase
        .from('api_usage')
        .update({ 
          requests_count: (usage.requests_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', usage.id)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing API request count:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in incrementApiRequestCount:', error);
      throw error;
    }
  }

  /**
   * Increment project count for an API
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} Updated usage data
   */
  async incrementApiProjectCount(apiId) {
    try {
      const usage = await this.getOrCreateApiUsage(apiId);
      
      const { data, error } = await this.supabase
        .from('api_usage')
        .update({ 
          projects_count: (usage.projects_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', usage.id)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing API project count:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in incrementApiProjectCount:', error);
      throw error;
    }
  }

  /**
   * Check if API can make a request
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} Check result with allowed status and message
   */
  async canApiMakeRequest(apiId) {
    try {
      const usage = await this.getCurrentApiUsage(apiId);

      // Enterprise plan has unlimited access
      if (usage.isUnlimited) {
        return { allowed: true, usage };
      }

      // Check if request limit exceeded
      if (usage.requestsCount >= usage.maxRequests) {
        return {
          allowed: false,
          message: `Monthly request limit exceeded for this API (${usage.planName} allows max ${usage.maxRequests} requests/month).`,
          usage
        };
      }

      return { allowed: true, usage };
    } catch (error) {
      console.error('Error checking API request limit:', error);
      return { allowed: false, message: 'Error checking usage limits', error };
    }
  }

  /**
   * Check if API can create a project
   * @param {string} apiId - API ID
   * @returns {Promise<Object>} Check result with allowed status and message
   */
  async canApiCreateProject(apiId) {
    try {
      const usage = await this.getCurrentApiUsage(apiId);

      // Enterprise plan has unlimited access
      if (usage.isUnlimited) {
        return { allowed: true, usage };
      }

      // Check if project limit exceeded
      if (usage.projectsCount >= usage.maxProjects) {
        return {
          allowed: false,
          message: `Project limit exceeded for this API (${usage.planName} allows max ${usage.maxProjects} projects).`,
          usage
        };
      }

      return { allowed: true, usage };
    } catch (error) {
      console.error('Error checking API project limit:', error);
      return { allowed: false, message: 'Error checking usage limits', error };
    }
  }

  /**
   * Reset monthly usage for all APIs
   * @returns {Promise<boolean>} Success status
   */
  async resetMonthlyApiUsage() {
    try {
      const { error } = await this.supabase.rpc('reset_monthly_api_usage');

      if (error) {
        console.error('Error resetting monthly API usage:', error);
        throw error;
      }

      console.log('Monthly API usage reset successfully');
      return true;
    } catch (error) {
      console.error('Error in resetMonthlyApiUsage:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for APIs
   * @param {string} userId - Optional user ID to filter by
   * @returns {Promise<Array>} Usage statistics
   */
  async getApiUsageStats(userId = null) {
    try {
      let query = this.supabase
        .from('api_usage')
        .select(`
          *,
          users:user_id (
            id,
            email,
            plan_id
          )
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting API usage stats:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getApiUsageStats:', error);
      throw error;
    }
  }
}

module.exports = ApiUsageService;

const { createClient } = require('@supabase/supabase-js');
const PlanService = require('./planService');

class UsageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    this.planService = new PlanService();
  }

  /**
   * Get or create usage record for current month
   * @param {string} userId - User ID
   * @param {string} userPlan - User's current plan
   * @returns {Promise<Object>} Usage record
   */
  async getOrCreateUsage(userId, userPlan) {
    try {
      // First, try to get user by username (for string XAuthUserId)
      let actualUserId = userId;
      
      if (typeof userId === 'string' && !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // This is a username, not a UUID - get the actual user ID
        const { data: user, error: userError } = await this.supabase
          .from('users')
          .select('id')
          .eq('username', userId)
          .single();
        
        if (userError || !user) {
          console.error(`User not found: ${userId}`);
          throw new Error(`User not found: ${userId}`);
        }
        
        actualUserId = user.id;
      }

      const { data, error } = await this.supabase.rpc('get_or_create_usage', {
        p_user_id: actualUserId,
        p_user_plan: userPlan
      });

      if (error) {
        console.error('Error getting/creating usage record:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getOrCreateUsage:', error);
      throw error;
    }
  }

  /**
   * Get current usage for a user
   * @param {string} userId - User ID
   * @param {string} userPlan - User's current plan
   * @returns {Promise<Object>} Current usage data
   */
  async getCurrentUsage(userId, userPlan) {
    try {
      const usage = await this.getOrCreateUsage(userId, userPlan);
      const limits = await this.planService.getPlanLimits(userPlan);

      return {
        userId,
        userPlan,
        requestsCount: usage.requests_count || 0,
        projectsCount: usage.projects_count || 0,
        maxRequests: limits.maxRequests,
        maxProjects: limits.maxProjects,
        planName: limits.planName,
        isUnlimited: limits.isUnlimited
      };
    } catch (error) {
      console.error('Error getting current usage:', error);
      throw error;
    }
  }

  /**
   * Increment request count for a user
   * @param {string} userId - User ID
   * @param {string} userPlan - User's current plan
   * @returns {Promise<Object>} Updated usage data
   */
  async incrementRequestCount(userId, userPlan) {
    try {
      const usage = await this.getOrCreateUsage(userId, userPlan);
      
      const { data, error } = await this.supabase
        .from('usage')
        .update({ 
          requests_count: (usage.requests_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', usage.id)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing request count:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in incrementRequestCount:', error);
      throw error;
    }
  }

  /**
   * Increment project count for a user
   * @param {string} userId - User ID
   * @param {string} userPlan - User's current plan
   * @returns {Promise<Object>} Updated usage data
   */
  async incrementProjectCount(userId, userPlan) {
    try {
      const usage = await this.getOrCreateUsage(userId, userPlan);
      
      const { data, error } = await this.supabase
        .from('usage')
        .update({ 
          projects_count: (usage.projects_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', usage.id)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing project count:', error);
        throw error;
      }

      console.log(`Project count incremented for user ${userId}: ${usage.projects_count + 1}`);
      return data;
    } catch (error) {
      console.error('Error in incrementProjectCount:', error);
      throw error;
    }
  }

  /**
   * Check if user can make a request (API call)
   * @param {string} userId - User ID
   * @param {string} userPlan - User's current plan
   * @returns {Promise<Object>} Check result with allowed status and message
   */
  async canMakeRequest(userId, userPlan) {
    try {
      const usage = await this.getCurrentUsage(userId, userPlan);

      // Enterprise plan has unlimited access
      if (usage.isUnlimited) {
        return { allowed: true, usage };
      }

      // Check if request limit exceeded
      if (usage.requestsCount >= usage.maxRequests) {
        return {
          allowed: false,
          message: `Monthly request limit exceeded for your current plan (${usage.planName} allows max ${usage.maxRequests} requests/month).`,
          usage
        };
      }

      return { allowed: true, usage };
    } catch (error) {
      console.error('Error checking request limit:', error);
      return { allowed: false, message: 'Error checking usage limits', error };
    }
  }

  /**
   * Check if user can create a project (schema generation)
   * @param {string} userId - User ID
   * @param {string} userPlan - User's current plan
   * @returns {Promise<Object>} Check result with allowed status and message
   */
  async canCreateProject(userId, userPlan) {
    try {
      const usage = await this.getCurrentUsage(userId, userPlan);

      // Enterprise plan has unlimited access
      if (usage.isUnlimited) {
        return { allowed: true, usage };
      }

      // Check if project limit exceeded
      if (usage.projectsCount >= usage.maxProjects) {
        return {
          allowed: false,
          message: `Project limit exceeded for your current plan (${usage.planName} allows max ${usage.maxProjects} projects).`,
          usage
        };
      }

      return { allowed: true, usage };
    } catch (error) {
      console.error('Error checking project limit:', error);
      return { allowed: false, message: 'Error checking usage limits', error };
    }
  }

  /**
   * Reset monthly usage for all users (to be run monthly)
   * @returns {Promise<boolean>} Success status
   */
  async resetMonthlyUsage() {
    try {
      const { error } = await this.supabase.rpc('reset_monthly_usage');

      if (error) {
        console.error('Error resetting monthly usage:', error);
        throw error;
      }

      console.log('Monthly usage reset successfully');
      return true;
    } catch (error) {
      console.error('Error in resetMonthlyUsage:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for admin purposes
   * @param {string} userId - Optional user ID to filter by
   * @returns {Promise<Array>} Usage statistics
   */
  async getUsageStats(userId = null) {
    try {
      let query = this.supabase
        .from('usage')
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
        console.error('Error getting usage stats:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUsageStats:', error);
      throw error;
    }
  }
}

module.exports = UsageService;

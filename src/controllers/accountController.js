const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

class AccountController {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  /**
   * Get user profile
   * @route GET /api/user/profile
   */
  async getUserProfile(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email, first_name, last_name, company, phone, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user profile'
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          company: user.company,
          phone: user.phone,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });

    } catch (error) {
      console.error('Error in getUserProfile:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Update user profile
   * @route PUT /api/user/profile
   */
  async updateUserProfile(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { firstName, lastName, email, company, phone } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          success: false,
          error: 'First name, last name, and email are required'
        });
      }

      // Check if email is already taken by another user
      const { data: existingUser, error: checkError } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already taken by another user'
        });
      }

      const { data: user, error } = await this.supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email,
          company: company || null,
          phone: phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('id, email, first_name, last_name, company, phone, updated_at')
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update user profile'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          company: user.company,
          phone: user.phone,
          updatedAt: user.updated_at
        }
      });

    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Change user password
   * @route PUT /api/user/change-password
   */
  async changePassword(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 6 characters long'
        });
      }

      // Get current user data
      const { data: user, error: fetchError } = await this.supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify current password'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update password'
        });
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Error in changePassword:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get user subscription
   * @route GET /api/user/subscription
   */
  async getUserSubscription(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Try to get subscription from user_subscriptions table first
      let subscription = null;
      let subscriptionError = null;
      
      try {
        // First, get the actual user UUID from users table
        const { data: user, error: userError } = await this.supabase
          .from('users')
          .select('id')
          .eq('username', userId)
          .single();
        
        if (userError || !user) {
          console.log('User not found, falling back to users table');
          subscriptionError = userError;
        } else {
          const actualUserId = user.id;
          
          const { data: subData, error: subError } = await this.supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', actualUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          subscription = subData;
          subscriptionError = subError;
        }
      } catch (err) {
        console.log('user_subscriptions table not available, falling back to users table');
        subscriptionError = err;
      }

      // If user_subscriptions table doesn't exist or has issues, fall back to users table
      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.log('Falling back to users table for subscription data');
        
        try {
          const { data: userData, error: userError } = await this.supabase
            .from('users')
            .select('plan_id')
            .eq('id', userId)
            .single();
          
          if (!userError && userData) {
            // Create a mock subscription object from user data
            subscription = {
              id: null,
              plan_id: userData.plan_id || 'basic',
              status: 'active',
              start_date: new Date().toISOString(),
              expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
            };
          }
        } catch (fallbackError) {
          console.error('Fallback to users table also failed:', fallbackError);
        }
      }

      // If no active subscription, return default free plan
      if (!subscription) {
        return res.json({
          success: true,
          data: {
            id: null,
            plan: 'basic',
            planName: 'Basic Plan',
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: null,
            price: 0,
            currency: 'AZN',
            features: {
              apiCalls: 1000,
              maxProjects: 2,
              prioritySupport: false,
              analytics: false,
              customIntegrations: false
            },
            autoRenew: false
          }
        });
      }

      // Get plan features
      const planFeatures = this.getPlanFeatures(subscription.plan_id);

      res.json({
        success: true,
        data: {
          id: subscription.id,
          plan: subscription.plan_id,
          planName: this.getPlanName(subscription.plan_id),
          status: subscription.status,
          startDate: subscription.start_date,
          endDate: subscription.expiration_date,
          price: 0, // Will be fetched from payment_orders if needed
          currency: 'AZN',
          features: planFeatures,
          autoRenew: true // Default for new subscriptions
        }
      });

    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Upgrade subscription
   * @route POST /api/user/subscription/upgrade
   */
  async upgradeSubscription(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { plan } = req.body;

      if (!plan) {
        return res.status(400).json({
          success: false,
          error: 'Plan is required'
        });
      }

      const validPlans = ['pro', 'enterprise'];
      if (!validPlans.includes(plan)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan. Valid plans are: pro, enterprise'
        });
      }

      // Get plan pricing
      const planPricing = this.getPlanPricing(plan);
      
      // Generate order ID
      const orderId = `SUB_${Date.now()}_${userId}`;

      // Create subscription order with fallback
      let order = null;
      let orderError = null;
      
      try {
        const { data: orderData, error: orderErr } = await this.supabase
          .from('payment_orders')
          .insert([{
            order_id: orderId,
            user_id: userId,
            plan_id: plan,
            amount: planPricing.price,
            currency: 'AZN',
            description: `Subscription upgrade to ${plan} plan`,
            status: 'pending',
            payment_method: 'epoint'
          }])
          .select()
          .single();
        
        order = orderData;
        orderError = orderErr;
      } catch (err) {
        console.log('payment_orders table not available, using mock order');
        orderError = err;
      }

      // If payment_orders table doesn't exist, create a mock order
      if (orderError) {
        console.log('Creating mock payment order for testing');
        order = {
          id: Date.now(),
          order_id: orderId,
          user_id: userId,
          plan_id: plan,
          amount: planPricing.price,
          currency: 'AZN',
          description: `Subscription upgrade to ${plan} plan`,
          status: 'pending',
          payment_method: 'epoint'
        };
      }

      // Use Epoint service to create payment request with fallback
      let epointResponse = null;
      
      try {
        const EpointService = require('../services/epointService');
        const epointService = new EpointService();

        const paymentData = epointService.prepareStandardPayment({
          amount: planPricing.price,
          order_id: orderId,
          description: `Subscription upgrade to ${plan} plan`,
          currency: 'AZN',
          language: 'az'
        });

        // Make request to Epoint API
        epointResponse = await epointService.makeEpointRequest('request', {
          data: paymentData.data,
          signature: paymentData.signature
        }, true);
      } catch (epointError) {
        console.error('Epoint service error:', epointError);
        // Create a mock response for testing
        epointResponse = {
          redirect_url: `${process.env.SUCCESS_REDIRECT_URL || 'http://localhost:3000/success'}?order_id=${orderId}&plan=${plan}`
        };
      }

      res.json({
        success: true,
        message: 'Subscription upgrade initiated',
        data: {
          redirectUrl: epointResponse.redirect_url,
          orderId: orderId,
          plan: plan,
          amount: planPricing.price
        }
      });

    } catch (error) {
      console.error('Error in upgradeSubscription:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get API usage statistics
   * @route GET /api/user/usage
   */
  async getApiUsage(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { period = 'month', startDate, endDate } = req.query;

      // Calculate date range
      const now = new Date();
      let start, end;

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else if (period === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      // Get API usage data
      const { data: usage, error } = await this.supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) {
        console.error('Error fetching API usage:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch usage data'
        });
      }

      // Calculate statistics
      const totalCalls = usage.length;
      const successfulCalls = usage.filter(u => u.status_code >= 200 && u.status_code < 300).length;
      const errorRate = totalCalls > 0 ? ((totalCalls - successfulCalls) / totalCalls * 100).toFixed(1) : 0;
      const avgResponseTime = totalCalls > 0 ? Math.round(usage.reduce((sum, u) => sum + u.response_time, 0) / totalCalls) : 0;

      // Get top endpoints
      const endpointStats = {};
      usage.forEach(u => {
        if (!endpointStats[u.endpoint]) {
          endpointStats[u.endpoint] = {
            calls: 0,
            success: 0,
            totalResponseTime: 0
          };
        }
        endpointStats[u.endpoint].calls++;
        if (u.status_code >= 200 && u.status_code < 300) {
          endpointStats[u.endpoint].success++;
        }
        endpointStats[u.endpoint].totalResponseTime += u.response_time;
      });

      const topEndpoints = Object.entries(endpointStats)
        .map(([endpoint, stats]) => ({
          endpoint,
          calls: stats.calls,
          success: ((stats.success / stats.calls) * 100).toFixed(1),
          avgResponseTime: Math.round(stats.totalResponseTime / stats.calls)
        }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10);

      // Get user's subscription limit
      let userPlan = 'basic';
      
      try {
        // First, get the actual user UUID from users table
        const { data: user, error: userError } = await this.supabase
          .from('users')
          .select('id')
          .eq('username', userId)
          .single();
        
        if (!userError && user) {
          const actualUserId = user.id;
          
          const { data: subscription } = await this.supabase
            .from('user_subscriptions')
            .select('plan_id')
            .eq('user_id', actualUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          userPlan = subscription?.plan_id || 'basic';
        }
      } catch (err) {
        // Fallback to users table
        try {
          const { data: userData } = await this.supabase
            .from('users')
            .select('plan_id')
            .eq('username', userId)
            .single();
          
          userPlan = userData?.plan_id || 'basic';
        } catch (fallbackErr) {
          console.log('Using default basic plan');
        }
      }

      const planFeatures = this.getPlanFeatures(userPlan);
      const limit = planFeatures.apiCalls;
      const remaining = Math.max(0, limit - totalCalls);

      res.json({
        success: true,
        data: {
          totalCalls,
          limit,
          remaining,
          thisMonth: totalCalls,
          lastMonth: 0, // TODO: Calculate last month usage
          dailyUsage: [], // TODO: Calculate daily usage
          topEndpoints,
          errorRate: parseFloat(errorRate),
          avgResponseTime
        }
      });

    } catch (error) {
      console.error('Error in getApiUsage:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get request logs (similar to /admin/logs but for user's own logs)
   * @route GET /api/user/logs
   */
  async getRequestLogs(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Get filter params (same as admin/logs)
      const { 
        page = 1, 
        limit = 50, 
        endpoint, 
        method,
        status,
        from_date,
        to_date,
        min_time,
        max_time
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100);
      const offset = (pageNum - 1) * limitNum;

      // Use api_logs table (same as admin/logs) but filter by user
      let query = this.supabase
        .from('api_logs')
        .select('*', { count: 'exact' })
        .eq('XAuthUserId', userId) // Only user's own logs
        .order('timestamp', { ascending: false })
        .range(offset, offset + limitNum - 1);

      // Apply filters (same as admin/logs)
      if (endpoint) {
        query = query.ilike('endpoint', `%${endpoint}%`);
      }
      
      if (method) {
        query = query.eq('method', method.toUpperCase());
      }
      
      if (status) {
        query = query.eq('response->status', parseInt(status));
      }
      
      if (from_date) {
        query = query.gte('timestamp', from_date);
      }
      
      if (to_date) {
        query = query.lte('timestamp', to_date);
      }
      
      if (min_time) {
        query = query.gte('response_time_ms', parseInt(min_time));
      }
      
      if (max_time) {
        query = query.lte('response_time_ms', parseInt(max_time));
      }

      const { data: logs, error, count } = await query;

      if (error) {
        console.error('Error fetching request logs:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch request logs'
        });
      }

      const totalPages = Math.ceil(count / limitNum);

      res.json({
        success: true,
        data: {
          logs: logs.map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            endpoint: log.endpoint,
            method: log.method,
            status: log.response?.status || log.status_code,
            responseTime: log.response_time_ms,
            ip: log.request?.headers ? JSON.parse(log.request.headers)['host'] : 'N/A',
            userAgent: log.request?.headers ? JSON.parse(log.request.headers)['user-agent'] : 'N/A',
            requestSize: log.request?.body ? log.request.body.length : 0,
            responseSize: log.response?.body ? log.response.body.length : 0,
            error: log.response?.status >= 400 ? log.response?.body : null,
            apiId: log.api_id,
            isApiRequest: log.is_api_request
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            totalPages
          },
          filters: {
            endpoint,
            method,
            status,
            from_date,
            to_date,
            min_time,
            max_time
          }
        }
      });

    } catch (error) {
      console.error('Error in getRequestLogs:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get user log statistics (similar to /admin/logs/stats but for user's own logs)
   * @route GET /api/user/logs/stats
   */
  async getUserLogStats(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { 
        days = 7, 
        startDate, 
        endDate,
        timeRange
      } = req.query;
      
      // Calculate the time range based on provided parameters
      let startDateTime = new Date();
      let endDateTime = new Date();
      
      // Case 1: If specific startDate and endDate are provided
      if (startDate && endDate) {
        startDateTime = new Date(startDate);
        endDateTime = new Date(endDate);
        
        // Add time component if not specified (set end date to end of day)
        if (endDateTime.getHours() === 0 && endDateTime.getMinutes() === 0 && endDateTime.getSeconds() === 0) {
          endDateTime.setHours(23, 59, 59, 999);
        }
      }
      // Case 2: If timeRange is provided, use predefined ranges
      else if (timeRange) {
        endDateTime = new Date(); // Current time
        
        switch(timeRange) {
          case 'today':
            startDateTime.setHours(0, 0, 0, 0); // Start of today
            break;
          case 'yesterday':
            startDateTime.setDate(startDateTime.getDate() - 1);
            startDateTime.setHours(0, 0, 0, 0);
            endDateTime.setDate(endDateTime.getDate() - 1);
            endDateTime.setHours(23, 59, 59, 999);
            break;
          case 'last7days':
            startDateTime.setDate(startDateTime.getDate() - 7);
            startDateTime.setHours(0, 0, 0, 0);
            break;
          case 'last30days':
            startDateTime.setDate(startDateTime.getDate() - 30);
            startDateTime.setHours(0, 0, 0, 0);
            break;
          case 'last90days':
            startDateTime.setDate(startDateTime.getDate() - 90);
            startDateTime.setHours(0, 0, 0, 0);
            break;
          default:
            startDateTime.setDate(startDateTime.getDate() - 7);
            startDateTime.setHours(0, 0, 0, 0);
        }
      }
      // Case 3: Use days parameter
      else {
        startDateTime.setDate(startDateTime.getDate() - parseInt(days));
        startDateTime.setHours(0, 0, 0, 0);
      }
      
      // Get logs for the specified time range
      const { data: logs, error } = await this.supabase
        .from('api_logs')
        .select('*')
        .eq('XAuthUserId', userId) // Only user's own logs
        .gte('timestamp', startDateTime.toISOString())
        .lte('timestamp', endDateTime.toISOString());
      
      if (error) {
        console.error('Error fetching logs for stats:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch log statistics'
        });
      }
      
      // Calculate statistics
      const totalRequests = logs.length;
      const successfulRequests = logs.filter(log => log.response?.status >= 200 && log.response?.status < 300).length;
      const errorRequests = logs.filter(log => log.response?.status >= 400).length;
      const avgResponseTime = totalRequests > 0 ? 
        Math.round(logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / totalRequests) : 0;
      
      // Group by endpoint
      const endpointStats = {};
      logs.forEach(log => {
        if (!endpointStats[log.endpoint]) {
          endpointStats[log.endpoint] = {
            count: 0,
            success: 0,
            errors: 0,
            totalTime: 0
          };
        }
        endpointStats[log.endpoint].count++;
        endpointStats[log.endpoint].totalTime += log.response_time_ms || 0;
        
        if (log.response?.status >= 200 && log.response?.status < 300) {
          endpointStats[log.endpoint].success++;
        } else if (log.response?.status >= 400) {
          endpointStats[log.endpoint].errors++;
        }
      });
      
      // Convert to array and sort by count
      const topEndpoints = Object.entries(endpointStats)
        .map(([endpoint, stats]) => ({
          endpoint,
          count: stats.count,
          success: stats.success,
          errors: stats.errors,
          avgResponseTime: Math.round(stats.totalTime / stats.count)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Group by date for daily stats
      const dailyStats = {};
      logs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = {
            requests: 0,
            success: 0,
            errors: 0
          };
        }
        dailyStats[date].requests++;
        if (log.response?.status >= 200 && log.response?.status < 300) {
          dailyStats[date].success++;
        } else if (log.response?.status >= 400) {
          dailyStats[date].errors++;
        }
      });
      
      const dailyData = Object.entries(dailyStats)
        .map(([date, stats]) => ({
          date,
          requests: stats.requests,
          success: stats.success,
          errors: stats.errors
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      res.json({
        success: true,
        data: {
          summary: {
            totalRequests,
            successfulRequests,
            errorRequests,
            successRate: totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) : 0,
            errorRate: totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(1) : 0,
            avgResponseTime
          },
          topEndpoints,
          dailyData,
          timeRange: {
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            days: Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24))
          }
        }
      });

    } catch (error) {
      console.error('Error in getUserLogStats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get notification settings
   * @route GET /api/user/notifications/settings
   */
  async getNotificationSettings(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { data: settings, error } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notification settings'
        });
      }

      // Return default settings if none exist
      const defaultSettings = {
        emailNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        twoFactorAuth: false,
        apiAccess: true,
        securityAlerts: true,
        billingNotifications: true
      };

      res.json({
        success: true,
        data: settings || defaultSettings
      });

    } catch (error) {
      console.error('Error in getNotificationSettings:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Update notification settings
   * @route PUT /api/user/notifications/settings
   */
  async updateNotificationSettings(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const {
        emailNotifications,
        smsNotifications,
        marketingEmails,
        twoFactorAuth,
        apiAccess,
        securityAlerts,
        billingNotifications
      } = req.body;

      const { data: settings, error } = await this.supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          email_notifications: emailNotifications,
          sms_notifications: smsNotifications,
          marketing_emails: marketingEmails,
          two_factor_auth: twoFactorAuth,
          api_access: apiAccess,
          security_alerts: securityAlerts,
          billing_notifications: billingNotifications,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating notification settings:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update notification settings'
        });
      }

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
        data: {
          emailNotifications: settings.email_notifications,
          smsNotifications: settings.sms_notifications,
          marketingEmails: settings.marketing_emails,
          twoFactorAuth: settings.two_factor_auth,
          apiAccess: settings.api_access,
          securityAlerts: settings.security_alerts,
          billingNotifications: settings.billing_notifications,
          updatedAt: settings.updated_at
        }
      });

    } catch (error) {
      console.error('Error in updateNotificationSettings:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Helper methods
  getPlanFeatures(plan) {
    const features = {
      free: {
        apiCalls: 1000,
        maxProjects: 1,
        prioritySupport: false,
        analytics: false,
        customIntegrations: false
      },
      pro: {
        apiCalls: 10000,
        maxProjects: 5,
        prioritySupport: true,
        analytics: true,
        customIntegrations: false
      },
      enterprise: {
        apiCalls: 100000,
        maxProjects: -1, // unlimited
        prioritySupport: true,
        analytics: true,
        customIntegrations: true
      }
    };
    return features[plan] || features.free;
  }

  getPlanName(plan) {
    const names = {
      free: 'Free Plan',
      pro: 'Pro Plan',
      enterprise: 'Enterprise Plan'
    };
    return names[plan] || 'Free Plan';
  }

  getPlanPricing(plan) {
    const pricing = {
      pro: { price: 0.01, currency: 'AZN' },
      enterprise: { price: 0.02, currency: 'AZN' }
    };
    return pricing[plan] || { price: 0, currency: 'AZN' };
  }
}

module.exports = AccountController;

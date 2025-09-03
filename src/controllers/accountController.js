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

      const { data: subscription, error } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching subscription:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch subscription'
        });
      }

      // If no active subscription, return default free plan
      if (!subscription) {
        return res.json({
          success: true,
          data: {
            id: null,
            plan: 'free',
            planName: 'Free Plan',
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: null,
            price: 0,
            currency: 'AZN',
            features: {
              apiCalls: 1000,
              maxProjects: 1,
              prioritySupport: false,
              analytics: false,
              customIntegrations: false
            },
            autoRenew: false
          }
        });
      }

      // Get plan features
      const planFeatures = this.getPlanFeatures(subscription.plan);

      res.json({
        success: true,
        data: {
          id: subscription.id,
          plan: subscription.plan,
          planName: this.getPlanName(subscription.plan),
          status: subscription.status,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          price: subscription.price,
          currency: subscription.currency,
          features: planFeatures,
          autoRenew: subscription.auto_renew
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

      // Create subscription order
      const { data: order, error: orderError } = await this.supabase
        .from('payment_orders')
        .insert([{
          order_id: orderId,
          user_id: userId,
          amount: planPricing.price,
          currency: 'AZN',
          description: `Subscription upgrade to ${plan} plan`,
          status: 'pending',
          payment_method: 'epoint'
        }])
        .select()
        .single();

      if (orderError) {
        console.error('Error creating subscription order:', orderError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create subscription order'
        });
      }

      // Use Epoint service to create payment request
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
      const epointResponse = await epointService.makeEpointRequest('request', {
        data: paymentData.data,
        signature: paymentData.signature
      }, true);

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
      const { data: subscription } = await this.supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const planFeatures = this.getPlanFeatures(subscription?.plan || 'free');
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
   * Get request logs
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

      const { 
        page = 1, 
        limit = 50, 
        startDate, 
        endDate, 
        status, 
        endpoint 
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100);
      const offset = (pageNum - 1) * limitNum;

      let query = this.supabase
        .from('api_usage')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', new Date(endDate).toISOString());
      }
      if (status) {
        query = query.eq('status_code', parseInt(status));
      }
      if (endpoint) {
        query = query.ilike('endpoint', `%${endpoint}%`);
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
            timestamp: log.created_at,
            endpoint: log.endpoint,
            method: log.method,
            status: log.status_code,
            responseTime: log.response_time,
            ip: log.ip_address,
            userAgent: log.user_agent,
            requestSize: log.request_size,
            responseSize: log.response_size,
            error: log.error_message
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            totalPages
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

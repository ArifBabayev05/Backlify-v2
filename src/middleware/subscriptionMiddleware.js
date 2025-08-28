const PaymentService = require('../services/paymentService');
const { setCorsHeaders } = require('./corsMiddleware');

class SubscriptionMiddleware {
  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Middleware to check if user has active subscription
   */
  checkSubscription(planRequired = 'basic') {
    return async (req, res, next) => {
      try {
        setCorsHeaders(res, req);
        
        const userId = req.user?.id || req.headers['x-user-id'];
        const apiId = req.params.apiId || req.query.apiId || req.body.apiId;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required'
          });
        }

        // Check if user has active subscription
        const hasSubscription = await this.paymentService.hasActiveSubscription(userId, apiId);

        if (!hasSubscription) {
          return res.status(403).json({
            success: false,
            error: 'Active subscription required',
            code: 'SUBSCRIPTION_REQUIRED',
            redirectUrl: '/pricing'
          });
        }

        // Get subscription details for plan validation
        const subscriptions = await this.paymentService.getUserSubscription(userId, apiId);
        const userPlan = subscriptions[0]?.plan_id;

        // Check if user's plan meets the required plan level
        if (!this.isPlanSufficient(userPlan, planRequired)) {
          return res.status(403).json({
            success: false,
            error: `Plan upgrade required. Current plan: ${userPlan}, Required: ${planRequired}`,
            code: 'PLAN_UPGRADE_REQUIRED',
            redirectUrl: '/pricing'
          });
        }

        // Add subscription info to request for later use
        req.userSubscription = subscriptions[0];
        next();
      } catch (error) {
        console.error('Subscription middleware error:', error);
        setCorsHeaders(res, req);
        res.status(500).json({
          success: false,
          error: 'Failed to verify subscription'
        });
      }
    };
  }

  /**
   * Check if user's plan is sufficient for the required plan
   */
  isPlanSufficient(userPlan, requiredPlan) {
    const planHierarchy = {
      'basic': 1,
      'pro': 2,
      'enterprise': 3
    };

    const userPlanLevel = planHierarchy[userPlan] || 0;
    const requiredPlanLevel = planHierarchy[requiredPlan] || 0;

    return userPlanLevel >= requiredPlanLevel;
  }

  /**
   * Middleware to check API usage limits based on plan
   */
  checkUsageLimits() {
    return async (req, res, next) => {
      try {
        setCorsHeaders(res, req);
        
        const userId = req.user?.id || req.headers['x-user-id'];
        const apiId = req.params.apiId || req.query.apiId || req.body.apiId;

        if (!userId || !apiId) {
          return next(); // Skip usage check if no user or API ID
        }

        const subscriptions = await this.paymentService.getUserSubscription(userId, apiId);
        const subscription = subscriptions[0];

        if (!subscription) {
          return next(); // Skip if no subscription
        }

        // Check if subscription is expired
        if (new Date(subscription.expiration_date) < new Date()) {
          return res.status(403).json({
            success: false,
            error: 'Subscription expired',
            code: 'SUBSCRIPTION_EXPIRED',
            redirectUrl: '/pricing'
          });
        }

        // Add usage tracking info to request
        req.usageInfo = {
          planId: subscription.plan_id,
          subscriptionId: subscription.id,
          userId: userId,
          apiId: apiId
        };

        next();
      } catch (error) {
        console.error('Usage limits middleware error:', error);
        next(); // Continue even if usage check fails
      }
    };
  }

  /**
   * Middleware to skip subscription check for certain routes
   */
  skipSubscriptionCheck() {
    return (req, res, next) => {
      req.skipSubscriptionCheck = true;
      next();
    };
  }

  /**
   * Middleware to handle subscription errors gracefully
   */
  handleSubscriptionError() {
    return (err, req, res, next) => {
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.code === 'PLAN_UPGRADE_REQUIRED') {
        setCorsHeaders(res, req);
        return res.status(403).json({
          success: false,
          error: err.message,
          code: err.code,
          redirectUrl: err.redirectUrl || '/pricing'
        });
      }
      next(err);
    };
  }
}

module.exports = SubscriptionMiddleware;

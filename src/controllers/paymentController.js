const PaymentService = require('../services/paymentService');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { createClient } = require('@supabase/supabase-js');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  /**
   * Get available payment plans
   */
  async getPlans(req, res) {
    try {
      setCorsHeaders(res, req);
      
      // Get plans from database
      const { data: plans, error } = await this.supabase
        .from('payment_plans')
        .select('plan_id, name, price, currency, features, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) {
        console.error('Error fetching payment plans from database:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch payment plans'
        });
      }

      // Transform data to match expected format
      const formattedPlans = plans.map(plan => ({
        id: plan.plan_id,
        name: plan.name,
        price: parseFloat(plan.price),
        currency: plan.currency,
        features: plan.features || []
      }));

      res.json({
        success: true,
        data: formattedPlans
      });
    } catch (error) {
      console.error('Error getting plans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment plans'
      });
    }
  }

  /**
   * Create payment order
   */
  async createOrder(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const { planId, apiId } = req.body;
      const userId = req.user?.id || req.headers['x-user-id'];

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      if (!planId) {
        return res.status(400).json({
          success: false,
          error: 'Plan ID is required'
        });
      }

      const order = await this.paymentService.createOrder(userId, planId, apiId);
      const paymentUrl = this.paymentService.generateEpointPaymentUrl(order);

      res.json({
        success: true,
        data: {
          order,
          paymentUrl
        }
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create payment order'
      });
    }
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const userId = req.user?.id || req.headers['x-user-id'];

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const history = await this.paymentService.getUserPaymentHistory(userId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting payment history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment history'
      });
    }
  }

  /**
   * Get user's active subscription
   */
  async getSubscription(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const userId = req.user?.id || req.headers['x-user-id'];
      const { apiId } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const subscription = await this.paymentService.getUserSubscription(userId, apiId);

      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      console.error('Error getting subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get subscription'
      });
    }
  }

  /**
   * Check subscription status
   */
  async checkSubscription(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const userId = req.user?.id || req.headers['x-user-id'];
      const { apiId } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const hasSubscription = await this.paymentService.hasActiveSubscription(userId, apiId);

      res.json({
        success: true,
        data: {
          hasActiveSubscription: hasSubscription
        }
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check subscription'
      });
    }
  }

  /**
   * Process Epoint callback
   */
  async processEpointCallback(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const { data, signature } = req.body;

      if (!data || !signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: data and signature'
        });
      }

      const result = await this.paymentService.processEpointCallback({
        data,
        signature
      });

      // Return 200 OK to Epoint as required
      res.status(200).json({
        success: true,
        message: 'Callback processed successfully',
        data: result
      });
    } catch (error) {
      console.error('Error processing Epoint callback:', error);
      
      // Still return 200 to Epoint but with error details
      res.status(200).json({
        success: false,
        error: error.message || 'Failed to process callback'
      });
    }
  }

  /**
   * Payment success page redirect
   */
  async paymentSuccess(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const { order_id } = req.query;

      if (!order_id) {
        return res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
      }

      res.json({
        success: true,
        message: 'Payment successful',
        orderId: order_id,
        redirectUrl: '/dashboard'
      });
    } catch (error) {
      console.error('Error handling payment success:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process payment success'
      });
    }
  }

  /**
   * Payment cancel page redirect
   */
  async paymentCancel(req, res) {
    try {
      setCorsHeaders(res, req);
      
      const { order_id } = req.query;

      res.json({
        success: false,
        message: 'Payment cancelled',
        orderId: order_id,
        redirectUrl: '/pricing'
      });
    } catch (error) {
      console.error('Error handling payment cancel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process payment cancel'
      });
    }
  }
}

module.exports = PaymentController;

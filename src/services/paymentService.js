const crypto = require('crypto');
const config = require('../config/config');
const { createClient } = require('@supabase/supabase-js');
const EpointService = require('./epointService');

class PaymentService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    this.epointConfig = config.payment.epoint;
    this.plans = config.payment.plans;
    this.epointService = new EpointService();
  }

  /**
   * Get available payment plans from database
   */
  async getAvailablePlans() {
    try {
      const { data: plans, error } = await this.supabase
        .from('payment_plans')
        .select('plan_id, name, price, currency, features, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) {
        console.error('Error fetching payment plans:', error);
        throw error;
      }

      return plans.map(plan => ({
        id: plan.plan_id,
        name: plan.name,
        price: parseFloat(plan.price),
        currency: plan.currency,
        features: plan.features || []
      }));
    } catch (error) {
      console.error('Error getting available plans:', error);
      throw error;
    }
  }

  /**
   * Get plan by ID from database
   */
  async getPlanById(planId) {
    try {
      const { data: plan, error } = await this.supabase
        .from('payment_plans')
        .select('*')
        .eq('plan_id', planId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching plan by ID:', error);
        throw error;
      }

      return {
        id: plan.plan_id,
        name: plan.name,
        price: parseFloat(plan.price),
        currency: plan.currency,
        features: plan.features || []
      };
    } catch (error) {
      console.error('Error getting plan by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new payment order
   */
  async createOrder(userId, planId, apiId = null) {
    try {
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      const orderData = {
        user_id: userId,
        plan_id: planId,
        api_id: apiId,
        amount: plan.price,
        currency: plan.currency,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('payment_orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating payment order:', error);
      throw error;
    }
  }

  /**
   * Generate Epoint payment URL using the new EpointService
   */
  generateEpointPaymentUrl(order) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    const paymentData = this.epointService.prepareStandardPayment({
      amount: order.amount,
      order_id: order.order_id,
      description: `Backlify ${this.plans[order.plan_id]?.name || order.plan_id} Plan`,
      success_redirect_url: process.env.SUCCESS_REDIRECT_URL,
      error_redirect_url: process.env.ERROR_REDIRECT_URL,
      currency: order.currency,
      language: 'az'
    });

    return paymentData.checkout_url;
  }

  /**
   * Generate signature for Epoint (legacy method - now uses EpointService)
   */
  generateSignature(data) {
    return this.epointService.generateSignature(data);
  }

  /**
   * Verify Epoint callback signature (legacy method - now uses EpointService)
   */
  verifySignature(data, signature) {
    return this.epointService.validateSignature(data, signature);
  }

  /**
   * Process Epoint callback
   */
  async processEpointCallback(callbackData) {
    try {
      // Verify signature
      if (!this.verifySignature(callbackData.data, callbackData.signature)) {
        throw new Error('Invalid signature');
      }

      // Decode data
      const decodedData = Buffer.from(callbackData.data, 'base64').toString();
      const paymentInfo = JSON.parse(decodedData);

      // Update order status
      const orderId = paymentInfo.order_id;
      const status = paymentInfo.status;
      
      await this.updateOrderStatus(orderId, status, paymentInfo);

      // If payment successful, activate user's plan
      if (status === 'success') {
        await this.activateUserPlan(orderId);
      }

      return { success: true, orderId, status };
    } catch (error) {
      console.error('Error processing Epoint callback:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status, paymentInfo = {}) {
    try {
      const updateData = {
        status: status === 'success' ? 'paid' : 'failed',
        payment_transaction_id: paymentInfo.transaction_id || null,
        payment_details: paymentInfo,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('payment_orders')
        .update(updateData)
        .eq('order_id', orderId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Activate user's plan after successful payment
   */
  async activateUserPlan(orderId) {
    try {
      // Get order details
      const { data: order, error: orderError } = await this.supabase
        .from('payment_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Calculate expiration date (30 days from now)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      // Update or create user subscription
      const subscriptionData = {
        user_id: order.user_id,
        plan_id: order.plan_id,
        api_id: order.api_id,
        status: 'active',
        start_date: new Date().toISOString(),
        expiration_date: expirationDate.toISOString(),
        payment_order_id: order.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Check if subscription already exists
      const { data: existingSub } = await this.supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', order.user_id)
        .eq('api_id', order.api_id)
        .single();

      if (existingSub) {
        // Update existing subscription
        const { error } = await this.supabase
          .from('user_subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id);
        
        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await this.supabase
          .from('user_subscriptions')
          .insert(subscriptionData);
        
        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error activating user plan:', error);
      throw error;
    }
  }

  /**
   * Get user's active subscription
   */
  async getUserSubscription(userId, apiId = null) {
    try {
      let query = this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (apiId) {
        query = query.eq('api_id', apiId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId, apiId = null) {
    try {
      const subscriptions = await this.getUserSubscription(userId, apiId);
      return subscriptions && subscriptions.length > 0;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(userId) {
    try {
      const { data, error } = await this.supabase
        .from('payment_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }
}

module.exports = PaymentService;

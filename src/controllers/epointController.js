const EpointService = require('../services/epointService');
const { createClient } = require('@supabase/supabase-js');

class EpointController {
  constructor() {
    this.epointService = new EpointService();
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  /**
   * Save payment order to database
   * @private
   */
  async savePaymentOrder(orderData) {
    try {
      const { data, error } = await this.supabase
        .from('payment_orders')
        .insert([{
          order_id: orderData.order_id,
          user_id: orderData.user_id || null,
          amount: orderData.amount,
          currency: orderData.currency || 'AZN',
          description: orderData.description,
          status: 'pending',
          payment_method: 'epoint',
          success_redirect_url: orderData.success_redirect_url,
          error_redirect_url: orderData.error_redirect_url,
          epoint_data: orderData.epoint_data,
          epoint_signature: orderData.epoint_signature,
          epoint_redirect_url: orderData.epoint_redirect_url
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving payment order:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error saving payment order:', error);
      throw error;
    }
  }

  /**
   * Save payment transaction to database
   * @private
   */
  async savePaymentTransaction(transactionData) {
    try {
      const { data, error } = await this.supabase
        .from('payment_transactions')
        .insert([{
          order_id: transactionData.order_id,
          user_id: transactionData.user_id || null,
          epoint_transaction_id: transactionData.epoint_transaction_id,
          bank_transaction_id: transactionData.bank_transaction_id,
          amount: transactionData.amount,
          currency: transactionData.currency || 'AZN',
          status: transactionData.status,
          payment_method: 'epoint',
          card_last_four: transactionData.card_last_four,
          card_brand: transactionData.card_brand,
          processing_fee: transactionData.processing_fee || 0,
          net_amount: transactionData.net_amount,
          epoint_response: transactionData.epoint_response
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving payment transaction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error saving payment transaction:', error);
      throw error;
    }
  }

  /**
   * Save payment callback to database
   * @private
   */
  async savePaymentCallback(callbackData) {
    try {
      const { data, error } = await this.supabase
        .from('payment_callbacks')
        .insert([{
          order_id: callbackData.order_id,
          epoint_transaction_id: callbackData.epoint_transaction_id,
          callback_data: callbackData.callback_data,
          signature: callbackData.signature,
          signature_valid: callbackData.signature_valid,
          processed: callbackData.processed || false,
          processing_error: callbackData.processing_error,
          ip_address: callbackData.ip_address,
          user_agent: callbackData.user_agent
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving payment callback:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error saving payment callback:', error);
      throw error;
    }
  }

  /**
   * Create standard payment request
   * @route POST /api/epoint/create-payment
   */
  async createStandardPayment(req, res) {
    try {
      const {
        amount,
        order_id,
        description = '',
        success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
        error_redirect_url = process.env.ERROR_REDIRECT_URL,
        currency = 'AZN',
        language = 'az'
      } = req.body;

      // Validate required fields
      if (!amount || !order_id) {
        return res.status(400).json({
          success: false,
          error: 'Amount and order_id are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Prepare payment data
      const paymentData = this.epointService.prepareStandardPayment({
        amount,
        order_id,
        description,
        success_redirect_url,
        error_redirect_url,
        currency,
        language
      });

      // Log payment request
      console.log(`Payment request created for order: ${order_id}, amount: ${amount} ${currency}`);

      // Try to make the request to Epoint API and return the response
      try {
        const epointResponse = await this.epointService.makeEpointRequest('request', {
          data: paymentData.data,
          signature: paymentData.signature
        }, true); // Use form data format

        // Return the response in the format frontend expects
        res.json({
          success: true,
          status: epointResponse.status || 'success',
          redirect_url: epointResponse.redirect_url,
          data: {
            data: paymentData.data,
            signature: paymentData.signature,
            checkout_url: paymentData.checkout_url
          },
          message: 'Payment request created successfully'
        });
      } catch (epointError) {
        // If Epoint API call fails, still return the data for frontend to use
        console.warn('Epoint API call failed, returning data for frontend:', epointError.message);
        res.json({
          success: true,
          data: {
            data: paymentData.data,
            signature: paymentData.signature,
            checkout_url: paymentData.checkout_url
          },
          message: 'Payment request created successfully (use checkout_url for direct API call)'
        });
      }

    } catch (error) {
      console.error('Error creating standard payment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment request',
        code: 'PAYMENT_CREATION_FAILED'
      });
    }
  }

  /**
   * Create payment request that matches frontend expectations
   * @route POST /api/epoint/request
   */
  async createPaymentRequest(req, res) {
    try {
      const {
        amount,
        order_id,
        description = '',
        success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
        error_redirect_url = process.env.ERROR_REDIRECT_URL,
        currency = 'AZN',
        language = 'az'
      } = req.body;

      // Validate required fields
      if (!amount || !order_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Amount and order_id are required'
        });
      }

      // Prepare payment data
      const paymentData = this.epointService.prepareStandardPayment({
        amount,
        order_id,
        description,
        success_redirect_url,
        error_redirect_url,
        currency,
        language
      });

      // Save payment order to database
      const savedOrder = await this.savePaymentOrder({
        order_id,
        user_id: req.user?.id || null,
        amount,
        currency,
        description,
        success_redirect_url,
        error_redirect_url,
        epoint_data: paymentData.data,
        epoint_signature: paymentData.signature,
        epoint_redirect_url: paymentData.checkout_url
      });

      // Make request to Epoint API using form data (like frontend does)
      const epointResponse = await this.epointService.makeEpointRequest('request', {
        data: paymentData.data,
        signature: paymentData.signature
      }, true); // Use form data format

      // Update order with Epoint response
      if (epointResponse.redirect_url) {
        await this.supabase
          .from('payment_orders')
          .update({ 
            epoint_redirect_url: epointResponse.redirect_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', savedOrder.id);
      }

      // Return response in the exact format frontend expects
      res.json({
        status: epointResponse.status || 'success',
        redirect_url: epointResponse.redirect_url,
        message: epointResponse.message || 'Payment request created successfully'
      });

    } catch (error) {
      console.error('Error creating payment request:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Payment request failed'
      });
    }
  }

  /**
   * Handle payment callback from Epoint
   * @route POST /api/epoint/callback
   */
  async handlePaymentCallback(req, res) {
    try {
      const { data, signature } = req.body;

      if (!data || !signature) {
        console.error('Missing data or signature in callback');
        return res.status(400).json({
          success: false,
          error: 'Missing required callback parameters'
        });
      }

      // Validate signature
      const signatureValid = this.epointService.validateSignature(data, signature);
      
      // Decode callback data
      const callbackData = this.epointService.decodeData(data);
      console.log('Epoint callback received:', callbackData);

      // Save callback to database
      await this.savePaymentCallback({
        order_id: callbackData.order_id,
        epoint_transaction_id: callbackData.transaction,
        callback_data: callbackData,
        signature,
        signature_valid: signatureValid,
        processed: false,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      if (!signatureValid) {
        console.error('Invalid signature in callback');
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      // Extract transaction details
      const {
        order_id,
        status,
        transaction,
        bank_transaction,
        message
      } = callbackData;

      // Save payment transaction to database
      if (transaction && order_id) {
        await this.savePaymentTransaction({
          order_id,
          epoint_transaction_id: transaction,
          bank_transaction_id: bank_transaction,
          amount: callbackData.amount || 0,
          currency: callbackData.currency || 'AZN',
          status,
          epoint_response: callbackData
        });
      }

      // Update order status in database
      if (order_id) {
        await this.updateOrderStatus(order_id, status, {
          transaction,
          bank_transaction,
          message,
          callback_data: callbackData
        });
      }

      // Mark callback as processed
      await this.supabase
        .from('payment_callbacks')
        .update({ processed: true })
        .eq('order_id', order_id)
        .eq('epoint_transaction_id', transaction);

      // Log successful callback processing
      console.log(`Payment callback processed for order: ${order_id}, status: ${status}`);

      // Respond to Epoint with success
      res.status(200).json({
        success: true,
        message: 'Callback processed successfully'
      });

    } catch (error) {
      console.error('Error processing payment callback:', error);
      
      // Mark callback as failed if we have the data
      try {
        if (req.body.data) {
          const callbackData = this.epointService.decodeData(req.body.data);
          await this.supabase
            .from('payment_callbacks')
            .update({ 
              processed: true,
              processing_error: error.message 
            })
            .eq('order_id', callbackData.order_id)
            .eq('epoint_transaction_id', callbackData.transaction);
        }
      } catch (updateError) {
        console.error('Error updating callback status:', updateError);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process callback'
      });
    }
  }

  /**
   * Check payment transaction status
   * @route POST /api/epoint/check-status
   */
  async checkPaymentStatus(req, res) {
    try {
      const { transaction_id, order_id } = req.body;

      if (!transaction_id && !order_id) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID or order ID is required',
          code: 'MISSING_IDENTIFIER'
        });
      }

      // Prepare status check data
      const statusData = this.epointService.prepareStatusCheck(transaction_id || order_id);

      // Make request to Epoint status endpoint
      const response = await this.epointService.makeEpointRequest('get-status', {
        data: statusData.data,
        signature: statusData.signature
      });

      console.log(`Status check completed for: ${transaction_id || order_id}`);

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Error checking payment status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check payment status',
        code: 'STATUS_CHECK_FAILED'
      });
    }
  }

  /**
   * Initiate card saving process
   * @route POST /api/epoint/save-card
   */
  async saveCard(req, res) {
    try {
      const {
        language = 'az',
        description = 'Card registration',
        success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
        error_redirect_url = process.env.ERROR_REDIRECT_URL
      } = req.body;

      // Prepare card registration data
      const cardData = this.epointService.prepareCardRegistration({
        language,
        description,
        success_redirect_url,
        error_redirect_url
      });

      // Make request to Epoint card registration endpoint
      const response = await this.epointService.makeEpointRequest('card-registration', {
        data: cardData.data,
        signature: cardData.signature
      });

      console.log('Card registration initiated successfully');

      res.json({
        success: true,
        data: {
          redirect_url: response.redirect_url,
          data: cardData.data,
          signature: cardData.signature
        },
        message: 'Card registration initiated'
      });

    } catch (error) {
      console.error('Error initiating card registration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate card registration',
        code: 'CARD_REGISTRATION_FAILED'
      });
    }
  }

  /**
   * Execute payment with saved card
   * @route POST /api/epoint/execute-saved-card-payment
   */
  async executeSavedCardPayment(req, res) {
    try {
      const {
        card_id,
        order_id,
        amount,
        description = '',
        currency = 'AZN',
        language = 'az'
      } = req.body;

      // Validate required fields
      if (!card_id || !order_id || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Card ID, order ID, and amount are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Prepare saved card payment data
      const paymentData = this.epointService.prepareSavedCardPayment({
        card_id,
        order_id,
        amount,
        description,
        currency,
        language
      });

      // Make request to Epoint execute-pay endpoint
      const response = await this.epointService.makeEpointRequest('execute-pay', {
        data: paymentData.data,
        signature: paymentData.signature
      });

      console.log(`Saved card payment executed for order: ${order_id}, card: ${card_id}`);

      res.json({
        success: true,
        data: response,
        message: 'Payment executed successfully'
      });

    } catch (error) {
      console.error('Error executing saved card payment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute payment',
        code: 'PAYMENT_EXECUTION_FAILED'
      });
    }
  }

  /**
   * Reverse/cancel a payment transaction
   * @route POST /api/epoint/reverse-payment
   */
  async reversePayment(req, res) {
    try {
      const {
        transaction,
        currency = 'AZN',
        language = 'az',
        amount = null
      } = req.body;

      if (!transaction) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required',
          code: 'MISSING_TRANSACTION_ID'
        });
      }

      // Prepare reversal data
      const reversalData = this.epointService.preparePaymentReversal({
        transaction,
        currency,
        language,
        amount
      });

      // Make request to Epoint reverse endpoint
      const response = await this.epointService.makeEpointRequest('reverse', {
        data: reversalData.data,
        signature: reversalData.signature
      });

      console.log(`Payment reversal initiated for transaction: ${transaction}`);

      res.json({
        success: true,
        data: response,
        message: 'Payment reversal initiated successfully'
      });

    } catch (error) {
      console.error('Error reversing payment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reverse payment',
        code: 'PAYMENT_REVERSAL_FAILED'
      });
    }
  }

  /**
   * Create pre-authorization request
   * @route POST /api/epoint/pre-auth/create
   */
  async createPreAuth(req, res) {
    try {
      const {
        amount,
        currency = 'AZN',
        language = 'az',
        order_id,
        description = '',
        success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
        error_redirect_url = process.env.ERROR_REDIRECT_URL
      } = req.body;

      // Validate required fields
      if (!amount || !order_id) {
        return res.status(400).json({
          success: false,
          error: 'Amount and order_id are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Prepare pre-authorization data
      const preAuthData = this.epointService.preparePreAuthRequest({
        amount,
        currency,
        language,
        order_id,
        description,
        success_redirect_url,
        error_redirect_url
      });

      // Make request to Epoint pre-auth endpoint
      const response = await this.epointService.makeEpointRequest('pre-auth-request', {
        data: preAuthData.data,
        signature: preAuthData.signature
      });

      console.log(`Pre-authorization created for order: ${order_id}, amount: ${amount} ${currency}`);

      res.json({
        success: true,
        data: {
          redirect_url: response.redirect_url,
          data: preAuthData.data,
          signature: preAuthData.signature
        },
        message: 'Pre-authorization created successfully'
      });

    } catch (error) {
      console.error('Error creating pre-authorization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create pre-authorization',
        code: 'PRE_AUTH_CREATION_FAILED'
      });
    }
  }

  /**
   * Complete pre-authorization
   * @route POST /api/epoint/pre-auth/complete
   */
  async completePreAuth(req, res) {
    try {
      const {
        amount,
        transaction
      } = req.body;

      if (!amount || !transaction) {
        return res.status(400).json({
          success: false,
          error: 'Amount and transaction ID are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Prepare completion data
      const completionData = this.epointService.preparePreAuthCompletion({
        amount,
        transaction
      });

      // Make request to Epoint pre-auth completion endpoint
      const response = await this.epointService.makeEpointRequest('pre-auth-complete', {
        data: completionData.data,
        signature: completionData.signature
      });

      console.log(`Pre-authorization completed for transaction: ${transaction}, amount: ${amount}`);

      res.json({
        success: true,
        data: response,
        message: 'Pre-authorization completed successfully'
      });

    } catch (error) {
      console.error('Error completing pre-authorization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete pre-authorization',
        code: 'PRE_AUTH_COMPLETION_FAILED'
      });
    }
  }

  /**
   * Update order status in database
   * @private
   */
  async updateOrderStatus(orderId, status, paymentInfo = {}) {
    try {
      const updateData = {
        status: status === 'success' ? 'paid' : 'failed',
        payment_transaction_id: paymentInfo.transaction || null,
        payment_details: paymentInfo,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('payment_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
}

module.exports = EpointController;

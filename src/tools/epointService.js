const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/config');

class EpointService {
  constructor() {
    this.publicKey = process.env.EPOINT_PUBLIC_KEY;
    this.privateKey = process.env.EPOINT_PRIVATE_KEY;
    this.apiBaseUrl = process.env.EPOINT_API_BASE_URL || 'https://epoint.az/api/1';
    
    if (!this.publicKey || !this.privateKey) {
      throw new Error('EPOINT_PUBLIC_KEY and EPOINT_PRIVATE_KEY must be configured');
    }
  }

  /**
   * Generate signature for Epoint API requests
   * Algorithm: base64_encode(sha1(private_key + data + private_key, 1))
   * @param {string} data - Base64 encoded data string
   * @returns {string} - Generated signature
   */
  generateSignature(data) {
    const signatureString = this.privateKey + data + this.privateKey;
    const hash = crypto.createHash('sha1').update(signatureString).digest();
    return hash.toString('base64');
  }

  /**
   * Validate incoming signature from callbacks
   * @param {string} data - Base64 encoded data string
   * @param {string} receivedSignature - Signature received from Epoint
   * @returns {boolean} - True if signature is valid
   */
  validateSignature(data, receivedSignature) {
    const expectedSignature = this.generateSignature(data);
    console.log('Signature validation details:', {
      data: data,
      receivedSignature: receivedSignature,
      expectedSignature: expectedSignature,
      match: expectedSignature === receivedSignature
    });
    return expectedSignature === receivedSignature;
  }

  /**
   * Encode JSON object to Base64 string
   * @param {object} jsonData - JSON object to encode
   * @returns {string} - Base64 encoded string
   */
  encodeData(jsonData) {
    const jsonString = JSON.stringify(jsonData);
    return Buffer.from(jsonString).toString('base64');
  }

  /**
   * Decode Base64 string to JSON object
   * @param {string} encodedData - Base64 encoded string
   * @returns {object} - Decoded JSON object
   */
  decodeData(encodedData) {
    try {
      const jsonString = Buffer.from(encodedData, 'base64').toString();
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error('Invalid Base64 encoded data');
    }
  }

  /**
   * Make request to Epoint API
   * @param {string} endpoint - API endpoint (e.g., 'checkout', 'get-status')
   * @param {object} requestData - Data to send
   * @returns {Promise<object>} - Epoint API response
   */
  async makeEpointRequest(endpoint, requestData, useFormData = false) {
    try {
      const url = `${this.apiBaseUrl}/${endpoint}`;
      
      let requestConfig = {
        timeout: 30000 // 30 second timeout
      };

      if (useFormData) {
        // Use URLSearchParams for form data (like frontend does)
        const formData = new URLSearchParams();
        formData.append('data', requestData.data);
        formData.append('signature', requestData.signature);
        
        requestConfig.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
        requestConfig.data = formData;
      } else {
        // Use JSON format
        requestConfig.headers = {
          'Content-Type': 'application/json',
        };
        requestConfig.data = requestData;
      }

      const response = await axios.post(url, requestConfig.data, requestConfig);
      
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Epoint API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('Epoint API request failed - no response received');
      } else {
        throw new Error(`Epoint API request error: ${error.message}`);
      }
    }
  }

  /**
   * Prepare payment data for standard payment
   * @param {object} paymentDetails - Payment details
   * @returns {object} - Object containing data, signature, and checkout URL
   */
  prepareStandardPayment(paymentDetails) {
    const {
      amount,
      order_id,
      description = '',
      success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
      error_redirect_url = process.env.ERROR_REDIRECT_URL,
      currency = 'AZN',
      language = 'az'
    } = paymentDetails;

    // Required fields according to Epoint documentation
    const paymentData = {
      public_key: this.publicKey,
      amount: amount,
      currency: currency,
      language: language,
      order_id: order_id,
      description: description,
      success_redirect_url: success_redirect_url,
      error_redirect_url: error_redirect_url
    };

    const data = this.encodeData(paymentData);
    const signature = this.generateSignature(data);

    return {
      data,
      signature,
      checkout_url: `${this.apiBaseUrl}/request` // Changed to /request to match frontend
    };
  }

  /**
   * Prepare card registration data
   * @param {object} cardDetails - Card registration details
   * @returns {object} - Object containing data, signature, and registration URL
   */
  prepareCardRegistration(cardDetails) {
    const {
      language = 'az',
      description = 'Card registration',
      success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
      error_redirect_url = process.env.ERROR_REDIRECT_URL
    } = cardDetails;

    const cardData = {
      public_key: this.publicKey,
      language: language,
      description: description,
      success_redirect_url: success_redirect_url,
      error_redirect_url: error_redirect_url,
      refund: 0 // 0 for payment cards
    };

    const data = this.encodeData(cardData);
    const signature = this.generateSignature(data);

    return {
      data,
      signature,
      registration_url: `${this.apiBaseUrl}/card-registration`
    };
  }

  /**
   * Prepare saved card payment data
   * @param {object} paymentDetails - Saved card payment details
   * @returns {object} - Object containing data and signature
   */
  prepareSavedCardPayment(paymentDetails) {
    const {
      card_id,
      order_id,
      amount,
      description = '',
      currency = 'AZN',
      language = 'az'
    } = paymentDetails;

    const paymentData = {
      public_key: this.publicKey,
      language: language,
      card_id: card_id,
      order_id: order_id,
      amount: amount,
      currency: currency,
      description: description
    };

    const data = this.encodeData(paymentData);
    const signature = this.generateSignature(data);

    return { data, signature };
  }

  /**
   * Prepare pre-authorization request data
   * @param {object} preAuthDetails - Pre-authorization details
   * @returns {object} - Object containing data, signature, and pre-auth URL
   */
  preparePreAuthRequest(preAuthDetails) {
    const {
      amount,
      currency = 'AZN',
      language = 'az',
      order_id,
      description = '',
      success_redirect_url = process.env.SUCCESS_REDIRECT_URL,
      error_redirect_url = process.env.ERROR_REDIRECT_URL
    } = preAuthDetails;

    const preAuthData = {
      public_key: this.publicKey,
      amount: amount,
      currency: currency,
      language: language,
      order_id: order_id,
      description: description,
      success_redirect_url: success_redirect_url,
      error_redirect_url: error_redirect_url
    };

    const data = this.encodeData(preAuthData);
    const signature = this.generateSignature(data);

    return {
      data,
      signature,
      pre_auth_url: `${this.apiBaseUrl}/pre-auth-request`
    };
  }

  /**
   * Prepare pre-authorization completion data
   * @param {object} completionDetails - Pre-auth completion details
   * @returns {object} - Object containing data and signature
   */
  preparePreAuthCompletion(completionDetails) {
    const {
      amount,
      transaction
    } = completionDetails;

    const completionData = {
      public_key: this.publicKey,
      amount: amount,
      transaction: transaction
    };

    const data = this.encodeData(completionData);
    const signature = this.generateSignature(data);

    return { data, signature };
  }

  /**
   * Prepare payment reversal data
   * @param {object} reversalDetails - Payment reversal details
   * @returns {object} - Object containing data and signature
   */
  preparePaymentReversal(reversalDetails) {
    const {
      transaction,
      currency = 'AZN',
      language = 'az',
      amount = null
    } = reversalDetails;

    const reversalData = {
      public_key: this.publicKey,
      language: language,
      transaction: transaction,
      currency: currency
    };

    // Add amount if provided (for partial reversal)
    if (amount !== null) {
      reversalData.amount = amount;
    }

    const data = this.encodeData(reversalData);
    const signature = this.generateSignature(data);

    return { data, signature };
  }

  /**
   * Prepare status check data
   * @param {string} transactionId - Transaction ID to check
   * @returns {object} - Object containing data and signature
   */
  prepareStatusCheck(transactionId) {
    const statusData = {
      public_key: this.publicKey,
      transaction: transactionId
    };

    const data = this.encodeData(statusData);
    const signature = this.generateSignature(data);

    return { data, signature };
  }
}

module.exports = EpointService;

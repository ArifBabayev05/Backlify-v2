# 🚀 Epoint Payment Gateway - Frontend Integration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Payment Flows](#payment-flows)
5. [Frontend Implementation](#frontend-implementation)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide provides comprehensive instructions for integrating Epoint payment gateway into your frontend application. The backend API is already configured and ready to handle all Epoint payment operations.

### What is Epoint?
Epoint is a payment gateway service that allows you to process online payments through various methods including credit cards, bank transfers, and digital wallets. It's commonly used in Azerbaijan and supports multiple currencies.

### Why Use This Integration?
- **Secure**: All sensitive operations are handled on the backend
- **Flexible**: Supports multiple payment methods and flows
- **Reliable**: Built-in error handling and status checking
- **Compliant**: Follows payment industry standards

---

## 🔧 Environment Setup

### Required Environment Variables
Add these to your `.env` file:

```env
# Epoint Configuration
EPOINT_PUBLIC_KEY=your_actual_public_key_here
EPOINT_PRIVATE_KEY=your_actual_private_key_here
EPOINT_API_BASE_URL=https://epoint.az/api/1

# Redirect URLs (where users go after payment)
SUCCESS_REDIRECT_URL=https://yourdomain.com/payment/success
ERROR_REDIRECT_URL=https://yourdomain.com/payment/error
```

### What Each Variable Does:
- **EPOINT_PUBLIC_KEY**: Your merchant public key from Epoint (used for API authentication)
- **EPOINT_PRIVATE_KEY**: Your merchant private key (used for signature generation - NEVER expose in frontend)
- **EPOINT_API_BASE_URL**: Base URL for Epoint API endpoints
- **SUCCESS_REDIRECT_URL**: Where users are redirected after successful payment
- **ERROR_REDIRECT_URL**: Where users are redirected after failed payment

---

## 📡 API Endpoints Reference

### 1. Standard Payment Request
**Purpose**: Initiate a standard payment process where user is redirected to Epoint checkout page.

**Endpoint**: `POST /api/epoint/request`

**When to Use**: 
- Regular product purchases
- Subscription payments
- One-time payments
- When you want user to enter card details on Epoint's secure page

**Request Body**:
```javascript
{
  "amount": 25.50,           // Required: Payment amount
  "order_id": "ORDER_123",   // Required: Unique order identifier
  "description": "Product purchase", // Optional: Payment description
  "currency": "AZN",         // Optional: Currency (default: AZN)
  "language": "az"           // Optional: Language (default: az)
}
```

**Response**:
```javascript
{
  "status": "success",                    // Payment request status
  "redirect_url": "https://epoint.az/checkout/...", // URL to redirect user
  "message": "Payment request created successfully"
}
```

**Frontend Flow**:
1. User clicks "Pay Now" button
2. Frontend sends request to `/api/epoint/request`
3. Backend creates payment request with Epoint
4. Frontend receives `redirect_url`
5. User is redirected to Epoint checkout page
6. User completes payment on Epoint
7. Epoint redirects back to your success/error page

---

### 2. Payment Status Check
**Purpose**: Check the current status of a payment transaction.

**Endpoint**: `POST /api/epoint/check-status`

**When to Use**:
- After user returns from Epoint checkout
- To verify payment completion
- For order status updates
- When handling payment callbacks

**Request Body**:
```javascript
{
  "transaction_id": "TXN_123456",  // Optional: Epoint transaction ID
  "order_id": "ORDER_123"          // Optional: Your order ID (alternative to transaction_id)
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "status": "success",           // Payment status: success, failed, pending
    "transaction": "TXN_123456",   // Epoint transaction ID
    "amount": "25.50",            // Payment amount
    "currency": "AZN",            // Payment currency
    "order_id": "ORDER_123",      // Your order ID
    "message": "Payment completed successfully"
  }
}
```

---

### 3. Save Card (Card Registration)
**Purpose**: Allow users to save their card details for future payments without re-entering information.

**Endpoint**: `POST /api/epoint/save-card`

**When to Use**:
- For returning customers
- Subscription services
- Quick checkout options
- When you want to store card details securely

**Request Body**:
```javascript
{
  "language": "az",                    // Optional: Language (default: az)
  "description": "Card registration"   // Optional: Description for the card save process
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "redirect_url": "https://epoint.az/card-registration/...", // URL for card registration
    "data": "base64_encoded_data",     // Encoded data for the request
    "signature": "generated_signature" // Security signature
  },
  "message": "Card registration initiated"
}
```

**Frontend Flow**:
1. User clicks "Save Card" button
2. Frontend sends request to `/api/epoint/save-card`
3. User is redirected to Epoint card registration page
4. User enters card details on Epoint's secure page
5. Epoint returns a `card_id` to your callback URL
6. You can now use this `card_id` for future payments

---

### 4. Pay with Saved Card
**Purpose**: Process payment using a previously saved card without redirecting user to Epoint.

**Endpoint**: `POST /api/epoint/execute-saved-card-payment`

**When to Use**:
- For users with saved cards
- Quick checkout process
- Subscription renewals
- When you want seamless payment experience

**Request Body**:
```javascript
{
  "card_id": "CARD_123456",        // Required: Saved card ID from card registration
  "order_id": "ORDER_123",         // Required: Unique order identifier
  "amount": 25.50,                 // Required: Payment amount
  "description": "Payment with saved card", // Optional: Payment description
  "currency": "AZN",               // Optional: Currency (default: AZN)
  "language": "az"                 // Optional: Language (default: az)
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "status": "success",           // Payment status
    "transaction": "TXN_123456",   // Epoint transaction ID
    "amount": "25.50",            // Payment amount
    "currency": "AZN",            // Payment currency
    "message": "Payment completed successfully"
  },
  "message": "Payment executed successfully"
}
```

---

### 5. Payment Reversal (Refund)
**Purpose**: Cancel or refund a completed payment transaction.

**Endpoint**: `POST /api/epoint/reverse-payment`

**When to Use**:
- Customer requests refund
- Order cancellation
- Partial refunds
- Dispute resolution

**Request Body**:
```javascript
{
  "transaction": "TXN_123456",     // Required: Epoint transaction ID to reverse
  "currency": "AZN",               // Optional: Currency (default: AZN)
  "language": "az",                // Optional: Language (default: az)
  "amount": 25.50                  // Optional: Amount to reverse (null for full reversal)
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "status": "success",           // Reversal status
    "transaction": "TXN_123456",   // Original transaction ID
    "reversal_transaction": "REV_123456", // New reversal transaction ID
    "amount": "25.50",            // Reversed amount
    "message": "Payment reversed successfully"
  },
  "message": "Payment reversal initiated successfully"
}
```

---

### 6. Pre-Authorization (Two-Step Payment)
**Purpose**: Hold funds on customer's card without immediately charging them.

**Endpoint**: `POST /api/epoint/pre-auth/create`

**When to Use**:
- Hotel bookings
- Car rentals
- Services that need approval before charging
- When you need to verify card validity

**Request Body**:
```javascript
{
  "amount": 25.50,                 // Required: Amount to authorize
  "currency": "AZN",               // Optional: Currency (default: AZN)
  "language": "az",                // Optional: Language (default: az)
  "order_id": "ORDER_123",         // Required: Unique order identifier
  "description": "Pre-authorization" // Optional: Description
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "redirect_url": "https://epoint.az/pre-auth/...", // URL for pre-auth process
    "data": "base64_encoded_data",     // Encoded data
    "signature": "generated_signature" // Security signature
  },
  "message": "Pre-authorization created successfully"
}
```

### 7. Complete Pre-Authorization
**Purpose**: Capture the previously authorized funds.

**Endpoint**: `POST /api/epoint/pre-auth/complete`

**When to Use**:
- After service is delivered
- When you're ready to charge the customer
- To complete the two-step payment process

**Request Body**:
```javascript
{
  "amount": 25.50,                 // Required: Amount to capture (can be less than authorized)
  "transaction": "TXN_123456"      // Required: Transaction ID from pre-auth step
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "status": "success",           // Capture status
    "transaction": "TXN_123456",   // Original pre-auth transaction
    "capture_transaction": "CAP_123456", // New capture transaction
    "amount": "25.50",            // Captured amount
    "message": "Pre-authorization completed successfully"
  },
  "message": "Pre-authorization completed successfully"
}
```

---

## 💻 Frontend Implementation

### 1. Payment Component Structure

```javascript
// PaymentForm.jsx
import React, { useState, useEffect } from 'react';

const PaymentForm = ({ orderData, onPaymentSuccess, onPaymentError }) => {
  const [paymentMethod, setPaymentMethod] = useState('standard');
  const [savedCards, setSavedCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user's saved cards
  useEffect(() => {
    loadSavedCards();
  }, []);

  const loadSavedCards = async () => {
    try {
      // Load from your user profile or local storage
      const cards = await getUserSavedCards();
      setSavedCards(cards);
    } catch (error) {
      console.error('Error loading saved cards:', error);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (paymentMethod) {
        case 'standard':
          await handleStandardPayment();
          break;
        case 'saved_card':
          await handleSavedCardPayment();
          break;
        case 'pre_auth':
          await handlePreAuthPayment();
          break;
        default:
          throw new Error('Invalid payment method');
      }
    } catch (error) {
      setError(error.message);
      onPaymentError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-form">
      <h2>Payment Method</h2>
      
      {/* Payment Method Selection */}
      <div className="payment-methods">
        <label>
          <input
            type="radio"
            value="standard"
            checked={paymentMethod === 'standard'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          Pay with New Card
        </label>
        
        {savedCards.length > 0 && (
          <label>
            <input
              type="radio"
              value="saved_card"
              checked={paymentMethod === 'saved_card'}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            Pay with Saved Card
          </label>
        )}
        
        <label>
          <input
            type="radio"
            value="pre_auth"
            checked={paymentMethod === 'pre_auth'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          Pre-Authorize Payment
        </label>
      </div>

      {/* Order Summary */}
      <div className="order-summary">
        <h3>Order Summary</h3>
        <p>Amount: {orderData.total} {orderData.currency}</p>
        <p>Description: {orderData.description}</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Payment Button */}
      <button
        onClick={handlePayment}
        disabled={loading}
        className="payment-button"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
};

export default PaymentForm;
```

### 2. Standard Payment Implementation

```javascript
// StandardPayment.js
const handleStandardPayment = async () => {
  try {
    const response = await fetch('/api/epoint/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: orderData.total,
        order_id: orderData.id,
        description: orderData.description,
        currency: orderData.currency || 'AZN',
        language: 'az'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 'success') {
      // Store order ID for later verification
      localStorage.setItem('pending_order_id', orderData.id);
      
      // Redirect to Epoint checkout
      window.location.href = result.redirect_url;
    } else {
      throw new Error(result.message || 'Payment request failed');
    }
  } catch (error) {
    console.error('Standard payment error:', error);
    throw error;
  }
};
```

### 3. Saved Card Payment Implementation

```javascript
// SavedCardPayment.js
const handleSavedCardPayment = async () => {
  try {
    const selectedCard = savedCards.find(card => card.isSelected);
    
    if (!selectedCard) {
      throw new Error('Please select a saved card');
    }

    const response = await fetch('/api/epoint/execute-saved-card-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        card_id: selectedCard.card_id,
        order_id: orderData.id,
        amount: orderData.total,
        description: orderData.description,
        currency: orderData.currency || 'AZN',
        language: 'az'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.data.status === 'success') {
      // Payment successful
      onPaymentSuccess?.(result.data);
      
      // Redirect to success page
      window.location.href = '/payment/success?order_id=' + orderData.id;
    } else {
      throw new Error(result.data?.message || 'Payment failed');
    }
  } catch (error) {
    console.error('Saved card payment error:', error);
    throw error;
  }
};
```

### 4. Card Registration Implementation

```javascript
// CardRegistration.js
const saveCard = async () => {
  try {
    setLoading(true);
    
    const response = await fetch('/api/epoint/save-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: 'az',
        description: 'Card registration for future payments'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      // Store pending card registration
      localStorage.setItem('pending_card_registration', 'true');
      
      // Redirect to card registration
      window.location.href = result.data.redirect_url;
    } else {
      throw new Error('Card registration failed');
    }
  } catch (error) {
    console.error('Card save error:', error);
    throw error;
  } finally {
    setLoading(false);
  }
};
```

### 5. Payment Status Check Implementation

```javascript
// PaymentStatus.js
const checkPaymentStatus = async (orderId) => {
  try {
    const response = await fetch('/api/epoint/check-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error('Status check failed');
    }
  } catch (error) {
    console.error('Status check error:', error);
    return null;
  }
};

// Usage in success page
const PaymentSuccess = () => {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyPayment = async () => {
      const orderId = new URLSearchParams(window.location.search).get('order_id');
      
      if (orderId) {
        const status = await checkPaymentStatus(orderId);
        setPaymentStatus(status);
        
        if (status?.status !== 'success') {
          // Redirect to error page if payment failed
          window.location.href = '/payment/error?order_id=' + orderId;
        }
      }
      
      setLoading(false);
    };

    verifyPayment();
  }, []);

  if (loading) {
    return <div>Verifying payment...</div>;
  }

  if (paymentStatus?.status === 'success') {
    return (
      <div className="success-page">
        <h1>Payment Successful!</h1>
        <p>Transaction ID: {paymentStatus.transaction}</p>
        <p>Amount: {paymentStatus.amount} {paymentStatus.currency}</p>
        <button onClick={() => window.location.href = '/dashboard'}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return <div>Payment verification failed</div>;
};
```

### 6. Pre-Authorization Implementation

```javascript
// PreAuthorization.js
const handlePreAuthPayment = async () => {
  try {
    const response = await fetch('/api/epoint/pre-auth/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: orderData.total,
        currency: orderData.currency || 'AZN',
        language: 'az',
        order_id: orderData.id,
        description: orderData.description
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      // Store pre-auth transaction for later completion
      localStorage.setItem('pre_auth_transaction', result.data.transaction);
      localStorage.setItem('pre_auth_order_id', orderData.id);
      
      // Redirect to pre-auth process
      window.location.href = result.data.redirect_url;
    } else {
      throw new Error('Pre-authorization failed');
    }
  } catch (error) {
    console.error('Pre-auth error:', error);
    throw error;
  }
};

// Complete pre-authorization (call this when service is delivered)
const completePreAuth = async (transactionId, finalAmount) => {
  try {
    const response = await fetch('/api/epoint/pre-auth/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: finalAmount,
        transaction: transactionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error('Pre-auth completion failed');
    }
  } catch (error) {
    console.error('Pre-auth completion error:', error);
    throw error;
  }
};
```

### 7. Payment Reversal Implementation

```javascript
// PaymentReversal.js
const reversePayment = async (transactionId, amount = null) => {
  try {
    const response = await fetch('/api/epoint/reverse-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: transactionId,
        currency: 'AZN',
        language: 'az',
        amount: amount // null for full reversal, specific amount for partial
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error('Payment reversal failed');
    }
  } catch (error) {
    console.error('Payment reversal error:', error);
    throw error;
  }
};

// Usage in admin panel or customer service
const RefundButton = ({ transactionId, orderAmount }) => {
  const [loading, setLoading] = useState(false);
  const [refundType, setRefundType] = useState('full'); // 'full' or 'partial'
  const [partialAmount, setPartialAmount] = useState('');

  const handleRefund = async () => {
    setLoading(true);
    
    try {
      const amount = refundType === 'partial' ? parseFloat(partialAmount) : null;
      
      if (refundType === 'partial' && (!amount || amount <= 0 || amount > orderAmount)) {
        throw new Error('Invalid partial refund amount');
      }

      const result = await reversePayment(transactionId, amount);
      
      alert(`Refund successful! Transaction ID: ${result.reversal_transaction}`);
      
      // Refresh the page or update UI
      window.location.reload();
    } catch (error) {
      alert(`Refund failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="refund-section">
      <h3>Refund Options</h3>
      
      <div>
        <label>
          <input
            type="radio"
            value="full"
            checked={refundType === 'full'}
            onChange={(e) => setRefundType(e.target.value)}
          />
          Full Refund ({orderAmount} AZN)
        </label>
        
        <label>
          <input
            type="radio"
            value="partial"
            checked={refundType === 'partial'}
            onChange={(e) => setRefundType(e.target.value)}
          />
          Partial Refund
        </label>
      </div>

      {refundType === 'partial' && (
        <div>
          <input
            type="number"
            value={partialAmount}
            onChange={(e) => setPartialAmount(e.target.value)}
            placeholder="Enter refund amount"
            min="0.01"
            max={orderAmount}
            step="0.01"
          />
          <span>AZN</span>
        </div>
      )}

      <button
        onClick={handleRefund}
        disabled={loading}
        className="refund-button"
      >
        {loading ? 'Processing Refund...' : 'Process Refund'}
      </button>
    </div>
  );
};
```

---

## ⚠️ Error Handling

### Common Error Scenarios

#### 1. Network Errors
```javascript
const handleApiCall = async (apiFunction) => {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // Network error
      throw new Error('Network connection failed. Please check your internet connection.');
    } else if (error.response?.status === 500) {
      // Server error
      throw new Error('Server error. Please try again later.');
    } else if (error.response?.status === 400) {
      // Bad request
      throw new Error('Invalid request. Please check your input.');
    } else {
      // Other errors
      throw new Error(error.message || 'An unexpected error occurred.');
    }
  }
};
```

#### 2. Payment-Specific Errors
```javascript
const handlePaymentError = (error) => {
  const errorMessages = {
    'MISSING_REQUIRED_FIELDS': 'Please fill in all required fields.',
    'INVALID_AMOUNT': 'Invalid payment amount.',
    'CARD_DECLINED': 'Your card was declined. Please try a different card.',
    'INSUFFICIENT_FUNDS': 'Insufficient funds. Please check your account balance.',
    'EXPIRED_CARD': 'Your card has expired. Please use a different card.',
    'INVALID_CARD': 'Invalid card information. Please check your card details.',
    'MERCHANT_NOT_ACTIVE': 'Payment service is temporarily unavailable.',
    'TRANSACTION_FAILED': 'Transaction failed. Please try again.'
  };

  const userMessage = errorMessages[error.code] || error.message || 'Payment failed. Please try again.';
  
  // Show error to user
  showErrorMessage(userMessage);
  
  // Log error for debugging
  console.error('Payment error:', error);
};
```

#### 3. Error Display Component
```javascript
const ErrorDisplay = ({ error, onRetry, onCancel }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="error-display">
      <div className="error-icon">⚠️</div>
      <h3>Payment Error</h3>
      <p className="error-message">{error.message}</p>
      
      {error.details && (
        <div className="error-details">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="details-toggle"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
          
          {showDetails && (
            <div className="error-details-content">
              <p><strong>Error Code:</strong> {error.code}</p>
              <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
              {error.transactionId && (
                <p><strong>Transaction ID:</strong> {error.transactionId}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="error-actions">
        {onRetry && (
          <button onClick={onRetry} className="retry-button">
            Try Again
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## 🔒 Security Considerations

### 1. Never Expose Sensitive Data
```javascript
// ❌ WRONG - Never do this
const privateKey = "your_private_key"; // This will be visible to users!

// ✅ CORRECT - Use environment variables on backend only
// Private key stays on server, never sent to frontend
```

### 2. Validate All Inputs
```javascript
const validatePaymentData = (orderData) => {
  const errors = [];

  // Amount validation
  if (!orderData.total || orderData.total <= 0) {
    errors.push('Invalid payment amount');
  }

  // Order ID validation
  if (!orderData.id || orderData.id.length < 3) {
    errors.push('Invalid order ID');
  }

  // Currency validation
  const validCurrencies = ['AZN', 'USD', 'EUR'];
  if (!validCurrencies.includes(orderData.currency)) {
    errors.push('Invalid currency');
  }

  return errors;
};

// Use validation before making API calls
const handlePayment = async () => {
  const validationErrors = validatePaymentData(orderData);
  
  if (validationErrors.length > 0) {
    setError(validationErrors.join(', '));
    return;
  }

  // Proceed with payment
  await processPayment();
};
```

### 3. Use HTTPS Only
```javascript
// Ensure all API calls use HTTPS
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://yourdomain.com' 
  : 'http://localhost:3000';

// Check if current page is HTTPS
if (window.location.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
  console.warn('Payment page should use HTTPS in production');
}
```

### 4. Implement Rate Limiting on Frontend
```javascript
class RateLimiter {
  constructor(maxRequests = 5, timeWindow = 60000) { // 5 requests per minute
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    
    // Remove old requests outside time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    // Check if we can make another request
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    this.requests.push(now);
    return true;
  }
}

const paymentRateLimiter = new RateLimiter(3, 60000); // 3 payment attempts per minute

const handlePayment = async () => {
  if (!paymentRateLimiter.canMakeRequest()) {
    setError('Too many payment attempts. Please wait a moment and try again.');
    return;
  }

  // Proceed with payment
  await processPayment();
};
```

---

## 🧪 Testing Guide

### 1. Test Environment Setup
```javascript
// Create test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000', // Your local backend
  testOrderId: 'TEST_' + Date.now(),
  testAmount: 1.00, // Use small amounts for testing
  testCard: {
    number: '4111111111111111', // Test card number
    expiry: '12/25',
    cvv: '123'
  }
};

// Test data generator
const generateTestOrder = () => ({
  id: TEST_CONFIG.testOrderId,
  total: TEST_CONFIG.testAmount,
  currency: 'AZN',
  description: 'Test payment',
  items: [
    { name: 'Test Product', price: TEST_CONFIG.testAmount, quantity: 1 }
  ]
});
```

### 2. Manual Testing Checklist

#### Standard Payment Flow
- [ ] Payment form loads correctly
- [ ] Amount validation works
- [ ] Order ID generation works
- [ ] API request is sent correctly
- [ ] Redirect to Epoint works
- [ ] Success page loads after payment
- [ ] Error page loads on failure
- [ ] Payment status is verified correctly

#### Saved Card Flow
- [ ] Card registration initiates correctly
- [ ] Card is saved successfully
- [ ] Saved cards are displayed
- [ ] Payment with saved card works
- [ ] Card selection works
- [ ] Error handling for invalid cards

#### Pre-Authorization Flow
- [ ] Pre-auth request is created
- [ ] Pre-auth completion works
- [ ] Partial capture works
- [ ] Full capture works
- [ ] Error handling for failed pre-auth

#### Error Scenarios
- [ ] Network errors are handled
- [ ] Invalid amounts are rejected
- [ ] Missing fields are validated
- [ ] Server errors are handled
- [ ] Timeout errors are handled

### 3. Automated Testing
```javascript
// Jest test example
describe('Payment Integration', () => {
  test('should create standard payment request', async () => {
    const orderData = generateTestOrder();
    
    const response = await fetch('/api/epoint/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: orderData.total,
        order_id: orderData.id,
        description: orderData.description,
        currency: 'AZN',
        language: 'az'
      })
    });

    expect(response.ok).toBe(true);
    
    const result = await response.json();
    expect(result.status).toBe('success');
    expect(result.redirect_url).toBeDefined();
  });

  test('should handle payment errors gracefully', async () => {
    const response = await fetch('/api/epoint/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required fields
        description: 'Test payment'
      })
    });

    expect(response.status).toBe(400);
    
    const result = await response.json();
    expect(result.status).toBe('error');
    expect(result.message).toContain('required');
  });
});
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. "Merchant not active" Error
**Problem**: Epoint returns "Merchant not active" error
**Solution**: 
- Check if your Epoint account is properly activated
- Verify your public and private keys are correct
- Contact Epoint support to activate your merchant account

#### 2. Signature Validation Failed
**Problem**: "Invalid signature" error in callbacks
**Solution**:
- Ensure private key is correctly set in environment variables
- Check if signature generation algorithm matches Epoint requirements
- Verify data encoding is correct (Base64)

#### 3. Redirect URLs Not Working
**Problem**: Users not redirected to correct success/error pages
**Solution**:
- Check SUCCESS_REDIRECT_URL and ERROR_REDIRECT_URL in environment variables
- Ensure URLs are accessible and return proper HTTP status codes
- Test redirect URLs manually

#### 4. CORS Issues
**Problem**: Frontend can't make requests to backend API
**Solution**:
- Check CORS configuration in backend
- Ensure frontend domain is allowed in CORS settings
- Verify preflight OPTIONS requests are handled

#### 5. Payment Status Not Updating
**Problem**: Payment status remains pending after successful payment
**Solution**:
- Check if callback URL is correctly configured in Epoint dashboard
- Verify callback endpoint is accessible from internet
- Check server logs for callback processing errors

### Debug Tools

#### 1. Network Monitoring
```javascript
// Add request/response logging
const logApiCall = (url, request, response) => {
  console.group('API Call');
  console.log('URL:', url);
  console.log('Request:', request);
  console.log('Response:', response);
  console.groupEnd();
};

// Wrap fetch calls
const apiCall = async (url, options) => {
  const response = await fetch(url, options);
  logApiCall(url, options, response);
  return response;
};
```

#### 2. Error Tracking
```javascript
// Implement error tracking
const trackError = (error, context) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    context: context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  // Send to your error tracking service
  console.error('Payment Error:', errorData);
  
  // Or send to your backend
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData)
  }).catch(console.error);
};
```

#### 3. Payment Flow Debugging
```javascript
// Add debugging to payment flow
const debugPaymentFlow = {
  start: (orderData) => {
    console.log('Payment flow started:', orderData);
    localStorage.setItem('payment_debug', JSON.stringify({
      startTime: Date.now(),
      orderData: orderData
    }));
  },

  step: (stepName, data) => {
    console.log(`Payment step: ${stepName}`, data);
    const debug = JSON.parse(localStorage.getItem('payment_debug') || '{}');
    debug[stepName] = { timestamp: Date.now(), data: data };
    localStorage.setItem('payment_debug', JSON.stringify(debug));
  },

  end: (result) => {
    console.log('Payment flow ended:', result);
    const debug = JSON.parse(localStorage.getItem('payment_debug') || '{}');
    debug.end = { timestamp: Date.now(), result: result };
    localStorage.setItem('payment_debug', JSON.stringify(debug));
  }
};

// Usage in payment flow
const handlePayment = async () => {
  debugPaymentFlow.start(orderData);
  
  try {
    debugPaymentFlow.step('api_request', { endpoint: '/api/epoint/request' });
    const response = await fetch('/api/epoint/request', { /* ... */ });
    
    debugPaymentFlow.step('api_response', { status: response.status });
    const result = await response.json();
    
    debugPaymentFlow.step('redirect', { url: result.redirect_url });
    window.location.href = result.redirect_url;
    
    debugPaymentFlow.end({ success: true });
  } catch (error) {
    debugPaymentFlow.end({ success: false, error: error.message });
    throw error;
  }
};
```

---

## 📞 Support and Resources

### Epoint Documentation
- Official Epoint API Documentation
- Epoint Merchant Portal
- Epoint Support Contact

### Backend API Documentation
- Check `/docs/EPOINT_INTEGRATION.md` for backend implementation details
- API endpoint testing tools in `/src/tools/`

### Common Support Contacts
- **Epoint Support**: support@epoint.az
- **Technical Issues**: Check server logs and error tracking
- **Integration Questions**: Refer to this documentation

---

## 📝 Conclusion

This comprehensive guide provides everything you need to integrate Epoint payment gateway into your frontend application. The backend API is already configured and ready to handle all payment operations securely.

### Key Takeaways:
1. **Security First**: Never expose private keys in frontend code
2. **Error Handling**: Implement comprehensive error handling for all scenarios
3. **User Experience**: Provide clear feedback and loading states
4. **Testing**: Thoroughly test all payment flows before going live
5. **Monitoring**: Implement proper logging and error tracking

### Next Steps:
1. Set up environment variables with your actual Epoint credentials
2. Implement the payment components in your frontend
3. Test all payment flows in a safe environment
4. Deploy to production with proper monitoring

Remember to always test with small amounts first and ensure your application handles all error scenarios gracefully.

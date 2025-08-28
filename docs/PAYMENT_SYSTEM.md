# Backlify Payment System

## Overview

The Backlify Payment System is a comprehensive solution that integrates with the Epoint payment gateway to provide subscription-based API access. This system handles payment processing, subscription management, and ensures all APIs are accessible without CORS errors.

## Features

- **Multiple Subscription Plans**: Basic, Pro, and Enterprise tiers
- **Epoint Integration**: Secure payment processing with signature verification
- **Subscription Management**: Automatic plan activation and expiration handling
- **CORS-Free APIs**: All endpoints are accessible from any origin
- **Usage Tracking**: Monitor API usage based on subscription plans
- **Secure Callbacks**: Verified payment callbacks from Epoint

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backlify API   │    │   Epoint        │
│   Application   │◄──►│   Server         │◄──►│   Gateway       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Supabase       │
                       │   Database       │
                       └──────────────────┘
```

## Database Schema

### Payment Plans Table
```sql
CREATE TABLE payment_plans (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AZN',
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Payment Orders Table
```sql
CREATE TABLE payment_orders (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    api_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AZN',
    status VARCHAR(20) DEFAULT 'pending',
    payment_transaction_id VARCHAR(100),
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### User Subscriptions Table
```sql
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    api_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

### Payment Management

#### Get Available Plans
```http
GET /api/payment/plans
```
Returns all available subscription plans with pricing and features.

#### Create Payment Order
```http
POST /api/payment/order
Content-Type: application/json

{
  "planId": "pro",
  "apiId": "optional-api-id"
}
```
Creates a new payment order and returns Epoint payment URL.

#### Get Payment History
```http
GET /api/payment/history
Authorization: Bearer <token>
```
Returns user's payment history.

#### Get User Subscription
```http
GET /api/payment/subscription?apiId=<optional-api-id>
Authorization: Bearer <token>
```
Returns user's active subscription details.

#### Check Subscription Status
```http
GET /api/payment/check-subscription?apiId=<optional-api-id>
Authorization: Bearer <token>
```
Quick check if user has active subscription.

### Epoint Integration

#### Payment Callback
```http
POST /api/epoint-callback
Content-Type: application/json

{
  "data": "base64_encoded_payment_data",
  "signature": "verification_signature"
}
```
Processes payment callbacks from Epoint gateway.

#### Payment Success
```http
GET /api/payment/success?order_id=<order_id>
```
Handles successful payment redirects.

#### Payment Cancel
```http
GET /api/payment/cancel?order_id=<order_id>
```
Handles cancelled payment redirects.

## CORS Configuration

The system implements comprehensive CORS settings to ensure all APIs are accessible:

- **All Origins Allowed**: `Access-Control-Allow-Origin: *`
- **All Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **All Headers**: Including custom authentication and payment headers
- **Credentials Support**: `Access-Control-Allow-Credentials: true`
- **Preflight Caching**: 24-hour cache for OPTIONS requests

## Environment Variables

```bash
# Epoint Configuration
EPOINT_PRIVATE_KEY=your_private_key_here
EPOINT_MERCHANT_ID=your_merchant_id_here
EPOINT_API_URL=https://api.epoint.az
EPOINT_CALLBACK_URL=/api/epoint-callback

# Server Configuration
BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the required environment variables to your `.env` file.

### 3. Initialize Database
```bash
node src/tools/setup-payment-system.js
```

### 4. Start Server
```bash
npm start
```

## Payment Flow

### 1. User Selection
- User selects a subscription plan
- System creates payment order
- Returns Epoint payment URL

### 2. Payment Processing
- User redirected to Epoint
- Completes payment
- Epoint sends callback to `/api/epoint-callback`

### 3. Callback Processing
- System verifies callback signature
- Updates order status
- Activates user subscription
- Returns success to Epoint

### 4. Subscription Activation
- User subscription marked as active
- API access granted based on plan
- Usage tracking enabled

## Security Features

### Signature Verification
```javascript
// Epoint signature verification
const signatureString = privateKey + data + privateKey;
const hash = crypto.createHash('sha1').update(signatureString).digest();
const expectedSignature = hash.toString('base64');
```

### Input Validation
- All payment data validated before processing
- SQL injection prevention
- XSS protection

### Rate Limiting
- API request rate limiting
- Payment attempt throttling
- IP-based security measures

## Subscription Plans

### Basic Plan - 9.99 AZN/month
- Basic API access
- 1,000 requests/month
- Email support

### Pro Plan - 19.99 AZN/month
- Pro API access
- 10,000 requests/month
- Priority support
- Custom domains

### Enterprise Plan - 49.99 AZN/month
- Enterprise API access
- Unlimited requests
- 24/7 support
- Custom integrations
- SLA guarantee

## Usage Examples

### Frontend Integration
```javascript
// Get available plans
const plans = await fetch('/api/payment/plans').then(r => r.json());

// Create payment order
const order = await fetch('/api/payment/order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'pro' })
}).then(r => r.json());

// Redirect to payment
window.location.href = order.data.paymentUrl;
```

### Subscription Check
```javascript
// Check if user has active subscription
const subscription = await fetch('/api/payment/check-subscription?apiId=my-api')
  .then(r => r.json());

if (subscription.data.hasActiveSubscription) {
  // User can access API
} else {
  // Redirect to pricing page
}
```

## Error Handling

### Common Error Codes
- `SUBSCRIPTION_REQUIRED`: User needs active subscription
- `PLAN_UPGRADE_REQUIRED`: Current plan insufficient
- `SUBSCRIPTION_EXPIRED`: Subscription has expired
- `PAYMENT_FAILED`: Payment processing failed

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "redirectUrl": "/pricing"
}
```

## Monitoring and Logging

### Payment Logs
- All payment attempts logged
- Callback processing tracked
- Error scenarios documented

### Usage Analytics
- API request counts
- Plan subscription statistics
- Revenue tracking

## Troubleshooting

### Common Issues

#### CORS Errors
- Ensure CORS middleware is loaded first
- Check that all origins are allowed
- Verify preflight request handling

#### Payment Callbacks
- Verify Epoint private key configuration
- Check callback URL accessibility
- Monitor signature verification logs

#### Database Issues
- Verify Supabase connection
- Check table permissions
- Ensure proper indexes exist

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## Support

For technical support or questions about the payment system:

1. Check the logs for error details
2. Verify environment configuration
3. Test database connectivity
4. Review CORS settings

## Contributing

When contributing to the payment system:

1. Follow existing code patterns
2. Add comprehensive error handling
3. Include CORS headers in all responses
4. Test with various origin scenarios
5. Update documentation for new features

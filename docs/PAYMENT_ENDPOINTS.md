# Payment System Endpoints - Public vs Private

## Overview

The Backlify Payment System has both public and private endpoints. Public endpoints can be accessed without authentication, while private endpoints require user authentication.

## 🌐 Public Endpoints (No Authentication Required)

### 1. Health Check
```http
GET /api/payment/health
```
**Purpose**: Check if the payment system is operational
**Response**: System status and timestamp
**Use Case**: Monitoring, health checks, system verification

### 2. Get Payment Plans
```http
GET /api/payment/plans
```
**Purpose**: Retrieve available subscription plans
**Response**: List of all payment plans with pricing and features
**Use Case**: Display pricing page, plan comparison, public information

### 3. Payment Success Page
```http
GET /api/payment/success?order_id=<order_id>
```
**Purpose**: Handle successful payment redirects
**Response**: Success message and redirect information
**Use Case**: Post-payment user experience

### 4. Payment Cancel Page
```http
GET /api/payment/cancel?order_id=<order_id>
```
**Purpose**: Handle cancelled payment redirects
**Response**: Cancel message and redirect information
**Use Case**: Post-payment user experience

### 5. Epoint Callback (Direct)
```http
POST /api/epoint-callback
```
**Purpose**: Process payment callbacks from Epoint gateway
**Response**: Processing status
**Use Case**: Payment gateway integration (called by Epoint, not users)

## 🔒 Private Endpoints (Authentication Required)

### 1. Create Payment Order
```http
POST /api/payment/order
Authorization: Bearer <token> OR X-User-Id: <user_id>
```
**Purpose**: Create a new payment order
**Response**: Order details and payment URL
**Use Case**: User initiates payment

### 2. Get Payment History
```http
GET /api/payment/history
Authorization: Bearer <token> OR X-User-Id: <user_id>
```
**Purpose**: Retrieve user's payment history
**Response**: List of past payments
**Use Case**: User dashboard, billing history

### 3. Get User Subscription
```http
GET /api/payment/subscription?apiId=<optional-api-id>
Authorization: Bearer <token> OR X-User-Id: <user_id>
```
**Purpose**: Get user's active subscription details
**Response**: Subscription information
**Use Case**: Check subscription status, plan details

### 4. Check Subscription Status
```http
GET /api/payment/check-subscription?apiId=<optional-api-id>
Authorization: Bearer <token> OR X-User-Id: <user_id>
```
**Purpose**: Quick check if user has active subscription
**Response**: Boolean subscription status
**Use Case**: API access control, subscription validation

## 🔑 Authentication Methods

### Method 1: Bearer Token
```http
Authorization: Bearer <jwt_token>
```

### Method 2: User ID Header
```http
X-User-Id: <user_id>
```

### Method 3: Alternative Headers (for compatibility)
```http
x-user-id: <user_id>
X-USER-ID: <user_id>
xauthuserid: <user_id>
XAuthUserId: <user_id>
```

## 🌍 CORS Configuration

**All endpoints support CORS** with the following configuration:
- **Origins**: All origins allowed (`*`)
- **Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Headers**: All headers including custom authentication headers
- **Credentials**: Supported
- **Preflight**: 24-hour cache for OPTIONS requests

## 📱 Browser Testing

### Test Public Endpoints in Browser

1. **Health Check**:
   ```
   https://backlify-v2.onrender.com/api/payment/health
   ```

2. **Payment Plans**:
   ```
   https://backlify-v2.onrender.com/api/payment/plans
   ```

3. **Payment Success**:
   ```
   https://backlify-v2.onrender.com/api/payment/success?order_id=test123
   ```

4. **Payment Cancel**:
   ```
   https://backlify-v2.onrender.com/api/payment/cancel?order_id=test123
   ```

### Expected Behavior
- ✅ **No authentication required**
- ✅ **JSON response displayed**
- ✅ **CORS headers present**
- ✅ **Accessible from any origin**

## 🧪 Testing Scripts

### Test Public Endpoints
```bash
npm run test-public
```

### Test All Payment Endpoints
```bash
npm run test-payment
```

### Setup Payment System
```bash
npm run setup-payment
```

## 📋 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "redirectUrl": "/pricing"
}
```

## 🚀 Quick Start Examples

### Frontend Integration (Public Endpoints)

```javascript
// Get payment plans (no auth required)
const plans = await fetch('https://backlify-v2.onrender.com/api/payment/plans')
  .then(r => r.json());

console.log('Available plans:', plans.data);
```

### Frontend Integration (Private Endpoints)

```javascript
// Create payment order (auth required)
const order = await fetch('https://backlify-v2.onrender.com/api/payment/order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': 'user123'
  },
  body: JSON.stringify({ planId: 'pro' })
}).then(r => r.json());

console.log('Payment URL:', order.data.paymentUrl);
```

## 🔧 Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Ensure CORS middleware is loaded first
   - Check that all origins are allowed
   - Verify preflight request handling

2. **Authentication Errors (401)**:
   - Check if endpoint requires authentication
   - Verify user ID or token is provided
   - Ensure proper header format

3. **404 Errors**:
   - Verify endpoint URL is correct
   - Check if server is running
   - Ensure routes are properly registered

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## 📞 Support

For technical support:
1. Check the logs for error details
2. Verify endpoint accessibility using test scripts
3. Test CORS configuration
4. Review authentication requirements

## 🔄 Updates

- **v1.0**: Initial implementation with public/private endpoint separation
- **v1.1**: Added health check endpoint
- **v1.2**: Enhanced CORS configuration
- **v1.3**: Added comprehensive testing scripts

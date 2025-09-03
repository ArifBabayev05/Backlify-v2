# Epoint Payment Gateway Integration

## Overview

This document describes the complete integration of the Epoint payment gateway into the Backlify backend system. The integration provides a comprehensive set of endpoints for handling various payment scenarios including standard payments, card management, pre-authorizations, and payment reversals.

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

## Core Components

### 1. EpointService (`src/services/epointService.js`)

The core service that handles all Epoint-specific operations:

- **Signature Generation**: Implements the required signature algorithm
- **Data Encoding/Decoding**: Base64 encoding for API requests
- **API Communication**: HTTP requests to Epoint endpoints
- **Request Preparation**: Prepares data for various payment operations

### 2. EpointController (`src/controllers/epointController.js`)

Handles HTTP requests and responses for all Epoint operations:

- **Request Validation**: Validates incoming request data
- **Business Logic**: Orchestrates payment operations
- **Database Updates**: Updates order statuses and payment information
- **Error Handling**: Comprehensive error handling and logging

### 3. Epoint Routes (`src/routes/epointRoutes.js`)

Defines all Epoint-related API endpoints with proper CORS and authentication handling.

## Environment Configuration

Add the following variables to your `.env` file:

```bash
# Epoint Payment Gateway Configuration
EPOINT_PUBLIC_KEY=7747
EPOINT_PRIVATE_KEY=7747
EPOINT_API_BASE_URL=https://epoint.az/api/1
EPOINT_API_URL=https://api.epoint.az
EPOINT_MERCHANT_ID=your_merchant_id_here
EPOINT_CALLBACK_URL=/api/epoint/callback
```

## API Endpoints

### 1. Standard Payment

#### Create Payment Request
```http
POST /api/epoint/create-payment
Content-Type: application/json

{
  "amount": 25.50,
  "order_id": "ORDER_123",
  "description": "Payment for services",
  "success_redirect_url": "https://yoursite.com/success",
  "error_redirect_url": "https://yoursite.com/error",
  "currency": "AZN",
  "language": "az"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": "base64_encoded_data",
    "signature": "generated_signature",
    "checkout_url": "https://epoint.az/api/1/checkout"
  },
  "message": "Payment request created successfully"
}
```

### 2. Payment Callback

#### Webhook Endpoint
```http
POST /api/epoint/callback
Content-Type: application/json

{
  "data": "base64_encoded_callback_data",
  "signature": "verification_signature"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Callback processed successfully"
}
```

### 3. Payment Status Check

#### Check Transaction Status
```http
POST /api/epoint/check-status
Content-Type: application/json

{
  "transaction_id": "TXN_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Epoint API response
  }
}
```

### 4. Card Management

#### Save Card
```http
POST /api/epoint/save-card
Content-Type: application/json

{
  "language": "az",
  "description": "Card registration",
  "success_redirect_url": "https://yoursite.com/card-success",
  "error_redirect_url": "https://yoursite.com/card-error"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redirect_url": "https://epoint.az/card-registration",
    "data": "base64_encoded_data",
    "signature": "generated_signature"
  },
  "message": "Card registration initiated"
}
```

#### Execute Saved Card Payment
```http
POST /api/epoint/execute-saved-card-payment
Content-Type: application/json

{
  "card_id": "CARD_123",
  "order_id": "ORDER_456",
  "amount": 15.99,
  "description": "Payment with saved card",
  "currency": "AZN",
  "language": "az"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Epoint API response
  },
  "message": "Payment executed successfully"
}
```

### 5. Payment Reversal

#### Reverse Payment
```http
POST /api/epoint/reverse-payment
Content-Type: application/json

{
  "transaction": "TXN_123",
  "currency": "AZN",
  "language": "az",
  "amount": 25.50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Epoint API response
  },
  "message": "Payment reversal initiated successfully"
}
```

### 6. Pre-Authorization

#### Create Pre-Authorization
```http
POST /api/epoint/pre-auth/create
Content-Type: application/json

{
  "amount": 50.00,
  "currency": "AZN",
  "language": "az",
  "order_id": "PREAUTH_789",
  "description": "Pre-authorization for services",
  "success_redirect_url": "https://yoursite.com/preauth-success",
  "error_redirect_url": "https://yoursite.com/preauth-error"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redirect_url": "https://epoint.az/pre-auth-request",
    "data": "base64_encoded_data",
    "signature": "generated_signature"
  },
  "message": "Pre-authorization created successfully"
}
```

#### Complete Pre-Authorization
```http
POST /api/epoint/pre-auth/complete
Content-Type: application/json

{
  "amount": 50.00,
  "transaction": "PREAUTH_TXN_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Epoint API response
  },
  "message": "Pre-authorization completed successfully"
}
```

## Signature Algorithm

The Epoint API requires a specific signature algorithm:

```javascript
// Algorithm: base64_encode(sha1(private_key + data + private_key, 1))
const signatureString = privateKey + data + privateKey;
const hash = crypto.createHash('sha1').update(signatureString).digest();
const signature = hash.toString('base64');
```

## Data Encoding

All API requests to Epoint require Base64 encoding:

```javascript
// Encode JSON object to Base64
const jsonString = JSON.stringify(paymentData);
const encodedData = Buffer.from(jsonString).toString('base64');

// Decode Base64 to JSON object
const jsonString = Buffer.from(encodedData, 'base64').toString();
const decodedData = JSON.parse(jsonString);
```

## Error Handling

### Common Error Codes

- `MISSING_REQUIRED_FIELDS`: Required parameters are missing
- `MISSING_IDENTIFIER`: Transaction ID or order ID is missing
- `PAYMENT_CREATION_FAILED`: Failed to create payment request
- `STATUS_CHECK_FAILED`: Failed to check payment status
- `CARD_REGISTRATION_FAILED`: Failed to initiate card registration
- `PAYMENT_EXECUTION_FAILED`: Failed to execute payment
- `PAYMENT_REVERSAL_FAILED`: Failed to reverse payment
- `PRE_AUTH_CREATION_FAILED`: Failed to create pre-authorization
- `PRE_AUTH_COMPLETION_FAILED`: Failed to complete pre-authorization

### Error Response Format

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

## Testing

### Run Integration Tests

```bash
# Test the complete Epoint integration
node src/tools/test-epoint-integration.js
```

### Test Individual Endpoints with cURL

#### 1. Standard Payment Creation

```bash
# Create a standard payment request
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "amount": 25.50,
    "order_id": "TEST_ORDER_123",
    "description": "Test payment for services",
    "success_redirect_url": "https://yoursite.com/success",
    "error_redirect_url": "https://yoursite.com/error",
    "currency": "AZN",
    "language": "az"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "data": "eyJwdWJsaWNfa2V5IjoiNzc0NyIsImFtb3VudCI6MjUuNSwiY3VycmVuY3kiOiJBWk4iLCJsYW5ndWFnZSI6ImF6Iiwib3JkZXJfaWQiOiJURVNUX09SREVSXzEyMyIsImRlc2NyaXB0aW9uIjoiVGVzdCBwYXltZW50IGZvciBzZXJ2aWNlcyIsInN1Y2Nlc3NfcmVkaXJlY3RfdXJsIjoiaHR0cHM6Ly95b3Vyc2l0ZS5jb20vc3VjY2VzcyIsImVycm9yX3JlZGlyZWN0X3VybCI6Imh0dHBzOi8veW91cnNpdGUuY29tL2Vycm9yIn0=",
    "signature": "generated_signature_here",
    "checkout_url": "https://epoint.az/api/1/checkout"
  },
  "message": "Payment request created successfully"
}
```

#### 2. Payment Status Check

```bash
# Check payment status by transaction ID
curl -X POST http://localhost:3000/api/epoint/check-status \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "transaction_id": "TXN_123456789"
  }'

# Check payment status by order ID
curl -X POST http://localhost:3000/api/epoint/check-status \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "order_id": "TEST_ORDER_123"
  }'
```

#### 3. Card Registration (Save Card)

```bash
# Initiate card saving process
curl -X POST http://localhost:3000/api/epoint/save-card \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "language": "az",
    "description": "Card registration for future payments",
    "success_redirect_url": "https://yoursite.com/card-success",
    "error_redirect_url": "https://yoursite.com/card-error"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "redirect_url": "https://epoint.az/card-registration",
    "data": "base64_encoded_data",
    "signature": "generated_signature"
  },
  "message": "Card registration initiated"
}
```

#### 4. Execute Payment with Saved Card

```bash
# Pay with a saved card
curl -X POST http://localhost:3000/api/epoint/execute-saved-card-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "card_id": "CARD_123456789",
    "order_id": "ORDER_456",
    "amount": 15.99,
    "description": "Payment with saved card",
    "currency": "AZN",
    "language": "az"
  }'
```

#### 5. Payment Reversal (Cancel Payment)

```bash
# Full payment reversal
curl -X POST http://localhost:3000/api/epoint/reverse-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "transaction": "TXN_123456789",
    "currency": "AZN",
    "language": "az"
  }'

# Partial payment reversal
curl -X POST http://localhost:3000/api/epoint/reverse-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "transaction": "TXN_123456789",
    "currency": "AZN",
    "language": "az",
    "amount": 10.00
  }'
```

#### 6. Pre-Authorization Creation

```bash
# Create pre-authorization request
curl -X POST http://localhost:3000/api/epoint/pre-auth/create \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "amount": 50.00,
    "currency": "AZN",
    "language": "az",
    "order_id": "PREAUTH_789",
    "description": "Pre-authorization for hotel booking",
    "success_redirect_url": "https://yoursite.com/preauth-success",
    "error_redirect_url": "https://yoursite.com/preauth-error"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "redirect_url": "https://epoint.az/pre-auth-request",
    "data": "base64_encoded_data",
    "signature": "generated_signature"
  },
  "message": "Pre-authorization created successfully"
}
```

#### 7. Complete Pre-Authorization

```bash
# Complete pre-authorization (capture funds)
curl -X POST http://localhost:3000/api/epoint/pre-auth/complete \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "amount": 50.00,
    "transaction": "PREAUTH_TXN_123456789"
  }'
```

#### 8. Payment Callback (Webhook) - Simulate Epoint Callback

```bash
# Simulate a successful payment callback from Epoint
curl -X POST http://localhost:3000/api/epoint/callback \
  -H "Content-Type: application/json" \
  -H "Origin: https://epoint.az" \
  -d '{
    "data": "eyJvcmRlcl9pZCI6IlRFU1RfT1JERVJfMTIzIiwic3RhdHVzIjoic3VjY2VzcyIsInRyYW5zYWN0aW9uIjoiVFhOXzEyMzQ1Njc4OSIsImJhbmtfdHJhbnNhY3Rpb24iOiJCQU5LX1RYTl8xMjM0NTY3ODkiLCJtZXNzYWdlIjoiUGF5bWVudCBzdWNjZXNzZnVsIn0=",
    "signature": "valid_signature_here"
  }'

# Simulate a failed payment callback from Epoint
curl -X POST http://localhost:3000/api/epoint/callback \
  -H "Content-Type: application/json" \
  -H "Origin: https://epoint.az" \
  -d '{
    "data": "eyJvcmRlcl9pZCI6IlRFU1RfT1JERVJfMTIzIiwic3RhdHVzIjoiZmFpbGVkIiwidHJhbnNhY3Rpb24iOiIiLCJiYW5rX3RyYW5zYWN0aW9uIjoiIiwibWVzc2FnZSI6IlBheW1lbnQgZmFpbGVkIn0=",
    "signature": "valid_signature_here"
  }'
```

### Test Error Scenarios

#### 1. Missing Required Fields

```bash
# Test missing amount
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "order_id": "TEST_ORDER_123",
    "description": "Test payment"
  }'

# Test missing order_id
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "amount": 25.50,
    "description": "Test payment"
  }'
```

#### 2. Invalid Signature in Callback

```bash
# Test with invalid signature
curl -X POST http://localhost:3000/api/epoint/callback \
  -H "Content-Type: application/json" \
  -H "Origin: https://epoint.az" \
  -d '{
    "data": "eyJvcmRlcl9pZCI6IlRFU1RfT1JERVJfMTIzIiwic3RhdHVzIjoic3VjY2VzcyJ9",
    "signature": "invalid_signature"
  }'
```

#### 3. Missing Transaction ID for Status Check

```bash
# Test status check without transaction_id or order_id
curl -X POST http://localhost:3000/api/epoint/check-status \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}'
```

### Test CORS Preflight Requests

```bash
# Test OPTIONS request for CORS preflight
curl -X OPTIONS http://localhost:3000/api/epoint/create-payment \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

# Test OPTIONS request for callback endpoint
curl -X OPTIONS http://localhost:3000/api/epoint/callback \
  -H "Origin: https://epoint.az" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

### Test with Different Origins

```bash
# Test from different origin (should work with CORS)
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -H "Origin: https://myfrontend.com" \
  -d '{
    "amount": 25.50,
    "order_id": "TEST_ORDER_123",
    "description": "Test payment from different origin"
  }'

# Test from localhost with different port
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d '{
    "amount": 25.50,
    "order_id": "TEST_ORDER_123",
    "description": "Test payment from localhost:8080"
  }'
```

### Performance Testing

```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/epoint/create-payment \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{
      \"amount\": 25.50,
      \"order_id\": \"TEST_ORDER_$i\",
      \"description\": \"Concurrent test payment $i\"
    }" &
done
wait
```

### Health Check

```bash
# Test server health
curl -X GET http://localhost:3000/health \
  -H "Origin: http://localhost:3000"
```

### Environment Variables Test

```bash
# Test with different environment variables
EPOINT_PUBLIC_KEY=7747 \
EPOINT_PRIVATE_KEY=7747 \
EPOINT_API_BASE_URL=https://epoint.az/api/1 \
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25.50,
    "order_id": "ENV_TEST_123",
    "description": "Environment test payment"
  }'
```

### Quick Test Scripts

#### Automated Test Scripts

```bash
# Run comprehensive test suite (Linux/Mac)
bash src/tools/test-epoint-curl.sh

# Run comprehensive test suite (Windows)
src\tools\test-epoint-curl.bat

# Run integration tests
node src/tools/test-epoint-integration.js
```

#### Most Common Test Commands

```bash
# 1. Test server health
curl -X GET http://localhost:3000/health

# 2. Create a payment request
curl -X POST http://localhost:3000/api/epoint/create-payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 25.50, "order_id": "TEST_123", "description": "Test payment"}'

# 3. Check payment status
curl -X POST http://localhost:3000/api/epoint/check-status \
  -H "Content-Type: application/json" \
  -d '{"transaction_id": "TXN_123"}'

# 4. Test CORS preflight
curl -X OPTIONS http://localhost:3000/api/epoint/create-payment \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"

# 5. Test callback with invalid signature (should return 400)
curl -X POST http://localhost:3000/api/epoint/callback \
  -H "Content-Type: application/json" \
  -d '{"data": "test", "signature": "invalid"}'
```

## Security Features

### 1. Signature Verification
- All incoming callbacks are verified using the signature algorithm
- Invalid signatures result in 400 Bad Request responses

### 2. Input Validation
- All request parameters are validated before processing
- Required fields are checked for presence and format

### 3. CORS Configuration
- All endpoints support CORS with proper headers
- Preflight requests are handled correctly

### 4. Rate Limiting
- API endpoints are protected by rate limiting middleware
- Prevents abuse and ensures system stability

## Database Integration

### Payment Orders Table
The system automatically updates the `payment_orders` table when processing callbacks:

```sql
-- Order status updates
UPDATE payment_orders 
SET 
  status = 'paid' | 'failed',
  payment_transaction_id = 'transaction_id',
  payment_details = 'json_payment_info',
  updated_at = NOW()
WHERE id = 'order_id';
```

### Callback Processing
All payment callbacks are processed and logged:

1. **Signature Validation**: Verify callback authenticity
2. **Data Decoding**: Extract payment information
3. **Database Update**: Update order status and details
4. **Response**: Acknowledge successful processing

## Monitoring and Logging

### Payment Logs
- All payment operations are logged with timestamps
- Callback processing is tracked and monitored
- Error scenarios are documented for debugging

### Transaction Tracking
- Order IDs are used to track payment status
- Transaction IDs are stored for reference
- Payment details are preserved in JSON format

## Integration with Existing System

### Legacy Support
The new Epoint integration maintains backward compatibility:

- Existing `/api/epoint-callback` endpoint still works
- Legacy signature verification methods are preserved
- Payment service integration is seamless

### Enhanced Features
New capabilities added:

- Card management (save and reuse)
- Pre-authorization flows
- Payment reversals
- Enhanced status checking

## Troubleshooting

### Common Issues

#### 1. Signature Validation Failures
- Verify `EPOINT_PRIVATE_KEY` is correct
- Check that data encoding matches Epoint requirements
- Ensure signature algorithm implementation is correct

#### 2. CORS Errors
- Verify CORS middleware is loaded first
- Check that all origins are allowed
- Ensure preflight request handling is correct

#### 3. Database Connection Issues
- Verify Supabase connection parameters
- Check table permissions and structure
- Ensure proper indexes exist

#### 4. API Communication Failures
- Verify `EPOINT_API_BASE_URL` is correct
- Check network connectivity to Epoint
- Monitor API response codes and errors

### Debug Mode

Enable detailed logging by setting:

```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## Best Practices

### 1. Error Handling
- Always validate signatures before processing
- Implement comprehensive error logging
- Provide meaningful error messages to clients

### 2. Security
- Never expose private keys in client-side code
- Validate all incoming data
- Implement proper rate limiting

### 3. Monitoring
- Log all payment operations
- Monitor callback processing
- Track failed transactions

### 4. Testing
- Test all endpoints before production
- Verify signature generation and validation
- Test error scenarios and edge cases

## Support and Maintenance

### Regular Tasks
- Monitor payment callback processing
- Review error logs and failed transactions
- Update Epoint API integration as needed

### Updates and Upgrades
- Keep Epoint API integration current
- Monitor for security updates
- Test new features in staging environment

## Conclusion

The Epoint payment gateway integration provides a robust, secure, and feature-rich payment solution for the Backlify platform. With comprehensive error handling, security features, and monitoring capabilities, it ensures reliable payment processing while maintaining backward compatibility with existing systems.

For additional support or questions about the integration, refer to the Epoint API documentation or contact the development team.

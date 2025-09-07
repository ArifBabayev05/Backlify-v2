const { createClient } = require('@supabase/supabase-js');
const EpointService = require('./epointService');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testCallbackSignature() {
  console.log('🧪 Testing callback signature validation...');
  
  try {
    const epointService = new EpointService();
    
    // Create test callback data
    const testPaymentData = {
      order_id: 'TEST_ORDER_123',
      status: 'success',
      transaction: 'TEST_TRANSACTION_123',
      amount: 0.01,
      currency: 'AZN',
      message: 'Test payment'
    };
    
    console.log('📤 Test payment data:', testPaymentData);
    
    // Encode the data
    const encodedData = epointService.encodeData(testPaymentData);
    console.log('📤 Encoded data:', encodedData);
    
    // Generate signature
    const signature = epointService.generateSignature(encodedData);
    console.log('📤 Generated signature:', signature);
    
    // Test signature validation
    const isValid = epointService.validateSignature(encodedData, signature);
    console.log('✅ Signature validation result:', isValid);
    
    if (!isValid) {
      console.error('❌ Signature validation failed!');
      return false;
    }
    
    // Test with PaymentService
    console.log('\n🔄 Testing with PaymentService...');
    const PaymentService = require('./paymentService');
    const paymentService = new PaymentService();
    
    const callbackData = {
      data: encodedData,
      signature: signature
    };
    
    console.log('📤 Callback data:', callbackData);
    
    // Test the processEpointCallback method
    try {
      const result = await paymentService.processEpointCallback(callbackData);
      console.log('✅ PaymentService callback processing result:', result);
    } catch (error) {
      console.error('❌ PaymentService callback processing failed:', error.message);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testCallbackSignature()
    .then((success) => {
      if (success) {
        console.log('\n✅ Callback signature test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Callback signature test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCallbackSignature };

const { createClient } = require('@supabase/supabase-js');
const PaymentService = require('../src/services/paymentService');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testCompleteCallbackFix() {
  console.log('🧪 Testing complete callback flow fix...');
  
  try {
    const paymentService = new PaymentService();
    
    // Test with the actual callback data from the logs
    const callbackData = {
      data: 'eyJvcmRlcl9pZCI6IlNVQl8xNzU3Mjc5MDkzMTE1X2FzZGFfMTc1NzI3OTA5OTkxN19lMmgzOWZhOXUiLCJzdGF0dXMiOiJzdWNjZXNzIiwiY29kZSI6IjAwMCIsIm1lc3NhZ2UiOiJUXHUwMjU5c2RpcSBlZGlsZGkiLCJ0cmFuc2FjdGlvbiI6InRlMDA5MTIwMjc2IiwiYmFua190cmFuc2FjdGlvbiI6IlJ6UGZ5ZnVsUm9aUWxhMHB5bWNqTzMyNW5NYz0iLCJiYW5rX3Jlc3BvbnNlIjoiUkVTVUxUOiBPS1xuUkVTVUxUX0NPREU6IDAwMFxuM0RTRUNVUkU6IEFVVEhFTlRJQ0FURURcblJSTjogNTI1MTAxMTU4NTE1XG5BUFBST1ZBTF9DT0RFOiA4MTUzOTJcbkNBUkRfTlVNQkVSOiA0MDk4NTgqKioqKio1ODg2XG5DQVJETkFNRTogQXJpZiBCYWJheWV2IiwiY2FyZF9uYW1lIjoiQXJpZiBCYWJheWV2IiwiY2FyZF9tYXNrIjoiNDA5ODU4KioqKioqNTg4NiIsImNhcmRfZXhwaXJ5X2RhdGUiOm51bGwsIm9wZXJhdGlvbl9jb2RlIjoiMTAwIiwicnJuIjoiNTI1MTAxMTU4NTE1IiwiYW1vdW50IjowLjAxLCJvdGhlcl9hdHRyIjpudWxsfQ==',
      signature: 'VPWv3VEKorW9X7OECosYcT7T0cg='
    };
    
    console.log('📤 Testing callback data:', {
      hasData: !!callbackData.data,
      hasSignature: !!callbackData.signature
    });
    
    // Decode the data to see what we're working with
    const decodedData = Buffer.from(callbackData.data, 'base64').toString();
    const paymentInfo = JSON.parse(decodedData);
    
    console.log('📋 Decoded payment info:', {
      order_id: paymentInfo.order_id,
      status: paymentInfo.status,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency
    });
    
    // Test the complete callback processing
    console.log('\n🔄 Testing complete callback processing...');
    const result = await paymentService.processEpointCallback(callbackData);
    
    console.log('✅ Callback processing result:', result);
    
    // Check if the user's subscription was updated
    console.log('\n🔍 Checking user subscription...');
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', 'c8dc07c2-971f-443d-a120-4726de396e56') // asda's UUID
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (subError) {
      console.error('❌ Error fetching subscription:', subError);
      return false;
    }
    
    console.log('✅ User subscription:', {
      plan_id: subscription.plan_id,
      status: subscription.status,
      expiration_date: subscription.expiration_date
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testCompleteCallbackFix()
    .then((success) => {
      if (success) {
        console.log('\n✅ Complete callback fix test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Complete callback fix test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteCallbackFix };

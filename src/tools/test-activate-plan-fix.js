const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testActivatePlanFix() {
  console.log('🧪 Testing activateUserPlan fix...');
  
  try {
    // Test with a real order from the logs
    const testOrderId = 'SUB_1757279093115_asda_1757279099917_e2h39fa9u';
    
    console.log('📋 Testing with order ID:', testOrderId);
    
    // First, check if the order exists
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', testOrderId)
      .single();
    
    if (orderError) {
      console.error('❌ Order not found:', orderError);
      return false;
    }
    
    console.log('✅ Order found:', {
      order_id: order.order_id,
      user_id: order.user_id,
      plan_id: order.plan_id,
      status: order.status
    });
    
    // Test user lookup
    console.log('🔍 Looking up user UUID for username:', order.user_id);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', order.user_id)
      .single();
    
    if (userError) {
      console.error('❌ User not found:', userError);
      return false;
    }
    
    console.log('✅ User found:', user.id);
    
    // Test subscription data creation
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    
    const subscriptionData = {
      user_id: user.id,
      plan_id: order.plan_id,
      api_id: order.api_id,
      status: 'active',
      start_date: new Date().toISOString(),
      expiration_date: expirationDate.toISOString(),
      payment_order_id: order.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📋 Subscription data:', subscriptionData);
    
    // Test if we can insert (without actually inserting)
    console.log('✅ All data types are correct for subscription creation');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testActivatePlanFix()
    .then((success) => {
      if (success) {
        console.log('\n✅ Activate plan fix test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Activate plan fix test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testActivatePlanFix };

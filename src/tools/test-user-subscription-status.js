const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testUserSubscriptionStatus() {
  console.log('🧪 Testing user subscription status...');
  
  try {
    const username = 'asda';
    
    // Step 1: Get user UUID
    console.log('🔍 Step 1: Getting user UUID for username:', username);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, plan_id')
      .eq('username', username)
      .single();
    
    if (userError) {
      console.error('❌ User not found:', userError);
      return false;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      username: user.username,
      plan_id: user.plan_id
    });
    
    // Step 2: Check user_subscriptions table
    console.log('\n🔍 Step 2: Checking user_subscriptions table...');
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
      return false;
    }
    
    console.log(`✅ Found ${subscriptions.length} subscriptions:`, subscriptions.map(sub => ({
      id: sub.id,
      plan_id: sub.plan_id,
      status: sub.status,
      start_date: sub.start_date,
      expiration_date: sub.expiration_date,
      payment_order_id: sub.payment_order_id
    })));
    
    // Step 3: Check payment_orders table
    console.log('\n🔍 Step 3: Checking payment_orders table...');
    const { data: orders, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('user_id', username)
      .order('created_at', { ascending: false });
    
    if (orderError) {
      console.error('❌ Error fetching orders:', orderError);
      return false;
    }
    
    console.log(`✅ Found ${orders.length} payment orders:`, orders.map(order => ({
      id: order.id,
      order_id: order.order_id,
      user_id: order.user_id,
      plan_id: order.plan_id,
      status: order.status,
      amount: order.amount
    })));
    
    // Step 4: Test getUserPlan logic
    console.log('\n🔍 Step 4: Testing getUserPlan logic...');
    
    // Simulate the getUserPlan method
    const { data: activeSubscription, error: activeSubError } = await supabase
      .from('user_subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();
    
    if (!activeSubError && activeSubscription) {
      console.log('✅ Active subscription found:', activeSubscription.plan_id);
    } else {
      console.log('❌ No active subscription found, falling back to user.plan_id:', user.plan_id);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testUserSubscriptionStatus()
    .then((success) => {
      if (success) {
        console.log('\n✅ User subscription status test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ User subscription status test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testUserSubscriptionStatus };

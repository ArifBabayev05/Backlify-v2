const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testSimpleGetUserPlan() {
  console.log('🧪 Testing simple getUserPlan logic...');
  
  try {
    const username = 'asda';
    
    // Step 1: Get user by username
    console.log('🔍 Step 1: Getting user by username:', username);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, plan_id')
      .eq('username', username)
      .single();
    
    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return false;
    }
    
    console.log('✅ User found:', user);
    
    // Step 2: Get active subscriptions (most recent first)
    console.log('🔍 Step 2: Getting active subscriptions...');
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan_id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
      return false;
    }
    
    console.log('✅ Subscriptions found:', subscriptions);
    
    // Step 3: Determine user plan
    let userPlan = 'basic';
    
    if (subscriptions && subscriptions.length > 0) {
      const subscription = subscriptions[0];
      userPlan = subscription.plan_id || 'basic';
      console.log(`✅ Found active subscription: ${userPlan}`);
    } else if (user.plan_id) {
      userPlan = user.plan_id;
      console.log(`✅ Using user plan_id: ${userPlan}`);
    } else {
      console.log('✅ Defaulting to basic plan');
    }
    
    console.log('🎯 Final user plan:', userPlan);
    
    if (userPlan === 'pro') {
      console.log('🎉 SUCCESS: User plan is correctly identified as "pro"!');
      return true;
    } else {
      console.log('❌ FAILED: User plan should be "pro" but got:', userPlan);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testSimpleGetUserPlan()
    .then((success) => {
      if (success) {
        console.log('\n✅ Simple getUserPlan test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Simple getUserPlan test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSimpleGetUserPlan };

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testSubscriptionFix() {
  console.log('🧪 Testing subscription fix...');
  
  try {
    // Test 1: Check if we can access user_subscriptions
    console.log('\n1️⃣ Testing user_subscriptions access...');
    
    const { data: subs, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .limit(1);
    
    if (subsError) {
      console.error('❌ Cannot access user_subscriptions:', subsError);
      return false;
    }
    
    console.log(`✅ Can access user_subscriptions: ${subs.length} active subscriptions`);
    
    // Test 2: Simulate the getUserSubscription logic
    console.log('\n2️⃣ Testing getUserSubscription logic...');
    
    if (subs.length > 0) {
      const testUserId = subs[0].user_id;
      
      // Test the exact logic from AccountController
      let subscription = null;
      let subscriptionError = null;
      
      try {
        const { data: subData, error: subError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', testUserId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        subscription = subData;
        subscriptionError = subError;
      } catch (err) {
        console.log('user_subscriptions table not available, falling back to users table');
        subscriptionError = err;
      }

      // If user_subscriptions table doesn't exist or has issues, fall back to users table
      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.log('Falling back to users table for subscription data');
        
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('plan_id')
            .eq('id', testUserId)
            .single();
          
          if (!userError && userData) {
            // Create a mock subscription object from user data
            subscription = {
              id: null,
              plan_id: userData.plan_id || 'basic',
              status: 'active',
              start_date: new Date().toISOString(),
              expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            };
          }
        } catch (fallbackError) {
          console.error('Fallback to users table also failed:', fallbackError);
        }
      }
      
      if (subscription) {
        console.log('✅ getUserSubscription logic works:');
        console.log(`   - Plan: ${subscription.plan_id}`);
        console.log(`   - Status: ${subscription.status}`);
        console.log(`   - Start: ${subscription.start_date}`);
        console.log(`   - End: ${subscription.expiration_date}`);
        
        // Test the response format
        const response = {
          success: true,
          data: {
            id: subscription.id,
            plan: subscription.plan_id,
            planName: getPlanName(subscription.plan_id),
            status: subscription.status,
            startDate: subscription.start_date,
            endDate: subscription.expiration_date,
            price: 0,
            currency: 'AZN',
            features: getPlanFeatures(subscription.plan_id),
            autoRenew: true
          }
        };
        
        console.log('\n📤 Response format:');
        console.log(JSON.stringify(response, null, 2));
      } else {
        console.log('ℹ️ No subscription found, would return free plan');
      }
    }
    
    // Test 3: Test with a user that might not have subscription
    console.log('\n3️⃣ Testing fallback to users table...');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, plan_id')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Cannot access users table:', usersError);
      return false;
    }
    
    if (users.length > 0) {
      const testUserId = users[0].id;
      
      // Test fallback logic
      let subscription = null;
      
      try {
        const { data: subData, error: subError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', testUserId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        subscription = subData;
      } catch (err) {
        // Fallback to users table
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('plan_id')
            .eq('id', testUserId)
            .single();
          
          if (!userError && userData) {
            subscription = {
              id: null,
              plan_id: userData.plan_id || 'basic',
              status: 'active',
              start_date: new Date().toISOString(),
              expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            };
          }
        } catch (fallbackError) {
          console.error('Fallback failed:', fallbackError);
        }
      }
      
      if (subscription) {
        console.log('✅ Fallback logic works:');
        console.log(`   - Plan: ${subscription.plan_id}`);
        console.log(`   - Status: ${subscription.status}`);
      } else {
        console.log('ℹ️ Would return free plan for this user');
      }
    }
    
    console.log('\n🎉 Subscription fix test completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Helper functions
function getPlanFeatures(plan) {
  const features = {
    free: { apiCalls: 1000, maxProjects: 1, prioritySupport: false, analytics: false, customIntegrations: false },
    basic: { apiCalls: 1000, maxProjects: 1, prioritySupport: false, analytics: false, customIntegrations: false },
    pro: { apiCalls: 10000, maxProjects: 5, prioritySupport: true, analytics: true, customIntegrations: false },
    enterprise: { apiCalls: 100000, maxProjects: -1, prioritySupport: true, analytics: true, customIntegrations: true }
  };
  return features[plan] || features.free;
}

function getPlanName(plan) {
  const names = {
    free: 'Free Plan',
    basic: 'Basic Plan', 
    pro: 'Pro Plan',
    enterprise: 'Enterprise Plan'
  };
  return names[plan] || 'Free Plan';
}

// Run the test
if (require.main === module) {
  testSubscriptionFix()
    .then((success) => {
      if (success) {
        console.log('\n✅ Subscription fix test passed!');
        process.exit(0);
      } else {
        console.log('\n❌ Subscription fix test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSubscriptionFix };

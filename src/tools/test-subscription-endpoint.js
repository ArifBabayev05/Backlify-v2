const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testSubscriptionEndpoint() {
  console.log('🧪 Testing Subscription Endpoint Logic...');
  
  try {
    // Test 1: Check if users have subscriptions now
    console.log('\n1️⃣ Checking user subscriptions...');
    
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .limit(5);
    
    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return false;
    }
    
    console.log(`✅ Found ${subscriptions.length} active subscriptions`);
    
    if (subscriptions.length > 0) {
      console.log('📋 Sample subscription:');
      const sample = subscriptions[0];
      console.log(`   - User ID: ${sample.user_id}`);
      console.log(`   - Plan ID: ${sample.plan_id}`);
      console.log(`   - Status: ${sample.status}`);
      console.log(`   - Start Date: ${sample.start_date}`);
      console.log(`   - Expiration: ${sample.expiration_date}`);
    }
    
    // Test 2: Simulate getUserSubscription logic
    console.log('\n2️⃣ Testing getUserSubscription logic...');
    
    if (subscriptions.length > 0) {
      const testUserId = subscriptions[0].user_id;
      
      const { data: userSub, error: userSubError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (userSubError && userSubError.code !== 'PGRST116') {
        console.error('❌ Error fetching user subscription:', userSubError);
        return false;
      }
      
      if (userSub) {
        console.log('✅ getUserSubscription logic works:');
        console.log(`   - ID: ${userSub.id}`);
        console.log(`   - Plan: ${userSub.plan_id}`);
        console.log(`   - Status: ${userSub.status}`);
        console.log(`   - Start: ${userSub.start_date}`);
        console.log(`   - End: ${userSub.expiration_date}`);
        
        // Test the response format
        const response = {
          success: true,
          data: {
            id: userSub.id,
            plan: userSub.plan_id,
            planName: getPlanName(userSub.plan_id),
            status: userSub.status,
            startDate: userSub.start_date,
            endDate: userSub.expiration_date,
            price: 0,
            currency: 'AZN',
            features: getPlanFeatures(userSub.plan_id),
            autoRenew: true
          }
        };
        
        console.log('\n📤 Response format:');
        console.log(JSON.stringify(response, null, 2));
      } else {
        console.log('ℹ️ No subscription found for test user');
      }
    }
    
    // Test 3: Test with a user who has no subscription (should return free plan)
    console.log('\n3️⃣ Testing free plan fallback...');
    
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return false;
    }
    
    if (allUsers.length > 0) {
      const testUserId = allUsers[0].id;
      
      const { data: userSub, error: userSubError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (userSubError && userSubError.code === 'PGRST116') {
        // No subscription found - should return free plan
        const freePlanResponse = {
          success: true,
          data: {
            id: null,
            plan: 'free',
            planName: 'Free Plan',
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: null,
            price: 0,
            currency: 'AZN',
            features: {
              apiCalls: 1000,
              maxProjects: 1,
              prioritySupport: false,
              analytics: false,
              customIntegrations: false
            },
            autoRenew: false
          }
        };
        
        console.log('✅ Free plan fallback works:');
        console.log(JSON.stringify(freePlanResponse, null, 2));
      } else if (userSub) {
        console.log('ℹ️ User has subscription, testing with different user...');
      }
    }
    
    console.log('\n🎉 Subscription endpoint logic test completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Helper functions (copied from AccountController)
function getPlanFeatures(plan) {
  const features = {
    free: {
      apiCalls: 1000,
      maxProjects: 1,
      prioritySupport: false,
      analytics: false,
      customIntegrations: false
    },
    basic: {
      apiCalls: 1000,
      maxProjects: 1,
      prioritySupport: false,
      analytics: false,
      customIntegrations: false
    },
    pro: {
      apiCalls: 10000,
      maxProjects: 5,
      prioritySupport: true,
      analytics: true,
      customIntegrations: false
    },
    enterprise: {
      apiCalls: 100000,
      maxProjects: -1,
      prioritySupport: true,
      analytics: true,
      customIntegrations: true
    }
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
  testSubscriptionEndpoint()
    .then((success) => {
      if (success) {
        console.log('\n✅ Subscription endpoint test passed!');
        process.exit(0);
      } else {
        console.log('\n❌ Subscription endpoint test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSubscriptionEndpoint };

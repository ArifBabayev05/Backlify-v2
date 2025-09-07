const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testSubscriptionFinal() {
  console.log('🧪 Testing Final Subscription Logic...');
  
  try {
    // Get user UUID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'asda')
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return false;
    }

    const actualUserId = user.id;
    console.log(`📋 User UUID: ${actualUserId}`);

    // Test the getUserSubscription logic
    const { data: userSub, error: userSubError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', actualUserId)
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
      console.log('ℹ️ No active subscription found');
    }
    
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
    basic: { apiCalls: 1000, maxProjects: 2, prioritySupport: false, analytics: false, customIntegrations: false },
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
  testSubscriptionFinal()
    .then((success) => {
      if (success) {
        console.log('\n✅ Final subscription test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Final subscription test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSubscriptionFinal };

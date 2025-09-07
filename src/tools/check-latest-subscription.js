const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkLatestSubscription() {
  console.log('🔍 Checking latest subscription for user "asda"...');
  
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

    // Get all subscriptions for this user
    const { data: allSubscriptions, error: allError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', actualUserId)
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching subscriptions:', allError);
      return false;
    }

    console.log(`📊 Found ${allSubscriptions.length} total subscriptions:`);
    allSubscriptions.forEach((sub, index) => {
      console.log(`   ${index + 1}. ID: ${sub.id}, Plan: ${sub.plan_id}, Status: ${sub.status}, Created: ${sub.created_at}`);
    });

    // Get the latest active subscription
    const { data: latestSubscription, error: latestError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', actualUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestError) {
      console.error('❌ Error fetching latest subscription:', latestError);
      return false;
    }

    console.log('\n🎯 Latest active subscription:');
    console.log(`   - ID: ${latestSubscription.id}`);
    console.log(`   - Plan: ${latestSubscription.plan_id}`);
    console.log(`   - Status: ${latestSubscription.status}`);
    console.log(`   - Start: ${latestSubscription.start_date}`);
    console.log(`   - End: ${latestSubscription.expiration_date}`);
    console.log(`   - Created: ${latestSubscription.created_at}`);

    return true;

  } catch (error) {
    console.error('❌ Check failed:', error);
    return false;
  }
}

// Run the check
if (require.main === module) {
  checkLatestSubscription()
    .then((success) => {
      if (success) {
        console.log('\n✅ Latest subscription check completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Latest subscription check failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Check execution failed:', error);
      process.exit(1);
    });
}

module.exports = { checkLatestSubscription };

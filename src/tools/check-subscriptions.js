const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkSubscriptions() {
  console.log('🔍 Checking subscription data...');
  
  try {
    // Check with RLS disabled
    console.log('\n1️⃣ Disabling RLS to check data...');
    
    await supabase.rpc('execute_sql', {
      sql_query: 'ALTER TABLE user_subscriptions DISABLE ROW LEVEL SECURITY;'
    });
    
    console.log('✅ RLS disabled');
    
    // Check all subscriptions
    console.log('\n2️⃣ Checking all subscriptions...');
    
    const { data: allSubs, error: allError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Error fetching all subscriptions:', allError);
      return false;
    }
    
    console.log(`📊 Total subscriptions in table: ${allSubs.length}`);
    
    if (allSubs.length > 0) {
      console.log('\n📋 Sample subscriptions:');
      allSubs.slice(0, 3).forEach((sub, index) => {
        console.log(`   ${index + 1}. User: ${sub.user_id}, Plan: ${sub.plan_id}, Status: ${sub.status}`);
      });
      
      // Count by status
      const statusCount = {};
      allSubs.forEach(sub => {
        statusCount[sub.status] = (statusCount[sub.status] || 0) + 1;
      });
      
      console.log('\n📊 Status distribution:');
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
      
      // Count by plan
      const planCount = {};
      allSubs.forEach(sub => {
        planCount[sub.plan_id] = (planCount[sub.plan_id] || 0) + 1;
      });
      
      console.log('\n📊 Plan distribution:');
      Object.entries(planCount).forEach(([plan, count]) => {
        console.log(`   - ${plan}: ${count}`);
      });
    }
    
    // Check active subscriptions specifically
    console.log('\n3️⃣ Checking active subscriptions...');
    
    const { data: activeSubs, error: activeError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active');
    
    if (activeError) {
      console.error('❌ Error fetching active subscriptions:', activeError);
      return false;
    }
    
    console.log(`📊 Active subscriptions: ${activeSubs.length}`);
    
    // Re-enable RLS
    console.log('\n4️⃣ Re-enabling RLS...');
    
    await supabase.rpc('execute_sql', {
      sql_query: 'ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;'
    });
    
    console.log('✅ RLS re-enabled');
    
    // Test with RLS enabled
    console.log('\n5️⃣ Testing with RLS enabled...');
    
    const { data: rlsSubs, error: rlsError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active');
    
    if (rlsError) {
      console.error('❌ Error with RLS enabled:', rlsError);
    } else {
      console.log(`📊 Active subscriptions with RLS: ${rlsSubs.length}`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    return false;
  }
}

// Run the check
if (require.main === module) {
  checkSubscriptions()
    .then((success) => {
      if (success) {
        console.log('\n✅ Subscription check completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Subscription check failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Check execution failed:', error);
      process.exit(1);
    });
}

module.exports = { checkSubscriptions };

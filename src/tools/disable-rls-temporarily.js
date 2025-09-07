const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function disableRLSTemporarily() {
  console.log('🔧 Temporarily disabling RLS for subscription tables...');
  
  try {
    const tables = ['user_subscriptions', 'payment_orders', 'subscriptions', 'payment_transactions'];
    
    for (const table of tables) {
      console.log(`\n📋 Disabling RLS for ${table}...`);
      
      const { error } = await supabase.rpc('execute_sql', {
        sql_query: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
      });
      
      if (error) {
        console.error(`❌ Error disabling RLS for ${table}:`, error);
        return false;
      }
      
      console.log(`✅ RLS disabled for ${table}`);
    }
    
    // Test access
    console.log('\n🧪 Testing access...');
    
    const { data: subs, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .limit(5);
    
    if (subsError) {
      console.error('❌ Error accessing subscriptions:', subsError);
      return false;
    }
    
    console.log(`✅ Can access ${subs.length} subscriptions`);
    
    const { data: orders, error: ordersError } = await supabase
      .from('payment_orders')
      .select('*')
      .limit(5);
    
    if (ordersError) {
      console.error('❌ Error accessing payment orders:', ordersError);
      return false;
    }
    
    console.log(`✅ Can access ${orders.length} payment orders`);
    
    console.log('\n🎉 RLS disabled successfully!');
    console.log('⚠️  Note: RLS is now disabled. Remember to re-enable it later for security.');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to disable RLS:', error);
    return false;
  }
}

// Run the script
if (require.main === module) {
  disableRLSTemporarily()
    .then((success) => {
      if (success) {
        console.log('\n✅ RLS disabled successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Failed to disable RLS!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { disableRLSTemporarily };

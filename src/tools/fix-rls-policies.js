const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for service role access...');
  
  try {
    // Drop existing policies
    console.log('\n1️⃣ Dropping existing policies...');
    
    const policies = [
      'Users can view their own subscriptions',
      'Users can insert their own subscriptions', 
      'Users can update their own subscriptions',
      'Users can view their own payment orders',
      'Users can insert their own payment orders',
      'Users can update their own payment orders',
      'Users can view their own legacy subscriptions',
      'Users can insert their own legacy subscriptions',
      'Users can update their own legacy subscriptions',
      'Users can view their own payment transactions'
    ];
    
    for (const policyName of policies) {
      try {
        await supabase.rpc('execute_sql', {
          sql_query: `DROP POLICY IF EXISTS "${policyName}" ON user_subscriptions;`
        });
        await supabase.rpc('execute_sql', {
          sql_query: `DROP POLICY IF EXISTS "${policyName}" ON payment_orders;`
        });
        await supabase.rpc('execute_sql', {
          sql_query: `DROP POLICY IF EXISTS "${policyName}" ON subscriptions;`
        });
        await supabase.rpc('execute_sql', {
          sql_query: `DROP POLICY IF EXISTS "${policyName}" ON payment_transactions;`
        });
      } catch (error) {
        // Ignore errors for policies that don't exist
      }
    }
    
    console.log('✅ Existing policies dropped');
    
    // Create new policies that allow service role access
    console.log('\n2️⃣ Creating new RLS policies...');
    
    const newPolicies = [
      // User subscriptions policies
      `CREATE POLICY "Allow service role and user access to subscriptions" ON user_subscriptions
        FOR ALL USING (
          auth.role() = 'service_role' OR 
          auth.uid() = user_id
        );`,
      
      // Payment orders policies  
      `CREATE POLICY "Allow service role and user access to payment orders" ON payment_orders
        FOR ALL USING (
          auth.role() = 'service_role' OR 
          auth.uid() = user_id
        );`,
      
      // Legacy subscriptions policies
      `CREATE POLICY "Allow service role and user access to legacy subscriptions" ON subscriptions
        FOR ALL USING (
          auth.role() = 'service_role' OR 
          auth.uid() = user_id
        );`,
      
      // Payment transactions policies
      `CREATE POLICY "Allow service role and user access to payment transactions" ON payment_transactions
        FOR ALL USING (
          auth.role() = 'service_role' OR 
          EXISTS (
            SELECT 1 FROM payment_orders 
            WHERE payment_orders.id = payment_transactions.order_id 
            AND (auth.uid() = payment_orders.user_id OR auth.role() = 'service_role')
          )
        );`
    ];
    
    for (const policy of newPolicies) {
      const { error } = await supabase.rpc('execute_sql', {
        sql_query: policy
      });
      
      if (error) {
        console.error('❌ Error creating policy:', error);
        return false;
      }
    }
    
    console.log('✅ New RLS policies created');
    
    // Test the policies
    console.log('\n3️⃣ Testing new policies...');
    
    // Test with service role (should work)
    const { data: serviceRoleSubs, error: serviceError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .limit(5);
    
    if (serviceError) {
      console.error('❌ Service role access failed:', serviceError);
      return false;
    }
    
    console.log(`✅ Service role can access ${serviceRoleSubs.length} subscriptions`);
    
    // Test with a specific user (simulate user context)
    if (serviceRoleSubs.length > 0) {
      const testUserId = serviceRoleSubs[0].user_id;
      
      // Create a client with user context
      const userSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY}`
            }
          }
        }
      );
      
      // This might fail due to auth context, but let's try
      const { data: userSubs, error: userError } = await userSupabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('status', 'active');
      
      if (userError) {
        console.log('ℹ️ User context test failed (expected with anon key):', userError.message);
      } else {
        console.log(`✅ User context can access ${userSubs.length} subscriptions`);
      }
    }
    
    console.log('\n🎉 RLS policies fixed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    return false;
  }
}

// Run the fix
if (require.main === module) {
  fixRLSPolicies()
    .then((success) => {
      if (success) {
        console.log('\n✅ RLS policies fixed!');
        process.exit(0);
      } else {
        console.log('\n❌ RLS policies fix failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Fix execution failed:', error);
      process.exit(1);
    });
}

module.exports = { fixRLSPolicies };

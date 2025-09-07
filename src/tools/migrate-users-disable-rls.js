const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function migrateUsersDisableRLS() {
  console.log('🔄 Migrating users by temporarily disabling RLS...');
  
  try {
    // Step 1: Temporarily disable RLS
    console.log('\n1️⃣ Temporarily disabling RLS...');
    
    const { error: disableError } = await supabase
      .rpc('execute_sql', {
        sql_query: 'ALTER TABLE user_subscriptions DISABLE ROW LEVEL SECURITY;'
      });
    
    if (disableError) {
      console.error('❌ Error disabling RLS:', disableError);
      return false;
    }
    
    console.log('✅ RLS disabled for user_subscriptions');
    
    // Step 2: Get all users
    console.log('\n2️⃣ Fetching all users...');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at, plan_id')
      .order('created_at', { ascending: true });
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return false;
    }
    
    console.log(`✅ Found ${users.length} users`);
    
    // Step 3: Check existing subscriptions
    console.log('\n3️⃣ Checking existing subscriptions...');
    
    const { data: existingSubs, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('status', 'active');
    
    if (subsError) {
      console.error('❌ Error checking subscriptions:', subsError);
      return false;
    }
    
    const existingUserIds = new Set(existingSubs.map(sub => sub.user_id));
    console.log(`✅ Found ${existingUserIds.size} existing subscriptions`);
    
    // Step 4: Create subscriptions for users without them
    const usersToMigrate = users.filter(user => !existingUserIds.has(user.id));
    console.log(`📝 ${usersToMigrate.length} users need migration`);
    
    if (usersToMigrate.length === 0) {
      console.log('✅ All users already have subscriptions');
      // Re-enable RLS
      await supabase.rpc('execute_sql', {
        sql_query: 'ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;'
      });
      return true;
    }
    
    // Step 5: Insert subscriptions
    console.log('\n4️⃣ Creating subscriptions...');
    
    const subscriptions = usersToMigrate.map(user => {
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      
      return {
        user_id: user.id,
        plan_id: user.plan_id || 'basic',
        status: 'active',
        start_date: user.created_at || new Date().toISOString(),
        expiration_date: expirationDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    
    const { data: insertedSubs, error: insertError } = await supabase
      .from('user_subscriptions')
      .insert(subscriptions)
      .select('id, user_id, plan_id');
    
    if (insertError) {
      console.error('❌ Error inserting subscriptions:', insertError);
      return false;
    }
    
    console.log(`✅ Created ${insertedSubs.length} subscriptions`);
    
    // Step 6: Re-enable RLS
    console.log('\n5️⃣ Re-enabling RLS...');
    
    const { error: enableError } = await supabase
      .rpc('execute_sql', {
        sql_query: 'ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;'
      });
    
    if (enableError) {
      console.error('❌ Error re-enabling RLS:', enableError);
      return false;
    }
    
    console.log('✅ RLS re-enabled for user_subscriptions');
    
    // Step 7: Verify migration
    console.log('\n6️⃣ Verifying migration...');
    
    const { data: finalSubs, error: verifyError } = await supabase
      .from('user_subscriptions')
      .select('plan_id')
      .eq('status', 'active');
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
      return false;
    }
    
    // Count by plan
    const planDistribution = {};
    finalSubs.forEach(sub => {
      planDistribution[sub.plan_id] = (planDistribution[sub.plan_id] || 0) + 1;
    });
    
    console.log('\n📊 Final plan distribution:');
    Object.entries(planDistribution).forEach(([plan, count]) => {
      console.log(`   - ${plan}: ${count} users`);
    });
    
    console.log(`\n🎉 Migration completed! ${finalSubs.length} total active subscriptions`);
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // Try to re-enable RLS in case of error
    try {
      await supabase.rpc('execute_sql', {
        sql_query: 'ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;'
      });
      console.log('✅ RLS re-enabled after error');
    } catch (e) {
      console.error('❌ Failed to re-enable RLS:', e);
    }
    
    return false;
  }
}

// Run the migration
if (require.main === module) {
  migrateUsersDisableRLS()
    .then((success) => {
      if (success) {
        console.log('\n✅ User migration completed!');
        process.exit(0);
      } else {
        console.log('\n❌ User migration failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Migration execution failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateUsersDisableRLS };

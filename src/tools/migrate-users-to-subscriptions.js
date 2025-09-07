const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function migrateUsersToSubscriptions() {
  console.log('🔄 Migrating existing users to user_subscriptions table...');
  
  try {
    // Step 1: Get all existing users
    console.log('\n1️⃣ Fetching all existing users...');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at, plan_id')
      .order('created_at', { ascending: true });
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return false;
    }
    
    console.log(`✅ Found ${users.length} users to migrate`);
    
    // Step 2: Check existing subscriptions
    console.log('\n2️⃣ Checking existing subscriptions...');
    
    const { data: existingSubs, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('status', 'active');
    
    if (subsError) {
      console.error('❌ Error checking existing subscriptions:', subsError);
      return false;
    }
    
    const existingUserIds = new Set(existingSubs.map(sub => sub.user_id));
    console.log(`✅ Found ${existingUserIds.size} existing active subscriptions`);
    
    // Step 3: Create subscriptions for users who don't have them
    console.log('\n3️⃣ Creating subscriptions for users without them...');
    
    const usersToMigrate = users.filter(user => !existingUserIds.has(user.id));
    console.log(`📝 ${usersToMigrate.length} users need subscription migration`);
    
    if (usersToMigrate.length === 0) {
      console.log('✅ All users already have subscriptions');
      return true;
    }
    
    // Create subscriptions in batches
    const batchSize = 50;
    let migratedCount = 0;
    
    for (let i = 0; i < usersToMigrate.length; i += batchSize) {
      const batch = usersToMigrate.slice(i, i + batchSize);
      
      const subscriptions = batch.map(user => {
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year from now
        
        return {
          user_id: user.id,
          plan_id: user.plan_id || 'basic', // Use existing plan_id or default to basic
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
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        continue;
      }
      
      migratedCount += insertedSubs.length;
      console.log(`✅ Migrated batch ${Math.floor(i/batchSize) + 1}: ${insertedSubs.length} subscriptions`);
    }
    
    console.log(`\n🎉 Migration completed! ${migratedCount} subscriptions created`);
    
    // Step 4: Verify migration
    console.log('\n4️⃣ Verifying migration...');
    
    const { data: finalSubs, error: verifyError } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, plan_id, status')
      .eq('status', 'active');
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
      return false;
    }
    
    console.log(`✅ Verification complete: ${finalSubs.length} active subscriptions found`);
    
    // Show plan distribution
    const planDistribution = {};
    finalSubs.forEach(sub => {
      planDistribution[sub.plan_id] = (planDistribution[sub.plan_id] || 0) + 1;
    });
    
    console.log('\n📊 Plan distribution:');
    Object.entries(planDistribution).forEach(([plan, count]) => {
      console.log(`   - ${plan}: ${count} users`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

// Run the migration
if (require.main === module) {
  migrateUsersToSubscriptions()
    .then((success) => {
      if (success) {
        console.log('\n✅ User migration completed successfully!');
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

module.exports = { migrateUsersToSubscriptions };

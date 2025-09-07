const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function migrateUsersWithSQL() {
  console.log('🔄 Migrating users using SQL...');
  
  try {
    // Step 1: Get all users using SQL
    console.log('\n1️⃣ Fetching users...');
    
    const { data: users, error: usersError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT id, email, created_at, plan_id 
          FROM users 
          ORDER BY created_at ASC;
        `
      });
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return false;
    }
    
    console.log(`✅ Found ${users.length} users`);
    
    // Step 2: Check existing subscriptions
    console.log('\n2️⃣ Checking existing subscriptions...');
    
    const { data: existingSubs, error: subsError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT user_id 
          FROM user_subscriptions 
          WHERE status = 'active';
        `
      });
    
    if (subsError) {
      console.error('❌ Error checking subscriptions:', subsError);
      return false;
    }
    
    const existingUserIds = new Set(existingSubs.map(sub => sub.user_id));
    console.log(`✅ Found ${existingUserIds.size} existing subscriptions`);
    
    // Step 3: Create subscriptions for users without them
    const usersToMigrate = users.filter(user => !existingUserIds.has(user.id));
    console.log(`📝 ${usersToMigrate.length} users need migration`);
    
    if (usersToMigrate.length === 0) {
      console.log('✅ All users already have subscriptions');
      return true;
    }
    
    // Step 4: Insert subscriptions using SQL
    console.log('\n3️⃣ Creating subscriptions...');
    
    const values = usersToMigrate.map(user => {
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      
      return `(
        '${user.id}',
        '${user.plan_id || 'basic'}',
        'active',
        '${user.created_at || new Date().toISOString()}',
        '${expirationDate.toISOString()}',
        NOW(),
        NOW()
      )`;
    }).join(',\n');
    
    const insertSQL = `
      INSERT INTO user_subscriptions (
        user_id, plan_id, status, start_date, 
        expiration_date, created_at, updated_at
      ) VALUES ${values}
      ON CONFLICT (user_id, plan_id) DO NOTHING
      RETURNING id, user_id, plan_id;
    `;
    
    const { data: insertedSubs, error: insertError } = await supabase
      .rpc('execute_sql', {
        sql_query: insertSQL
      });
    
    if (insertError) {
      console.error('❌ Error inserting subscriptions:', insertError);
      return false;
    }
    
    console.log(`✅ Created ${insertedSubs?.length || usersToMigrate.length} subscriptions`);
    
    // Step 5: Verify migration
    console.log('\n4️⃣ Verifying migration...');
    
    const { data: finalSubs, error: verifyError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT plan_id, COUNT(*) as count
          FROM user_subscriptions 
          WHERE status = 'active'
          GROUP BY plan_id
          ORDER BY plan_id;
        `
      });
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
      return false;
    }
    
    console.log('\n📊 Final plan distribution:');
    finalSubs.forEach(plan => {
      console.log(`   - ${plan.plan_id}: ${plan.count} users`);
    });
    
    console.log('\n🎉 Migration completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

// Run the migration
if (require.main === module) {
  migrateUsersWithSQL()
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

module.exports = { migrateUsersWithSQL };

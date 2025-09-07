const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function quickFixProduction() {
  console.log('🚀 Quick fix for production subscription issue...');
  
  try {
    // Step 1: Check if user_subscriptions table exists
    console.log('\n1️⃣ Checking if user_subscriptions table exists...');
    
    const { data: tableCheck, error: tableError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_subscriptions'
          );
        `
      });
    
    if (tableError) {
      console.error('❌ Error checking table existence:', tableError);
      return false;
    }
    
    const tableExists = tableCheck && tableCheck[0] && tableCheck[0].exists;
    console.log(`📊 user_subscriptions table exists: ${tableExists}`);
    
    if (!tableExists) {
      console.log('\n2️⃣ Creating user_subscriptions table...');
      
      const { error: createError } = await supabase
        .rpc('execute_sql', {
          sql_query: `
            CREATE TABLE user_subscriptions (
              id SERIAL PRIMARY KEY,
              user_id UUID NOT NULL,
              plan_id VARCHAR(50) NOT NULL,
              api_id VARCHAR(100),
              status VARCHAR(20) DEFAULT 'active',
              start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
              payment_order_id INTEGER,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `
        });
      
      if (createError) {
        console.error('❌ Error creating table:', createError);
        return false;
      }
      
      console.log('✅ user_subscriptions table created');
    }
    
    // Step 2: Check if table has data
    console.log('\n3️⃣ Checking existing subscriptions...');
    
    const { data: existingSubs, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .limit(1);
    
    if (subsError) {
      console.error('❌ Error checking subscriptions:', subsError);
      return false;
    }
    
    console.log(`📊 Existing subscriptions: ${existingSubs.length}`);
    
    // Step 3: If no subscriptions, create them for all users
    if (existingSubs.length === 0) {
      console.log('\n4️⃣ Creating subscriptions for all users...');
      
      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, plan_id, created_at');
      
      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        return false;
      }
      
      console.log(`📊 Found ${users.length} users to migrate`);
      
      // Create subscriptions in batches
      const batchSize = 50;
      let migratedCount = 0;
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const subscriptions = batch.map(user => {
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
          .select('id');
        
        if (insertError) {
          console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
          continue;
        }
        
        migratedCount += insertedSubs.length;
        console.log(`✅ Migrated batch ${Math.floor(i/batchSize) + 1}: ${insertedSubs.length} subscriptions`);
      }
      
      console.log(`\n🎉 Migration completed! ${migratedCount} subscriptions created`);
    } else {
      console.log('✅ Subscriptions already exist, skipping migration');
    }
    
    // Step 4: Test the fix
    console.log('\n5️⃣ Testing subscription access...');
    
    const { data: testSubs, error: testError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .limit(3);
    
    if (testError) {
      console.error('❌ Error testing subscriptions:', testError);
      return false;
    }
    
    console.log(`✅ Can access ${testSubs.length} subscriptions`);
    
    if (testSubs.length > 0) {
      console.log('📋 Sample subscription:');
      const sample = testSubs[0];
      console.log(`   - User: ${sample.user_id}`);
      console.log(`   - Plan: ${sample.plan_id}`);
      console.log(`   - Status: ${sample.status}`);
    }
    
    console.log('\n🎉 Quick fix completed successfully!');
    console.log('✅ The /api/user/subscription endpoint should now work');
    
    return true;
    
  } catch (error) {
    console.error('❌ Quick fix failed:', error);
    return false;
  }
}

// Run the quick fix
if (require.main === module) {
  quickFixProduction()
    .then((success) => {
      if (success) {
        console.log('\n✅ Production quick fix completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Production quick fix failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Quick fix execution failed:', error);
      process.exit(1);
    });
}

module.exports = { quickFixProduction };

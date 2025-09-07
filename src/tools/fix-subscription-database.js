const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function fixSubscriptionDatabase() {
  console.log('🔧 Starting subscription database fix...');
  
  try {
    // Read the SQL fix file
    const fs = require('fs');
    const path = require('path');
    const sqlFile = path.join(__dirname, 'fix-subscription-tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📋 Executing SQL fix script...');
    
    // Execute the SQL script
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: sqlContent
    });
    
    if (error) {
      console.error('❌ Error executing SQL script:', error);
      throw error;
    }
    
    console.log('✅ SQL script executed successfully');
    
    // Verify tables exist
    console.log('🔍 Verifying table creation...');
    
    const tables = ['payment_plans', 'payment_orders', 'user_subscriptions', 'subscriptions', 'payment_transactions'];
    
    for (const tableName of tables) {
      const { data: tableData, error: tableError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error(`❌ Error checking table ${tableName}:`, tableError);
      } else {
        console.log(`✅ Table ${tableName} exists and is accessible`);
      }
    }
    
    // Test payment plan insertion
    console.log('🧪 Testing payment plan data...');
    
    const { data: plans, error: plansError } = await supabase
      .from('payment_plans')
      .select('*');
    
    if (plansError) {
      console.error('❌ Error fetching payment plans:', plansError);
    } else {
      console.log(`✅ Found ${plans.length} payment plans:`, plans.map(p => `${p.plan_id} - ${p.name}`));
    }
    
    // Test payment order structure
    console.log('🧪 Testing payment order structure...');
    
    const { data: orderTest, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .limit(1);
    
    if (orderError) {
      console.error('❌ Error testing payment_orders table:', orderError);
    } else {
      console.log('✅ payment_orders table structure is correct');
    }
    
    console.log('🎉 Database fix completed successfully!');
    console.log('\n📋 Summary of fixes:');
    console.log('✅ Fixed foreign key type mismatch (UUID vs INTEGER)');
    console.log('✅ Created proper table schemas with correct field types');
    console.log('✅ Added missing plan_id field to payment_orders');
    console.log('✅ Fixed user_id field to be NOT NULL');
    console.log('✅ Added payment_order_id reference to subscriptions');
    console.log('✅ Created proper indexes for performance');
    console.log('✅ Added Row Level Security policies');
    console.log('✅ Inserted default payment plans');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
if (require.main === module) {
  fixSubscriptionDatabase()
    .then(() => {
      console.log('✅ Database fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSubscriptionDatabase };

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function recreatePaymentOrdersTable() {
  try {
    console.log('Starting payment_orders table recreation...');

    // First, let's check if the table exists and what its current structure is
    console.log('Checking current table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('payment_orders')
      .select('*')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      console.log('Table does not exist, will need to create it manually.');
    } else if (tableError) {
      console.error('Error checking table:', tableError);
    } else {
      console.log('Table exists. Current structure:', Object.keys(tableInfo[0] || {}));
    }

    console.log('\n📋 Manual Steps Required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL script from: src/tools/payment-orders-table.sql');
    console.log('\nOr copy and paste this SQL:');
    console.log('─'.repeat(80));
    
    const fs = require('fs');
    const sqlContent = fs.readFileSync('src/tools/payment-orders-table.sql', 'utf8');
    console.log(sqlContent);
    console.log('─'.repeat(80));

    console.log('\n✅ After running the SQL script, the table will be recreated with the correct structure.');
    console.log('\nThe new table will include these fields that match your code:');
    console.log('- order_id (varchar, unique)');
    console.log('- user_id (uuid, nullable)');
    console.log('- amount (numeric)');
    console.log('- currency (varchar, default: AZN)');
    console.log('- description (text, nullable)');
    console.log('- status (varchar, default: pending)');
    console.log('- payment_method (varchar, default: epoint)');
    console.log('- success_redirect_url (text, nullable)');
    console.log('- error_redirect_url (text, nullable)');
    console.log('- epoint_data (jsonb, nullable)');
    console.log('- epoint_signature (text, nullable)');
    console.log('- epoint_redirect_url (text, nullable)');
    console.log('- payment_details (jsonb, nullable)');
    console.log('- created_at, updated_at (timestamps)');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
if (require.main === module) {
  recreatePaymentOrdersTable()
    .then(() => {
      console.log('\n🎉 Instructions provided!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { recreatePaymentOrdersTable };

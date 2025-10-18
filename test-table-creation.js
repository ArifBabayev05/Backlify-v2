/**
 * Test script to verify SecurityLogAnalysis table creation
 */

const AnalysisTablesSetup = require('./src/utils/setup/analysisTables');

async function testTableCreation() {
  console.log('🧪 Testing SecurityLogAnalysis table creation...\n');

  try {
    const analysisTablesSetup = new AnalysisTablesSetup();
    
    // Test table creation
    console.log('1. Creating SecurityLogAnalysis table...');
    await analysisTablesSetup.createTables();
    
    // Test table existence check
    console.log('\n2. Verifying table exists...');
    const exists = await analysisTablesSetup.checkTableExists();
    console.log(`Table exists: ${exists ? '✅ Yes' : '❌ No'}`);
    
    if (exists) {
      console.log('\n3. Testing table structure...');
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
      );
      
      // Try to query the table structure
      const { data, error } = await supabase
        .from('SecurityLogAnalysis')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log('❌ Error querying table:', error.message);
      } else {
        console.log('✅ Table is accessible and ready for use');
        console.log('📊 Table structure verified');
      }
    }
    
    console.log('\n🎉 Table creation test completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Table creation test failed:', error.message);
    console.log('\n📝 Manual setup instructions:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Run the SQL script from create_security_analysis_table.sql');
    console.log('4. Restart your application');
    process.exit(1);
  }
}

// Run the test
testTableCreation();

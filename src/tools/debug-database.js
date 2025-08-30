#!/usr/bin/env node

/**
 * Database Debug Script
 * Checks database connection and table structure for Google auth
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugDatabase() {
  console.log('🔍 Database Debug Script');
  console.log('=' .repeat(50));
  
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    console.log('📡 Testing Supabase connection...');
    console.log(`   URL: ${process.env.SUPABASE_URL}`);
    console.log(`   Key: ${process.env.SUPABASE_KEY ? 'Set' : 'Not Set'}`);

    // Test basic connection by trying to select from users table
    console.log('\n🗂️  Testing users table access...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (usersError) {
      console.log('❌ Users table access failed:', usersError);
      return;
    } else {
      console.log('✅ Users table accessible');
      console.log(`   Found ${usersData ? usersData.length : 0} sample records`);
    }

    // Try to create a test record to see what columns exist
    console.log('\n🧪 Testing user creation (dry run)...');
    const testUser = {
      username: 'test_google_user_debug',
      email: 'test@debug.com',
      password: 'test_password_hash'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert(testUser)
      .select();

    if (insertError) {
      console.log('❌ Test user creation failed:', insertError);
      console.log('   This is expected if Google columns don\'t exist');
    } else {
      console.log('✅ Test user creation successful');
      console.log('   User ID:', insertData[0]?.id);
      
      // Clean up test user
      await supabase
        .from('users')
        .delete()
        .eq('username', 'test_google_user_debug');
      console.log('🧹 Cleaned up test user');
    }

    // Try to add Google columns manually
    console.log('\n🔧 Attempting to add Google auth columns...');
    
    const googleColumns = [
      'google_id VARCHAR(255)',
      'profile_picture TEXT',
      'full_name VARCHAR(255)',
      'email_verified BOOLEAN DEFAULT FALSE',
      'login_method VARCHAR(50) DEFAULT \'email\''
    ];

    for (const column of googleColumns) {
      const columnName = column.split(' ')[0];
      console.log(`   Adding column: ${columnName}...`);
      
      // Try to add the column
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column};`
        });
        
        if (error) {
          console.log(`   ❌ Failed to add ${columnName}:`, error.message);
        } else {
          console.log(`   ✅ Added ${columnName} successfully`);
        }
      } catch (err) {
        console.log(`   ❌ Exception adding ${columnName}:`, err.message);
      }
    }

    // Test Google user creation after adding columns
    console.log('\n🔄 Testing Google user creation after schema update...');
    const googleTestUser = {
      username: 'google_test_user_debug',
      email: 'googletest@debug.com',
      password: 'test_password_hash',
      google_id: '123456789',
      profile_picture: 'https://test.com/pic.jpg',
      full_name: 'Google Test User',
      email_verified: true,
      login_method: 'google'
    };

    const { data: googleInsertData, error: googleInsertError } = await supabase
      .from('users')
      .insert(googleTestUser)
      .select();

    if (googleInsertError) {
      console.log('❌ Google user creation failed:', googleInsertError);
      console.log('   Details:', googleInsertError.details);
      console.log('   Hint:', googleInsertError.hint);
    } else {
      console.log('✅ Google user creation successful!');
      console.log('   User ID:', googleInsertData[0]?.id);
      console.log('   Google ID:', googleInsertData[0]?.google_id);
      
      // Clean up test user
      await supabase
        .from('users')
        .delete()
        .eq('username', 'google_test_user_debug');
      console.log('🧹 Cleaned up Google test user');
    }

    // Final verification - check what columns exist now
    console.log('\n🔍 Final verification - checking user table structure...');
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Could not fetch sample user:', sampleError);
    } else if (sampleUser && sampleUser.length > 0) {
      console.log('✅ User table columns detected:');
      Object.keys(sampleUser[0]).forEach(column => {
        console.log(`   - ${column}`);
      });
    } else {
      console.log('ℹ️  No users in table to check structure');
    }

  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Run debug if this script is executed directly
if (require.main === module) {
  debugDatabase();
}

module.exports = { debugDatabase };

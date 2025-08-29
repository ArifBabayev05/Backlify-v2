#!/usr/bin/env node

/**
 * Google Authentication Setup Script
 * Sets up database tables and configuration for Google OAuth
 */

const { createClient } = require('@supabase/supabase-js');
const { addGoogleAuthSupport } = require('../utils/setup/googleAuthTables');
require('dotenv').config();

async function setupGoogleAuth() {
  console.log('🔧 Setting up Google Authentication...\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    console.log('📡 Connecting to database...');

    // Check if users table exists
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }

    if (!tablesData || tablesData.length === 0) {
      console.error('❌ Users table not found. Please run user setup first.');
      return;
    }

    console.log('✅ Users table found');

    // Check if Google columns already exist
    const { data: columnsData, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .eq('column_name', 'google_id');

    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }

    if (columnsData && columnsData.length > 0) {
      console.log('✅ Google authentication columns already exist');
    } else {
      console.log('📋 Adding Google authentication support...');

      // Execute the Google auth setup SQL
      try {
        // Try using RPC function if available
        const { error: rpcError } = await supabase.rpc('exec_sql', {
          sql: addGoogleAuthSupport
        });

        if (rpcError) {
          console.error('❌ Error with RPC:', rpcError);
          console.log('ℹ️  Please execute the following SQL manually in Supabase SQL Editor:');
          console.log('\n' + '='.repeat(60));
          console.log(addGoogleAuthSupport);
          console.log('='.repeat(60) + '\n');
        } else {
          console.log('✅ Google authentication setup completed successfully!');
        }
      } catch (err) {
        console.error('❌ Error executing SQL:', err);
        console.log('ℹ️  Please execute the following SQL manually in Supabase SQL Editor:');
        console.log('\n' + '='.repeat(60));
        console.log(addGoogleAuthSupport);
        console.log('='.repeat(60) + '\n');
      }
    }

    // Verify the setup
    console.log('\n🔍 Verifying Google authentication setup...');
    await verifyGoogleAuthSetup(supabase);

    console.log('\n🎉 Google Authentication Setup Complete!');
    console.log('\n📋 Available endpoints:');
    console.log('  POST /auth/google-login     - Google OAuth login/register');
    console.log('  GET  /auth/google-profile   - Get Google user profile (protected)');
    console.log('  POST /auth/google-verify    - Verify Google token (public)');

    console.log('\n🔧 Frontend integration example:');
    console.log(`
// Frontend JavaScript example
const response = await fetch('${process.env.BASE_URL || 'http://localhost:3000'}/auth/google-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    google_token: 'your_google_access_token',
    email: 'user@gmail.com',
    name: 'User Name',
    picture: 'https://profile-picture-url',
    google_id: 'google_user_id'
  })
});

const data = await response.json();
console.log('Login response:', data);
    `);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function verifyGoogleAuthSetup(supabase) {
  const requiredColumns = ['google_id', 'profile_picture', 'full_name', 'email_verified', 'login_method'];
  
  for (const column of requiredColumns) {
    try {
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'users')
        .eq('column_name', column);

      if (error) {
        console.log(`  ❌ ${column}: Error checking column`);
      } else if (data && data.length > 0) {
        console.log(`  ✅ ${column}: ${data[0].data_type}`);
      } else {
        console.log(`  ❌ ${column}: Column not found`);
      }
    } catch (err) {
      console.log(`  ❌ ${column}: Error verifying column`);
    }
  }

  // Check if view exists
  try {
    const { data, error } = await supabase
      .from('google_users')
      .select('*')
      .limit(1);

    if (error) {
      console.log('  ❌ google_users view: Not accessible');
    } else {
      console.log('  ✅ google_users view: Working');
    }
  } catch (err) {
    console.log('  ❌ google_users view: Error checking');
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupGoogleAuth();
}

module.exports = { setupGoogleAuth };

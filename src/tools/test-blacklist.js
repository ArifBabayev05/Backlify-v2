/**
 * Quick IP Blacklist Test
 * 
 * This script adds the specified IP to the blacklist and verifies it works
 * Run with: node tools/test-blacklist.js [IP_ADDRESS]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Function to add IP to blacklist
async function addToBlacklist(ip) {
  try {
    console.log(`🔒 Adding IP ${ip} to blacklist...`);
    
    // Delete any existing entries first
    await supabase
      .from('ip_blacklist')
      .delete()
      .eq('ip', ip);
    
    // Add to blacklist as permanent entry
    const { data, error } = await supabase
      .from('ip_blacklist')
      .insert([{
        ip,
        reason: 'Test IP blocking',
        created_at: new Date().toISOString(),
        created_by: 'test-script'
      }])
      .select();
    
    if (error) {
      throw new Error(`Failed to add IP to blacklist: ${error.message}`);
    }
    
    console.log(`✅ Successfully added IP ${ip} to blacklist`);
    return data[0];
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Function to verify blacklist entry
async function verifyBlacklisted(ip) {
  try {
    console.log(`🔍 Verifying IP ${ip} is blacklisted...`);
    
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', ip)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to verify blacklist: ${error.message}`);
    }
    
    if (data) {
      console.log(`✅ Verified: IP ${ip} is in the blacklist`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Reason: ${data.reason}`);
      console.log(`   Created: ${new Date(data.created_at).toLocaleString()}`);
      console.log(`   Created by: ${data.created_by}`);
      return true;
    } else {
      console.log(`❌ IP ${ip} is NOT in the blacklist!`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  // Get IP from command line argument or use default
  const ip = process.argv[2] || '82.194.24.127';
  
  console.log('===== BACKLIFY IP BLACKLIST TEST =====');
  console.log(`Testing with IP: ${ip}`);
  
  // Add IP to blacklist
  await addToBlacklist(ip);
  
  // Verify it was added
  const verified = await verifyBlacklisted(ip);
  
  if (verified) {
    console.log('\n🚨 IMPORTANT: Test your application now to confirm access is blocked');
    console.log('   All requests from this IP should receive a 403 Forbidden response');
    console.log('   If your application still works, there is a problem in the blacklist middleware');
    console.log('\n   You can also check the security_logs table for BLACKLISTED_IP_BLOCKED entries');
    console.log('   When you are done testing, you can remove this IP from the blacklist');
    console.log(`   by running: node tools/verify-blacklist.js and using the "remove ${ip}" command`);
  } else {
    console.log('\n❌ Test failed! The IP could not be verified in the blacklist.');
  }
}

// Run the main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
}); 
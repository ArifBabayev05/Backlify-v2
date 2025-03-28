/**
 * Simple IP Blacklist Test Script
 * 
 * This is a minimal script to test IP blacklisting without any additional features.
 * It will add your current IP to the blacklist and confirm it was added correctly.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get the IP to test from command line or use default
const testIP = process.argv[2] || '82.194.24.127';

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testIPBlocking() {
  console.log('=== SIMPLE IP BLOCKING TEST ===');
  console.log(`Using IP: ${testIP}`);
  
  try {
    // 1. Check if IP is already in blacklist
    console.log('\n1. Checking if IP is already blacklisted...');
    const { data: existingEntry } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', testIP)
      .maybeSingle();
    
    if (existingEntry) {
      console.log(`IP ${testIP} is already in blacklist with reason: ${existingEntry.reason}`);
      console.log('Removing existing entry to start fresh...');
      
      await supabase
        .from('ip_blacklist')
        .delete()
        .eq('ip', testIP);
    } else {
      console.log(`IP ${testIP} is not currently blacklisted`);
    }
    
    // 2. Add IP to blacklist
    console.log('\n2. Adding IP to blacklist...');
    const { data: newEntry, error } = await supabase
      .from('ip_blacklist')
      .insert([{
        ip: testIP,
        reason: 'Test blocking',
        created_at: new Date().toISOString(),
        created_by: 'test-script'
      }])
      .select();
    
    if (error) {
      throw new Error(`Failed to add IP to blacklist: ${error.message}`);
    }
    
    console.log(`✅ Successfully added IP ${testIP} to blacklist`);
    
    // 3. Verify IP is now in blacklist
    console.log('\n3. Verifying IP is now blacklisted...');
    const { data: verifyEntry } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', testIP)
      .maybeSingle();
    
    if (verifyEntry) {
      console.log(`✅ CONFIRMED: IP ${testIP} is blacklisted`);
      console.log('Blacklist entry details:');
      console.log(JSON.stringify(verifyEntry, null, 2));
    } else {
      console.log(`❌ ERROR: IP ${testIP} was not found in blacklist after adding`);
    }
    
    // 4. Instructions for testing
    console.log('\n4. NEXT STEPS:');
    console.log(`a) Try accessing the application with IP ${testIP}`);
    console.log('b) You should receive a 403 Forbidden response');
    console.log('c) Check server logs for "[IP Blacklist] Blocked blacklisted IP" messages');
    console.log('\nTo remove this IP from blacklist when done testing, run:');
    console.log(`node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY); supabase.from('ip_blacklist').delete().eq('ip', '${testIP}').then(() => console.log('IP removed from blacklist'))"`);
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testIPBlocking(); 
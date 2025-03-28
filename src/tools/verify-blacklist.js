/**
 * IP Blacklist verification tool
 * 
 * This script allows you to test and verify that the IP blacklist functionality is working
 * You can add IPs to the blacklist and confirm they were added correctly
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Add an IP to the blacklist
 */
async function addToBlacklist(ip, reason, permanent = true) {
  try {
    // Check if IP already exists in blacklist
    const { data: existing } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', ip)
      .maybeSingle();
    
    if (existing) {
      console.log(`⚠️ IP ${ip} is already blacklisted with reason: ${existing.reason}`);
      return existing;
    }
    
    // Prepare entry data
    const entry = {
      ip,
      reason,
      created_at: new Date().toISOString(),
      created_by: 'blacklist-verify-tool'
    };
    
    // Add expiry if not permanent
    if (!permanent) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1); // 1 hour from now
      entry.expires_at = expiryDate.toISOString();
    }
    
    // Insert into blacklist
    const { data, error } = await supabase
      .from('ip_blacklist')
      .insert([entry])
      .select();
    
    if (error) {
      console.error('❌ Error adding IP to blacklist:', error);
      return null;
    }
    
    console.log(`✅ Added IP ${ip} to blacklist successfully`);
    return data[0];
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return null;
  }
}

/**
 * List all entries in the blacklist
 */
async function listBlacklist() {
  try {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error retrieving blacklist:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('ℹ️ Blacklist is empty');
      return;
    }
    
    console.log('\n=== BLACKLISTED IPs ===');
    console.log('ID\t\tIP\t\t\tReason\t\t\tExpires\t\t\tCreated By');
    console.log('---------------------------------------------------------------------------------');
    
    data.forEach(entry => {
      const expires = entry.expires_at ? new Date(entry.expires_at).toLocaleString() : 'Never (permanent)';
      console.log(`${entry.id}\t${entry.ip}\t${entry.reason}\t${expires}\t${entry.created_by}`);
    });
    
    console.log(`\nTotal: ${data.length} blacklisted IPs`);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

/**
 * Delete an IP from the blacklist
 */
async function removeFromBlacklist(ip) {
  try {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .delete()
      .eq('ip', ip)
      .select();
    
    if (error) {
      console.error(`❌ Error removing IP ${ip} from blacklist:`, error);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.log(`⚠️ IP ${ip} was not found in the blacklist`);
      return false;
    }
    
    console.log(`✅ Removed IP ${ip} from blacklist successfully`);
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

/**
 * Verify if an IP is blacklisted
 */
async function verifyBlacklisted(ip) {
  try {
    const currentTime = new Date().toISOString();
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', ip)
      .or(`expires_at.is.null,expires_at.gt.${currentTime}`)
      .maybeSingle();
    
    if (error) {
      console.error(`❌ Error checking if IP ${ip} is blacklisted:`, error);
      return false;
    }
    
    if (data) {
      console.log(`✅ IP ${ip} is blacklisted:`);
      console.log(`   Reason: ${data.reason}`);
      console.log(`   Type: ${data.expires_at ? 'Temporary' : 'Permanent'}`);
      if (data.expires_at) {
        console.log(`   Expires: ${new Date(data.expires_at).toLocaleString()}`);
      }
      return true;
    } else {
      console.log(`ℹ️ IP ${ip} is NOT blacklisted`);
      return false;
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

/**
 * Display help menu
 */
function showHelp() {
  console.log('\n=== IP Blacklist Verification Tool ===');
  console.log('Available commands:');
  console.log('  add <ip> <reason> [permanent]  - Add an IP to the blacklist');
  console.log('                                  - [permanent] can be "true" or "false", default is true');
  console.log('  remove <ip>                    - Remove an IP from the blacklist');
  console.log('  check <ip>                     - Check if an IP is blacklisted');
  console.log('  list                           - List all blacklisted IPs');
  console.log('  help                           - Show this help menu');
  console.log('  exit                           - Exit the tool');
  console.log('');
}

/**
 * Main interactive CLI function
 */
async function main() {
  console.log('=== IP Blacklist Verification Tool ===');
  console.log('Type "help" for available commands.\n');
  
  // Print current test IP if available
  if (process.env.YOUR_IP) {
    console.log(`Your current IP appears to be: ${process.env.YOUR_IP}`);
  }
  
  rl.on('line', async (line) => {
    const args = line.trim().split(' ');
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'add':
        if (args.length < 3) {
          console.log('❌ Usage: add <ip> <reason> [permanent]');
          break;
        }
        const permanent = args.length >= 4 ? args[3].toLowerCase() === 'true' : true;
        await addToBlacklist(args[1], args[2], permanent);
        break;
        
      case 'remove':
        if (args.length < 2) {
          console.log('❌ Usage: remove <ip>');
          break;
        }
        await removeFromBlacklist(args[1]);
        break;
        
      case 'check':
        if (args.length < 2) {
          console.log('❌ Usage: check <ip>');
          break;
        }
        await verifyBlacklisted(args[1]);
        break;
        
      case 'list':
        await listBlacklist();
        break;
        
      case 'help':
        showHelp();
        break;
        
      case 'exit':
      case 'quit':
        console.log('Exiting...');
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Type "help" for available commands.');
    }
    
    console.log('\nEnter command:');
  });
  
  // Initial prompt
  console.log('Enter command:');
}

// Start the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 
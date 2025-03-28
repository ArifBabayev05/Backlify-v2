/**
 * Initialize security-related database tables
 * This script creates the necessary tables for security features
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Create the invalid_tokens table if it doesn't exist
 * This table stores invalidated refresh tokens
 */
const initializeInvalidTokensTable = async () => {
  try {
    console.log('Checking if invalid_tokens table exists...');
    
    // Check if table exists
    const { error: checkError } = await supabase
      .from('invalid_tokens')
      .select('*')
      .limit(1);
    
    // If no error, table exists
    if (!checkError) {
      console.log('✅ invalid_tokens table already exists');
      return true;
    }
    
    // Create the table
    console.log('Creating invalid_tokens table...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS invalid_tokens (
        id SERIAL PRIMARY KEY,
        token_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        invalidated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        invalidated_by VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ip VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
      
      -- Add index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_invalid_tokens_token_id ON invalid_tokens(token_id);
      
      -- Add trigger to auto-delete expired tokens
      CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS trigger AS $$
      BEGIN
        DELETE FROM invalid_tokens WHERE expires_at < NOW();
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_cleanup_expired_tokens ON invalid_tokens;
      
      CREATE TRIGGER trigger_cleanup_expired_tokens
        AFTER INSERT ON invalid_tokens
        EXECUTE PROCEDURE cleanup_expired_tokens();
    `;
    
    // Execute SQL via Supabase RPC
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: createTableSQL
    });
    
    if (error) {
      console.error('❌ Failed to create invalid_tokens table:', error);
      
      // Try alternative method (direct SQL using pg if available)
      try {
        console.log('Trying alternative method to create table...');
        
        const { data, error: sqlError } = await supabase
          .from('security_setup')
          .select('*')
          .filter('name', 'eq', 'invalid_tokens_table')
          .maybeSingle();
        
        if (sqlError || !data) {
          await supabase.from('security_setup').insert([{
            name: 'invalid_tokens_table',
            created_at: new Date().toISOString(),
            status: 'pending'
          }]);
          
          console.log('⚠️ Could not create invalid_tokens table directly. Added setup request to security_setup table.');
          return false;
        }
      } catch (altError) {
        console.error('❌ Alternative method also failed:', altError);
        return false;
      }
    } else {
      console.log('✅ Successfully created invalid_tokens table');
      return true;
    }
  } catch (error) {
    console.error('❌ Error initializing invalid_tokens table:', error);
    return false;
  }
};

/**
 * Initialize all security tables
 */
const initializeSecurityTables = async () => {
  console.log('Initializing security tables...');
  
  // Create invalid_tokens table
  await initializeInvalidTokensTable();
  
  // Add more table initializations as needed
  
  console.log('Completed security tables initialization');
};

module.exports = {
  initializeSecurityTables,
  initializeInvalidTokensTable
}; 
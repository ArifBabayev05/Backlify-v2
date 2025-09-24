const { createClient } = require('@supabase/supabase-js');

class EmailTablesSetup {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  async createTables() {
    console.log('📧 Setting up email tables...');

    try {
      // Try to create the table using direct SQL execution
      // First, let's check if the table already exists
      const { data: existingTable, error: checkError } = await this.supabase
        .from('email_logs')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST116') {
        // Table doesn't exist, we need to create it
        console.log('📧 Creating email_logs table...');
        
        // For now, we'll skip the table creation and just log a message
        // The table will need to be created manually in Supabase dashboard
        console.log('⚠️  Email table creation skipped. Please create the email_logs table manually in Supabase dashboard.');
        console.log('📋 Required table structure:');
        console.log(`
CREATE TABLE email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  message_id VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_type ON email_logs(type);
CREATE INDEX idx_email_logs_from_email ON email_logs(from_email);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service role can manage email_logs" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read email_logs" ON email_logs
  FOR SELECT USING (auth.role() = 'authenticated');
        `);
        
        return true;
      } else if (checkError) {
        console.error('❌ Error checking email_logs table:', checkError);
        throw checkError;
      } else {
        console.log('✅ Email_logs table already exists');
        return true;
      }

    } catch (error) {
      console.error('❌ Error setting up email tables:', error);
      console.log('⚠️  Email features will work but logging will be disabled until table is created');
      return false; // Don't throw, just return false
    }
  }

  async dropTables() {
    console.log('🗑️ Dropping email tables...');

    try {
      const { error } = await this.supabase.rpc('execute_sql', {
        sql: `
          DROP TABLE IF EXISTS email_logs CASCADE;
        `
      });

      if (error) {
        console.error('❌ Error dropping email tables:', error);
        throw error;
      }

      console.log('✅ Email tables dropped successfully');
      return true;

    } catch (error) {
      console.error('❌ Error dropping email tables:', error);
      throw error;
    }
  }

  async checkTables() {
    console.log('🔍 Checking email tables...');

    try {
      const { data, error } = await this.supabase
        .from('email_logs')
        .select('count(*)', { count: 'exact', head: true });

      if (error) {
        console.log('❌ Email tables not found or not accessible');
        return false;
      }

      console.log('✅ Email tables are accessible');
      return true;

    } catch (error) {
      console.log('❌ Error checking email tables:', error.message);
      return false;
    }
  }
}

module.exports = EmailTablesSetup;

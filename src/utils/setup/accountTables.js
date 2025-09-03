const { createClient } = require('@supabase/supabase-js');

class AccountTablesSetup {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  async createTables() {
    console.log('Creating Account Settings database tables...');
    
    try {
      // 1. Users table (if not exists)
      await this.createUsersTable();
      
      // 2. Subscriptions table
      await this.createSubscriptionsTable();
      
      // 3. API Usage table
      await this.createApiUsageTable();
      
      // 4. Notification Settings table
      await this.createNotificationSettingsTable();
      
      console.log('✅ All Account Settings tables created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating Account Settings tables:', error);
      throw error;
    }
  }

  async createUsersTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          company VARCHAR(255),
          phone VARCHAR(20),
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          two_factor_secret VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      `
    });

    if (error) {
      console.error('Error creating users table:', error);
      throw error;
    }
    console.log('✅ users table created');
  }

  async createSubscriptionsTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          plan VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          start_date TIMESTAMP WITH TIME ZONE NOT NULL,
          end_date TIMESTAMP WITH TIME ZONE NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'AZN',
          auto_renew BOOLEAN DEFAULT TRUE,
          payment_order_id UUID REFERENCES payment_orders(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
      `
    });

    if (error) {
      console.error('Error creating subscriptions table:', error);
      throw error;
    }
    console.log('✅ subscriptions table created');
  }

  async createApiUsageTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS api_usage (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INTEGER NOT NULL,
          response_time INTEGER NOT NULL,
          ip_address INET NOT NULL,
          user_agent TEXT,
          request_size INTEGER,
          response_size INTEGER,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
        CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
        CREATE INDEX IF NOT EXISTS idx_api_usage_status_code ON api_usage(status_code);
        CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
        CREATE INDEX IF NOT EXISTS idx_api_usage_user_created ON api_usage(user_id, created_at);
      `
    });

    if (error) {
      console.error('Error creating api_usage table:', error);
      throw error;
    }
    console.log('✅ api_usage table created');
  }

  async createNotificationSettingsTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS notification_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          email_notifications BOOLEAN DEFAULT TRUE,
          sms_notifications BOOLEAN DEFAULT FALSE,
          marketing_emails BOOLEAN DEFAULT FALSE,
          two_factor_auth BOOLEAN DEFAULT FALSE,
          api_access BOOLEAN DEFAULT TRUE,
          security_alerts BOOLEAN DEFAULT TRUE,
          billing_notifications BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
      `
    });

    if (error) {
      console.error('Error creating notification_settings table:', error);
      throw error;
    }
    console.log('✅ notification_settings table created');
  }

  async checkTablesExist() {
    const tables = [
      'users',
      'subscriptions',
      'api_usage',
      'notification_settings'
    ];

    const results = {};
    
    for (const table of tables) {
      const { data, error } = await this.supabase
        .from(table)
        .select('*')
        .limit(1);
      
      results[table] = !error;
    }

    return results;
  }
}

module.exports = AccountTablesSetup;

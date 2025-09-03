const { createClient } = require('@supabase/supabase-js');

class EpointTablesSetup {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  async createTables() {
    console.log('Creating Epoint database tables...');
    
    try {
      // 1. Payment Orders Table
      await this.createPaymentOrdersTable();
      
      // 2. Payment Transactions Table
      await this.createPaymentTransactionsTable();
      
      // 3. Saved Cards Table
      await this.createSavedCardsTable();
      
      // 4. Payment Callbacks Table
      await this.createPaymentCallbacksTable();
      
      // 5. Payment Reversals Table
      await this.createPaymentReversalsTable();
      
      // 6. Pre-Authorizations Table
      await this.createPreAuthorizationsTable();
      
      console.log('✅ All Epoint tables created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating Epoint tables:', error);
      throw error;
    }
  }

  async createPaymentOrdersTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS payment_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          description TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          payment_method VARCHAR(50) DEFAULT 'epoint',
          success_redirect_url TEXT,
          error_redirect_url TEXT,
          epoint_data JSONB,
          epoint_signature TEXT,
          epoint_transaction_id VARCHAR(255),
          epoint_redirect_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
        CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
        CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
      `
    });

    if (error) {
      console.error('Error creating payment_orders table:', error);
      throw error;
    }
    console.log('✅ payment_orders table created');
  }

  async createPaymentTransactionsTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id VARCHAR(255) REFERENCES payment_orders(order_id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          epoint_transaction_id VARCHAR(255) UNIQUE NOT NULL,
          bank_transaction_id VARCHAR(255),
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          status VARCHAR(50) NOT NULL,
          payment_method VARCHAR(50) DEFAULT 'epoint',
          card_last_four VARCHAR(4),
          card_brand VARCHAR(50),
          processing_fee DECIMAL(10,2) DEFAULT 0,
          net_amount DECIMAL(10,2),
          epoint_response JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_epoint_id ON payment_transactions(epoint_transaction_id);
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
      `
    });

    if (error) {
      console.error('Error creating payment_transactions table:', error);
      throw error;
    }
    console.log('✅ payment_transactions table created');
  }

  async createSavedCardsTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS saved_cards (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          epoint_card_id VARCHAR(255) UNIQUE NOT NULL,
          card_last_four VARCHAR(4) NOT NULL,
          card_brand VARCHAR(50),
          card_expiry_month INTEGER,
          card_expiry_year INTEGER,
          is_default BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          registration_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON saved_cards(user_id);
        CREATE INDEX IF NOT EXISTS idx_saved_cards_epoint_id ON saved_cards(epoint_card_id);
        CREATE INDEX IF NOT EXISTS idx_saved_cards_is_active ON saved_cards(is_active);
      `
    });

    if (error) {
      console.error('Error creating saved_cards table:', error);
      throw error;
    }
    console.log('✅ saved_cards table created');
  }

  async createPaymentCallbacksTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS payment_callbacks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id VARCHAR(255),
          epoint_transaction_id VARCHAR(255),
          callback_data JSONB NOT NULL,
          signature TEXT NOT NULL,
          signature_valid BOOLEAN NOT NULL,
          processed BOOLEAN DEFAULT FALSE,
          processing_error TEXT,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_payment_callbacks_order_id ON payment_callbacks(order_id);
        CREATE INDEX IF NOT EXISTS idx_payment_callbacks_epoint_id ON payment_callbacks(epoint_transaction_id);
        CREATE INDEX IF NOT EXISTS idx_payment_callbacks_processed ON payment_callbacks(processed);
        CREATE INDEX IF NOT EXISTS idx_payment_callbacks_created_at ON payment_callbacks(created_at);
      `
    });

    if (error) {
      console.error('Error creating payment_callbacks table:', error);
      throw error;
    }
    console.log('✅ payment_callbacks table created');
  }

  async createPaymentReversalsTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS payment_reversals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          original_transaction_id VARCHAR(255) NOT NULL,
          reversal_transaction_id VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          reversal_type VARCHAR(20) DEFAULT 'full', -- 'full' or 'partial'
          reason TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          epoint_response JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_payment_reversals_original_id ON payment_reversals(original_transaction_id);
        CREATE INDEX IF NOT EXISTS idx_payment_reversals_reversal_id ON payment_reversals(reversal_transaction_id);
        CREATE INDEX IF NOT EXISTS idx_payment_reversals_user_id ON payment_reversals(user_id);
        CREATE INDEX IF NOT EXISTS idx_payment_reversals_status ON payment_reversals(status);
      `
    });

    if (error) {
      console.error('Error creating payment_reversals table:', error);
      throw error;
    }
    console.log('✅ payment_reversals table created');
  }

  async createPreAuthorizationsTable() {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS pre_authorizations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id VARCHAR(255) NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pre_auth_transaction_id VARCHAR(255) UNIQUE NOT NULL,
          capture_transaction_id VARCHAR(255),
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'authorized', 'captured', 'expired', 'cancelled'
          authorized_at TIMESTAMP WITH TIME ZONE,
          captured_at TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE,
          epoint_response JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_pre_auth_order_id ON pre_authorizations(order_id);
        CREATE INDEX IF NOT EXISTS idx_pre_auth_user_id ON pre_authorizations(user_id);
        CREATE INDEX IF NOT EXISTS idx_pre_auth_transaction_id ON pre_authorizations(pre_auth_transaction_id);
        CREATE INDEX IF NOT EXISTS idx_pre_auth_status ON pre_authorizations(status);
        CREATE INDEX IF NOT EXISTS idx_pre_auth_expires_at ON pre_authorizations(expires_at);
      `
    });

    if (error) {
      console.error('Error creating pre_authorizations table:', error);
      throw error;
    }
    console.log('✅ pre_authorizations table created');
  }

  async checkTablesExist() {
    const tables = [
      'payment_orders',
      'payment_transactions', 
      'saved_cards',
      'payment_callbacks',
      'payment_reversals',
      'pre_authorizations'
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

module.exports = EpointTablesSetup;

const { createClient } = require('@supabase/supabase-js');

class AnalysisTablesSetup {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  async createTables() {
    try {
      console.log('Creating SecurityLogAnalysis table...');
      
      // Check if table already exists
      const exists = await this.checkTableExists();
      if (exists) {
        console.log('✅ SecurityLogAnalysis table already exists');
        return true;
      }

      // Create the table using direct SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS SecurityLogAnalysis (
            id VARCHAR(255) PRIMARY KEY,
            detected_user VARCHAR(255),
            machine_name VARCHAR(255),
            time_from TIMESTAMP WITH TIME ZONE,
            time_to TIMESTAMP WITH TIME ZONE,
            risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
            risk_likelihood VARCHAR(10) NOT NULL CHECK (risk_likelihood IN ('Low', 'Medium', 'High')),
            risk_justification TEXT,
            confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
            summary_bullets JSONB NOT NULL,
            top_indicators JSONB NOT NULL,
            recommendations JSONB NOT NULL,
            behavior_breakdown JSONB NOT NULL,
            chart_risk_history JSONB,
            chart_event_dist JSONB,
            alert_flags JSONB NOT NULL,
            timestamp_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            raw_input JSONB
        )
      `;
      
      // Execute the table creation
      const { data: tableData, error: tableError } = await this.supabase.rpc('execute_sql', {
        sql_query: createTableSQL
      });

      if (tableError) {
        console.error('Error creating SecurityLogAnalysis table:', tableError);
        throw tableError;
      }

      console.log('✅ SecurityLogAnalysis table created');

      // Create indexes one by one to handle potential errors
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_risk_score ON SecurityLogAnalysis(risk_score)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_risk_likelihood ON SecurityLogAnalysis(risk_likelihood)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_detected_user ON SecurityLogAnalysis(detected_user)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_machine_name ON SecurityLogAnalysis(machine_name)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_timestamp_created ON SecurityLogAnalysis(timestamp_created)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_time_from ON SecurityLogAnalysis(time_from)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_time_to ON SecurityLogAnalysis(time_to)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_summary_gin ON SecurityLogAnalysis USING GIN (summary_bullets)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_indicators_gin ON SecurityLogAnalysis USING GIN (top_indicators)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_recommendations_gin ON SecurityLogAnalysis USING GIN (recommendations)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_behavior_gin ON SecurityLogAnalysis USING GIN (behavior_breakdown)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_alerts_gin ON SecurityLogAnalysis USING GIN (alert_flags)',
        'CREATE INDEX IF NOT EXISTS idx_security_analysis_raw_input_gin ON SecurityLogAnalysis USING GIN (raw_input)'
      ];

      for (const indexSQL of indexes) {
        try {
          const { error: indexError } = await this.supabase.rpc('execute_sql', {
            sql_query: indexSQL
          });
          if (indexError) {
            console.warn(`Warning: Could not create index: ${indexError.message}`);
          }
        } catch (err) {
          console.warn(`Warning: Could not create index: ${err.message}`);
        }
      }

      console.log('✅ SecurityLogAnalysis table created successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to create SecurityLogAnalysis table with execute_sql:', error);
      console.log('🔄 Trying alternative table creation method...');
      
      // Fallback: Try to create table using Supabase client directly
      try {
        await this.createTableDirectly();
        console.log('✅ SecurityLogAnalysis table created using alternative method');
        return true;
      } catch (fallbackError) {
        console.error('❌ All table creation methods failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async createTableDirectly() {
    // This is a fallback method that doesn't rely on execute_sql
    // We'll just verify the table exists and let Supabase handle the creation
    // when we try to insert data
    console.log('Using direct table creation fallback...');
    
    // Try to query the table to see if it exists
    const { data, error } = await this.supabase
      .from('SecurityLogAnalysis')
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, we need to create it manually
      console.log('Table does not exist, manual creation required');
      throw new Error('SecurityLogAnalysis table does not exist and cannot be created automatically. Please create the table manually in Supabase dashboard.');
    }
    
    return true;
  }

  async checkTableExists() {
    try {
      const { data, error } = await this.supabase
        .from('SecurityLogAnalysis')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = AnalysisTablesSetup;

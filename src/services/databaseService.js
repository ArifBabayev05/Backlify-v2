const { Pool } = require('pg');
const config = require('../config/config');

// Parse connection string from Supabase URL
// Format: postgresql://postgres:[password]@[host]:[port]/postgres
const getConnectionConfig = () => {
  // If direct database connection info is provided, use it
  if (process.env.DB_CONNECTION_STRING) {
    return {
      connectionString: process.env.DB_CONNECTION_STRING,
      ssl: { rejectUnauthorized: false }
    };
  }
  
  // Otherwise try to extract from Supabase URL/key
  // This is a fallback but likely won't work without proper connection string
  const supabaseUrl = config.supabase.url;
  // Extract host from URL (e.g., https://tiobwgnujrkhfotxdtdc.supabase.co)
  const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = urlMatch ? urlMatch[1] : 'unknown';
  
  return {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.DB_PASSWORD || config.supabase.key,
    ssl: { rejectUnauthorized: false }
  };
};

class DatabaseService {
  constructor() {
    this.pool = new Pool(getConnectionConfig());
    this.connected = false;
  }

  async connect() {
    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('Successfully connected to the database');
      client.release();
      this.connected = true;
      return true;
    } catch (error) {
      console.error('Database connection error:', error.message);
      return false;
    }
  }

  async executeSQL(sql) {
    if (!this.connected) {
      await this.connect();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Split SQL into individual statements
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('SQL execution error:', error.message);
      throw new Error(`SQL execution failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async createTable(tableDefinition) {
    const { name, columns, relationships = [] } = tableDefinition;
    
    try {
      // Generate SQL for table creation
      const sql = this.generateTableSQL(tableDefinition);
      
      // Execute the SQL
      await this.executeSQL(sql);
      
      console.log(`Table ${name} created successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to create table ${name}:`, error.message);
      throw error;
    }
  }

  generateTableSQL(tableDefinition) {
    const { name, columns, relationships = [] } = tableDefinition;
    
    // Generate column definitions
    const columnDefs = columns.map(col => {
      const constraints = Array.isArray(col.constraints) 
        ? col.constraints.join(' ') 
        : (col.constraints || '');
      return `${col.name} ${col.type} ${constraints}`.trim();
    });

    // Add timestamps if not present
    if (!columns.find(col => col.name === 'created_at')) {
      columnDefs.push('created_at timestamp with time zone DEFAULT now()');
    }
    if (!columns.find(col => col.name === 'updated_at')) {
      columnDefs.push('updated_at timestamp with time zone DEFAULT now()');
    }

    // Generate SQL
    return `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS ${name} CASCADE;

CREATE TABLE ${name} (
  ${columnDefs.join(',\n  ')}
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column_${name}() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_${name} ON ${name};

CREATE TRIGGER set_timestamp_${name}
BEFORE UPDATE ON ${name}
FOR EACH ROW
EXECUTE FUNCTION update_modified_column_${name}();
`;
  }
}

module.exports = new DatabaseService(); 
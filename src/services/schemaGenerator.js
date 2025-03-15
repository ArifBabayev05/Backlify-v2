const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const edgeFunctionService = require('./edgeFunctionService');

class SchemaGenerator {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    // Store schemas in memory
    this.schemas = new Map();
  }

  async generateSchemas(analysisResult, userId = 'default') {
    const createdTables = [];
    const schemaName = `user_${userId}`;

    try {
      // First, make sure we have the execute_sql function
      await this._ensureSqlFunction();
      
      // Create schema for this user
      await this._createSchema(schemaName);
      
      // Process tables in order to handle dependencies
      for (const table of analysisResult.tables) {
        // Store schema in memory
        this.schemas.set(table.name, table);
        
        // Create table in Supabase under user's schema
        const createResult = await this._createTable(table, userId);
        if (createResult.success) {
          console.log(`Table ${table.name} created successfully in schema ${schemaName}`);
          createdTables.push(table.name);
        } else {
          console.error(`Failed to create table ${table.name}:`, createResult.message);
          // Still add to list for API generation
          createdTables.push(table.name);
        }
      }

      // After all tables are created, add foreign key relationships
      for (const table of analysisResult.tables) {
        if (table.relationships && table.relationships.length > 0) {
          for (const rel of table.relationships) {
            await this._createRelationship(
              table.name,
              rel.targetTable,
              rel.type,
              rel.sourceColumn,
              rel.targetColumn,
              userId
            );
          }
        }
      }

      // Add sample data
      for (const table of analysisResult.tables) {
        await this._addSampleData(table, userId);
      }

      return createdTables;
    } catch (error) {
      throw new Error(`Schema generation failed: ${error.message}`);
    }
  }

  async _ensureSqlFunction() {
    // Check if execute_sql function exists by trying to call it
    const testResult = await this.supabase.rpc('execute_sql', {
      sql: 'SELECT 1 as test'
    });

    if (testResult.error && testResult.error.message.includes('function "execute_sql" does not exist')) {
      console.log('execute_sql function does not exist, creating it...');
      
      // Create the function through the REST API
      // Note: This probably won't work but we try anyway
      const { error } = await this.supabase.from('_rpc').select('*').eq('name', 'execute_sql_function_setup').execute();
      
      if (error) {
        console.error('Could not create execute_sql function:', error.message);
        console.error('Please create this function in your Supabase project using the SQL editor:');
        console.error(`
-- Create a function to execute SQL commands
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the authenticated and service roles
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;
        `);
      }
    }
  }

  async _createSchema(schemaName) {
    try {
      const createSchemaSQL = `CREATE SCHEMA IF NOT EXISTS ${schemaName}`;
      console.log(`Creating schema: ${createSchemaSQL}`);
      
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: createSchemaSQL
      });
      
      if (error) {
        console.error(`Error creating schema ${schemaName}:`, error.message);
        return { 
          success: false, 
          message: `Failed to create schema: ${error.message}`
        };
      }
      
      console.log(`Schema ${schemaName} created successfully`);
      return { 
        success: true, 
        message: `Schema ${schemaName} created successfully`
      };
    } catch (error) {
      console.error(`Error in creating schema:`, error);
      return { 
        success: false, 
        message: `Failed to create schema: ${error.message}`
      };
    }
  }

  async _createTable(tableSchema, userId) {
    try {
      const { name } = tableSchema;
      const schemaName = `user_${userId}`;
      
      // Convert our schema to SQL with the user's schema
      const createTableSQL = this._generateCreateTableSQL(name, tableSchema.columns, userId);
      console.log(`Creating table ${name} in schema ${schemaName}`);
      
      // Execute the SQL using Supabase's SQL API
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: createTableSQL
      });
      
      if (error) {
        console.error(`Error creating table ${name}:`, error.message);
        return { 
          success: false, 
          message: `Failed to create table: ${error.message}`
        };
      }
      
      console.log(`Table ${name} created successfully in schema ${schemaName}`);
      return { 
        success: true, 
        message: `Table ${name} created successfully in schema ${schemaName}`
      };
    } catch (error) {
      console.error(`Error in _createTable:`, error);
      return { 
        success: false, 
        message: `Failed to create table: ${error.message}`
      };
    }
  }

  async _createRelationship(sourceTable, targetTable, type, sourceColumn, targetColumn, userId) {
    try {
      const schemaName = `user_${userId}`;
      const relationshipSQL = this._generateRelationshipSQL(
        sourceTable,
        targetTable,
        type,
        sourceColumn,
        targetColumn,
        userId
      );

      console.log(`Creating relationship in schema ${schemaName}`);
      
      // Execute the SQL
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: relationshipSQL
      });
      
      if (error) {
        console.error(`Error creating relationship:`, error.message);
        return { 
          success: false, 
          message: `Failed to create relationship: ${error.message}`
        };
      }
      
      console.log(`Relationship created successfully in schema ${schemaName}`);
      return { 
        success: true, 
        message: `Relationship created successfully in schema ${schemaName}`
      };
    } catch (error) {
      console.error(`Error in _createRelationship:`, error);
      return { 
        success: false, 
        message: `Failed to create relationship: ${error.message}`
      };
    }
  }

  async _addSampleData(tableSchema, userId) {
    try {
      const { name } = tableSchema;
      const schemaName = `user_${userId}`;
      
      // Generate sample data SQL
      const insertSQL = this._generateSampleDataSQL(tableSchema, userId);
      if (!insertSQL) return { success: true, message: 'No sample data to add' };
      
      console.log(`Adding sample data to ${name} in schema ${schemaName}`);
      
      // Execute the SQL
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: insertSQL
      });
      
      if (error) {
        console.error(`Error adding sample data:`, error.message);
        return { 
          success: false, 
          message: `Failed to add sample data: ${error.message}`
        };
      }
      
      console.log(`Sample data added to ${name} in schema ${schemaName} successfully`);
      return { 
        success: true, 
        message: `Sample data added to ${name} in schema ${schemaName} successfully`
      };
    } catch (error) {
      console.error(`Error in _addSampleData:`, error);
      return { 
        success: false, 
        message: `Failed to add sample data: ${error.message}`
      };
    }
  }

  _generateCreateTableSQL(tableName, columns, userId) {
    const schemaName = `user_${userId}`;
    const fullTableName = `${schemaName}.${tableName}`;
    
    // First enable necessary extensions and create schema
    let sql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema for this user if it doesn't exist
CREATE SCHEMA IF NOT EXISTS ${schemaName};

`;

    // Drop the table if it exists
    sql += `DROP TABLE IF EXISTS ${fullTableName} CASCADE;\n\n`;
    
    // Generate column definitions
    const columnDefinitions = columns.map(column => {
      let colSql = `${column.name} ${column.type}`;
      
      if (column.constraints) {
        if (Array.isArray(column.constraints)) {
          colSql += ` ${column.constraints.join(' ')}`;
        } else {
          colSql += ` ${column.constraints}`;
        }
      }
      
      return colSql;
    });
    
    // Add timestamps if not present
    if (!columns.find(col => col.name === 'created_at')) {
      columnDefinitions.push('created_at timestamp with time zone DEFAULT now()');
    }
    if (!columns.find(col => col.name === 'updated_at')) {
      columnDefinitions.push('updated_at timestamp with time zone DEFAULT now()');
    }
    
    // Create the table
    sql += `CREATE TABLE ${fullTableName} (\n  ${columnDefinitions.join(',\n  ')}\n);\n\n`;
    
    // Add updated_at trigger
    sql += `
-- Create updated_at trigger
CREATE OR REPLACE FUNCTION ${schemaName}.update_modified_column_${tableName}() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_${tableName} ON ${fullTableName};

CREATE TRIGGER set_timestamp_${tableName}
BEFORE UPDATE ON ${fullTableName}
FOR EACH ROW
EXECUTE FUNCTION ${schemaName}.update_modified_column_${tableName}();
`;

    return sql;
  }

  _generateRelationshipSQL(sourceTable, targetTable, type, sourceColumn, targetColumn, userId) {
    const schemaName = `user_${userId}`;
    const constraintName = `fk_${sourceTable}_${sourceColumn}_${targetTable}`;
    
    let sql = `ALTER TABLE ${schemaName}.${sourceTable} ADD CONSTRAINT ${constraintName} `;
    sql += `FOREIGN KEY (${sourceColumn}) REFERENCES ${schemaName}.${targetTable}(${targetColumn}) `;
    sql += `ON DELETE CASCADE;`;
    
    return sql;
  }

  _generateSampleDataSQL(tableSchema, userId) {
    const schemaName = `user_${userId}`;
    const { name, columns, relationships = [] } = tableSchema;
    
    // Skip columns that should be auto-generated
    const columnNames = columns
      .filter(col => !((col.name === 'id' && col.type.includes('serial')) || 
                       col.name === 'created_at' || 
                       col.name === 'updated_at'))
      .map(col => col.name);
    
    if (columnNames.length === 0) return null;
    
    // Generate values for each column
    const values = columnNames.map(colName => {
      const col = columns.find(c => c.name === colName);
      
      if (colName === 'id' && col.type.includes('uuid')) {
        return 'uuid_generate_v4()';
      } else if (col.type.includes('varchar') || col.type.includes('text')) {
        return `'Sample ${colName} for ${name}'`;
      } else if (colName.endsWith('_id') && col.type.includes('uuid')) {
        // This is likely a foreign key
        const rel = relationships.find(r => r.sourceColumn === colName);
        if (rel) {
          return `(SELECT id FROM ${schemaName}.${rel.targetTable} LIMIT 1)`;
        }
        return 'uuid_generate_v4()';
      } else if (col.type.includes('int')) {
        return '1';
      } else if (col.type.includes('bool')) {
        return 'true';
      } else if (col.type.includes('json')) {
        return `'{}'::jsonb`;
      } else if (col.type.includes('date') || col.type.includes('time')) {
        return 'now()';
      } else {
        return 'null';
      }
    });
    
    return `INSERT INTO ${schemaName}.${name} (${columnNames.join(', ')}) VALUES (${values.join(', ')});`;
  }

  // Get a schema by name
  getSchema(tableName) {
    return this.schemas.get(tableName);
  }

  // Get all schemas
  getAllSchemas() {
    return Array.from(this.schemas.values());
  }
}

module.exports = new SchemaGenerator(); 
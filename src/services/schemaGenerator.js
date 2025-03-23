const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const edgeFunctionService = require('./edgeFunctionService');

class SchemaGenerator {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    // Store schemas in memory
    this.schemas = new Map();
  }

  async generateSchemas(analysisResult, XAuthUserId = 'default') {
    const createdTables = [];
    
    try {
      // First, make sure we have the execute_sql function
      await this._ensureSqlFunction();
      
      // Make a deep copy of the tables to avoid modifying the original
      const tablesData = JSON.parse(JSON.stringify(analysisResult.tables));
      
      console.log("Original tables structure:", JSON.stringify(tablesData, null, 2));
      
      // First pass: Create all tables with all columns including FK columns
      console.log("First pass: Creating all tables...");
      for (const table of tablesData) {
        // Add XAuthUserId prefix to table name
        const prefixedTableName = `${XAuthUserId}_${table.name}`;
        const originalName = table.name;
        table.name = prefixedTableName;
        
        // Store schema in memory with XAuthUserId prefix
        this.schemas.set(prefixedTableName, table);
        
        // Create table in Supabase in public schema with XAuthUserId prefix
        const createResult = await this._createTable(table, XAuthUserId);
        if (createResult.success) {
          console.log(`Table ${prefixedTableName} created successfully`);
          createdTables.push({ 
            originalName: originalName,
            prefixedName: prefixedTableName 
          });
        } else {
          console.error(`Failed to create table ${prefixedTableName}:`, createResult.message);
          // Still add to list for API generation
          createdTables.push({ 
            originalName: originalName,
            prefixedName: prefixedTableName 
          });
        }
      }

      // Second pass: Add relationships after all tables exist
      console.log("Second pass: Adding relationships...");
      for (const table of tablesData) {
        if (table.relationships && table.relationships.length > 0) {
          for (const rel of table.relationships) {
            // Update relationship to use prefixed table names
            const result = await this._createRelationship(
              table.name,  // Already prefixed
              `${XAuthUserId}_${rel.targetTable}`,
              rel.type,
              rel.sourceColumn,
              rel.targetColumn || 'id',  // Default to id if not specified
              XAuthUserId
            );
            
            console.log(`Relationship result: ${JSON.stringify(result)}`);
          }
        }
      }

      // Third pass: Add sample data
      console.log("Third pass: Adding sample data...");
      for (const table of tablesData) {
        await this._addSampleData(table, XAuthUserId);
      }

      return createdTables;
    } catch (error) {
      console.error("Schema generation error:", error);
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

  async _createTable(tableSchema, XAuthUserId) {
    const { name } = tableSchema;
    
    // Convert our schema to SQL
    const createTableSQL = this._generateCreateTableSQL(name, tableSchema.columns);
    
    return await this._executeSql(createTableSQL, `Creating table ${name}`);
  }

  async _createRelationship(sourceTable, targetTable, type, sourceColumn, targetColumn) {
    // Generate relationship SQL
    const relationshipSQL = this._generateRelationshipSQL(
      sourceTable,
      targetTable,
      type,
      sourceColumn,
      targetColumn
    );
    
    return await this._executeSql(
      relationshipSQL, 
      `Creating relationship between ${sourceTable} and ${targetTable}`
    );
  }

  async _addSampleData(tableSchema, XAuthUserId) {
    const { name } = tableSchema;
    
    try {
      // Generate sample data SQL
      const insertSQL = this._generateSampleDataSQL(tableSchema, XAuthUserId);
      if (!insertSQL) {
        console.log(`No sample data to add for ${name}`);
        return { success: true, message: 'No sample data to add' };
      }
      
      return await this._executeSql(insertSQL, `Adding sample data to ${name}`);
    } catch (error) {
      console.error(`Error adding sample data to ${name}:`, error);
      // Don't fail the whole process if sample data insertion fails
      return { 
        success: false, 
        message: `Sample data insertion failed: ${error.message}` 
      };
    }
  }

  async _executeSql(sql, operation) {
    try {
      console.log(`Executing SQL for ${operation}...`);
      
      // Execute the SQL using Supabase's SQL API
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: sql
      });
      
      if (error) {
        console.error(`Error in ${operation}:`, error.message);
        console.error(`SQL that caused error:\n${sql}`);
        return { 
          success: false, 
          message: `${operation} failed: ${error.message}`
        };
      }
      
      console.log(`${operation} completed successfully`);
      return { 
        success: true, 
        message: `${operation} completed successfully`
      };
    } catch (error) {
      console.error(`Exception in ${operation}:`, error);
      console.error(`SQL that caused error:\n${sql}`);
      return { 
        success: false, 
        message: `${operation} failed: ${error.message}`
      };
    }
  }

  _generateCreateTableSQL(tableName, columns) {
    // Use the table name directly (it's already prefixed)
    const fullTableName = tableName;
    
    // First enable necessary extensions
    let sql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

    // Drop the table if it exists
    sql += `DROP TABLE IF EXISTS "${fullTableName}" CASCADE;\n\n`;
    
    // Generate column definitions
    const columnDefinitions = columns.map(column => {
      // Clean up the column data to avoid SQL syntax errors
      const cleanedType = this._cleanSqlIdentifier(column.type);
      
      // Start with column name and type
      let colSql = `"${column.name}" ${cleanedType}`;
      
      // Handle constraints properly
      if (column.constraints) {
        let constraintText = '';
        
        if (Array.isArray(column.constraints)) {
          // Process each constraint individually
          column.constraints.forEach(constraint => {
            if (typeof constraint === 'string') {
              // Fix default value syntax - change "default: X" to "DEFAULT X"
              if (constraint.toLowerCase().includes('default:')) {
                const defaultValue = constraint.split(':')[1].trim();
                // Replace CURRENT_TIMESTAMP with now()
                const pgValue = defaultValue === 'CURRENT_TIMESTAMP' ? 'now()' : defaultValue;
                constraintText += ` DEFAULT ${pgValue}`;
              } 
              // Handle normal constraints but preserve foreign key information for later
              else if (!constraint.toLowerCase().includes('foreign key')) {
                constraintText += ` ${constraint}`;
              }
            }
          });
        } 
        // Handle string constraints
        else if (typeof column.constraints === 'string') {
          const constraintStr = column.constraints;
          
          // Fix default value syntax
          if (constraintStr.toLowerCase().includes('default:')) {
            const defaultValue = constraintStr.split(':')[1].trim();
            // Replace CURRENT_TIMESTAMP with now()
            const pgValue = defaultValue === 'CURRENT_TIMESTAMP' ? 'now()' : defaultValue;
            constraintText += ` DEFAULT ${pgValue}`;
          }
          // Skip foreign keys but add other constraints
          else if (!constraintStr.toLowerCase().includes('foreign key')) {
            constraintText += ` ${constraintStr}`;
          }
        }
        
        colSql += constraintText;
      }
      
      return colSql;
    });
    
    // Add timestamps if not present
    if (!columns.find(col => col.name === 'created_at')) {
      columnDefinitions.push('"created_at" timestamp with time zone DEFAULT now()');
    }
    if (!columns.find(col => col.name === 'updated_at')) {
      columnDefinitions.push('"updated_at" timestamp with time zone DEFAULT now()');
    }
    
    // Add XAuthUserId column if not present
    if (!columns.find(col => col.name === 'XAuthUserId')) {
      columnDefinitions.push('"XAuthUserId" varchar(255) NOT NULL');
    }
    
    // Create the table
    sql += `CREATE TABLE "${fullTableName}" (\n  ${columnDefinitions.join(',\n  ')}\n);\n\n`;
    
    // Function name needs to be sanitized for SQL
    const safeFunctionName = fullTableName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Add updated_at trigger - make sure to quote identifiers
    sql += `
-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column_${safeFunctionName}() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_${safeFunctionName} ON "${fullTableName}";

CREATE TRIGGER set_timestamp_${safeFunctionName}
BEFORE UPDATE ON "${fullTableName}"
FOR EACH ROW
EXECUTE FUNCTION update_modified_column_${safeFunctionName}();
`;

    // Debug the SQL being executed
    console.log("Generated SQL:", sql);
    
    return sql;
  }

  // Add a helper function to clean SQL identifiers
  _cleanSqlIdentifier(identifier) {
    if (!identifier) return '';
    
    // Replace any possibly dangerous characters
    return identifier
      .replace(/:/g, '')  // Remove colons
      .replace(/;/g, '')  // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .trim();
  }

  _generateRelationshipSQL(sourceTable, targetTable, type, sourceColumn, targetColumn) {
    // Use quoted identifiers and clean names
    const constraintName = `fk_${sourceTable.replace(/[^a-zA-Z0-9_]/g, '_')}_${sourceColumn}_${targetTable.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    
    // Debug
    console.log(`Creating FK: ${sourceTable}.${sourceColumn} -> ${targetTable}.${targetColumn}`);
    
    // First check if the column exists, and add it if it doesn't
    let sql = `
-- First check if both tables exist and add column if needed
DO $$
BEGIN
    -- Ensure tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${sourceTable}') AND 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${targetTable}') THEN
       
        -- Check if the column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = '${sourceTable}' AND column_name = '${sourceColumn}') THEN
            -- Add the column if it doesn't exist
            EXECUTE 'ALTER TABLE "${sourceTable}" ADD COLUMN "${sourceColumn}" uuid NOT NULL';
        END IF;
        
        -- Add the foreign key constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = '${constraintName}') THEN
            ALTER TABLE "${sourceTable}" 
            ADD CONSTRAINT "${constraintName}" 
            FOREIGN KEY ("${sourceColumn}") 
            REFERENCES "${targetTable}" ("${targetColumn}") 
            ON DELETE CASCADE;
        END IF;
    END IF;
END
$$;
`;
    
    // Debug
    console.log("Relationship SQL:", sql);
    
    return sql;
  }

  _generateSampleDataSQL(tableSchema, XAuthUserId) {
    // Similar safety checks and better foreign key handling
    const { name, columns } = tableSchema;
    
    // Create sample values for each column
    const columnValues = {};
    columns.forEach(col => {
      if (col.name === 'id' && col.type.includes('uuid')) {
        columnValues[col.name] = "uuid_generate_v4()";
      } else if (col.name === 'id' && col.type.includes('serial')) {
        // Skip serial IDs as they're auto-generated
        return;
      } else if (col.name === 'created_at' || col.name === 'updated_at') {
        columnValues[col.name] = "now()";
      } else if (col.name === 'XAuthUserId') {
        columnValues[col.name] = `'${XAuthUserId}'`;
      } else if (col.name.endsWith('_id') && col.name !== 'XAuthUserId') {
        // Check if the target table exists before creating a foreign key reference
        const targetTable = col.name.replace('_id', '');
        const targetTableName = `${XAuthUserId}_${targetTable}`;
        
        // Instead of a direct reference that might fail, use a safer approach
        columnValues[col.name] = `(SELECT id FROM "${targetTableName}" LIMIT 1)`;
        
        // Add a fallback in case the target table doesn't exist
        columnValues[col.name] = `
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${targetTableName}')
            THEN (SELECT id FROM "${targetTableName}" LIMIT 1)
            ELSE NULL
          END`;
      } else if (col.type.includes('varchar') || col.type.includes('text')) {
        columnValues[col.name] = `'Sample ${col.name} for ${name}'`;
      } else if (col.type.includes('int') || col.type.includes('float')) {
        columnValues[col.name] = "1";
      } else if (col.type.includes('bool')) {
        columnValues[col.name] = "true";
      } else if (col.type.includes('json')) {
        columnValues[col.name] = "'{}'";
      } else if (col.type.includes('date') || col.type.includes('time')) {
        columnValues[col.name] = "now()";
      } else {
        columnValues[col.name] = "null";
      }
    });
    
    // Make sure XAuthUserId is included
    if (!columnValues['XAuthUserId']) {
      columnValues['XAuthUserId'] = `'${XAuthUserId}'`;
    }
    
    // Create the insert statement
    const columnNames = Object.keys(columnValues).filter(name => 
      !name.includes('id') || !['serial', 'bigserial'].includes(columns.find(c => c.name === name)?.type)
    );
    
    const values = columnNames.map(name => columnValues[name]);
    
    if (columnNames.length > 0) {
      return `INSERT INTO "${name}" (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`;
    }
    
    return null;
  }

  // Get a schema by name
  getSchema(tableName) {
    return this.schemas.get(tableName);
  }

  // Get all schemas
  getAllSchemas() {
    return Array.from(this.schemas.values());
  }

  // New method: Generate schemas without creating tables in Supabase
  async generateSchemasWithoutCreating(analysisResult, XAuthUserId = 'default') {
    try {
      // Make a deep copy of the tables to avoid modifying the original
      const tablesData = JSON.parse(JSON.stringify(analysisResult.tables));
      
      console.log("Original tables structure:", JSON.stringify(tablesData, null, 2));
      
      // Process tables but don't create them in Supabase
      const processedTables = tablesData.map(table => {
        // Preserve original table name
        const originalName = table.name;
        // Add XAuthUserId prefix to table name (for when it will be created later)
        const prefixedTableName = `${XAuthUserId}_${table.name}`;
        
        // Return the complete table structure with both original and prefixed names
        return {
          ...table,
          originalName: originalName,
          name: originalName,  // Keep the original name for the schema
          prefixedName: prefixedTableName  // Store the prefixed name for later use
        };
      });
      
      console.log(`Processed ${processedTables.length} tables without creating them in Supabase`);
      return processedTables;
    } catch (error) {
      console.error("Schema processing error:", error);
      throw new Error(`Schema processing failed: ${error.message}`);
    }
  }
}

module.exports = new SchemaGenerator(); 
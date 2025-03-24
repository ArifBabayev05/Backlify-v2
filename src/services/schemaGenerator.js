const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const edgeFunctionService = require('./edgeFunctionService');

class SchemaGenerator {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    // Store schemas in memory
    this.schemas = new Map();
  }

  async generateSchemas(analysisResult, XAuthUserId = 'default', apiIdentifier = null) {
    try {
      // Generate a unique API identifier if not provided
      const effectiveApiId = apiIdentifier || Math.random().toString(36).substring(2, 8);
      
      // Make a deep copy of the tables to avoid modifying the original
      const tablesData = JSON.parse(JSON.stringify(analysisResult.tables));
      
      // First pass: Create all tables without relationships
      console.log("First pass: Creating tables without relationships...");
      const createdTables = [];
      
      for (const table of tablesData) {
        // Add XAuthUserId AND API identifier prefix to table name
        // IMPORTANT: Always use lowercase for table names to avoid PostgreSQL case sensitivity issues
        const originalName = table.name;
        const prefixedTableName = `${XAuthUserId}_${effectiveApiId}_${originalName}`.toLowerCase();
        table.name = prefixedTableName;
        
        // Store schema in memory with XAuthUserId prefix
        this.schemas.set(prefixedTableName, table);
        
        // Create table in Supabase in public schema with XAuthUserId and API identifier prefix
        const createResult = await this._createTable(table, XAuthUserId);
        if (createResult.success) {
          console.log(`Table ${prefixedTableName} created successfully`);
          createdTables.push({ 
            originalName: originalName,
            prefixedName: prefixedTableName,
            name: originalName,
            columns: table.columns,
            relationships: table.relationships || []
          });
        } else {
          console.error(`Failed to create table ${prefixedTableName}:`, createResult.message);
          // Don't add to the list if creation failed - this is more accurate
          // Only add tables that were actually created
        }
      }
      
      // Add a delay to ensure all tables are fully created before adding relationships
      console.log("Waiting for tables to be fully created...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Second pass: Now add relationships between tables that were successfully created
      console.log("Second pass: Adding relationships between tables...");
      for (const table of tablesData) {
        const relationships = table.relationships || [];
        if (relationships.length > 0) {
          for (const rel of relationships) {
            try {
              // Make sure we use the prefixed table names
              const sourceTable = table.name;
              let targetTable = rel.targetTable;
              
              // If the target table doesn't already include the prefix, add it
              if (!targetTable.startsWith(`${XAuthUserId}_${effectiveApiId}_`)) {
                targetTable = `${XAuthUserId}_${effectiveApiId}_${targetTable}`;
              }
              
              console.log(`Adding relationship: ${sourceTable}.${rel.sourceColumn} -> ${targetTable}.${rel.targetColumn}`);
              
              // Create relationship
              const relResult = await this._createRelationship(
                sourceTable,
                targetTable,
                rel.type || 'many-to-one',
                rel.sourceColumn,
                rel.targetColumn || 'id'
              );
              
              if (!relResult.success) {
                console.error(`Failed to create relationship:`, relResult.message);
              } else {
                console.log(`Relationship created successfully`);
              }
            } catch (error) {
              console.error(`Error creating relationship:`, error);
            }
          }
        }
      }
      
      // Third pass: Add sample data
      console.log("Third pass: Adding sample data...");
      for (const table of tablesData) {
        try {
          await this._addSampleData(table, XAuthUserId);
        } catch (error) {
          console.error(`Error adding sample data to ${table.name}:`, error);
          // Continue even if sample data insertion fails
        }
      }
      
      return createdTables;
    } catch (error) {
      console.error('Schema generation failed:', error);
      throw error;
    }
  }

  async _ensureSqlFunction() {
    console.log('Checking if execute_sql function exists in Supabase...');
    
    try {
      // First try to call the function with a simple query to test if it exists
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql_query: 'SELECT 1 as test;'
      });
      
      if (error) {
        // If function doesn't exist, try to create it
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log('execute_sql function not found. Attempting to create it...');
          await this._createSqlFunction();
          return true;
        } else {
          // Some other error (permissions, etc)
          console.error('Error accessing execute_sql function:', error);
          
          // Display specific advice for typical errors
          if (error.message.includes('permission denied')) {
            console.error('PERMISSIONS ERROR: Your Supabase service role key does not have permission to call the execute_sql function.');
            console.error('You may need to:');
            console.error('1. Create the execute_sql function with proper permissions');
            console.error('2. Use a service role key with more privileges');
          }
          
          throw new Error(`Unable to access execute_sql function: ${error.message}`);
        }
      }
      
      // Function exists and is working
      console.log('execute_sql function exists and is working properly');
      return true;
    } catch (error) {
      console.error('Error checking for execute_sql function:', error.message);
      
      // More detailed diagnostics
      console.error('IMPORTANT: The execute_sql function may not exist or you may not have permissions to use it.');
      console.error('This function is essential for creating tables in Supabase.');
      console.error('Please check your Supabase database settings and ensure:');
      console.error('1. The execute_sql function exists');
      console.error('2. Your service role key has permission to use it');
      console.error('3. Your Supabase project allows SQL execution through RPC');
      
      throw error;
    }
  }
  
  async _createSqlFunction() {
    console.log('Creating execute_sql function in Supabase...');
    
    // SQL function definition
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result json;
      BEGIN
        EXECUTE sql_query;
        result := json_build_object('success', true);
        RETURN result;
      EXCEPTION WHEN OTHERS THEN
        result := json_build_object(
          'success', false,
          'error', SQLERRM,
          'detail', SQLSTATE
        );
        RETURN result;
      END;
      $$;
      
      -- Grant usage permissions
      GRANT EXECUTE ON FUNCTION execute_sql TO service_role;
      GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
      GRANT EXECUTE ON FUNCTION execute_sql TO anon;
    `;
    
    try {
      // Try to create the function directly using Supabase SQL
      // Note: This may fail if the user doesn't have permissions
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql_query: createFunctionSQL
      });
      
      if (error) {
        console.error('Error creating execute_sql function:', error);
        console.error('');
        console.error('YOU NEED TO CREATE THIS FUNCTION MANUALLY IN SUPABASE SQL EDITOR:');
        console.error(createFunctionSQL);
        console.error('');
        console.error('After creating the function, restart the server.');
        
        throw new Error(`Failed to create execute_sql function: ${error.message}`);
      }
      
      console.log('execute_sql function created successfully');
      return true;
    } catch (error) {
      console.error('Failed to create execute_sql function:', error.message);
      
      // More friendly guidance
      console.error('');
      console.error('MANUAL ACTION REQUIRED:');
      console.error('Please run the following SQL in your Supabase SQL Editor:');
      console.error(createFunctionSQL);
      console.error('');
      console.error('After creating the function, restart the server.');
      
      throw error;
    }
  }

  async _addXAuthUserIdColumnIfNeeded(table) {
    // Check if XAuthUserId column exists
    const hasXAuthUserIdColumn = table.columns.some(col => col.name === 'XAuthUserId');

    if (!hasXAuthUserIdColumn) {
      console.log(`Adding XAuthUserId column to table ${table.name}`);
      
      // Add XAuthUserId column with appropriate definition
      const xAuthUserIdColumn = {
        name: 'XAuthUserId',
        type: 'varchar(255)',
        constraints: '' // No specific constraints needed
      };
      
      // Add to columns array
      table.columns.push(xAuthUserIdColumn);
    }
    
    return table;
  }

  async _createTable(tableSchema, XAuthUserId) {
    try {
      // Add XAuthUserId column if needed
      tableSchema = await this._addXAuthUserIdColumnIfNeeded(tableSchema);
      
      // Ensure table name is lowercase for consistency
      const { name: originalName, columns = [] } = tableSchema;
      const name = originalName.toLowerCase();
      
      console.log(`Attempting to create table ${name} in Supabase...`);
      
      // Generate SQL for table creation
      let sql = `
        -- Create table with UUID extension
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        -- Drop existing table if it exists
        DROP TABLE IF EXISTS "${name}" CASCADE;
        
        -- Create the new table
        CREATE TABLE "${name}" (
      `;
      
      // Track foreign keys for separate handling
      const foreignKeys = [];
      
      // Add column definitions
      const columnDefinitions = [];
      for (const col of columns) {
        let colDef = `"${col.name}" ${col.type}`;
        
        // Handle constraints properly
        if (col.constraints) {
          let constraintText = '';
          
          if (Array.isArray(col.constraints)) {
            // Process each constraint individually
            col.constraints.forEach(constraint => {
              if (typeof constraint === 'string') {
                // Fix default value syntax - change "default: X" to "DEFAULT X"
                if (constraint.toLowerCase().includes('default:')) {
                  const defaultValue = constraint.split(':')[1].trim();
                  // Replace CURRENT_TIMESTAMP with now()
                  const pgValue = defaultValue === 'CURRENT_TIMESTAMP' ? 'now()' : defaultValue;
                  constraintText += ` DEFAULT ${pgValue}`;
                } 
                // Extract foreign key constraints for later processing
                else if (constraint.toLowerCase().includes('references')) {
                  // Extract the referenced table and column
                  const refMatch = constraint.match(/references\s+([^\s(]+)(\(([^)]+)\))?/i);
                  if (refMatch) {
                    const targetTable = refMatch[1];
                    const targetColumn = refMatch[3] || 'id';
                    
                    // Store for later processing, making sure we get the exact case sensitive table name
                    foreignKeys.push({
                      sourceColumn: col.name,
                      targetTable: targetTable,
                      targetColumn: targetColumn
                    });
                    
                    // Remove the references part from the constraint for now
                    // We'll add proper foreign keys later - just keep the column as not null
                    constraintText += ` not null`;
                  } else {
                    constraintText += ` ${constraint}`;
                  }
                }
                // Handle normal constraints
                else {
                  constraintText += ` ${constraint}`;
                }
              }
            });
          } 
          // Handle string constraints
          else if (typeof col.constraints === 'string') {
            const constraintStr = col.constraints;
            
            // Fix default value syntax
            if (constraintStr.toLowerCase().includes('default:')) {
              const defaultValue = constraintStr.split(':')[1].trim();
              // Replace CURRENT_TIMESTAMP with now()
              const pgValue = defaultValue === 'CURRENT_TIMESTAMP' ? 'now()' : defaultValue;
              constraintText += ` DEFAULT ${pgValue}`;
            }
            // Extract foreign key constraints for later processing
            else if (constraintStr.toLowerCase().includes('references')) {
              // Extract the referenced table and column
              const refMatch = constraintStr.match(/references\s+([^\s(]+)(\(([^)]+)\))?/i);
              if (refMatch) {
                const targetTable = refMatch[1];
                const targetColumn = refMatch[3] || 'id';
                
                // Store for later processing, making sure we get the exact case sensitive table name
                foreignKeys.push({
                  sourceColumn: col.name,
                  targetTable: targetTable,
                  targetColumn: targetColumn
                });
                
                // Remove the references part from the constraint for now
                // Just make it not null, we'll add the proper foreign key after table creation
                constraintText += ` not null`;
              } else {
                constraintText += ` ${constraintStr}`;
              }
            }
            // Add other constraints
            else {
              constraintText += ` ${constraintStr}`;
            }
          }
          
          colDef += constraintText;
        }
        
        columnDefinitions.push(colDef);
      }
      
      // Add timestamps if not already present
      if (!columns.find(col => col.name === 'created_at')) {
        columnDefinitions.push('"created_at" timestamp not null default now()');
      }
      if (!columns.find(col => col.name === 'updated_at')) {
        columnDefinitions.push('"updated_at" timestamp not null default now()');
      }
      
      // Add XAuthUserId column if not present
      if (!columns.find(col => col.name === 'XAuthUserId')) {
        columnDefinitions.push('"XAuthUserId" varchar(255)');
      }
      
      // Combine column definitions
      sql += columnDefinitions.join(',\n          ');
      sql += `
        );
        
        -- Create updated_at trigger
        CREATE OR REPLACE FUNCTION "update_${name}_updated_at"() 
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE 'plpgsql';
        
        DROP TRIGGER IF EXISTS "set_${name}_updated_at" ON "${name}";
        
        CREATE TRIGGER "set_${name}_updated_at"
        BEFORE UPDATE ON "${name}"
        FOR EACH ROW
        EXECUTE FUNCTION "update_${name}_updated_at"();
      `;
      
      console.log(`Generated SQL for table ${name}:`);
      
      // Execute the SQL using Supabase Edge Function or direct database access
      console.log('Executing SQL to create table...');
      const { data, error } = await this.supabase.rpc('execute_sql', { sql_query: sql });
      
      if (error) {
        console.error(`Error executing SQL for table ${name}:`, error);
        return { success: false, message: error.message };
      }
      
      console.log(`Table ${name} creation response:`, data);
      
      // If we have foreign keys to add, do it in a separate step
      if (foreignKeys.length > 0) {
        console.log(`Adding ${foreignKeys.length} foreign key constraints for table ${name}`);
        
        for (const fk of foreignKeys) {
          // Create a separate ALTER TABLE statement for each foreign key
          const fkSql = `
            -- Add foreign key constraint
            DO $$
            BEGIN
              -- Make sure the referenced table exists before adding constraint
              IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = '${fk.targetTable.toLowerCase()}'
              ) THEN
                -- Add the constraint
                ALTER TABLE "${name}" 
                ADD CONSTRAINT "fk_${name}_${fk.sourceColumn}" 
                FOREIGN KEY ("${fk.sourceColumn}") 
                REFERENCES "${fk.targetTable}" ("${fk.targetColumn}")
                ON DELETE CASCADE;
              ELSE
                RAISE NOTICE 'Referenced table ${fk.targetTable} does not exist, skipping foreign key';
              END IF;
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Error adding foreign key constraint: %', SQLERRM;
            END $$;
          `;
          
          // Execute the foreign key addition
          const { data: fkData, error: fkError } = await this.supabase.rpc('execute_sql', { 
            sql_query: fkSql 
          });
          
          if (fkError) {
            console.warn(`Warning: Could not add foreign key constraint:`, fkError);
            // Don't fail the whole operation, just log the warning
          }
        }
      }
      
      // Double-check if the table exists
      try {
        const { count, error: verifyError } = await this.supabase
          .from(name)
          .select('*', { count: 'exact', head: true });
          
        if (verifyError) {
          console.error(`Table ${name} verification failed:`, verifyError);
          
          // Try verifying with SQL instead
          try {
            const { data: sqlData, error: sqlError } = await this.supabase.rpc('execute_sql', {
              sql_query: `SELECT EXISTS (SELECT FROM information_schema.tables 
                          WHERE table_schema = 'public' AND table_name = '${name.toLowerCase()}') as exists;`
            });
            
            if (sqlError || !sqlData || !sqlData[0] || !sqlData[0].exists) {
              return { success: false, message: `Table verification failed: Table does not exist` };
            }
            
            console.log(`✅ Table ${name} verified via SQL check`);
            return { success: true };
          } catch (sqlCheckError) {
            console.error(`SQL verification check failed:`, sqlCheckError);
            return { success: false, message: `Table verification failed: ${verifyError.message}` };
          }
        } else {
          console.log(`✅ Table ${name} verified successfully`);
          return { success: true };
        }
      } catch (verifyError) {
        console.error(`Error verifying table ${name}:`, verifyError);
        return { success: false, message: `Table verification error: ${verifyError.message}` };
      }
    } catch (error) {
      console.error(`Unexpected error creating table ${tableSchema.name}:`, error);
      return { success: false, message: error.message };
    }
  }

  async _createRelationship(sourceTable, targetTable, type, sourceColumn, targetColumn) {
    try {
      // Ensure table names are lowercase for consistency
      const sourceTableLower = sourceTable.toLowerCase();
      const targetTableLower = targetTable.toLowerCase();
      
      // Generate relationship SQL
      const relationshipSQL = this._generateRelationshipSQL(
        sourceTableLower,
        targetTableLower,
        type,
        sourceColumn,
        targetColumn
      );
      
      // Check if both tables exist before trying to create relationship
      const tablesExistSQL = `
        SELECT 
          (SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND 
                  table_name = '${sourceTableLower}'
          )) as source_exists,
          (SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND 
                  table_name = '${targetTableLower}'
          )) as target_exists;
      `;
      
      const { data: tableCheck, error: tableCheckError } = await this.supabase.rpc('execute_sql', { 
        sql_query: tablesExistSQL 
      });
      
      if (tableCheckError || !tableCheck) {
        console.error(`Error checking table existence for relationship:`, tableCheckError || 'No data returned');
        return { success: false, message: 'Error checking table existence' };
      }
      
      const sourceExists = tableCheck[0]?.source_exists === true;
      const targetExists = tableCheck[0]?.target_exists === true;
      
      if (!sourceExists || !targetExists) {
        console.error(`Cannot create relationship - source exists: ${sourceExists}, target exists: ${targetExists}`);
        return { 
          success: false, 
          message: `Cannot create relationship - missing tables. Source: ${sourceExists ? 'exists' : 'missing'}, Target: ${targetExists ? 'exists' : 'missing'}`
        };
      }
      
      // Both tables exist, proceed with creating the relationship
      console.log(`Creating relationship between ${sourceTableLower}.${sourceColumn} and ${targetTableLower}.${targetColumn}`);
      
      return await this._executeSql(
        relationshipSQL, 
        `Creating relationship between ${sourceTableLower} and ${targetTableLower}`
      );
    } catch (error) {
      console.error(`Error creating relationship:`, error);
      return { success: false, message: error.message };
    }
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
        sql_query: sql
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
    
    // Track foreign keys for separate handling
    const foreignKeys = [];
    
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
              // Extract foreign key constraints for later processing
              else if (constraint.toLowerCase().includes('foreign key')) {
                const fkMatch = constraint.match(/foreign\s+key\s+references\s+([^\s(]+)(\(([^)]+)\))?/i);
                if (fkMatch) {
                  const targetTable = fkMatch[1];
                  const targetColumn = fkMatch[3] || 'id';
                  foreignKeys.push({
                    sourceColumn: column.name,
                    targetTable: targetTable,
                    targetColumn: targetColumn
                  });
                }
              }
              // Handle normal constraints
              else {
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
          // Extract foreign key constraints for later processing
          else if (constraintStr.toLowerCase().includes('foreign key')) {
            const fkMatch = constraintStr.match(/foreign\s+key\s+references\s+([^\s(]+)(\(([^)]+)\))?/i);
            if (fkMatch) {
              const targetTable = fkMatch[1];
              const targetColumn = fkMatch[3] || 'id';
              foreignKeys.push({
                sourceColumn: column.name,
                targetTable: targetTable,
                targetColumn: targetColumn
              });
            }
          }
          // Add other constraints
          else {
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
    
    // Add foreign key constraints if any
    const fkConstraints = foreignKeys.map(fk => {
      // Extract table prefix from fullTableName
      const tableNameParts = fullTableName.split('_');
      const prefix = tableNameParts.slice(0, 2).join('_') + '_';
      
      // Make sure target table has proper prefix
      let targetTable = fk.targetTable;
      if (!targetTable.includes(prefix)) {
        targetTable = prefix + targetTable;
      }
      
      return `CONSTRAINT "fk_${fk.sourceColumn}_${targetTable}" FOREIGN KEY ("${fk.sourceColumn}") REFERENCES "${targetTable}" ("${fk.targetColumn}") ON DELETE CASCADE`;
    });
    
    // Combine column definitions and foreign key constraints
    const allDefinitions = [...columnDefinitions];
    if (fkConstraints.length > 0) {
      allDefinitions.push(...fkConstraints);
    }
    
    // Create the table
    sql += `CREATE TABLE "${fullTableName}" (\n  ${allDefinitions.join(',\n  ')}\n);\n\n`;
    
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
    // Ensure all names are lowercase for consistency
    sourceTable = sourceTable.toLowerCase();
    targetTable = targetTable.toLowerCase();
    
    // Use quoted identifiers and clean names
    const constraintName = `fk_${sourceTable.replace(/[^a-zA-Z0-9_]/g, '_')}_${sourceColumn}_${targetTable.replace(/[^a-zA-Z0-9_]/g, '_')}`.toLowerCase();
    
    // Debug
    console.log(`Creating FK: ${sourceTable}.${sourceColumn} -> ${targetTable}.${targetColumn}`);
    
    // First check if the column exists, and add it if it doesn't
    let sql = `
-- First check if both tables exist and add column if needed
DO $$
BEGIN
    -- Ensure tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${sourceTable}') AND 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${targetTable}') THEN
       
        -- Check if the column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = '${sourceTable}' AND column_name = '${sourceColumn.toLowerCase()}') THEN
            -- Add the column if it doesn't exist
            EXECUTE 'ALTER TABLE "${sourceTable}" ADD COLUMN "${sourceColumn}" uuid NOT NULL';
        END IF;
        
        -- Add the foreign key constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = '${constraintName}') THEN
            BEGIN
                ALTER TABLE "${sourceTable}" 
                ADD CONSTRAINT "${constraintName}" 
                FOREIGN KEY ("${sourceColumn}") 
                REFERENCES "${targetTable}" ("${targetColumn}") 
                ON DELETE CASCADE;
                
                RAISE NOTICE 'Added foreign key constraint: ${constraintName}';
            EXCEPTION WHEN others THEN
                RAISE NOTICE 'Error adding foreign key constraint: %', SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'Tables not found. Source: % or Target: % does not exist', '${sourceTable}', '${targetTable}';
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
  async generateSchemasWithoutCreating(analysisResult, XAuthUserId = 'default', apiIdentifier = null) {
    try {
      // Generate a unique API identifier if not provided
      const effectiveApiId = apiIdentifier || Math.random().toString(36).substring(2, 8);
      
      // Make a deep copy of the tables to avoid modifying the original
      const tablesData = JSON.parse(JSON.stringify(analysisResult.tables));
      
      // Process tables for API generation without creating them in the database
      const processedTables = await Promise.all(tablesData.map(async table => {
        // Add XAuthUserId column if needed
        table = await this._addXAuthUserIdColumnIfNeeded(table);
        
        // Add XAuthUserId AND API identifier prefix to table name for reference
        const prefixedTableName = `${XAuthUserId}_${effectiveApiId}_${table.name}`;
        
        // Return table with original name and prefixed name
        return {
          name: table.name,
          originalName: table.name,
          prefixedName: prefixedTableName,
          columns: table.columns,
          relationships: (table.relationships || []).map(rel => ({
            ...rel,
            // Update target table reference for consistency
            targetTable: rel.targetTable
          }))
        };
      }));
      
      return processedTables;
    } catch (error) {
      console.error("Error processing schemas without creating:", error);
      throw error;
    }
  }
}

module.exports = new SchemaGenerator(); 
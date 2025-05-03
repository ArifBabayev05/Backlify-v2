const mistralService = require('../services/mistralService');
const schemaGenerator = require('../services/schemaGenerator');
const apiGenerator = require('../services/apiGenerator');
const apiPublisher = require('../services/apiPublisher');

class APIGeneratorController {
  constructor() {
    this.generatedApis = new Map();
    // Add a mapping to track APIs by XAuthUserId
    this.userApiMapping = new Map();
  }

  // Helper method to generate SQL
  generateSQL(tables, XAuthUserId, apiIdentifier = null) {
    // Generate a unique API identifier if not provided
    const effectiveApiId = apiIdentifier || Math.random().toString(36).substring(2, 8);
    
    let sql = `-- Generated SQL for Backlify API
-- Generated at: ${new Date().toISOString()}
-- User: ${XAuthUserId}
-- API Identifier: ${effectiveApiId}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

    // First create all tables without relationships
    tables.forEach(schema => {
      // Add XAuthUserId AND API identifier to table name
      const tableName = `${XAuthUserId}_${effectiveApiId}_${schema.name}`;
      const modifiedSchema = {...schema, name: tableName};
      
      sql += this.generateTableSQL(modifiedSchema, XAuthUserId);
      sql += '\n\n';
    });

    // Then add all foreign key constraints
    tables.forEach(schema => {
      if (schema.relationships && schema.relationships.length > 0) {
        // Add XAuthUserId AND API identifier to table name for relationships
        const tableName = `${XAuthUserId}_${effectiveApiId}_${schema.name}`;
        const modifiedSchema = {
          ...schema, 
          name: tableName,
          relationships: schema.relationships.map(rel => ({
            ...rel,
            targetTable: `${XAuthUserId}_${effectiveApiId}_${rel.targetTable}`
          }))
        };
        
        sql += this.generateRelationshipsSQL(modifiedSchema);
        sql += '\n\n';
      }
    });

    // Add sample data for each table
    sql += `-- Insert sample data\n`;
    tables.forEach(schema => {
      // Add XAuthUserId AND API identifier to table name for sample data
      const tableName = `${XAuthUserId}_${effectiveApiId}_${schema.name}`;
      const modifiedSchema = {...schema, name: tableName};
      
      // Make sure to pass the XAuthUserId to sample data generation
      sql += this.generateSampleDataSQL(modifiedSchema, XAuthUserId);
      sql += '\n\n';
    });

    return sql;
  }

  // Generate table SQL without relationships
  generateTableSQL(tableSchema, XAuthUserId) {
    const { name, columns, relationships = [] } = tableSchema;
    const fullTableName = name;

    // Generate column definitions
    const columnDefs = columns.map(col => {
      // Extract foreign key declarations for separate handling
      let colString = `    ${col.name} ${col.type}`;
      
      // Convert any array constraints to string
      let constraints = Array.isArray(col.constraints) 
        ? col.constraints.join(' ') 
        : (col.constraints || '');
      
      // Remove any inline foreign key definitions from constraints
      constraints = constraints.replace(/foreign\s+key\s+references\s+[^\s,)]+(\([^\s,)]+\))?/gi, '').trim();
      
      // Add the cleaned constraints
      if (constraints) {
        colString += ` ${constraints}`;
      }
      
      return colString.trim();
    });

    // Add timestamps if not present
    if (!columns.find(col => col.name === 'created_at')) {
      columnDefs.push('    created_at timestamp with time zone DEFAULT now()');
    }
    if (!columns.find(col => col.name === 'updated_at')) {
      columnDefs.push('    updated_at timestamp with time zone DEFAULT now()');
    }
    
    // Check if XAuthUserId column exists, if not add it
    if (!columns.find(col => col.name === 'XAuthUserId')) {
      columnDefs.push('    "XAuthUserId" varchar(255) NOT NULL');
    }

    // Process foreign keys separately as constraints
    const foreignKeyDefs = [];
    if (relationships && relationships.length > 0) {
      relationships.forEach(rel => {
        if (rel.sourceColumn && rel.targetTable && rel.targetColumn) {
          // Make sure target table has proper prefix
          let targetTable = rel.targetTable;
          if (!targetTable.includes(`${XAuthUserId}_`)) {
            const tableParts = targetTable.split('_');
            const originalTableName = tableParts[tableParts.length - 1];
            targetTable = `${XAuthUserId}_${rel.apiIdentifier || tableSchema.apiIdentifier || name.split('_')[1]}_${originalTableName}`;
          }
          
          // Properly quote identifiers to prevent syntax errors
          foreignKeyDefs.push(`    CONSTRAINT "fk_${rel.sourceColumn}_${rel.targetTable.replace(/[^a-zA-Z0-9_]/g, '_')}" FOREIGN KEY ("${rel.sourceColumn}") REFERENCES "${targetTable}"("${rel.targetColumn}") ON DELETE CASCADE`);
        }
      });
    }

    // Combine all definitions
    const allDefs = [...columnDefs];
    
    // Add foreign key constraints if any
    if (foreignKeyDefs.length > 0) {
      allDefs.push(...foreignKeyDefs);
    }

    return `
-- Create table: ${fullTableName}
CREATE TABLE IF NOT EXISTS ${fullTableName} (
${allDefs.join(',\n')}
);

-- Create updated_at trigger for ${fullTableName}
CREATE OR REPLACE FUNCTION update_modified_column_${fullTableName}() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_${fullTableName} ON ${fullTableName};

CREATE TRIGGER set_timestamp_${fullTableName}
BEFORE UPDATE ON ${fullTableName}
FOR EACH ROW
EXECUTE FUNCTION update_modified_column_${fullTableName}();
`;
  }

  // Generate relationships SQL
  generateRelationshipsSQL(tableSchema) {
    const { name, relationships } = tableSchema;
    let sql = `-- Add relationships for table: ${name}\n`;
    
    relationships.forEach(rel => {
      const constraintName = `fk_${name}_${rel.sourceColumn}_${rel.targetTable}`;
      sql += `ALTER TABLE ${name} ADD CONSTRAINT ${constraintName} `;
      sql += `FOREIGN KEY (${rel.sourceColumn}) REFERENCES ${rel.targetTable}(${rel.targetColumn}) ON DELETE CASCADE;\n`;
    });
    
    return sql;
  }

  // Generate sample data SQL
  generateSampleDataSQL(tableSchema, XAuthUserId) {
    const { name, columns } = tableSchema;
    let sql = `-- Insert sample data into ${name}\n`;
    
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
        // Use the provided XAuthUserId
        columnValues[col.name] = `'${XAuthUserId}'`;
      } else if (col.name === 'id' && col.name.endsWith('_id')) {
        // This is likely a foreign key, we'll handle it specially
        const targetTable = col.name.replace('_id', '');
        columnValues[col.name] = `(SELECT id FROM ${targetTable} LIMIT 1)`;
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
    
    // Create the insert statement
    const columnNames = Object.keys(columnValues).filter(name => 
      !name.includes('id') || !['serial', 'bigserial'].includes(columns.find(c => c.name === name)?.type)
    );
    
    const values = columnNames.map(name => columnValues[name]);
    
    if (columnNames.length > 0) {
      sql += `INSERT INTO ${name} (${columnNames.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }

  async generateAPI(req, res) {
    try {
      const { prompt, XAuthUserId = 'default' } = req.body;
      
      // Generate a unique API identifier for this specific API instance
      const apiIdentifier = Math.random().toString(36).substring(2, 8);
      
      console.log(`Generating API for prompt: "${prompt}" and user: ${XAuthUserId} with identifier: ${apiIdentifier}`);
      
      // Analyze prompt with Mistral AI
      console.log('Analyzing prompt with Mistral AI...');
      const analysisResult = await mistralService.analyzeRequest(prompt);
      
      // Generate database schema
      console.log('Generating database schema...');
      const createdTables = await schemaGenerator.generateSchemas(analysisResult, XAuthUserId);
      
      // Ensure all tables are properly prefixed with XAuthUserId AND API identifier
      createdTables.forEach(table => {
        // Store the original name for reference
        table.originalName = table.name;
        // Set the prefixed name that will be used in the database
        table.prefixedName = `${XAuthUserId}_${apiIdentifier}_${table.name}`;
        
        // For relationships, ensure they point to prefixed tables
        if (table.relationships && Array.isArray(table.relationships)) {
          table.relationships.forEach(rel => {
            // Store original target table
            rel.originalTargetTable = rel.targetTable;
            // Update target table to use the prefixed name with API identifier
            rel.targetTable = `${XAuthUserId}_${apiIdentifier}_${rel.targetTable}`;
          });
        }
      });
      
      // Deep clone the tables to prevent any shared references
      const safeTableSchemas = JSON.parse(JSON.stringify(createdTables));
      
      // Create API endpoints with isolated schemas
      console.log('Creating API endpoints...');
      const router = apiGenerator.generateEndpoints(safeTableSchemas, XAuthUserId);
      
      // Generate SQL using the apiIdentifier
      const sql = this.generateSQL(safeTableSchemas, XAuthUserId, apiIdentifier);
      
      // Create isolated metadata
      const safeMetadata = {
        prompt,
        XAuthUserId,
        apiIdentifier,
        tables: safeTableSchemas,
        createdAt: new Date().toISOString()
      };
      
      // Publish API with safe metadata
      console.log('Publishing API...');
      const apiId = apiPublisher.publishAPI(router, safeMetadata);
      
      // Store in memory for quick access - use a deep clone
      this.generatedApis.set(apiId, JSON.parse(JSON.stringify({
        prompt,
        XAuthUserId,
        apiIdentifier,
        tables: safeTableSchemas,
        apiId,
        sql: sql || analysisResult.sql || ''
      })));
      
      // Add to user API mapping
      if (!this.userApiMapping.has(XAuthUserId)) {
        this.userApiMapping.set(XAuthUserId, new Set());
      }
      this.userApiMapping.get(XAuthUserId).add(apiId);
      
      res.json({
        message: 'API created successfully',
        apiId,
        documentation: `/api/${apiId}/docs`,
        swagger: `/api/${apiId}/swagger.json`,
        tables: safeTableSchemas.map(t => t.originalName || t.name)
      });
    } catch (error) {
      console.error('Error generating API:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Add method to regenerate API
  async regenerateAPI(metadata) {
    try {
      // Create a brand new deep clone of metadata
      const safeMetadata = JSON.parse(JSON.stringify(metadata));
      
      // Get XAuthUserId and tables from metadata
      const XAuthUserId = safeMetadata.XAuthUserId || 'default';
      const tables = safeMetadata.tables || [];
      
      // Do any additional processing here
            
      // Generate a new router with fresh state
      const router = apiGenerator.generateEndpoints(tables, XAuthUserId);
      
      // Publish the API with original metadata
      const apiId = apiPublisher.publishAPI(router, safeMetadata);
      
      return {
        message: 'API regenerated successfully',
        apiId,
        metadata: safeMetadata
      };
    } catch (error) {
      console.error('Error regenerating API:', error);
      throw error;
    }
  }

  // Generate database schema from prompt - improved method for better handling of complex relationships
  async generateDatabaseSchema(prompt, XAuthUserId = 'default') {
    try {
      console.log(`Generating schema for prompt: "${prompt}" and user: ${XAuthUserId}`);
      
      // Analyze prompt with Mistral AI
      console.log('Analyzing prompt with Mistral AI...');
      const analysisResult = await mistralService.analyzeRequest(prompt);
      
      // Validate and enhance relationships
      console.log('Validating and enhancing relationships...');
      this._validateAndEnhanceRelationships(analysisResult.tables);
      
      // Generate database schema WITHOUT creating tables in Supabase
      console.log('Generating database schema without creating tables...');
      const processedTables = await schemaGenerator.generateSchemasWithoutCreating(analysisResult, XAuthUserId);
      
      // Log the tables structure for debugging
      console.log(`Generated ${processedTables.length} tables for schema`);
      console.log('Table names:', processedTables.map(t => t.name || t.originalName).join(', '));
      
      // Ensure we return the complete table structure with columns
      if (processedTables.length > 0 && (!processedTables[0].columns || !Array.isArray(processedTables[0].columns))) {
        console.warn('Tables missing column definitions, attempting to extract from analysis result');
        
        // Try to get complete table definitions from the analysis result
        if (analysisResult.tables && Array.isArray(analysisResult.tables)) {
          return JSON.parse(JSON.stringify(analysisResult.tables));
        }
        
        // If unable to find column definitions, create a placeholder structure
        // This should not happen in production, but provides a fallback for testing
        return processedTables.map(table => {
          const tableName = table.originalName || table.name;
          return {
            name: tableName,
            columns: [
              {
                name: "id",
                type: "uuid",
                constraints: ["PRIMARY KEY", "DEFAULT uuid_generate_v4()"]
              },
              {
                name: "name",
                type: "varchar(255)",
                constraints: ["NOT NULL"]
              },
              {
                name: "description",
                type: "text",
                constraints: []
              },
              {
                name: "created_at",
                type: "timestamp with time zone",
                constraints: ["DEFAULT now()"]
              },
              {
                name: "updated_at",
                type: "timestamp with time zone",
                constraints: ["DEFAULT now()"]
              }
            ],
            relationships: []
          };
        });
      }
      
      // Deep clone the tables to prevent any shared references
      return JSON.parse(JSON.stringify(processedTables));
    } catch (error) {
      console.error('Error generating database schema from prompt:', error);
      throw error;
    }
  }
  
  // Helper method to validate and enhance relationships in the schema
  _validateAndEnhanceRelationships(tables) {
    if (!tables || !Array.isArray(tables)) return;
    
    // Step 1: Identify tables that might have multiple instances (addresses, contacts)
    const addressTables = tables.filter(t => 
      t.name && (
        t.name.toLowerCase().includes('address') || 
        t.name.toLowerCase().includes('location')
      )
    );
    
    const contactTables = tables.filter(t => 
      t.name && (
        t.name.toLowerCase().includes('contact') || 
        t.name.toLowerCase().includes('phone') ||
        t.name.toLowerCase().includes('email')
      )
    );
    
    // Step 2: Check if these tables have proper foreign keys to their parent entities
    const entityTables = tables.filter(t => 
      t.name && !(
        t.name.toLowerCase().includes('address') ||
        t.name.toLowerCase().includes('location') ||
        t.name.toLowerCase().includes('contact') ||
        t.name.toLowerCase().includes('phone') ||
        t.name.toLowerCase().includes('email')
      )
    );
    
    // Step 3: Fix address tables if needed
    addressTables.forEach(addressTable => {
      const hasEntityReference = addressTable.columns && addressTable.columns.some(col => 
        col.name && (
          col.name.includes('_id') || 
          col.name === 'entity_id'
        )
      );
      
      // If there's no entity reference, add a polymorphic association
      if (!hasEntityReference && addressTable.columns) {
        console.log(`Adding entity reference columns to ${addressTable.name}`);
        
        // Add entity_type and entity_id columns for polymorphic association
        addressTable.columns.push({
          name: "entity_type",
          type: "varchar(50)",
          constraints: ["NOT NULL"],
          description: "Type of entity (e.g., teacher, student, employer)"
        });
        
        addressTable.columns.push({
          name: "entity_id",
          type: "uuid",
          constraints: ["NOT NULL"],
          description: "ID of the entity this address belongs to"
        });
        
        // Add an index for these columns
        if (!addressTable.indexes) {
          addressTable.indexes = [];
        }
        
        addressTable.indexes.push({
          name: `idx_${addressTable.name}_entity`,
          columns: ["entity_type", "entity_id"]
        });
      }
    });
    
    // Step 4: Fix contact tables if needed - similar approach
    contactTables.forEach(contactTable => {
      const hasEntityReference = contactTable.columns && contactTable.columns.some(col => 
        col.name && (
          col.name.includes('_id') || 
          col.name === 'entity_id'
        )
      );
      
      // If there's no entity reference, add a polymorphic association
      if (!hasEntityReference && contactTable.columns) {
        console.log(`Adding entity reference columns to ${contactTable.name}`);
        
        // Add entity_type and entity_id columns for polymorphic association
        contactTable.columns.push({
          name: "entity_type",
          type: "varchar(50)",
          constraints: ["NOT NULL"],
          description: "Type of entity (e.g., teacher, student, employer)"
        });
        
        contactTable.columns.push({
          name: "entity_id",
          type: "uuid",
          constraints: ["NOT NULL"],
          description: "ID of the entity this contact belongs to"
        });
        
        // Also add contact_type if it doesn't exist
        const hasContactType = contactTable.columns.some(col => 
          col.name && (
            col.name === 'type' ||
            col.name === 'contact_type'
          )
        );
        
        if (!hasContactType) {
          contactTable.columns.push({
            name: "contact_type",
            type: "varchar(50)",
            constraints: ["NOT NULL"],
            description: "Type of contact (e.g., email, phone, etc.)"
          });
        }
        
        // Add an index for these columns
        if (!contactTable.indexes) {
          contactTable.indexes = [];
        }
        
        contactTable.indexes.push({
          name: `idx_${contactTable.name}_entity`,
          columns: ["entity_type", "entity_id"]
        });
      }
    });
    
    // Step 5: Ensure all relationships are properly defined
    tables.forEach(table => {
      if (table.relationships && Array.isArray(table.relationships)) {
        // Validate each relationship
        table.relationships.forEach(rel => {
          // Ensure target table exists
          const targetTable = tables.find(t => t.name === rel.targetTable);
          if (!targetTable) {
            console.warn(`Warning: Relationship target table ${rel.targetTable} not found`);
          }
          
          // If this is a many-to-one relationship, ensure the foreign key column exists in this table
          if (rel.type === 'many-to-one' || rel.type === 'many_to_one') {
            const foreignKeyColumn = table.columns && table.columns.find(col => 
              col.name === rel.sourceColumn || col.name === `${rel.targetTable}_id`
            );
            
            if (!foreignKeyColumn && table.columns) {
              console.log(`Adding missing foreign key ${rel.targetTable}_id to ${table.name}`);
              table.columns.push({
                name: `${rel.targetTable}_id`,
                type: "uuid",
                constraints: []
              });
            }
          }
        });
      }
    });
  }
  
  // Modify an existing database schema based on a prompt
  async modifyDatabaseSchema(prompt, existingTables, XAuthUserId = 'default') {
    try {
      console.log(`Modifying schema for prompt: "${prompt}" and user: ${XAuthUserId}`);
      console.log(`Existing tables: ${existingTables.length}`);
      
      // Deep clone existing tables to ensure we don't mutate the originals
      const clonedExistingTables = JSON.parse(JSON.stringify(existingTables));
      
      // Create a more structured description of the existing schema
      const tableDescriptions = clonedExistingTables.map(table => {
        const columnDescriptions = table.columns.map(col => {
          const constraints = Array.isArray(col.constraints)
            ? col.constraints.join(', ')
            : (typeof col.constraints === 'string' ? col.constraints : '');
          
          return `${col.name} (${col.type}${constraints ? ' ' + constraints : ''})`;
        }).join(', ');
        
        // Add relationship descriptions
        let relationshipsDesc = '';
        if (table.relationships && table.relationships.length > 0) {
          relationshipsDesc = '\n      Relationships: ' + table.relationships.map(rel => {
            return `${rel.type} to ${rel.targetTable} (${rel.sourceColumn} -> ${rel.targetColumn})`;
          }).join(', ');
        }
        
        return `- Table "${table.name}" with columns: ${columnDescriptions}${relationshipsDesc}`;
      }).join('\n');
      
      // Create an enhanced prompt including the existing schema
      const enhancedPrompt = `
EXISTING SCHEMA:
${tableDescriptions}

MODIFICATION REQUEST:
${prompt}

Please modify the existing schema based on the modification request. Return the complete updated schema with all tables.
`;
      
      // Analyze enhanced prompt with Mistral AI
      console.log('Analyzing modification prompt with Mistral AI...');
      const analysisResult = await mistralService.analyzeSchemaModification(enhancedPrompt, clonedExistingTables);
      
      // Extract the modified schema
      console.log('Processing modified schema...');
      
      // If the AI service returns complete tables, use them directly
      if (analysisResult.tables && Array.isArray(analysisResult.tables) && analysisResult.tables.length > 0) {
        // Ensure each table has the required properties and preserve original data where needed
        const processedTables = analysisResult.tables.map(modifiedTable => {
          // Find the original table if it exists
          const originalTable = clonedExistingTables.find(t => t.name === modifiedTable.name);
          
          // Initialize normalized table with critical properties
          const normalizedTable = {
            name: modifiedTable.name,
            originalName: modifiedTable.originalName || modifiedTable.name,
            columns: modifiedTable.columns || [],
            relationships: modifiedTable.relationships || []
          };
          
          // If we had a prefixed name in the original table, preserve it
          if (originalTable && originalTable.prefixedName) {
            normalizedTable.prefixedName = originalTable.prefixedName;
          }
          
          // For each relationship, ensure proper format and references
          if (normalizedTable.relationships && normalizedTable.relationships.length > 0) {
            normalizedTable.relationships = normalizedTable.relationships.map(rel => {
              // Find original relationship if exists
              const matchingOriginalRel = originalTable ? 
                (originalTable.relationships || []).find(origRel => 
                  origRel.targetTable === rel.targetTable && 
                  origRel.type === rel.type
                ) : null;
              
              // Create normalized relationship
              const normalizedRel = {
                targetTable: rel.targetTable,
                type: rel.type || 'many-to-one',  // Default to many-to-one if not specified
                sourceColumn: rel.sourceColumn,
                targetColumn: rel.targetColumn || 'id'  // Default to id for target column
              };
              
              // If original relationship exists, fill in missing fields from it
              if (matchingOriginalRel) {
                normalizedRel.targetTable = normalizedRel.targetTable || matchingOriginalRel.targetTable;
                normalizedRel.type = normalizedRel.type || matchingOriginalRel.type;
                normalizedRel.sourceColumn = normalizedRel.sourceColumn || matchingOriginalRel.sourceColumn;
                normalizedRel.targetColumn = normalizedRel.targetColumn || matchingOriginalRel.targetColumn;
                
                // Preserve original target table if it was prefixed
                if (matchingOriginalRel.originalTargetTable) {
                  normalizedRel.originalTargetTable = matchingOriginalRel.originalTargetTable;
                }
              }
              
              // Ensure source column exists - if not, derive it based on relationship type
              if (!normalizedRel.sourceColumn) {
                if (normalizedRel.type === 'many-to-one') {
                  // For many-to-one, use targetTable_id as the column name
                  const targetTableName = normalizedRel.targetTable.split('_').pop();
                  normalizedRel.sourceColumn = `${targetTableName}_id`;
                } else {
                  // For one-to-many, use 'id' as the source column
                  normalizedRel.sourceColumn = 'id';
                }
              }
              
              return normalizedRel;
            });
          }
          
          return normalizedTable;
        });
        
        // Handle possible missing tables from the original schema that should be preserved
        const modifiedTableNames = new Set(processedTables.map(table => table.name));
        
        // Add tables that exist in the original schema but not in the modified schema
        clonedExistingTables.forEach(originalTable => {
          if (!modifiedTableNames.has(originalTable.name)) {
            console.log(`Table ${originalTable.name} from original schema not modified by AI, adding it back`);
            processedTables.push({...originalTable});
          }
        });
        
        console.log(`Modified schema contains ${processedTables.length} tables`);
        return processedTables;
      }
      
      // Fallback: If the AI didn't return a complete schema, use schemaGenerator
      console.log('Generating modified schema using schema generator...');
      const processedTables = await schemaGenerator.generateSchemasWithoutCreating(analysisResult, XAuthUserId);
      
      // Check if we got valid tables back
      if (!processedTables || !Array.isArray(processedTables) || processedTables.length === 0) {
        console.warn('Failed to generate modified schema, returning original schema');
        return clonedExistingTables;
      }
      
      return processedTables;
    } catch (error) {
      console.error('Error modifying database schema:', error);
      // Return original tables as fallback in case of error
      return existingTables;
    }
  }
  
  // Helper function to ensure consistent table naming
  standardizeTableName(userId, apiId, tableName) {
    // Always use lowercase for table names to avoid PostgreSQL case sensitivity issues
    return `${userId}_${apiId}_${tableName}`.toLowerCase();
  }

  // Generate API from provided schema - new method for separate endpoint
  async generateAPIFromSchema(tables, XAuthUserId = 'default') {
    try {
      // Generate a unique API identifier for this specific API instance
      const apiIdentifier = Math.random().toString(36).substring(2, 8);
      
      console.log(`Generating API from provided schema for user: ${XAuthUserId} with identifier: ${apiIdentifier}`);
      
      // Ensure we have a deep clone of the tables
      const safeTableSchemas = JSON.parse(JSON.stringify(tables));
      
      // Update all tables with proper prefixing including the API identifier
      safeTableSchemas.forEach(table => {
        // Store the original name for reference
        table.originalName = table.name;
        // Set the prefixed name that will be used in the database with API identifier - using lowercase
        table.prefixedName = this.standardizeTableName(XAuthUserId, apiIdentifier, table.name);
        
        // For relationships, ensure they point to prefixed tables
        if (table.relationships && Array.isArray(table.relationships)) {
          table.relationships.forEach(rel => {
            // Store original target table
            rel.originalTargetTable = rel.targetTable;
            // Update target table to use the prefixed name with API identifier
            rel.targetTable = this.standardizeTableName(XAuthUserId, apiIdentifier, rel.targetTable);
          });
        }
      });
      
      console.log('Creating tables in Supabase...');
      
      // Create a fake analysis result that matches what schemaGenerator.generateSchemas expects
      const fakeAnalysisResult = {
        tables: safeTableSchemas.map(table => {
          // Make sure relationships are properly formatted
          if (table.relationships && !Array.isArray(table.relationships)) {
            table.relationships = [table.relationships];
          } else if (!table.relationships) {
            table.relationships = [];
          }
          
          return {
            ...table,
            // Ensure name is original (without XAuthUserId prefix)
            name: table.originalName || table.name
          };
        })
      };
      
      // Try to create tables - if standard approach fails, try alternative methods
      let createdTables = [];
      let allTablesExist = false;
      const schemaGenerator = require('../services/schemaGenerator');
      const config = require('../config/config');
      const { createClient } = require('@supabase/supabase-js');
      
      // Method 1: Try the standard approach first (with foreign keys handled properly)
      try {
        console.log("Attempt 1: Standard table creation approach...");
        createdTables = await schemaGenerator.generateSchemas(fakeAnalysisResult, XAuthUserId, apiIdentifier);
        
        // Verify tables exist
        allTablesExist = await this.verifyAllTablesExist(createdTables);
        
        if (allTablesExist) {
          console.log("Standard approach successful - all tables created properly");
        } else {
          console.warn("Standard approach failed - some tables are missing. Trying alternative approach...");
        }
      } catch (err) {
        console.error("Error with standard table creation:", err.message);
        allTablesExist = false;
      }
      
      // Method 2: If standard approach failed, try creating tables without foreign keys first
      if (!allTablesExist) {
        try {
          console.log("Attempt 2: Creating tables without foreign keys first...");
          
          // Temporarily remove relationships
          const tablesWithoutRelationships = fakeAnalysisResult.tables.map(table => ({
            ...table,
            relationships: [] // Remove relationships temporarily
          }));
          
          // Create tables without foreign keys
          const simplifiedAnalysisResult = { tables: tablesWithoutRelationships };
          
          // Create basic tables first
          createdTables = await schemaGenerator.generateSchemas(simplifiedAnalysisResult, XAuthUserId, apiIdentifier);
          
          // Now add foreign keys manually using SQL
          console.log("Tables created without relationships. Now adding foreign keys manually...");
          const client = createClient(config.supabase.url, config.supabase.key);
          
          // Process each table's relationships
          for (const table of fakeAnalysisResult.tables) {
            if (!table.relationships || !Array.isArray(table.relationships) || table.relationships.length === 0) {
              continue;
            }
            
            const sourcePrefixedTable = this.standardizeTableName(XAuthUserId, apiIdentifier, table.name);
            
            for (const rel of table.relationships) {
              try {
                const targetTable = this.standardizeTableName(XAuthUserId, apiIdentifier, rel.originalTargetTable || rel.targetTable.split('_').pop());
                
                console.log(`Adding foreign key for ${sourcePrefixedTable}.${rel.sourceColumn} -> ${targetTable}`);
                
                // Create SQL for the foreign key
                const constraintName = `fk_${sourcePrefixedTable}_${rel.sourceColumn}_${targetTable}`.toLowerCase();
                const sql = `
                  DO $$
                  BEGIN
                    IF NOT EXISTS (
                      SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = '${constraintName}'
                    ) THEN
                      ALTER TABLE "${sourcePrefixedTable}" 
                      ADD CONSTRAINT "${constraintName}" 
                      FOREIGN KEY ("${rel.sourceColumn}") 
                      REFERENCES "${targetTable}" ("${rel.targetColumn || 'id'}") 
                      ON DELETE CASCADE;
                    END IF;
                  EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'Error adding constraint %: %', '${constraintName}', SQLERRM;
                  END $$;
                `;
                
                // Execute the SQL
                const { error } = await client.rpc('execute_sql', { sql_query: sql });
                if (error) {
                  console.warn(`Warning: Could not add foreign key constraint:`, error.message);
                }
              } catch (relError) {
                console.warn(`Warning: Failed to add relationship:`, relError.message);
              }
            }
          }
          
          // Verify all tables exist
          allTablesExist = await this.verifyAllTablesExist(createdTables);
          
          if (allTablesExist) {
            console.log("Alternative approach successful - created tables and added foreign keys separately");
          } else {
            console.warn("Alternative approach partially successful - some tables may be missing");
          }
        } catch (alternativeError) {
          console.error("Error with alternative table creation:", alternativeError.message);
        }
      }
      
      // Method 3: Last resort - direct SQL execution for each table
      if (!allTablesExist) {
        try {
          console.log("Attempt 3: Direct SQL execution for each table...");
          const client = createClient(config.supabase.url, config.supabase.key);
          
          // Track created tables
          const directlyCreatedTables = [];
          
          // Create each table using direct SQL
          for (const table of fakeAnalysisResult.tables) {
            try {
              // IMPORTANT: Consistently use lowercase for table names to avoid case sensitivity issues
              const originalName = table.name;
              const prefixedTableName = this.standardizeTableName(XAuthUserId, apiIdentifier, originalName);
              
              // Log the standardized naming
              console.log(`Creating table with standardized lowercase name: ${prefixedTableName}`);
              
              // Generate basic table SQL without foreign keys
              const sql = `
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
                
                DROP TABLE IF EXISTS "${prefixedTableName}" CASCADE;
                
                CREATE TABLE "${prefixedTableName}" (
                  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                  ${table.columns
                    .filter(col => col.name !== 'id')
                    .map(col => `"${col.name}" ${col.type}${col.constraints ? ' ' + (Array.isArray(col.constraints) ? col.constraints.join(' ') : col.constraints).replace(/references\s+[^\s,)]+(\([^\s,)]+\))?/gi, '') : ''}`.trim())
                    .join(',\n                  ')
                  }${table.columns.some(col => col.name === 'created_at') ? '' : ',\n                  "created_at" timestamp with time zone DEFAULT now()'}${table.columns.some(col => col.name === 'updated_at') ? '' : ',\n                  "updated_at" timestamp with time zone DEFAULT now()'}${table.columns.some(col => col.name === 'XAuthUserId') ? '' : ',\n                  "XAuthUserId" varchar(255)'}
                );
              `;
              
              const { error } = await client.rpc('execute_sql', { sql_query: sql });
              
              if (!error) {
                console.log(`Successfully created table ${prefixedTableName} using direct SQL`);
                directlyCreatedTables.push({
                  prefixedName: prefixedTableName,
                  originalName: originalName,
                  name: originalName
                });
              } else {
                console.error(`Failed to create table ${prefixedTableName} with direct SQL:`, error);
              }
            } catch (tableError) {
              console.error(`Error creating table ${table.name}:`, tableError.message);
            }
          }
          
          // Override createdTables with our directly created ones
          if (directlyCreatedTables.length > 0) {
            createdTables = directlyCreatedTables;
            // Final verification
            allTablesExist = await this.verifyAllTablesExist(createdTables);
          }
          
          if (allTablesExist) {
            console.log("Direct SQL approach successful");
          } else {
            console.warn("All approaches failed to create all tables");
          }
        } catch (directError) {
          console.error("Error with direct SQL table creation:", directError.message);
        }
      }
      
      // If we still don't have all tables, throw error
      if (!allTablesExist) {
        throw new Error(`Failed to create all required tables despite multiple approaches. Tables may be partially created.`);
      }
      
      // Create API endpoints with isolated schemas
      console.log('Creating API endpoints...');
      const router = apiGenerator.generateEndpoints(safeTableSchemas, XAuthUserId, apiIdentifier);
      
      // Generate SQL for the tables
      const sql = this.generateSQL(safeTableSchemas, XAuthUserId, apiIdentifier);
      
      // Create metadata with all necessary information
      const safeMetadata = {
        XAuthUserId,
        apiIdentifier,
        tables: safeTableSchemas,
        createdAt: new Date().toISOString(),
        sql: sql, // Include the SQL in the metadata
        prompt: 'Created from schema', // Add a default prompt
      };
      
      // Publish API with complete metadata
      console.log('Publishing API...');
      const apiId = apiPublisher.publishAPI(router, safeMetadata);
      
      // Store in memory for quick access - use a deep clone
      const apiObject = {
        XAuthUserId,
        tables: safeTableSchemas,
        apiId,
        sql: sql,
        prompt: safeMetadata.prompt,
        createdAt: safeMetadata.createdAt,
        router: router // Include router reference
      };
      
      this.generatedApis.set(apiId, apiObject);
      
      // Add to user API mapping
      if (!this.userApiMapping.has(XAuthUserId)) {
        this.userApiMapping.set(XAuthUserId, new Set());
      }
      this.userApiMapping.get(XAuthUserId).add(apiId);
      
      console.log(`API ${apiId} successfully generated and stored for user ${XAuthUserId}`);
      
      // Return information about the created API
      return {
        apiId,
        endpoints: safeTableSchemas.map(t => ({
          table: t.originalName || t.name,
          routes: [
            { method: 'GET', path: `/${t.name}` },
            { method: 'GET', path: `/${t.name}/:id` },
            { method: 'POST', path: `/${t.name}` },
            { method: 'PUT', path: `/${t.name}/:id` },
            { method: 'DELETE', path: `/${t.name}/:id` }
          ]
        }))
      };
    } catch (error) {
      console.error('Error generating API from schema:', error);
      throw error;
    }
  }
  
  // Helper method to verify all tables exist
  async verifyAllTablesExist(tables) {
    try {
      console.log(`Verifying existence of ${tables.length} tables...`);
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      const client = createClient(config.supabase.url, config.supabase.key);
      
      // Track which tables we've verified
      const tableStatus = [];
      
      // Check each table
      for (const table of tables) {
        // Get the table name, ensuring consistent case
        let tableName;
        if (table.prefixedName) {
          // Use the existing prefixed name, but ensure it's lowercase
          tableName = table.prefixedName.toLowerCase();
        } else if (table.XAuthUserId && table.apiIdentifier) {
          // Generate the name using our standardization function
          tableName = this.standardizeTableName(table.XAuthUserId, table.apiIdentifier, table.originalName || table.name);
        } else {
          // Fallback - just lowercase the name we have
          tableName = (table.prefixedName || table.name).toLowerCase();
        }
        
        console.log(`Verifying table: ${tableName}`);
        
        let tableExists = false;
        let errorMessage = null;
        
        // Method 1: Direct query using from().select()
        try {
          const { data, error } = await client
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            tableExists = true;
            console.log(`✅ Table ${tableName} verified successfully through direct query`);
          } else {
            errorMessage = error.message;
            console.log(`Direct query check failed: ${error.message}, trying alternative methods...`);
          }
        } catch (err) {
          errorMessage = err.message;
          console.log(`Error in direct query check: ${err.message}`);
        }
        
        // Method 2: Check using information_schema query with case-insensitive matching
        if (!tableExists) {
          try {
            const { data, error } = await client.rpc('execute_sql', { 
              sql_query: `
                SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_schema = 'public' 
                  AND lower(table_name) = '${tableName}'
                ) as exists;
              `
            });
            
            if (!error && data && data[0] && data[0].exists === true) {
              tableExists = true;
              console.log(`✅ Table ${tableName} verified through information_schema (case-insensitive)`);
            } else if (error) {
              errorMessage = (errorMessage || "") + "; " + error.message;
              console.log(`Information schema check failed: ${error.message}`);
            } else {
              console.log(`Table ${tableName} not found in information_schema`);
            }
          } catch (err) {
            errorMessage = (errorMessage || "") + "; " + err.message;
            console.log(`Error in information_schema check: ${err.message}`);
          }
        }
        
        // Method 3: Try a broader search for similarly named tables
        if (!tableExists) {
          try {
            // Look for tables with similar names (to debug case sensitivity issues)
            const { data, error } = await client.rpc('execute_sql', {
              sql_query: `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name ILIKE '%${tableName.split('_').pop()}%';
              `
            });
            
            if (!error && data && data.length > 0) {
              console.log(`Found similar tables: ${data.map(row => row.table_name).join(', ')}`);
              
              // If we find an exact match with different case, consider it valid
              const exactMatchDifferentCase = data.find(row => 
                row.table_name.toLowerCase() === tableName.toLowerCase()
              );
              
              if (exactMatchDifferentCase) {
                tableExists = true;
                console.log(`✅ Table ${tableName} verified with different case: ${exactMatchDifferentCase.table_name}`);
              }
            }
          } catch (err) {
            console.log(`Error in similar name check: ${err.message}`);
          }
        }
        
        // Record the result
        tableStatus.push({
          table: table.originalName || table.name,
          prefixedName: tableName,
          exists: tableExists,
          error: errorMessage
        });
        
        // If any table doesn't exist, the overall result is false
        if (!tableExists) {
          console.error(`❌ Table ${tableName} does not exist`);
        }
      }
      
      // Log the overall status
      console.log("Table verification results:", tableStatus);
      
      // Check if all tables exist
      const allExist = tableStatus.every(status => status.exists);
      
      if (allExist) {
        console.log('✅ All tables verified successfully');
      } else {
        console.error('❌ Some tables are missing:', tableStatus.filter(s => !s.exists).map(s => s.prefixedName).join(', '));
      }
      
      return allExist;
    } catch (error) {
      console.error('Error verifying tables:', error);
      return false;
    }
  }

  getSQL(req, res) {
    const { apiId } = req.params;
    
    if (!this.generatedApis.has(apiId)) {
      return res.status(404).json({ error: 'API not found' });
    }
    
    const api = this.generatedApis.get(apiId);
    
    res.json({
      sql: api.sql
    });
  }

  // Add method to get all APIs for a specific user
  getUserAPIs(XAuthUserId) {
    const userApis = this.userApiMapping.get(XAuthUserId);
    if (!userApis) {
      return [];
    }
    
    return Array.from(userApis).map(apiId => {
      const api = this.generatedApis.get(apiId);
      if (!api) return null;
      
      // Return a deep clone to avoid shared references
      return JSON.parse(JSON.stringify({
        apiId,
        prompt: api.prompt,
        tables: api.tables?.map(t => t.originalName || t.name) || [],
        createdAt: api.createdAt || new Date().toISOString()
      }));
    }).filter(Boolean);
  }
}

// Export an instance, not the class
module.exports = new APIGeneratorController(); 
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
      // Convert any array constraints to string
      const constraints = Array.isArray(col.constraints) 
        ? col.constraints.join(' ') 
        : (col.constraints || '');
      return `    ${col.name} ${col.type} ${constraints}`.trim();
    });

    // Add timestamps if not present
    if (!columns.find(col => col.name === 'created_at')) {
      columnDefs.push('    created_at timestamp with time zone DEFAULT now()');
    }
    if (!columns.find(col => col.name === 'updated_at')) {
      columnDefs.push('    updated_at timestamp with time zone DEFAULT now()');
    }

    // Only include foreign keys if requested
    const allDefs = columnDefs;

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

  // Generate database schema from prompt - new method for separate endpoint
  async generateDatabaseSchema(prompt, XAuthUserId = 'default') {
    try {
      console.log(`Generating schema for prompt: "${prompt}" and user: ${XAuthUserId}`);
      
      // Analyze prompt with Mistral AI
      console.log('Analyzing prompt with Mistral AI...');
      const analysisResult = await mistralService.analyzeRequest(prompt);
      
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
                constraints: "PRIMARY KEY DEFAULT uuid_generate_v4()"
              },
              {
                name: "name",
                type: "varchar(255)",
                constraints: "NOT NULL"
              },
              {
                name: "description",
                type: "text",
                constraints: ""
              },
              {
                name: "created_at",
                type: "timestamp with time zone",
                constraints: "DEFAULT now()"
              },
              {
                name: "updated_at",
                type: "timestamp with time zone",
                constraints: "DEFAULT now()"
              }
            ],
            relationships: []
          };
        });
      }
      
      // Deep clone the tables to prevent any shared references
      return JSON.parse(JSON.stringify(processedTables));
    } catch (error) {
      console.error('Error generating database schema:', error);
      throw error;
    }
  }
  
  // Modify an existing database schema based on a prompt
  async modifyDatabaseSchema(prompt, existingTables, XAuthUserId = 'default') {
    try {
      console.log(`Modifying schema for prompt: "${prompt}" and user: ${XAuthUserId}`);
      console.log(`Existing tables: ${existingTables.length}`);
      
      // Create a modification context to inform the AI about the existing schema
      const tableDescriptions = existingTables.map(table => {
        const columnDescriptions = table.columns.map(col => 
          `${col.name} (${col.type}${col.constraints ? ' ' + col.constraints : ''})`
        ).join(', ');
        
        return `- Table "${table.name}" with columns: ${columnDescriptions}`;
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
      const analysisResult = await mistralService.analyzeSchemaModification(enhancedPrompt, existingTables);
      
      // Extract the modified schema
      console.log('Processing modified schema...');
      
      // If the AI service returns complete tables, use them directly
      if (analysisResult.tables && Array.isArray(analysisResult.tables) && analysisResult.tables.length > 0) {
        // Ensure each table has the required properties
        const processedTables = analysisResult.tables.map(table => {
          return {
            name: table.name,
            originalName: table.originalName || table.name,
            columns: table.columns || [],
            relationships: table.relationships || []
          };
        });
        
        console.log(`Modified schema contains ${processedTables.length} tables`);
        return JSON.parse(JSON.stringify(processedTables));
      }
      
      // Fallback: If the AI didn't return a complete schema, use schemaGenerator
      console.log('Generating modified schema using schema generator...');
      const processedTables = await schemaGenerator.generateSchemasWithoutCreating(analysisResult, XAuthUserId);
      
      // Check if we got valid tables back
      if (!processedTables || !Array.isArray(processedTables) || processedTables.length === 0) {
        console.warn('Failed to generate modified schema, returning original schema');
        return JSON.parse(JSON.stringify(existingTables));
      }
      
      // Deep clone the tables to prevent any shared references
      return JSON.parse(JSON.stringify(processedTables));
    } catch (error) {
      console.error('Error modifying database schema:', error);
      throw error;
    }
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
        // Set the prefixed name that will be used in the database with API identifier
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
      
      // First, create the tables in Supabase
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
      
      // Now create the tables in Supabase
      const createdTables = await schemaGenerator.generateSchemas(fakeAnalysisResult, XAuthUserId, apiIdentifier);
      console.log(`Created ${createdTables.length} tables in Supabase`);
      
      // Log all table names for debugging
      console.log('Tables created with prefix:');
      createdTables.forEach(table => {
        console.log(`- ${table.prefixedName}`);
      });
      
      // Create API endpoints with isolated schemas
      console.log('Creating API endpoints...');
      const router = apiGenerator.generateEndpoints(safeTableSchemas, XAuthUserId, apiIdentifier);
      
      // Verify the API identifier is being used consistently
      console.log(`API router created with identifier: ${router.apiIdentifier}`);
      
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
const mistralService = require('../services/mistralService');
const schemaGenerator = require('../services/schemaGenerator');
const apiGenerator = require('../services/apiGenerator');
const apiPublisher = require('../services/apiPublisher');

class APIGeneratorController {
  constructor() {
    this.generatedApis = new Map();
  }

  // Helper method to generate SQL
  generateSQL(tables, userId) {
    // Remove schema name prefix, use table name prefixes instead
    
    let sql = `-- Generated SQL for Backlify API
-- Generated at: ${new Date().toISOString()}
-- User: ${userId}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

    // First create all tables without relationships
    tables.forEach(schema => {
      // Add userId to table name
      const tableName = `${userId}_${schema.name}`;
      const modifiedSchema = {...schema, name: tableName};
      
      sql += this.generateTableSQL(modifiedSchema, userId);
      sql += '\n\n';
    });

    // Then add all foreign key constraints
    tables.forEach(schema => {
      if (schema.relationships && schema.relationships.length > 0) {
        // Add userId to table name for relationships
        const tableName = `${userId}_${schema.name}`;
        const modifiedSchema = {
          ...schema, 
          name: tableName,
          relationships: schema.relationships.map(rel => ({
            ...rel,
            targetTable: `${userId}_${rel.targetTable}`
          }))
        };
        
        sql += this.generateRelationshipsSQL(modifiedSchema);
        sql += '\n\n';
      }
    });

    // Add sample data for each table
    sql += `-- Insert sample data\n`;
    tables.forEach(schema => {
      // Add userId to table name for sample data
      const tableName = `${userId}_${schema.name}`;
      const modifiedSchema = {...schema, name: tableName};
      
      sql += this.generateSampleDataSQL(modifiedSchema, userId);
      sql += '\n\n';
    });

    return sql;
  }

  // Generate table SQL without relationships
  generateTableSQL(tableSchema, userId) {
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
  generateSampleDataSQL(tableSchema) {
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
      const { prompt, userId = 'default' } = req.body;
      
      console.log(`Generating API for prompt: "${prompt}" and user: ${userId}`);
      
      // Analyze prompt with Mistral AI
      console.log('Analyzing prompt with Mistral AI...');
      const analysisResult = await mistralService.analyzeRequest(prompt);
      
      // Generate database schema
      console.log('Generating database schema...');
      const createdTables = await schemaGenerator.generateSchemas(analysisResult, userId);
      
      // Create API endpoints
      console.log('Creating API endpoints...');
      const router = apiGenerator.generateEndpoints(createdTables, userId);
      
      // Publish API
      console.log('Publishing API...');
      const apiId = apiPublisher.publishAPI(router, {
        prompt,
        userId,
        tables: createdTables,
        createdAt: new Date().toISOString()
      });
      
      // Store in memory for quick access
      this.generatedApis.set(apiId, {
        prompt,
        userId,
        tables: createdTables,
        apiId,
        sql: analysisResult.sql || ''
      });
      
      res.json({
        message: 'API created successfully',
        apiId,
        documentation: `/api/${apiId}/docs`,
        swagger: `/api/${apiId}/swagger.json`,
        tables: createdTables.map(t => t.originalName || t.name)
      });
    } catch (error) {
      console.error('Error generating API:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Add method to regenerate API
  async regenerateAPI(metadata) {
    try {
      const { prompt, userId, tables } = metadata;
      
      // Validate tables data
      if (!tables || !Array.isArray(tables)) {
        console.error('Invalid tables data for API regeneration:', tables);
        return null;
      }
      
      console.log(`Regenerating API for prompt: "${prompt}" and user: ${userId}`);
      
      // Ensure each table has the required properties
      const validTables = tables.filter(table => {
        // Each table must have a name and columns
        return table && table.name && table.columns && Array.isArray(table.columns);
      });
      
      if (validTables.length === 0) {
        console.error('No valid tables found in metadata');
        return null;
      }
      
      console.log(`Found ${validTables.length} valid tables to restore`);
      
      // Create API endpoints from valid tables
      console.log('Recreating API endpoints...');
      const router = apiGenerator.generateEndpoints(validTables, userId);
      
      return router;
    } catch (error) {
      console.error('Error regenerating API:', error);
      return null;
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
}

// Export the class itself, not an instance
module.exports = APIGeneratorController; 
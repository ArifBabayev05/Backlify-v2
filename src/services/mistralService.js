const axios = require('axios');
const config = require('../config/config');

class MistralService {
  constructor() {
    this.apiKey = config.mistral.apiKey;
    this.model = config.mistral.model || 'mistral-small-latest';
    this.apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    this.timeout = 30000; // 30 seconds timeout
  }

  async generateCompletion(systemPrompt, userPrompt) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Mistral AI API error:', error.response?.data || error.message);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('Mistral AI request timed out');
      }
      
      throw new Error(`Mistral AI completion failed: ${error.message}`);
    }
  }

  async interpretPrompt(prompt) {
    try {
      const systemPrompt = `You are a database schema expert that designs optimal PostgreSQL database schemas.

Your task is to analyze the user's request and generate a complete database schema design in JSON format.

Output must be in this JSON structure: 
{
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type",
          "constraints": ["constraint1", "constraint2"]
        }
      ],
      "relationships": [
        {
          "targetTable": "target_table",
          "type": "one-to-many",
          "sourceColumn": "source_column",
          "targetColumn": "target_column"
        }
      ]
    }
  ]
}

IMPORTANT RULES FOR SCHEMA DESIGN:
1. Return ONLY the raw JSON without any markdown formatting.
2. Always include timestamp columns (created_at, updated_at) for each table.
3. Make sure each table has an "id" column with "primary key" constraint.
4. Use PostgreSQL data types: uuid, varchar(255), text, integer, timestamp, etc.
5. For varchar, ALWAYS include the size specification like varchar(255).
6. DO NOT include "references" or "on delete" in constraints - use the relationships array instead.
7. For constraints, use ONLY simple strings like: "primary key", "unique", "not null", "default now()".
8. NEVER put objects like {"default value": "something"} inside constraint arrays - use "default something" format instead.

RULES FOR HANDLING RELATIONSHIPS:
1. For one-to-many relationships, the foreign key should be placed in the "many" side table.
2. For many-to-many relationships, create a junction table with foreign keys to both related tables.
3. When an entity can have multiple of something (addresses, contact details, etc.), place the foreign key in the child table.
4. Always clearly identify the parent-child relationship in table naming.
5. Use a consistent approach for polymorphic associations when needed (entity_type + entity_id pattern).

RELATIONSHIP PATTERNS TO USE:
1. One-to-Many: Add foreign key column in the "many" table pointing to the "one" table (e.g., user_id in posts table).
2. Many-to-Many: Create a junction table (e.g., user_roles) with foreign keys to both tables.
3. Multiple instances of same entity type (e.g., multiple addresses): Create a separate table with foreign key pointing back to owner.
4. Polymorphic associations (when same table relates to multiple entity types): Use entity_type and entity_id columns.

ALWAYS CHECK YOUR SCHEMA FOR:
1. Missing foreign keys needed for relationships
2. Proper handling of one-to-many and many-to-many relationships
3. Correct targeting of foreign keys (they should be in the "child" tables)
4. Consistency in naming patterns
5. Proper handling of multiple instances of same entity type (addresses, contacts, etc.)`;

      // Enhanced prompt with additional guide for multi-entity associations
      let enhancedPrompt = prompt;
      if (prompt.toLowerCase().includes('address') || 
          prompt.toLowerCase().includes('contact') || 
          prompt.toLowerCase().includes('multiple')) {
        enhancedPrompt += `\n\nNote: If entities have multiple addresses or contact details, create separate tables for addresses and contacts with foreign keys pointing back to the main entity. For example, a 'users' table would have a one-to-many relationship with an 'addresses' table containing a user_id column.`;
      }

      if (prompt.toLowerCase().includes('teacher') && prompt.toLowerCase().includes('student')) {
        enhancedPrompt += `\n\nNote: For related entities like teachers and students, clearly define the relationships between them. If multiple entities share common attributes (like addresses or contact details), consider using a polymorphic association pattern with entity_type and entity_id columns in the shared tables.`;
      }

      // Generate the completion with the enhanced prompt
      const jsonResponse = await this.generateCompletion(systemPrompt, enhancedPrompt);
      console.log('Raw Mistral schema generation response:', jsonResponse);
      
      // Clean the response and parse JSON
      let cleanedResponse = this._cleanMarkdownCodeBlocks(jsonResponse);
      
      try {
        const parsedResponse = JSON.parse(cleanedResponse);
        return this._normalizeResponse(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse Mistral response as JSON:', parseError);
        
        // Try to extract JSON from the text
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const potentialJson = jsonMatch[0];
          try {
            const extractedJson = JSON.parse(potentialJson);
            return this._normalizeResponse(extractedJson);
          } catch (extractError) {
            console.error('Failed to extract JSON from response:', extractError);
            
            // Additional fixes for common JSON issues
            console.log('Attempting to fix invalid JSON for schema modification...');
            
            // Fix 1: Try to find and fix problematic "default value": "X" patterns
            let fixedJson = potentialJson.replace(/("default value"\s*:\s*)"([^"]*)"/g, '$1"default $2"');
            
            // Fix 2: Replace any objects within arrays with string format
            fixedJson = fixedJson.replace(/\[([^\]]*{[^}]*}[^\]]*)\]/g, (match, content) => {
              // Convert objects in arrays to strings
              const fixedContent = content.replace(/{([^{}]*)}/g, '"$1"');
              return `[${fixedContent}]`;
            });
            
            // Fix 3: Try to repair missing commas between array items
            fixedJson = fixedJson.replace(/("[^"]*")\s+("[^"]*")/g, '$1, $2');
            
            try {
              const fixedJsonParsed = JSON.parse(fixedJson);
              console.log('Successfully fixed and parsed schema modification JSON');
              return this._normalizeResponse(fixedJsonParsed);
            } catch (fixError) {
              console.error('Still unable to parse schema modification JSON after fixes:', fixError);
              console.log('Falling back to original schema');
              // Return the original tables as fallback
              return { tables: existingTables };
            }
          }
        }
        
        // Return the original tables as fallback
        console.log('Unable to extract valid JSON, returning original schema');
        return { tables: existingTables };
      }
    } catch (error) {
      console.error('Mistral schema modification error:', error);
      // Return the original tables as fallback
      return { tables: existingTables };
    }
  }
  
  _normalizeResponse(response) {
    if (!response.tables || !Array.isArray(response.tables)) {
      throw new Error('Invalid response structure: missing tables array');
    }
    
    // Process each table
    response.tables = response.tables.map(table => {
      // Ensure columns exist
      if (!table.columns || !Array.isArray(table.columns)) {
        table.columns = [];
      }
      
      // Normalize columns and constraints
      table.columns = table.columns.map(col => {
        // Ensure constraints are always an array
        if (!col.constraints) {
          col.constraints = [];
        } else if (typeof col.constraints === 'string') {
          // Split string constraints into array
          col.constraints = col.constraints.split(',').map(c => c.trim());
        } else if (Array.isArray(col.constraints)) {
          // Clean up any non-string values in constraints array
          col.constraints = col.constraints.map(constraint => {
            if (typeof constraint === 'object' && constraint !== null) {
              // Convert object constraints to string format (e.g., {default value: 'now()'} -> 'default now()')
              return Object.entries(constraint)
                .map(([key, value]) => `${key} ${value}`)
                .join(' ');
            }
            return constraint;
          });
        }
        
        // Filter out potentially dangerous SQL references in constraints
        col.constraints = col.constraints.filter(constraint => {
          if (!constraint) return false;
          
          // Remove any SQL references that might trigger security checks
          return !(/references\s+\w+\s*\(.*\)/i.test(constraint) || 
                  /references/i.test(constraint) ||
                  /on\s+delete/i.test(constraint) ||
                  /on\s+update/i.test(constraint));
        });
        
        // Normalize data types to be SQL injection safe
        if (col.type) {
          // Ensure varchar has a size specification
          if (col.type === 'varchar' || col.type === 'character varying') {
            col.type = 'varchar(255)';
          }
          
          // Make sure data types don't contain SQL strings
          col.type = col.type.replace(/\(\s*\d+\s*,\s*\d+\s*\)/, ''); // Remove precision/scale
          
          // Fix common data types
          const typeMap = {
            'varchar': 'varchar(255)',
            'char': 'char(255)',
            'int': 'integer',
            'number': 'numeric',
            'bool': 'boolean',
            'date': 'date',
            'datetime': 'timestamp'
          };
          
          if (typeMap[col.type]) {
            col.type = typeMap[col.type];
          }
        }
        
        return col;
      });
      
      // Ensure relationships exist
      if (!table.relationships) {
        table.relationships = [];
      } else if (!Array.isArray(table.relationships)) {
        table.relationships = [table.relationships];
      }
      
      // Normalize relationship types
      table.relationships = table.relationships.map(rel => {
        // Create a normalized relationship object
        const normalizedRel = { ...rel };
        
        // Ensure all required fields exist
        if (!normalizedRel.targetTable) {
          console.warn(`Missing targetTable in relationship for ${table.name}, skipping`);
          return null;
        }
        
        // Ensure sourceColumn exists, default to 'id' for one-to-many
        if (!normalizedRel.sourceColumn) {
          if (normalizedRel.type === 'one-to-many') {
            normalizedRel.sourceColumn = 'id';
          } else {
            // For many-to-one, if sourceColumn is missing, use targetTable + '_id'
            normalizedRel.sourceColumn = `${normalizedRel.targetTable.split('_').pop()}_id`;
          }
          console.log(`Added missing sourceColumn: ${normalizedRel.sourceColumn} to relationship`);
        }
        
        // Ensure targetColumn exists, default to 'id' or source table + '_id'
        if (!normalizedRel.targetColumn) {
          if (normalizedRel.type === 'many-to-one') {
            normalizedRel.targetColumn = 'id';
          } else {
            normalizedRel.targetColumn = `${table.name}_id`;
          }
          console.log(`Added missing targetColumn: ${normalizedRel.targetColumn} to relationship`);
        }
        
        // Normalize relationship type
        if (normalizedRel.type) {
          normalizedRel.type = normalizedRel.type.toLowerCase();
          
          const typeMap = {
            'belongs_to': 'many-to-one',
            'has_many': 'one-to-many',
            'has_one': 'one-to-one',
            'belongs_to_many': 'many-to-many'
          };
          
          if (typeMap[normalizedRel.type]) {
            normalizedRel.type = typeMap[normalizedRel.type];
          }
        } else {
          // Default to many-to-one if no type specified
          normalizedRel.type = 'many-to-one';
          console.log(`Added missing relationship type: many-to-one to relationship`);
        }
        
        // Clean up targetTable name if it contains SQL references
        if (normalizedRel.targetTable.includes('(') || normalizedRel.targetTable.includes(')')) {
          normalizedRel.targetTable = normalizedRel.targetTable.replace(/\([^)]*\)/g, '').trim();
        }
        
        return normalizedRel;
      }).filter(rel => rel !== null); // Remove any null relationships
      
      // Remove indexes if they exist - they'll be handled by relationships
      delete table.indexes;
      
      return table;
    });
    
    return response;
  }
  
  _cleanMarkdownCodeBlocks(text) {
    let cleaned = text.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*$/g, '');
    cleaned = cleaned.replace(/```/g, '');
    
    // Fix common JSON format errors that Mistral might introduce
    // Fix "default value": "CURRENT_TIMESTAMP" inside arrays which is not valid JSON
    cleaned = cleaned.replace(/"default value":\s*"([^"]*)"/g, '"default $1"');
    
    return cleaned.trim();
  }

  async analyzeRequest(prompt) {
    try {
      const result = await this.interpretPrompt(prompt);
      return result;
    } catch (error) {
      throw new Error(`Failed to analyze request: ${error.message}`);
    }
  }

  async analyzeSchemaModification(prompt, existingTables) {
    try {
      const systemPrompt = `You are a database schema expert that modifies existing database schemas based on user requests.

Your task is to analyze an existing schema and modify it according to the user's instructions.
The user will provide the existing schema and their modification request.

Output should be in JSON format with the following structure: 
{
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type",
          "constraints": ["constraint1", "constraint2"]
        }
      ],
      "relationships": [
        {
          "targetTable": "target_table",
          "type": "one-to-many",
          "sourceColumn": "source_column",
          "targetColumn": "target_column"
        }
      ]
    }
  ]
}

IMPORTANT NOTES:
1. Return ONLY the raw JSON without any markdown formatting.
2. Always include timestamp columns (created_at, updated_at) for each table.
3. Make sure each table has an "id" column with "primary key" constraint.
4. Use PostgreSQL data types: uuid, varchar(255), text, integer, timestamp, etc.
5. For varchar, ALWAYS include the size specification like varchar(255).
6. Keep the existing schema structure unless explicitly requested to modify it.
7. Maintain existing relationships unless they conflict with new changes.
8. DO NOT include "references" or "on delete" in constraints - use the relationships array instead.
9. For constraints, use ONLY simple strings like: "primary key", "unique", "not null", "default now()".
10. NEVER put objects like {"default value": "something"} inside constraint arrays - use "default something" format instead.`;
      
      // Provide the existing schema as context
      const existingSchemaJson = JSON.stringify(existingTables, null, 2);
      const enhancedPrompt = `${prompt}\n\nExisting schema for reference (in JSON format):\n${existingSchemaJson}`;
      
      const jsonResponse = await this.generateCompletion(systemPrompt, enhancedPrompt);
      console.log('Raw Mistral schema modification response:', jsonResponse);
      
      // Clean the response and parse JSON
      let cleanedResponse = this._cleanMarkdownCodeBlocks(jsonResponse);
      
      try {
        const parsedResponse = JSON.parse(cleanedResponse);
        return this._normalizeResponse(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse Mistral response as JSON:', parseError);
        
        // Try to extract JSON from the text
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const potentialJson = jsonMatch[0];
          try {
            const extractedJson = JSON.parse(potentialJson);
            return this._normalizeResponse(extractedJson);
          } catch (extractError) {
            console.error('Failed to extract JSON from response:', extractError);
            
            // Additional fixes for common JSON issues
            console.log('Attempting to fix invalid JSON for schema modification...');
            
            // Fix 1: Try to find and fix problematic "default value": "X" patterns
            let fixedJson = potentialJson.replace(/("default value"\s*:\s*)"([^"]*)"/g, '$1"default $2"');
            
            // Fix 2: Replace any objects within arrays with string format
            fixedJson = fixedJson.replace(/\[([^\]]*{[^}]*}[^\]]*)\]/g, (match, content) => {
              // Convert objects in arrays to strings
              const fixedContent = content.replace(/{([^{}]*)}/g, '"$1"');
              return `[${fixedContent}]`;
            });
            
            // Fix 3: Try to repair missing commas between array items
            fixedJson = fixedJson.replace(/("[^"]*")\s+("[^"]*")/g, '$1, $2');
            
            try {
              const fixedJsonParsed = JSON.parse(fixedJson);
              console.log('Successfully fixed and parsed schema modification JSON');
              return this._normalizeResponse(fixedJsonParsed);
            } catch (fixError) {
              console.error('Still unable to parse schema modification JSON after fixes:', fixError);
              console.log('Falling back to original schema');
              // Return the original tables as fallback
              return { tables: existingTables };
            }
          }
        }
        
        // Return the original tables as fallback
        console.log('Unable to extract valid JSON, returning original schema');
        return { tables: existingTables };
      }
    } catch (error) {
      console.error('Mistral schema modification error:', error);
      // Return the original tables as fallback
      return { tables: existingTables };
    }
  }

  /**
   * Generate a simple fallback schema when JSON parsing fails
   * @param {string} prompt - The original user prompt
   * @returns {object} A minimal valid schema structure
   */
  _generateFallbackSchema(prompt) {
    console.log('Generating fallback schema for prompt:', prompt);
    
    // Extract potential table names from the prompt
    const words = prompt.toLowerCase().split(/\s+/);
    const commonWords = ['a', 'an', 'the', 'and', 'or', 'with', 'for', 'system', 'application', 'app'];
    const potentialTableNames = words
      .filter(word => word.length > 3)
      .filter(word => !commonWords.includes(word))
      .map(word => word.replace(/[^a-z0-9]/g, ''));
    
    // Use at most 3 unique potential table names
    const uniqueTableNames = [...new Set(potentialTableNames)].slice(0, 3);
    
    // If no potential table names found, use generic ones
    const tableNames = uniqueTableNames.length > 0 
      ? uniqueTableNames 
      : ['items', 'users', 'categories'];
    
    // Generate a simple schema with basic tables
    return {
      tables: tableNames.map(name => ({
        name,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            constraints: ['primary key', 'default uuid_generate_v4()']
          },
          {
            name: 'name',
            type: 'varchar(255)',
            constraints: ['not null']
          },
          {
            name: 'description',
            type: 'text',
            constraints: []
          },
          {
            name: 'created_at',
            type: 'timestamp',
            constraints: ['not null', 'default now()']
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            constraints: ['not null', 'default now()']
          }
        ],
        relationships: []
      }))
    };
  }
}

module.exports = new MistralService(); 
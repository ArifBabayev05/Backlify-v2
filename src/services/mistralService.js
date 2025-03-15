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
      const systemPrompt = `You are a backend architect that converts natural language descriptions into database schemas and API endpoints. 

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
4. Use PostgreSQL data types (uuid, varchar, text, integer, timestamp, etc.).
5. Include appropriate indexes and foreign key constraints.`;
      
      const userPrompt = `Generate a database schema and API endpoints for: ${prompt}`;
      
      const jsonResponse = await this.generateCompletion(systemPrompt, userPrompt);
      console.log('Raw Mistral response:', jsonResponse);
      
      // Clean the response and parse JSON
      const cleanedResponse = this._cleanMarkdownCodeBlocks(jsonResponse);
      
      try {
        const parsedResponse = JSON.parse(cleanedResponse);
        return this._normalizeResponse(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse Mistral response as JSON:', parseError);
        
        // Try to extract JSON from the text
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            return this._normalizeResponse(extractedJson);
          } catch (extractError) {
            console.error('Failed to extract JSON from response:', extractError);
            throw new Error('Failed to parse Mistral AI response as JSON');
          }
        }
        throw new Error('Failed to parse Mistral AI response as JSON');
      }
    } catch (error) {
      console.error('Mistral interpretation error:', error);
      throw new Error(`AI interpretation failed: ${error.message}`);
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
      
      // Ensure relationships exist
      if (!table.relationships) {
        table.relationships = [];
      } else if (!Array.isArray(table.relationships)) {
        table.relationships = [table.relationships];
      }
      
      // Normalize relationship types
      table.relationships = table.relationships.map(rel => {
        if (rel.type) {
          rel.type = rel.type.toLowerCase();
          
          const typeMap = {
            'belongs_to': 'many-to-one',
            'has_many': 'one-to-many',
            'has_one': 'one-to-one',
            'belongs_to_many': 'many-to-many'
          };
          
          if (typeMap[rel.type]) {
            rel.type = typeMap[rel.type];
          }
        }
        
        return rel;
      });
      
      return table;
    });
    
    return response;
  }
  
  _cleanMarkdownCodeBlocks(text) {
    let cleaned = text.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*$/g, '');
    cleaned = cleaned.replace(/```/g, '');
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
}

module.exports = new MistralService(); 
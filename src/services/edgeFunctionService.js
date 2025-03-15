const axios = require('axios');
const config = require('../config/config');

class EdgeFunctionService {
  constructor() {
    // Get the project reference from the Supabase URL
    const match = config.supabase.url.match(/https:\/\/([^.]+)\.supabase\.co/);
    this.projectRef = match ? match[1] : null;
    this.supabaseKey = config.supabase.key;
  }

  async createTables(schemaDefinition) {
    try {
      if (!this.projectRef || !this.supabaseKey) {
        throw new Error('Missing Supabase configuration');
      }
      
      const functionUrl = `https://${this.projectRef}.supabase.co/functions/v1/create-tables`;
      
      const response = await axios({
        method: 'post',
        url: functionUrl,
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          tables: schemaDefinition.tables
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Edge Function error:', error.message);
      throw new Error(`Failed to create tables: ${error.message}`);
    }
  }
}

module.exports = new EdgeFunctionService(); 
const axios = require('axios');

class SupabaseManagementService {
  constructor() {
    this.baseUrl = 'https://api.supabase.io/v1';
    this.token = process.env.SUPABASE_MANAGEMENT_KEY;
    this.organizationId = process.env.SUPABASE_ORG_ID;
    this.projectRef = this.extractProjectRef(process.env.SUPABASE_URL);
  }

  extractProjectRef(url) {
    // Extract project ref from URL (e.g., https://tiobwgnujrkhfotxdtdc.supabase.co)
    const match = url && url.match ? url.match(/https:\/\/([^.]+)\.supabase\.co/) : null;
    return match ? match[1] : null;
  }

  async createTable(tableDefinition) {
    try {
      if (!this.token || !this.organizationId || !this.projectRef) {
        throw new Error('Missing required configuration for Supabase Management API');
      }
      
      const { name, columns } = tableDefinition;
      
      // Format columns for the Management API
      const formattedColumns = columns.map(col => {
        return {
          name: col.name,
          type: col.type,
          isNullable: !(col.constraints || '').includes('not null'),
          isPrimaryKey: (col.constraints || '').includes('primary key'),
          isUnique: (col.constraints || '').includes('unique'),
          defaultValue: this.extractDefault(col.constraints)
        };
      });
      
      // Add timestamp columns if not present
      if (!columns.find(col => col.name === 'created_at')) {
        formattedColumns.push({
          name: 'created_at',
          type: 'timestamp with time zone',
          isNullable: false,
          defaultValue: 'now()'
        });
      }
      
      if (!columns.find(col => col.name === 'updated_at')) {
        formattedColumns.push({
          name: 'updated_at',
          type: 'timestamp with time zone',
          isNullable: false,
          defaultValue: 'now()'
        });
      }
      
      // Make the API request using axios
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/projects/${this.projectRef}/tables`,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        data: {
          name,
          schema: 'public',
          columns: formattedColumns
        }
      });
      
      console.log(`Table ${name} created successfully via Management API`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create table ${tableDefinition.name}:`, error.message);
      throw new Error(`Management API failed: ${error.message}`);
    }
  }
  
  extractDefault(constraints) {
    if (!constraints) return null;
    
    const defaultMatch = Array.isArray(constraints) 
      ? constraints.find(c => c.includes('default'))
      : constraints.includes('default') ? constraints : null;
      
    if (!defaultMatch) return null;
    
    const match = defaultMatch.match(/default\s+(.+?)($|\s)/i);
    return match ? match[1] : null;
  }
  
  async addForeignKey(sourceTable, sourceColumn, targetTable, targetColumn) {
    try {
      if (!this.token || !this.projectRef) {
        throw new Error('Missing required configuration for Supabase Management API');
      }
      
      const constraintName = `fk_${sourceTable}_${sourceColumn}_${targetTable}`;
      
      // Make the API request to create foreign key using axios
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/projects/${this.projectRef}/database/relationships`,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: constraintName,
          source_schema: 'public',
          source_table: sourceTable,
          source_column: sourceColumn,
          target_schema: 'public',
          target_table: targetTable,
          target_column: targetColumn,
          on_delete: 'CASCADE'
        }
      });
      
      console.log(`Foreign key from ${sourceTable}.${sourceColumn} to ${targetTable}.${targetColumn} created`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create foreign key:`, error.message);
      throw new Error(`Management API failed: ${error.message}`);
    }
  }
}

module.exports = new SupabaseManagementService(); 
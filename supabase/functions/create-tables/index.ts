import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Create a Supabase client with the Admin key (service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )
    
    // Get the schema definition from the request
    const { tables } = await req.json()
    
    // Execute SQL to create tables
    const sql = generateSQL(tables)
    
    // Execute the SQL directly
    const { error } = await supabaseAdmin.rpc('execute_sql', { sql_query: sql })
    
    if (error) {
      console.error('SQL execution error:', error)
      throw new Error(`SQL execution failed: ${error.message}`)
    }
    
    return new Response(
      JSON.stringify({ success: true, message: 'Tables created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateSQL(tables) {
  let sql = `-- Generated SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`
  
  // First create all tables
  tables.forEach(table => {
    sql += generateTableSQL(table)
    sql += '\n\n'
  })
  
  // Then add foreign key relationships
  tables.forEach(table => {
    if (table.relationships && table.relationships.length > 0) {
      sql += generateRelationshipSQL(table)
      sql += '\n\n'
    }
  })
  
  // Finally add sample data
  tables.forEach(table => {
    sql += generateSampleDataSQL(table)
    sql += '\n\n'
  })
  
  return sql
}

function generateTableSQL(table) {
  const { name, columns } = table
  
  // Generate column definitions
  const columnDefs = columns.map(col => {
    const constraints = Array.isArray(col.constraints) 
      ? col.constraints.join(' ') 
      : (col.constraints || '')
    
    // Remove any references constraints for now (we'll add them separately)
    const cleanConstraints = constraints.replace(/references\s+\w+\s*\(\w+\)\s*on\s+delete\s+cascade/i, '')
    
    return `    ${col.name} ${col.type} ${cleanConstraints}`.trim()
  })
  
  // Add timestamps if not present
  if (!columns.find(col => col.name === 'created_at')) {
    columnDefs.push('    created_at timestamp with time zone DEFAULT now()')
  }
  if (!columns.find(col => col.name === 'updated_at')) {
    columnDefs.push('    updated_at timestamp with time zone DEFAULT now()')
  }
  
  return `
-- Create table: ${name}
DROP TABLE IF EXISTS ${name} CASCADE;

CREATE TABLE ${name} (
${columnDefs.join(',\n')}
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column_${name}() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_${name} ON ${name};

CREATE TRIGGER set_timestamp_${name}
BEFORE UPDATE ON ${name}
FOR EACH ROW
EXECUTE FUNCTION update_modified_column_${name}();
`
}

function generateRelationshipSQL(table) {
  const { name, relationships } = table
  let sql = `-- Add relationships for ${name}\n`
  
  relationships.forEach(rel => {
    const constraintName = `fk_${name}_${rel.sourceColumn}_${rel.targetTable}`
    sql += `ALTER TABLE ${name} ADD CONSTRAINT ${constraintName} `
    sql += `FOREIGN KEY (${rel.sourceColumn}) REFERENCES ${rel.targetTable}(${rel.targetColumn}) ON DELETE CASCADE;\n`
  })
  
  return sql
}

function generateSampleDataSQL(table) {
  const { name, columns, relationships = [] } = table
  let sql = `-- Add sample data for ${name}\n`
  
  // Skip columns that should be auto-generated
  const columnNames = columns
    .filter(col => !((col.name === 'id' && col.type.includes('serial')) || 
                     col.name === 'created_at' || 
                     col.name === 'updated_at'))
    .map(col => col.name)
  
  if (columnNames.length === 0) return ''
  
  // Generate values for each column
  const values = columnNames.map(colName => {
    const col = columns.find(c => c.name === colName)
    
    if (colName === 'id' && col.type.includes('uuid')) {
      return 'uuid_generate_v4()'
    } else if (col.type.includes('varchar') || col.type.includes('text')) {
      return `'Sample ${colName} for ${name}'`
    } else if (colName.endsWith('_id') && col.type.includes('uuid')) {
      // This is likely a foreign key
      const rel = relationships.find(r => r.sourceColumn === colName)
      if (rel) {
        return `(SELECT id FROM ${rel.targetTable} LIMIT 1)`
      }
      return 'uuid_generate_v4()'
    } else if (col.type.includes('int')) {
      return '1'
    } else if (col.type.includes('bool')) {
      return 'true'
    } else if (col.type.includes('json')) {
      return `'{}'::jsonb`
    } else if (col.type.includes('date') || col.type.includes('time')) {
      return 'now()'
    } else {
      return 'null'
    }
  })
  
  sql += `INSERT INTO ${name} (${columnNames.join(', ')}) VALUES (${values.join(', ')});\n`
  
  return sql
} 
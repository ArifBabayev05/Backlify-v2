// Follow-up with Supabase Edge Functions implementation if Management API fails
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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
    // Create a Supabase client with the Auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )
    
    // Get the schema definition from the request
    const { schema } = await req.json()
    
    // Execute SQL to create tables
    const sql = generateSQL(schema)
    const { error } = await supabaseClient.rpc('execute_sql', { sql })
    
    if (error) throw error
    
    return new Response(
      JSON.stringify({ success: true, message: 'Tables created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateSQL(schema) {
  let sql = `-- Generated SQL\n`
  
  // Generate SQL for each table
  schema.tables.forEach(table => {
    sql += generateTableSQL(table)
    sql += '\n\n'
  })
  
  return sql
}

function generateTableSQL(tableSchema) {
  const { name, columns, relationships = [] } = tableSchema
  
  // Generate column definitions
  const columnDefs = columns.map(col => {
    const constraints = Array.isArray(col.constraints) 
      ? col.constraints.join(' ') 
      : (col.constraints || '')
    return `    ${col.name} ${col.type} ${constraints}`.trim()
  })
  
  // Add timestamps if not present
  if (!columns.find(col => col.name === 'created_at')) {
    columnDefs.push('    created_at timestamp with time zone DEFAULT now()')
  }
  if (!columns.find(col => col.name === 'updated_at')) {
    columnDefs.push('    updated_at timestamp with time zone DEFAULT now()')
  }
  
  // Generate SQL
  return `
-- Create table: ${name}
CREATE TABLE IF NOT EXISTS ${name} (
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
class SQLGenerator {
  generateCreateTableSQL(tableSchema) {
    const { name, columns, relationships = [] } = tableSchema;

    // Generate column definitions
    const columnDefs = columns.map(col => {
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

    // Generate foreign key constraints
    const foreignKeys = relationships.map(rel => {
      return `    FOREIGN KEY (${rel.sourceColumn}) REFERENCES ${rel.targetTable}(${rel.targetColumn}) ON DELETE CASCADE`;
    });

    // Combine all definitions
    const allDefs = [...columnDefs, ...foreignKeys];

    return `
-- Create table: ${name}
CREATE TABLE IF NOT EXISTS ${name} (
${allDefs.join(',\n')}
);

-- Create updated_at trigger for ${name}
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
`;
  }

  generateFullSQL(schemas) {
    let sql = `-- Generated SQL for Backlify API
-- Generated at: ${new Date().toISOString()}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

    // First create all tables
    schemas.forEach(schema => {
      sql += this.generateCreateTableSQL(schema);
      sql += '\n\n';
    });

    return sql;
  }
}

module.exports = new SQLGenerator(); 
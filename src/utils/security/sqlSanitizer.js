const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * SQL Sanitizer utility
 * Provides methods to prevent SQL injection by sanitizing inputs
 * And safely executing SQL queries
 */

/**
 * List of SQL keywords to check for potentially dangerous operations
 */
const dangerousSqlKeywords = [
  'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'GRANT', 'REVOKE',
  'EXECUTE', 'EXEC', 'SHUTDOWN', 'INFORMATION_SCHEMA', 'PG_'
];

/**
 * Sanitize a value for SQL queries
 * @param {any} value - Value to sanitize
 * @returns {string} Sanitized value
 */
const sanitizeValue = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  
  // For strings, escape single quotes and remove dangerous sequences
  let sanitized = value.toString()
    .replace(/'/g, "''") // Replace single quotes with two single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove comment markers
    .replace(/\/\*/g, '') // Remove comment start
    .replace(/\*\//g, ''); // Remove comment end
  
  return `'${sanitized}'`;
};

/**
 * Validate a table or column name for SQL injection
 * @param {string} identifier - Table or column name
 * @returns {boolean} True if the identifier is valid
 */
const isValidIdentifier = (identifier) => {
  if (!identifier || typeof identifier !== 'string') {
    return false;
  }
  
  // Only allow alphanumeric chars, underscore, and some basic symbols in identifiers
  // Identifier names can only contain letters, numbers, and underscores
  return /^[a-zA-Z0-9_]+$/.test(identifier);
};

/**
 * Check if SQL contains potentially dangerous operations
 * @param {string} sql - SQL query
 * @returns {boolean} True if query appears dangerous
 */
const isDangerousSql = (sql) => {
  const upperSql = sql.toUpperCase();
  
  // Check for dangerous keywords
  for (const keyword of dangerousSqlKeywords) {
    if (upperSql.includes(keyword)) {
      return true;
    }
  }
  
  // Check for multiple statements
  if (upperSql.includes(';') && !upperSql.endsWith(';')) {
    return true;
  }
  
  // Check for comment markers which might be used to comment out parts of the query
  if (upperSql.includes('--') || upperSql.includes('/*')) {
    return true;
  }
  
  return false;
};

/**
 * Build a safe SELECT query with sanitized inputs
 * @param {string} tableName - Table name
 * @param {Array<string>} columns - Column names
 * @param {Object} whereConditions - Where conditions with values
 * @param {Object} options - Additional options (limit, offset, orderBy)
 * @returns {Object} Query result or error
 */
const buildSafeSelectQuery = (tableName, columns = ['*'], whereConditions = {}, options = {}) => {
  // Validate table name
  if (!isValidIdentifier(tableName)) {
    return {
      success: false,
      error: 'Invalid table name'
    };
  }
  
  // Validate column names
  if (columns.length > 0 && columns[0] !== '*') {
    for (const column of columns) {
      if (!isValidIdentifier(column)) {
        return {
          success: false,
          error: `Invalid column name: ${column}`
        };
      }
    }
  }
  
  // Build columns part
  const columnsString = columns.join(', ');
  
  // Build base query
  let query = `SELECT ${columnsString} FROM ${tableName}`;
  
  // Add WHERE conditions if present
  const whereKeys = Object.keys(whereConditions);
  if (whereKeys.length > 0) {
    const whereClauses = [];
    
    for (const key of whereKeys) {
      if (!isValidIdentifier(key)) {
        return {
          success: false,
          error: `Invalid column name in where condition: ${key}`
        };
      }
      
      whereClauses.push(`${key} = ${sanitizeValue(whereConditions[key])}`);
    }
    
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  
  // Add ORDER BY if present
  if (options.orderBy) {
    if (!isValidIdentifier(options.orderBy.column)) {
      return {
        success: false,
        error: `Invalid column name in order by: ${options.orderBy.column}`
      };
    }
    
    const direction = options.orderBy.direction === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${options.orderBy.column} ${direction}`;
  }
  
  // Add LIMIT if present
  if (options.limit && Number.isInteger(options.limit) && options.limit > 0) {
    query += ` LIMIT ${options.limit}`;
  }
  
  // Add OFFSET if present
  if (options.offset && Number.isInteger(options.offset) && options.offset >= 0) {
    query += ` OFFSET ${options.offset}`;
  }
  
  // Final security check
  if (isDangerousSql(query)) {
    return {
      success: false,
      error: 'Query contains potentially dangerous operations'
    };
  }
  
  return {
    success: true,
    query
  };
};

/**
 * Execute a SQL query safely using the Supabase execute_sql RPC function
 * @param {string} sql - SQL query to execute
 * @returns {Promise<Object>} Query result
 */
const executeSafeSql = async (sql) => {
  try {
    // Final security check
    if (isDangerousSql(sql)) {
      return {
        success: false,
        error: 'Query contains potentially dangerous operations'
      };
    }
    
    // Execute query using Supabase RPC
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: sql
    });
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sanitizeValue,
  isValidIdentifier,
  isDangerousSql,
  buildSafeSelectQuery,
  executeSafeSql
}; 
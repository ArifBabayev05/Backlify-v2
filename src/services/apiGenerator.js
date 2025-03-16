const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const schemaGenerator = require('./schemaGenerator');
const swaggerUi = require('swagger-ui-express');

class APIGenerator {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
  }

  generateEndpoints(tableSchemas, userId = 'default') {
    // Make a deep copy of the table schemas to ensure isolation
    const safeTableSchemas = JSON.parse(JSON.stringify(tableSchemas));
    
    // Create a new router instance for each API
    const router = express.Router();
    
    // Store userId as a property on the router
    // Use Object.defineProperty to make it non-enumerable and prevent accidental changes
    Object.defineProperty(router, 'userId', {
      value: userId,
      writable: false,  // Make it read-only
      enumerable: true  // Make it visible for debugging
    });

    // Add in-memory database to the router (ensure it's a new Map instance)
    router.inMemoryDb = new Map();

    // Store original table schemas to prevent modification
    Object.defineProperty(router, '_tableSchemas', {
      value: safeTableSchemas,
      writable: false,
      enumerable: false
    });

    // Store a timestamp when this router was created
    Object.defineProperty(router, '_createdAt', {
      value: new Date().toISOString(),
      writable: false,
      enumerable: true
    });

    // Store a unique ID for this router instance
    Object.defineProperty(router, '_instanceId', {
      value: Math.random().toString(36).substring(2, 15),
      writable: false,
      enumerable: true
    });

    // Log router creation
    console.log(`Creating router instance ${router._instanceId} for userId ${userId} at ${router._createdAt}`);

    // Add documentation endpoint
    router.get('/', (req, res) => {
      // Add null checks to prevent errors
      if (!safeTableSchemas || !Array.isArray(safeTableSchemas)) {
        return res.json({
          api: 'Dynamically Generated API',
          error: 'Schema information is missing',
          status: 'degraded'
        });
      }
      
      const endpoints = safeTableSchemas.map(schema => {
        // Add null check for schema
        if (!schema) return null;
        
        const tableName = schema.originalName || schema.name;
        // Skip if no tableName
        if (!tableName) return null;
        
        // Add null check for columns
        const columns = schema.columns && Array.isArray(schema.columns) 
          ? schema.columns.map(col => ({
              name: col.name || 'unknown',
              type: col.type || 'unknown',
              constraints: col.constraints || []
            }))
          : [];
          
        return {
          table: tableName,
          endpoints: [
            { method: 'GET', path: `/${tableName}`, description: 'Get all records with pagination and filtering' },
            { method: 'GET', path: `/${tableName}/:id`, description: 'Get record by ID' },
            { method: 'POST', path: `/${tableName}`, description: 'Create new record' },
            { method: 'PUT', path: `/${tableName}/:id`, description: 'Update record' },
            { method: 'DELETE', path: `/${tableName}/:id`, description: 'Delete record' }
          ],
          schema: {
            columns: columns
          }
        };
      }).filter(Boolean); // Filter out null values

      res.json({
        api: 'Dynamically Generated API',
        tables: safeTableSchemas
          .filter(t => t && (t.originalName || t.name))
          .map(t => t.originalName || t.name),
        userId: userId,
        endpoints,
        routerInstanceId: router._instanceId,
        createdAt: router._createdAt
      });
    });

    // Generate endpoints for each table
    safeTableSchemas.forEach(schema => {
      const tableName = schema.originalName || schema.name;
      const prefixedTableName = schema.prefixedName || `${userId}_${tableName}`;

      // GET all items with pagination and filtering - filter by userId
      router.get(`/${tableName}`, async (req, res) => {
        try {
          const { page = 1, limit = 10, sort, order = 'asc', ...filters } = req.query;
          const offset = (parseInt(page) - 1) * parseInt(limit);
          
          // Build the query using a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          let query = supabase
            .from(prefixedTableName)
            .select('*', { count: 'exact' });
            
          // Always filter by the userId that created this API
          query = query.eq('user_id', router.userId);
          
          // Apply additional filters
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
          
          // Apply sorting if specified
          if (sort) {
            const orderDirection = order.toLowerCase() === 'desc' ? false : true;
            query = query.order(sort, { ascending: orderDirection });
          }
          
          // Apply pagination
          query = query.range(offset, offset + parseInt(limit) - 1);
          
          // Execute the query
          const { data, error, count } = await query;
          
          if (error) {
            console.error(`Error fetching ${prefixedTableName}:`, error);
            return res.status(500).json({ 
              error: `Database error: ${error.message}`,
              hint: 'Ensure the table exists and has the correct structure'
            });
          }
          
          res.json({
            data: data || [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: count || 0
            }
          });
        } catch (error) {
          console.error(`Error in GET ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // GET item by id - ensure it belongs to current userId
      router.get(`/${tableName}/:id`, async (req, res) => {
        try {
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          const { data, error } = await supabase
            .from(prefixedTableName)
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', router.userId) // Ensure record belongs to API creator
            .single();
          
          if (error) {
            if (error.code === 'PGRST116') {
              // No rows returned = not found
              return res.status(404).json({ error: 'Record not found' });
            }
            console.error(`Error fetching ${prefixedTableName} by ID:`, error);
            return res.status(500).json({ error: `Database error: ${error.message}` });
          }
          
          res.json(data);
        } catch (error) {
          console.error(`Error in GET ${tableName}/:id:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // POST new item - automatically include userId
      router.post(`/${tableName}`, async (req, res) => {
        try {
          // Clone the request body to avoid modifying the original
          const requestData = { ...req.body };
          
          // Only remove ID if it's one of our placeholder values
          if (requestData.id === "uuid-generated-by-database" || 
              requestData.id === "string" || 
              requestData.id === "" || 
              requestData.id === undefined) {
            delete requestData.id;
          }
          
          // Always use the API creator's userId, not the request userId
          requestData.user_id = router.userId;
          
          // Add proper timestamps if not provided or if they're placeholder values
          if (!requestData.created_at || requestData.created_at === "string") {
            requestData.created_at = new Date().toISOString();
          }
          if (!requestData.updated_at || requestData.updated_at === "string") {
            requestData.updated_at = new Date().toISOString();
          }
          
          // Clean any placeholder values for foreign keys
          Object.keys(requestData).forEach(key => {
            // Only clean placeholder values, keep valid values
            if (requestData[key] === "string" || 
                (key.endsWith('_id') && key !== 'user_id' && 
                 (requestData[key] === "00000000-0000-0000-0000-000000000000" || 
                  requestData[key] === ""))) {
              
              if (key.endsWith('_id') && key !== 'user_id') {
                // For foreign keys, use null instead of empty values
                requestData[key] = null;
              } else if (key !== 'created_at' && key !== 'updated_at' && key !== 'id') {
                // For regular string fields
                requestData[key] = '';
              }
            }
          });
          
          console.log(`Adding record to ${prefixedTableName}:`, requestData);
          
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          // Make sure we're inserting into the exact prefixed table
          const { data, error } = await supabase
            .from(prefixedTableName)
            .insert(requestData)
            .select();
          
          if (error) {
            console.error(`Error creating record in ${prefixedTableName}:`, error);
            
            // Provide more detailed error message and debugging info
            return res.status(500).json({ 
              error: `Database error: ${error.message}`,
              hint: 'Ensure the table exists and has the correct structure',
              details: {
                table: prefixedTableName,
                requestData: requestData,
                errorCode: error.code
              }
            });
          }
          
          res.status(201).json(data[0]);
        } catch (error) {
          console.error(`Error in POST ${tableName}:`, error);
          res.status(500).json({ 
            error: error.message, 
            table: prefixedTableName 
          });
        }
      });

      // PUT/UPDATE item - ensure it belongs to current userId
      router.put(`/${tableName}/:id`, async (req, res) => {
        try {
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          // First check if record belongs to this API's userId
          const { data: checkData, error: checkError } = await supabase
            .from(prefixedTableName)
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', router.userId)
            .single();
          
          if (checkError || !checkData) {
            return res.status(404).json({ error: 'Record not found or not authorized' });
          }
          
          // Record belongs to user, proceed with update
          const { data, error } = await supabase
            .from(prefixedTableName)
            .update(req.body)
            .eq('id', req.params.id)
            .eq('user_id', router.userId) // Ensure we only update user's own record
            .select();
          
          if (error) {
            console.error(`Error updating record in ${prefixedTableName}:`, error);
            return res.status(500).json({ error: `Database error: ${error.message}` });
          }
          
          res.json(data[0]);
        } catch (error) {
          console.error(`Error in PUT ${tableName}/:id:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // DELETE item - ensure it belongs to current userId
      router.delete(`/${tableName}/:id`, async (req, res) => {
        try {
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          // First check if record belongs to this API's userId
          const { data: checkData, error: checkError } = await supabase
            .from(prefixedTableName)
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', router.userId)
            .single();
          
          if (checkError || !checkData) {
            return res.status(404).json({ error: 'Record not found or not authorized' });
          }
          
          // Delete from Supabase with user_id check
          const { error } = await supabase
            .from(prefixedTableName)
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', router.userId); // Ensure we only delete user's own record
          
          if (error) {
            console.error(`Error deleting record from ${prefixedTableName}:`, error);
            return res.status(500).json({ error: `Database error: ${error.message}` });
          }
          
          res.status(204).send();
        } catch (error) {
          console.error(`Error in DELETE ${tableName}/:id:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    });

    // Add Swagger JSON endpoint 
    router.get('/swagger.json', (req, res) => {
      // Create a new isolated instance of _generateSwaggerSpec for this request
      const swaggerSpec = _generateSwaggerSpec(safeTableSchemas, userId);
      
      // Get the apiId from the request for constructing proper URLs
      const apiId = req.apiId;
      
      // If we have an apiId, update the server URL
      if (apiId) {
        swaggerSpec.servers = [
          {
            url: `/api/${apiId}`,
            description: 'Current API server'
          }
        ];
      }
      
      res.json(swaggerSpec);
    });

    // Mount the Swagger UI - switch back to middleware approach
    router.use('/docs', swaggerUi.serve);
    router.get('/docs', (req, res, next) => {
      const swaggerSpec = _generateSwaggerSpec(safeTableSchemas, userId);
      
      // Get the apiId from the request for constructing proper URLs
      const apiId = req.apiId;
      
      // If we have an apiId, update the server URL
      if (apiId) {
        swaggerSpec.servers = [
          {
            url: `/api/${apiId}`,
            description: 'Current API server'
          }
        ];
      }
      
      try {
        // Use middleware approach for consistent behavior
        req.swaggerDoc = swaggerSpec;
        return swaggerUi.setup(swaggerSpec, {
          explorer: true,
          customSiteTitle: `API for ${userId} (Instance: ${router._instanceId})`
        })(req, res, next);
      } catch (error) {
        console.error('Error setting up Swagger UI:', error);
        res.status(500).json({ error: 'Failed to set up Swagger UI' });
      }
    });

    // Add method to the router to generate Swagger spec with proper context
    router._generateSwaggerSpec = () => {
      // Get the correct userId from the router instance itself
      const effectiveUserId = router.userId;
      console.log(`Router ${router._instanceId} generating Swagger spec for user: ${effectiveUserId}`);
      
      // Call the generator method with the isolated context
      return _generateSwaggerSpec(safeTableSchemas, effectiveUserId);
    };

    return router;
  }
}

// Create a standalone function version of _generateSwaggerSpec that doesn't depend on 'this'
function _generateSwaggerSpec(tableSchemas, userId) {
  // Make a safe copy to prevent modification
  const safeSchemas = JSON.parse(JSON.stringify(tableSchemas));
  
  // Use the provided userId
  const effectiveUserId = userId || 'default';
  
  console.log('Generating Swagger spec with userId:', effectiveUserId);
  
  // Build the paths from the schemas
  const paths = {};
  
  // For each table, create swagger paths
  safeSchemas.forEach(schema => {
    // Safety check for schema
    if (!schema) return;
    
    const tableName = schema.originalName || schema.name;
    if (!tableName) return; // Skip if no table name
    
    // GET collection path
    paths[`/${tableName}`] = {
      get: {
        tags: [tableName],
        summary: `Get all ${tableName} records`,
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', default: 10 }
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Field to sort by',
            schema: { type: 'string' }
          },
          {
            name: 'order',
            in: 'query',
            description: 'Sort order (asc or desc)',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
          }
        ],
        responses: {
          '200': { description: 'Successful operation' }
        }
      },
      post: {
        tags: [tableName],
        summary: `Create a new ${tableName} record`,
        requestBody: {
          content: {
            'application/json': {
              schema: { 
                $ref: `#/components/schemas/${tableName}` 
              }
            }
          }
        },
        responses: {
          '201': { description: 'Record created successfully' }
        }
      }
    };
    
    // GET/PUT/DELETE item path
    paths[`/${tableName}/{id}`] = {
      get: {
        tags: [tableName],
        summary: `Get a ${tableName} record by ID`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': { description: 'Successful operation' },
          '404': { description: 'Record not found' }
        }
      },
      put: {
        tags: [tableName],
        summary: `Update a ${tableName} record`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { 
                $ref: `#/components/schemas/${tableName}` 
              }
            }
          }
        },
        responses: {
          '200': { description: 'Record updated successfully' },
          '404': { description: 'Record not found' }
        }
      },
      delete: {
        tags: [tableName],
        summary: `Delete a ${tableName} record`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '204': { description: 'Record deleted successfully' },
          '404': { description: 'Record not found' }
        }
      }
    };
  });
  
  // Generate schema components from table schemas
  const schemas = {};
  safeSchemas.forEach(schema => {
    // Safety check for schema and columns
    if (!schema || !schema.columns || !Array.isArray(schema.columns)) return;
    
    const tableName = schema.originalName || schema.name;
    if (!tableName) return; // Skip if no table name
    
    const properties = {};
    schema.columns.forEach(col => {
      // Safety check for column
      if (!col || !col.name) return;
      
      let type = 'string';
      let format = undefined;
      let example = undefined;
      
      // Handle different data types
      if (col.type.includes('int')) {
        type = 'integer';
        example = 1;
      } else if (col.type.includes('float') || col.type.includes('decimal')) {
        type = 'number';
        example = 1.5;
      } else if (col.type.includes('bool')) {
        type = 'boolean';
        example = true;
      } else if (col.type.includes('timestamp') || col.type.includes('date')) {
        type = 'string';
        format = 'date-time';
        example = new Date().toISOString();
      } else if (col.type.includes('uuid') || col.name === 'id') {
        // Don't include example for id fields - they're generated by the database
        if (col.name === 'id') {
          // Exclude ID field from example since it's auto-generated
          type = 'string';
          format = 'uuid';
          example = undefined; // No example needed for auto-generated field
        } else {
          type = 'string'; 
          format = 'uuid';
          // Only include UUID example for non-auto-generated fields
          example = col.name.endsWith('_id') ? null : undefined;
        }
      } else {
        // Regular string field
        example = col.name; // Use the field name as example
      }
      
      // Set properties with better examples
      properties[col.name] = { 
        type,
        ...(format ? { format } : {}),
        ...(example !== undefined ? { example } : {})
      };
    });
    
    // Add specific examples for timestamp fields
    if (!properties['created_at']) {
      properties['created_at'] = { 
        type: 'string', 
        format: 'date-time',
        example: new Date().toISOString()
      };
    }
    
    if (!properties['updated_at']) {
      properties['updated_at'] = { 
        type: 'string', 
        format: 'date-time',
        example: new Date().toISOString()  
      };
    }
    
    schemas[tableName] = {
      type: 'object',
      properties
    };
  });
  
  // Return with proper fallbacks
  return {
    openapi: "3.0.0",
    info: {
      title: `API for User ${effectiveUserId}`,
      version: "1.0.0",
      description: 'API generated by Backlify'
    },
    servers: [
      {
        url: '/'
      }
    ],
    paths: paths || {},
    components: {
      schemas: schemas || {}
    }
  };
}

// Create a new instance of the class for each usage
const apiGenerator = new APIGenerator();

// Export the class methods and standalone functions
module.exports = {
  generateEndpoints: (tableSchemas, userId) => apiGenerator.generateEndpoints(tableSchemas, userId),
  _generateSwaggerSpec
}; 
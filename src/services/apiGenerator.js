const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const schemaGenerator = require('./schemaGenerator');
const swaggerUi = require('swagger-ui-express');
const { setCorsHeaders } = require('../middleware/corsMiddleware');

class APIGenerator {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
  }

  generateEndpoints(tableSchemas, XAuthUserId = 'default', existingApiIdentifier = null) {
    // Make a deep copy of the table schemas to ensure isolation
    const safeTableSchemas = JSON.parse(JSON.stringify(tableSchemas));
    
    // Create a new router instance for each API
    const router = express.Router();
    
    // Use the existing API identifier if provided, or generate a new one
    const apiIdentifier = existingApiIdentifier || Math.random().toString(36).substring(2, 8);
    
    // Store XAuthUserId as a property on the router
    // Use Object.defineProperty to make it non-enumerable and prevent accidental changes
    Object.defineProperty(router, 'XAuthUserId', {
      value: XAuthUserId,
      writable: false,  // Make it read-only
      enumerable: true  // Make it visible for debugging
    });
    
    // Store API identifier as a property on the router
    Object.defineProperty(router, 'apiIdentifier', {
      value: apiIdentifier,
      writable: false,
      enumerable: true
    });

    // Add in-memory database to the router (ensure it's a new Map instance)
    router.inMemoryDb = new Map();

    // UNIVERSAL CORS middleware - applies to ALL routes in this router
    router.use((req, res, next) => {
      const { setCorsHeaders } = require('../middleware/corsMiddleware');
      setCorsHeaders(res, req);
      next();
    });

    // Handle ALL OPTIONS requests immediately for CORS preflight
    router.options('*', (req, res) => {
      const { setCorsHeaders } = require('../middleware/corsMiddleware');
      setCorsHeaders(res, req);
      res.status(200).json({ 
        message: 'CORS preflight OK for dynamic API',
        timestamp: new Date().toISOString()
      });
    });

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
    console.log(`Creating router instance ${router._instanceId} for XAuthUserId ${XAuthUserId} at ${router._createdAt}`);

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
          prefixedTableName: schema.prefixedName,
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
        XAuthUserId: XAuthUserId,
        apiIdentifier: router.apiIdentifier,
        endpoints,
        routerInstanceId: router._instanceId,
        createdAt: router._createdAt
      });
    });

    // Generate endpoints for each table
    safeTableSchemas.forEach(schema => {
      const tableName = schema.originalName || schema.name;
      
      // Use the existing prefixedName if available, otherwise generate a new one
      let prefixedTableName;
      if (schema.prefixedName) {
        prefixedTableName = schema.prefixedName;
        //console.log(`Using existing prefixedName: ${prefixedTableName}`);
      } else {
        // Explicitly generate prefixed table name with BOTH XAuthUserId AND apiIdentifier
        // This ensures complete isolation even between APIs from the same user
        prefixedTableName = `${XAuthUserId}_${apiIdentifier}_${tableName}`;
        // Convert to lowercase to avoid PostgreSQL case sensitivity issues
        prefixedTableName = prefixedTableName.toLowerCase();
        // Store the prefixed name on the schema to ensure consistency
        schema.prefixedName = prefixedTableName;
        //console.log(`Generated new prefixedName: ${prefixedTableName}`);
      }

      // GET all items with pagination and filtering
      router.get(`/${tableName}`, async (req, res) => {
        try {
          const { page = 1, limit = 10, sort, order = 'asc', ...filters } = req.query;
          const offset = (parseInt(page) - 1) * parseInt(limit);
          
          // Add debug logging about the table being accessed
          console.log(`[API ${router._instanceId}] Accessing table: ${prefixedTableName} for GET all items`);
          
          // Build the query using a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          // Log the table name being accessed for debugging
          console.log(`Table being accessed: "${prefixedTableName}"`);
          
          let query = supabase
            .from(prefixedTableName)
            .select('*', { count: 'exact' });
          
          // Apply all filters from query params
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
            
            // Check if this is a table not found error
            if (error.message && error.message.includes('does not exist')) {
              console.log('Attempting to fix table name case sensitivity issue...');
              
              // Try with lowercase table name
              const lowercaseTableName = prefixedTableName.toLowerCase();
              if (lowercaseTableName !== prefixedTableName) {
                console.log(`Retrying with lowercase table name: ${lowercaseTableName}`);
                
                // Retry the query with lowercase table name
                let retryQuery = supabase
                  .from(lowercaseTableName)
                  .select('*', { count: 'exact' });
                
                // Re-apply filters
                Object.entries(filters).forEach(([key, value]) => {
                  retryQuery = retryQuery.eq(key, value);
                });
                
                // Re-apply sorting
                if (sort) {
                  const orderDirection = order.toLowerCase() === 'desc' ? false : true;
                  retryQuery = retryQuery.order(sort, { ascending: orderDirection });
                }
                
                // Re-apply pagination
                retryQuery = retryQuery.range(offset, offset + parseInt(limit) - 1);
                
                // Execute retry query
                const retryResult = await retryQuery;
                
                if (!retryResult.error) {
                  console.log('Retry with lowercase table name successful');
                  
                  // Update schema to use lowercase name for future requests
                  schema.prefixedName = lowercaseTableName;
                  
                  return res.json({
                    data: retryResult.data?.map(item => {
                      if (item) {
                        const { XAuthUserId, ...rest } = item;
                        return rest;
                      }
                      return item;
                    }) || [],
                    pagination: {
                      page: parseInt(page),
                      limit: parseInt(limit),
                      total: retryResult.count || 0
                    }
                  });
                }
              }
            }
            
            return res.status(500).json({ 
              error: `Database error: ${error.message}`,
              hint: 'Ensure the table exists and has the correct structure'
            });
          }
          
          // Filter out XAuthUserId from response
          const filteredData = data?.map(item => {
            if (item) {
              const { XAuthUserId, ...rest } = item;
              return rest;
            }
            return item;
          }) || [];
          
          res.json({
            data: filteredData,
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

      // GET item by id
      router.get(`/${tableName}/:id`, async (req, res) => {
        try {
          // Add debug logging about the table being accessed
          console.log(`[API ${router._instanceId}] Accessing table: ${prefixedTableName} for GET by ID: ${req.params.id}`);
          
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          const { data, error } = await supabase
            .from(prefixedTableName)
            .select('*')
            .eq('id', req.params.id)
            .single();
          
          if (error) {
            if (error.code === 'PGRST116') {
              // No rows returned = not found
              return res.status(404).json({ error: 'Record not found' });
            }
            console.error(`Error fetching ${prefixedTableName} by ID:`, error);
            
            // Check if this is a table not found error
            if (error.message && error.message.includes('does not exist')) {
              console.log('Attempting to fix table name case sensitivity issue...');
              
              // Try with lowercase table name
              const lowercaseTableName = prefixedTableName.toLowerCase();
              if (lowercaseTableName !== prefixedTableName) {
                console.log(`Retrying with lowercase table name: ${lowercaseTableName}`);
                
                // Retry the query with lowercase table name
                const retryResult = await supabase
                  .from(lowercaseTableName)
                  .select('*')
                  .eq('id', req.params.id)
                  .single();
                
                if (!retryResult.error) {
                  console.log('Retry with lowercase table name successful');
                  
                  // Update schema to use lowercase name for future requests
                  schema.prefixedName = lowercaseTableName;
                  
                  // Filter out XAuthUserId from response data
                  if (retryResult.data) {
                    const { XAuthUserId, ...filteredData } = retryResult.data;
                    return res.json(filteredData);
                  }
                  
                  return res.json(retryResult.data);
                }
              }
            }
            
            return res.status(500).json({ error: `Database error: ${error.message}` });
          }
          
          // Filter out XAuthUserId from response data
          if (data) {
            const { XAuthUserId, ...filteredData } = data;
            return res.json(filteredData);
          }
          
          res.json(data);
        } catch (error) {
          console.error(`Error in GET ${tableName}/:id:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // POST new item
      router.post(`/${tableName}`, async (req, res) => {
        try {
          // Clone the request body to avoid modifying the original
          const requestData = { ...req.body };
          
          // Add debug logging about the table being accessed
          console.log(`[API ${router._instanceId}] Accessing table: ${prefixedTableName} for POST new item`);
          
          // Only remove ID if it's one of our placeholder values
          if (requestData.id === "uuid-generated-by-database" || 
              requestData.id === "string" || 
              requestData.id === "" || 
              requestData.id === undefined) {
            delete requestData.id;
          }
          
          // Check if the table has an XAuthUserId column before adding it
          const hasXAuthUserIdColumn = schema.columns && 
            Array.isArray(schema.columns) && 
            schema.columns.some(col => col.name === 'XAuthUserId');
          
          // Only add XAuthUserId if the column exists in the table
          if (hasXAuthUserIdColumn) {
            // Always remove any client-provided XAuthUserId first
            delete requestData.XAuthUserId;
            
            // Use this API instance's XAuthUserId or the authenticated user's ID
            requestData.XAuthUserId = req.XAuthUserId || router.XAuthUserId;
            console.log(`Adding XAuthUserId: ${requestData.XAuthUserId} to request`);
          } else {
            // Remove XAuthUserId if it was included but doesn't exist in the table
            if (requestData.XAuthUserId !== undefined) {
              console.log(`Removing XAuthUserId as the column doesn't exist in table ${prefixedTableName}`);
              delete requestData.XAuthUserId;
            }
          }
          
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
                (key.endsWith('_id') && 
                 (requestData[key] === "00000000-0000-0000-0000-000000000000" || 
                  requestData[key] === ""))) {
              
              if (key.endsWith('_id')) {
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
          
          // Filter out XAuthUserId from response
          if (data && data[0]) {
            const { XAuthUserId, ...filteredData } = data[0];
            return res.status(201).json(filteredData);
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

      // PUT/UPDATE item
      router.put(`/${tableName}/:id`, async (req, res) => {
        try {
          // Add debug logging about the table being accessed
          console.log(`[API ${router._instanceId}] Accessing table: ${prefixedTableName} for PUT update to ID: ${req.params.id}`);
          
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          // First check if record exists
          const { data: checkData, error: checkError } = await supabase
            .from(prefixedTableName)
            .select('id, XAuthUserId')
            .eq('id', req.params.id)
            .single();
          
          if (checkError || !checkData) {
            return res.status(404).json({ error: 'Record not found' });
          }
          
          // Clone the request body to avoid modifying it
          const updateData = { ...req.body };
          
          // Check if the table has an XAuthUserId column before adding it
          const hasXAuthUserIdColumn = schema.columns && 
            Array.isArray(schema.columns) && 
            schema.columns.some(col => col.name === 'XAuthUserId');
          
          // Only add XAuthUserId if the column exists in the table
          if (hasXAuthUserIdColumn) {
            // Always remove any client-provided XAuthUserId first
            delete updateData.XAuthUserId;
            
            // Use this API instance's XAuthUserId or the authenticated user's ID
            updateData.XAuthUserId = req.XAuthUserId || router.XAuthUserId;
            console.log(`Adding XAuthUserId: ${updateData.XAuthUserId} to update data`);
          } else {
            // Remove XAuthUserId if it was included but doesn't exist in the table
            if (updateData.XAuthUserId !== undefined) {
              console.log(`Removing XAuthUserId as the column doesn't exist in table ${prefixedTableName}`);
              delete updateData.XAuthUserId;
            }
          }
          
          // Always add updated_at timestamp
          updateData.updated_at = new Date().toISOString();
          
          // Record exists, proceed with update
          const { data, error } = await supabase
            .from(prefixedTableName)
            .update(updateData)
            .eq('id', req.params.id)
            .select();
          
          if (error) {
            console.error(`Error updating record in ${prefixedTableName}:`, error);
            return res.status(500).json({ error: `Database error: ${error.message}` });
          }
          
          // Filter out XAuthUserId from response
          if (data && data[0]) {
            const { XAuthUserId, ...filteredData } = data[0];
            return res.json(filteredData);
          }
          
          res.json(data[0]);
        } catch (error) {
          console.error(`Error in PUT ${tableName}/:id:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // DELETE item
      router.delete(`/${tableName}/:id`, async (req, res) => {
        try {
          // Add debug logging about the table being accessed
          console.log(`[API ${router._instanceId}] Accessing table: ${prefixedTableName} for DELETE ID: ${req.params.id}`);
          
          // Use a new Supabase client instance to avoid shared state
          const supabase = createClient(config.supabase.url, config.supabase.key);
          
          // First check if record exists
          const { data: checkData, error: checkError } = await supabase
            .from(prefixedTableName)
            .select('id')
            .eq('id', req.params.id)
            .single();
          
          if (checkError || !checkData) {
            return res.status(404).json({ error: 'Record not found' });
          }
          
          // Delete from Supabase
          const { error } = await supabase
            .from(prefixedTableName)
            .delete()
            .eq('id', req.params.id);
          
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
      const swaggerSpec = _generateSwaggerSpec(safeTableSchemas, XAuthUserId);
      
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
      const swaggerSpec = _generateSwaggerSpec(safeTableSchemas, XAuthUserId);
      
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
          customSiteTitle: `API for ${XAuthUserId} (Instance: ${router._instanceId})`
        })(req, res, next);
      } catch (error) {
        console.error('Error setting up Swagger UI:', error);
        res.status(500).json({ error: 'Failed to set up Swagger UI' });
      }
    });

    // Add method to the router to generate Swagger spec with proper context
    router._generateSwaggerSpec = () => {
      // Get the correct XAuthUserId from the router instance itself
      const effectiveXAuthUserId = router.XAuthUserId;
      console.log(`Router ${router._instanceId} generating Swagger spec for user: ${effectiveXAuthUserId}`);
      
      // Call the generator method with the isolated context
      return _generateSwaggerSpec(safeTableSchemas, effectiveXAuthUserId);
    };

    // Add a log statement to summarize all tables created for this API instance
    console.log(`[API ${router._instanceId}] Created for XAuthUserId: ${XAuthUserId} with apiIdentifier: ${apiIdentifier} and tables: ${safeTableSchemas.map(t => t.prefixedName).join(', ')}`);

    return router;
  }
}

// Create a standalone function version of _generateSwaggerSpec that doesn't depend on 'this'
function _generateSwaggerSpec(tableSchemas, XAuthUserId) {
  // Make a safe copy to prevent modification
  const safeSchemas = JSON.parse(JSON.stringify(tableSchemas));
  
  // Use the provided XAuthUserId
  const effectiveXAuthUserId = XAuthUserId || 'default';
  
  console.log('Generating Swagger spec with XAuthUserId:', effectiveXAuthUserId);
  
  // Build the paths from the schemas
  const paths = {};
  
  // No security schemes - allow free access to Swagger UI testing
  const securitySchemes = {};
  
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
          '200': { description: 'Successful operation' },
          '400': { description: 'Bad request - Invalid parameters' },
          '500': { description: 'Internal server error' }
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
          },
          description: 'Data for creating or updating a record'
        },
        responses: {
          '201': { description: 'Record created successfully' },
          '400': { description: 'Bad request - Invalid data' },
          '500': { description: 'Internal server error' }
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
          '400': { description: 'Bad request - Invalid ID' },
          '404': { description: 'Record not found' },
          '500': { description: 'Internal server error' }
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
          },
          description: 'Data for creating or updating a record'
        },
        responses: {
          '200': { description: 'Record updated successfully' },
          '400': { description: 'Bad request - Invalid data or ID' },
          '404': { description: 'Record not found' },
          '500': { description: 'Internal server error' }
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
          '400': { description: 'Bad request - Invalid ID' },
          '404': { description: 'Record not found' },
          '500': { description: 'Internal server error' }
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
    const requiredFields = [];
    
    // Collect all foreign key relationships for this table
    const relationships = schema.relationships || [];
    
    // Get a list of all foreign key columns
    const foreignKeyColumns = relationships
      .filter(rel => rel.sourceTable === tableName || rel.sourceTable === schema.name)
      .map(rel => rel.sourceColumn);
      
    schema.columns.forEach(col => {
      // Safety check for column
      if (!col || !col.name) return;
      
      // Skip XAuthUserId in the Swagger documentation
      if (col.name === 'XAuthUserId') return;
      
      let type = 'string';
      let format = undefined;
      let example = undefined;
      let required = false;
      
      // Check if column has constraints that indicate it's required
      if (col.constraints) {
        const constraints = Array.isArray(col.constraints) 
          ? col.constraints.join(' ').toLowerCase() 
          : (typeof col.constraints === 'string' ? col.constraints.toLowerCase() : '');
          
        if (constraints.includes('not null') || constraints.includes('primary key')) {
          required = true;
          requiredFields.push(col.name);
        }
      }
      
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
          example = "3fa85f64-5717-4562-b3fc-2c963f66afa6"; // Include a placeholder UUID
        } else {
          type = 'string'; 
          format = 'uuid';
          example = "3fa85f64-5717-4562-b3fc-2c963f66afa6"; // Include a placeholder UUID
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
    
    // Check for missing foreign key fields that might be added later in relationships
    relationships.forEach(rel => {
      // Only process relationships where this table is the source
      if ((rel.sourceTable === tableName || rel.sourceTable === schema.name) && 
          !properties[rel.sourceColumn]) {
        
        // Add this foreign key to the properties
        properties[rel.sourceColumn] = {
          type: 'string',
          format: 'uuid',
          example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          description: `Foreign key to ${rel.targetTable}.${rel.targetColumn || 'id'}`
        };
        
        // If this is a required relationship, add to required fields
        if (rel.required) {
          requiredFields.push(rel.sourceColumn);
        }
      }
    });
    
    // Special handling for role_id (common field that might be missing)
    if (tableName === 'users' && !properties['role_id']) {
      properties['role_id'] = {
        type: 'string',
        format: 'uuid',
        example: "a52e1330-ad67-480c-9968-1e97e79da98d",
        description: "Foreign key to roles.id"
      };
      
      // Add to required fields if not already there
      if (!requiredFields.includes('role_id')) {
        requiredFields.push('role_id');
      }
    }
    
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
      properties,
      required: requiredFields.length > 0 ? requiredFields : undefined
    };
  });
  
  // Return with proper fallbacks
  return {
    openapi: "3.0.0",
    info: {
      title: `API for User ${effectiveXAuthUserId}`,
      version: "1.0.0",
      description: 'API generated by Backlify\n\n**Open Access**: All API endpoints are publicly accessible and can be tested directly from this Swagger interface without authentication.'
    },
    servers: [
      {
        url: '/'
      }
    ],
    paths: paths || {},
    components: {
      schemas: schemas || {},
      securitySchemes: securitySchemes
    },
    // No global security requirements - open access
  };
}

// Create a new instance of the class for each usage
const apiGenerator = new APIGenerator();

// Export the class methods and standalone functions
module.exports = {
  generateEndpoints: (tableSchemas, XAuthUserId, existingApiIdentifier) => 
    apiGenerator.generateEndpoints(tableSchemas, XAuthUserId, existingApiIdentifier),
  _generateSwaggerSpec
}; 
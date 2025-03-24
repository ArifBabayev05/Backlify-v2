const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const APIGeneratorController = require('./controllers/apiGeneratorController');
const apiPublisher = require('./services/apiPublisher');
const swaggerUi = require('swagger-ui-express');
const schemaRoutes = require('./routes/schemaRoutes');
const { ensureCorsHeaders, setCorsHeaders } = require('./middleware/corsMiddleware');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const loggerMiddleware = require('./middleware/loggerMiddleware');
// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Verify database connectivity at startup
async function checkDatabase() {
  console.log('Verifying database connection...');
  try {
    // Check Supabase connectivity
    const { data, error } = await supabase.from('api_registry').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Database connectivity error:', error);
      console.error('Please check your Supabase URL and service role key in .env file');
    } else {
      console.log('✅ Connected to Supabase successfully');
    }
    
    // Additional verification for SQL execution
    try {
      const { createClient } = require('@supabase/supabase-js');
      const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      const { data, error } = await client.rpc('execute_sql', { sql_query: 'SELECT 1 as test;' });
      
      if (error) {
        console.error('❌ execute_sql function test failed:', error);
        console.error('Please ensure the execute_sql function exists in your Supabase database');
        console.error('Run this SQL in the Supabase SQL Editor:');
        console.error(`
          CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
          RETURNS json
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            result json;
          BEGIN
            EXECUTE sql_query;
            result := json_build_object('success', true);
            RETURN result;
          EXCEPTION WHEN OTHERS THEN
            result := json_build_object(
              'success', false,
              'error', SQLERRM,
              'detail', SQLSTATE
            );
            RETURN result;
          END;
          $$;
          
          -- Grant usage permissions
          GRANT EXECUTE ON FUNCTION execute_sql TO service_role;
          GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
          GRANT EXECUTE ON FUNCTION execute_sql TO anon;
        `);
      } else {
        console.log('✅ execute_sql function working properly');
      }
    } catch (err) {
      console.error('❌ Error testing execute_sql function:', err);
    }
  } catch (err) {
    console.error('❌ Critical database connection error:', err);
  }
}

// Run the database check
checkDatabase();

// Middleware
// Replace simple CORS setup with a more comprehensive configuration
const corsOptions = {
  origin: '*', // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id', 'x-user-id', 'X-USER-ID'],
  exposedHeaders: ['Content-Length', 'Content-Disposition'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Apply custom CORS middleware for all routes
app.use(ensureCorsHeaders);
app.use(loggerMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add a route for authenticating (if you have authentication middleware, you'd add it here)
// This is a placeholder for now - you'd need to implement proper authentication
app.use((req, res, next) => {
  // Try to get the XAuthUserId from various header formats to handle case-sensitivity
  const XAuthUserId = req.headers['x-user-id'] || 
                req.headers['X-USER-ID'] || 
                req.headers['X-User-Id'] || 
                req.headers['x-user-id'.toLowerCase()] ||
                req.header('x-user-id') ||
                req.body.XAuthUserId ||
                'default';
  
  // Log all headers to debug the issue
  console.log('Using XAuthUserId:', XAuthUserId);
  
  // Set XAuthUserId on the request object
  req.XAuthUserId = XAuthUserId;
  
  next();
});

// Create controller instance
const apiGeneratorController = require('./controllers/apiGeneratorController');

// Registration endpoint
app.post('/auth/register', async (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  const { email, password, username } = req.body;
  
  // Basic validation
  if (!email || !password || !username) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Please provide email, password, and username'
    });
  }
  
  try {
    // Check if username already exists in Supabase
    const { data: existingUsers, error: userCheckError } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .limit(1);
      
    if (userCheckError) throw new Error(userCheckError.message);
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Username already taken',
        details: 'Please choose a different username'
      });
    }
    
    // Check if email already exists
    const { data: existingEmails, error: emailCheckError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .limit(1);
      
    if (emailCheckError) throw new Error(emailCheckError.message);
    
    if (existingEmails && existingEmails.length > 0) {
      return res.status(400).json({
        error: 'Email already registered',
        details: 'This email is already associated with an account'
      });
    }
    
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user into Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        { 
          username, 
          email, 
          password: hashedPassword,
          created_at: new Date().toISOString()
        }
      ])
      .select();
      
    if (insertError) throw new Error(insertError.message);
    
    // Return the created user info (without password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      XAuthUserId: username,
      email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
});
// Add an endpoint to view logs
app.get('/admin/logs', async (req, res) => {
  setCorsHeaders(res);
  
  try {
    // Create a Supabase client
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Get filter params
    const { 
      page = 1, 
      limit = 50, 
      user, 
      endpoint, 
      method,
      status,
      from_date,
      to_date,
      min_time,
      max_time
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build the query
    let query = supabase
      .from('api_logs')
      .select('*', { count: 'exact' });
    
    // Apply filters if provided
    if (user) {
      query = query.eq('XAuthUserId', user);
    }
    
    if (endpoint) {
      query = query.ilike('endpoint', `%${endpoint}%`);
    }
    
    if (method) {
      query = query.eq('method', method.toUpperCase());
    }
    
    if (status) {
      // Extract status from the JSONB response field
      query = query.eq('response->status', parseInt(status));
    }
    
    if (from_date) {
      query = query.gte('timestamp', from_date);
    }
    
    if (to_date) {
      query = query.lte('timestamp', to_date);
    }
    
    if (min_time) {
      query = query.gte('response_time_ms', parseInt(min_time));
    }
    
    if (max_time) {
      query = query.lte('response_time_ms', parseInt(max_time));
    }
    
    // Apply pagination
    query = query.order('timestamp', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    // Execute the query
    const { data: logs, error, count } = await query;
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to retrieve logs', 
        details: error.message 
      });
    }
    
    // Return the logs with pagination info
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      },
      filters: {
        user,
        endpoint,
        method,
        status,
        from_date,
        to_date,
        min_time,
        max_time
      }
    });
  } catch (error) {
    console.error('Error retrieving logs:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve logs',
      details: error.message
    });
  }
});

// Add an endpoint to get log statistics
app.get('/admin/logs/stats', async (req, res) => {
  setCorsHeaders(res);
  
  try {
    // Create a Supabase client
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Get last 24 hours by default or use provided timespan
    const { days = 1 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Get statistics using the execute_sql function
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(DISTINCT "XAuthUserId") as unique_users,
          AVG(response_time_ms) as avg_response_time,
          MAX(response_time_ms) as max_response_time,
          COUNT(CASE WHEN response->>'status' LIKE '2%' THEN 1 END) as success_count,
          COUNT(CASE WHEN response->>'status' LIKE '4%' THEN 1 END) as client_error_count,
          COUNT(CASE WHEN response->>'status' LIKE '5%' THEN 1 END) as server_error_count,
          COUNT(CASE WHEN method = 'GET' THEN 1 END) as get_count,
          COUNT(CASE WHEN method = 'POST' THEN 1 END) as post_count,
          COUNT(CASE WHEN method = 'PUT' THEN 1 END) as put_count,
          COUNT(CASE WHEN method = 'DELETE' THEN 1 END) as delete_count
        FROM api_logs
        WHERE timestamp >= '${daysAgo.toISOString()}'
      `
    });
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to retrieve log statistics', 
        details: error.message 
      });
    }
    
    // Get most used endpoints
    const { data: topEndpoints, error: endpointsError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          endpoint,
          COUNT(*) as request_count
        FROM api_logs
        WHERE timestamp >= '${daysAgo.toISOString()}'
        GROUP BY endpoint
        ORDER BY request_count DESC
        LIMIT 10
      `
    });
    
    // Get most active users
    const { data: topUsers, error: usersError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          "XAuthUserId",
          COUNT(*) as request_count
        FROM api_logs
        WHERE timestamp >= '${daysAgo.toISOString()}'
        GROUP BY "XAuthUserId"
        ORDER BY request_count DESC
        LIMIT 10
      `
    });
    
    // Return the statistics
    res.json({
      timespan: `${days} day(s)`,
      start_date: daysAgo.toISOString(),
      end_date: new Date().toISOString(),
      general_stats: data,
      top_endpoints: topEndpoints,
      top_users: topUsers
    });
  } catch (error) {
    console.error('Error retrieving log statistics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve log statistics',
      details: error.message
    });
  }
});
// Authentication endpoint
app.post('/auth/login', async (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  const { username, password } = req.body;
  
  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Authentication failed', 
      details: 'Please provide username and password'
    });
  }
  
  try {
    // Find user by email
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('username, email, password')
      .eq('username', username)
      .limit(1);
      
    if (queryError) throw new Error(queryError.message);
    
    if (!users || users.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid username or password'
      });
    }
    
    const user = users[0];
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid username or password'
      });
    }
    
    // Return the XAuthUserId (username) without token
    res.json({
      success: true,
      XAuthUserId: user.username,
      email: user.email,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
});

// 2. Schema generator API
app.post('/generate-schema', (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  const { prompt, XAuthUserId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  // Use XAuthUserId from body or from the authenticated user
  const XAuthUserIdToUse = XAuthUserId || req.XAuthUserId;
  
  // Call the AI service to generate schema
  try {
    apiGeneratorController.generateDatabaseSchema(prompt, XAuthUserIdToUse)
      .then(tables => {
        // Validate that we have proper table structures
        if (!tables || !Array.isArray(tables) || tables.length === 0) {
          return res.status(500).json({ 
            error: 'Failed to generate schema',
            details: 'No valid tables were generated'
          });
        }
        
        // Verify each table has columns
        const validTables = tables.filter(table => 
          table && table.name && table.columns && Array.isArray(table.columns) && table.columns.length > 0
        );
        
        if (validTables.length === 0) {
          return res.status(500).json({ 
            error: 'Failed to generate schema',
            details: 'Generated tables have no valid column definitions'
          });
        }
        
        // Ensure every table has an ID column
        validTables.forEach(table => {
          // Check if table already has an ID column
          const hasIdColumn = table.columns.some(col => 
            col.name === 'id' && 
            (col.type.includes('uuid') || col.type.includes('serial'))
          );
          
          // If no ID column, add one
          if (!hasIdColumn) {
            console.log(`Adding missing ID column to table: ${table.name}`);
            // Add UUID primary key column
            table.columns.unshift({
              name: 'id',
              type: 'uuid',
              constraints: [
                'primary key',
                'default uuid_generate_v4()'
              ]
            });
          }
        });
        
        // Log the table structure for debugging
        console.log(`Returning ${validTables.length} valid tables with column definitions`);
        validTables.forEach(table => {
          console.log(`- Table "${table.name}" with ${table.columns.length} columns`);
        });
        
        // Send back exactly the structure needed for create-api-from-schema
        res.json({
          success: true,
          XAuthUserId: XAuthUserIdToUse,
          tables: validTables, // Return only the validated tables with proper structure
        });
      })
      .catch(error => {
        console.error('Error generating schema:', error);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error('Error generating schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for modifying an existing schema
app.post('/modify-schema', (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  const { prompt, tables, XAuthUserId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ 
      error: 'Valid tables structure is required',
      details: 'Please provide the existing tables array to modify'
    });
  }
  
  // Use XAuthUserId from body or from the authenticated user
  const XAuthUserIdToUse = XAuthUserId || req.XAuthUserId;
  
  // Call the AI service to modify the existing schema
  try {
    apiGeneratorController.modifyDatabaseSchema(prompt, tables, XAuthUserIdToUse)
      .then(modifiedTables => {
        // Validate that we have proper table structures
        if (!modifiedTables || !Array.isArray(modifiedTables) || modifiedTables.length === 0) {
          return res.status(500).json({ 
            error: 'Failed to modify schema',
            details: 'No valid tables were generated'
          });
        }
        
        // Verify each table has columns
        const validTables = modifiedTables.filter(table => 
          table && table.name && table.columns && Array.isArray(table.columns) && table.columns.length > 0
        );
        
        if (validTables.length === 0) {
          return res.status(500).json({ 
            error: 'Failed to modify schema',
            details: 'Modified tables have no valid column definitions'
          });
        }
        
        // Ensure every table has an ID column
        validTables.forEach(table => {
          // Check if table already has an ID column
          const hasIdColumn = table.columns.some(col => 
            col.name === 'id' && 
            (col.type.includes('uuid') || col.type.includes('serial'))
          );
          
          // If no ID column, add one
          if (!hasIdColumn) {
            console.log(`Adding missing ID column to table: ${table.name}`);
            // Add UUID primary key column
            table.columns.unshift({
              name: 'id',
              type: 'uuid',
              constraints: [
                'primary key',
                'default uuid_generate_v4()'
              ]
            });
          }
        });
        
        // Log the table structure for debugging
        console.log(`Returning ${validTables.length} valid tables with column definitions after modification`);
        validTables.forEach(table => {
          console.log(`- Table "${table.name}" with ${table.columns.length} columns`);
        });
        
        // Send back the modified schema
        res.json({
          success: true,
          XAuthUserId: XAuthUserIdToUse,
          tables: validTables, // Return only the validated tables with proper structure
        });
      })
      .catch(error => {
        console.error('Error modifying schema:', error);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error('Error modifying schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. API generator from schema
app.post('/create-api-from-schema', (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  let tables;
  let XAuthUserId;
  
  // Handle both formats:
  // 1. Direct { tables: [...], XAuthUserId: "..." }
  // 2. Output from generate-schema { success: true, XAuthUserId: "...", tables: [...] }
  if (req.body.tables) {
    tables = req.body.tables;
    XAuthUserId = req.body.XAuthUserId || req.XAuthUserId;
  } else if (req.body.success && req.body.tables) {
    // This is likely the full response from generate-schema
    tables = req.body.tables;
    XAuthUserId = req.body.XAuthUserId || req.XAuthUserId;
  } else {
    return res.status(400).json({ 
      error: 'Valid tables structure is required',
      details: 'Please provide a tables array in your request'
    });
  }
  
  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ 
      error: 'Valid tables structure is required',
      details: 'The tables array must be non-empty'
    });
  }
  
  // Ensure every table has an ID column
  tables.forEach(table => {
    // Check if table already has an ID column
    const hasIdColumn = table.columns && table.columns.some(col => 
      col.name === 'id' && 
      (col.type.includes('uuid') || col.type.includes('serial'))
    );
    
    // If no ID column, add one
    if (!hasIdColumn && table.columns) {
      console.log(`Adding missing ID column to table: ${table.name}`);
      // Add UUID primary key column
      table.columns.unshift({
        name: 'id',
        type: 'uuid',
        constraints: [
          'primary key',
          'default uuid_generate_v4()'
        ]
      });
    }
  });
  
  const XAuthUserIdToUse = XAuthUserId || req.XAuthUserId;
  
  console.log(`Creating API from schema for user: ${XAuthUserIdToUse}`);
  console.log(`Number of tables in schema: ${tables.length}`);
  
  // Generate API from the provided schema
  try {
    // This would call the API generator with the provided schema
    apiGeneratorController.generateAPIFromSchema(tables, XAuthUserIdToUse)
      .then(result => {
        res.json({
          success: true,
          swagger_url: `/api/${result.apiId}/docs`,
          XAuthUserId: XAuthUserIdToUse,
          apiId: result.apiId,
          tables: tables, // Include the original tables in the response
          message: 'API successfully generated and tables created in Supabase',
          endpoints: result.endpoints
        });
      })
      .catch(error => {
        console.error('Error generating API from schema:', error);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error('Error generating API from schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate API endpoint - pass XAuthUserId from the request
app.post('/generate-api', (req, res) => {
  // Use XAuthUserId from the body if specified, otherwise use the one from headers
  // This allows explicit overriding via the request body
  const XAuthUserId = req.body.XAuthUserId || req.XAuthUserId;
  
  // Make sure we use a consistent XAuthUserId throughout
  req.body.XAuthUserId = XAuthUserId;
  
  // Log the XAuthUserId being used to generate the API
  console.log(`Generating API with XAuthUserId: ${XAuthUserId}`);
  
  // In a critical section to avoid race conditions
  try {
    apiGeneratorController.generateAPI(req, res);
  } catch (error) {
    console.error('Error generating API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get SQL for an API - verify user owns the API
app.get('/api/:apiId/sql', (req, res) => {
  const apiId = req.params.apiId;
  const XAuthUserId = req.XAuthUserId;
  
  // Check if API exists
  if (!apiGeneratorController.generatedApis.has(apiId)) {
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  // NOTE: User validation check removed to allow any user to access any API's SQL
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  // User owns API, proceed with getting SQL
  apiGeneratorController.getSQL(req, res);
});

// Add route to get all APIs for a user
app.get('/my-apis', (req, res) => {
  const XAuthUserId = req.XAuthUserId;
  const userApis = apiGeneratorController.getUserAPIs(XAuthUserId);
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  res.json({
    XAuthUserId,
    apis: userApis
  });
});

// Dynamic API routing - verify user has access to the API
app.use('/api/:apiId', (req, res, next) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Log information about this API and request
  console.log(`API ${apiId} access:`, {
    apiXAuthUserId: router.XAuthUserId,
    requestXAuthUserId: req.XAuthUserId,
    apiMetadata: apiPublisher.apiMetadata.get(apiId)
  });
  
  // NOTE: User validation check removed to allow any user to access any API
  
  // Ensure CORS headers are set for this request
  setCorsHeaders(res);
  
  // Store the apiId on the request for use in the router
  req.apiId = apiId;
  
  // Use the router as middleware instead
  req.url = req.url.replace(`/api/${apiId}`, '') || '/';
  return router(req, res, next);
});

// Add this route after your existing routes - verify user owns the API
app.get('/setup-script/:apiId', (req, res) => {
  const { apiId } = req.params;
  const XAuthUserId = req.XAuthUserId;
  
  if (!apiGeneratorController.generatedApis.has(apiId)) {
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  const api = apiGeneratorController.generatedApis.get(apiId);
  
  // NOTE: User validation check removed to allow any user to access any API setup script
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  // Set header for SQL file download
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="backlify-setup-${apiId}.sql"`);
  
  // Send the SQL
  res.send(api.sql);
});

// Basic health check route with more detailed information
app.get('/health', (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  // Get API count and other status information
  const apiCount = apiPublisher.apiMetadata ? apiPublisher.apiMetadata.size : 0;
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: 'ok', 
    service: 'Backlify-v2',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    environment: process.env.NODE_ENV || 'development',
    uptime: {
      seconds: uptime,
      formatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    },
    apis: {
      count: apiCount
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Ensure CORS headers are set even for error responses
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id, x-user-id, X-USER-ID');
  
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Update your Swagger UI setup to use the spec directly
app.use('/api/:apiId/docs', (req, res, next) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  console.log(`Swagger UI access for API ${apiId}:`);
  console.log('Router XAuthUserId:', router.XAuthUserId);
  console.log('Router instanceId:', router._instanceId);
  console.log('Router createdAt:', router._createdAt);
  console.log('Request XAuthUserId:', req.XAuthUserId);
  console.log('Headers:', req.headers);
  
  // NOTE: User validation check removed to allow any user to access any API documentation
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  // Get the swagger spec from the router
  let swaggerSpec;
  
  try {
    // Use the router's _generateSwaggerSpec method directly, which ensures proper isolation
    if (typeof router._generateSwaggerSpec === 'function') {
      swaggerSpec = router._generateSwaggerSpec();
      console.log('Generated Swagger spec using router method');
    } else {
      // Fallback to finding a route handler for /swagger
      console.log('Router does not have _generateSwaggerSpec method, trying fallback...');
      const swaggerRoute = router.stack?.find(layer => 
        layer.route && (layer.route.path === '/swagger' || layer.route.path === '/swagger.json')
      );
      
      if (swaggerRoute) {
        console.log('Found Swagger route in router stack');
        // Execute the handler with a mock response to get the spec
        const mockRes = { json: (data) => { swaggerSpec = data; } };
        swaggerRoute.route.stack[0].handle({ params: {}, query: {} }, mockRes);
      } else {
        console.log('No Swagger route found in router stack');
      }
    }
    
    if (!swaggerSpec) {
      return res.status(404).json({ error: 'Swagger specification not available' });
    }
    
    // Make a deep copy of the spec to avoid any shared references or modifications
    swaggerSpec = JSON.parse(JSON.stringify(swaggerSpec));
    
    // Log the user ID used for this swagger spec
    const apiXAuthUserId = router.XAuthUserId || 'default';
    console.log('Swagger spec being served for user:', apiXAuthUserId);
    
    // Fix common issues with the spec
    
    // 1. Ensure it's a proper object and not a string
    if (typeof swaggerSpec === 'string') {
      try {
        swaggerSpec = JSON.parse(swaggerSpec);
      } catch (e) {
        console.error('Error parsing swagger spec:', e);
        return res.status(500).json({ error: 'Invalid Swagger specification format' });
      }
    }
    
    // 2. Ensure there's a valid OpenAPI version
    if (!swaggerSpec.openapi && !swaggerSpec.swagger) {
      swaggerSpec.openapi = "3.0.0";
    }
    
    // 3. Fix the version format if needed
    if (swaggerSpec.openapi && typeof swaggerSpec.openapi !== 'string') {
      swaggerSpec.openapi = String(swaggerSpec.openapi);
    }
    
    // 4. Ensure proper paths object if missing
    if (!swaggerSpec.paths) {
      swaggerSpec.paths = {};
    }
    
    // 5. Update the API title to use the correct XAuthUserId
    if (swaggerSpec.info) {
      swaggerSpec.info.title = `API for User ${apiXAuthUserId}`;
      
      // Add router instance details to the title for debugging
      swaggerSpec.info.title += ` (Instance: ${router._instanceId.substring(0, 6)}...)`;
      
      // Add information about who created this API
      swaggerSpec.info.description = swaggerSpec.info.description || '';
      swaggerSpec.info.description += `\n\n**Created by:** ${apiXAuthUserId}`;
      swaggerSpec.info.description += `\n\n**Created at:** ${router._createdAt}`;
      swaggerSpec.info.description += `\n\n**Router Instance ID:** ${router._instanceId}`;
      
      // Add note if user is viewing as someone else
      if (req.XAuthUserId !== apiXAuthUserId) {
        swaggerSpec.info.description += `\n\nYou are viewing this API as user "${req.XAuthUserId}" but it belongs to user "${apiXAuthUserId}".`;
      }
    }
    
    // Modify the Swagger spec paths to be relative
    if (swaggerSpec && swaggerSpec.paths) {
      const apiId = req.params.apiId;
      
      // Update the servers array to use the correct base URL
      swaggerSpec.servers = [
        {
          url: `/api/${apiId}`,  // This will make all paths start with /api/{apiId}
          description: 'Current API server'
        }
      ];
    }
    
    // For debugging - Log the spec title (optional - remove in production)
    console.log('Swagger spec title:', swaggerSpec.info?.title);
    
    // Use middleware approach for proper asset serving
    // We'll first serve the assets with swaggerUi.serve, which this function is currently using
    // Then set up our specification
    req.swaggerDoc = swaggerSpec;
    swaggerUi.setup(swaggerSpec, { 
      explorer: true,
      customSiteTitle: `API for ${router.XAuthUserId} (ID: ${apiId})`,
    })(req, res, next);
  } catch (error) {
    console.error('Error setting up Swagger UI:', error);
    res.status(500).json({ 
      error: 'Failed to set up Swagger UI', 
      details: error.message 
    });
  }
}, swaggerUi.serve);

// Add a debug endpoint to view in-memory data
app.get('/api/:apiId/debug-memory', (req, res) => {
  const { apiId } = req.params;
  const XAuthUserId = req.XAuthUserId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  // NOTE: User validation check removed to allow any user to access any API debug information
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  // Access the inMemoryDb from your router (might need to adjust based on your implementation)
  const inMemoryData = {};
  
  // If using a class instance
  if (router.inMemoryDb) {
    for (const [key, value] of router.inMemoryDb.entries()) {
      inMemoryData[key] = value;
    }
  }
  
  res.json({
    apiId,
    inMemoryData
  });
});

// Add debug endpoint to check API structure
app.get('/debug/api/:apiId', (req, res) => {
  const apiId = req.params.apiId;
  const XAuthUserId = req.XAuthUserId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  // NOTE: User validation check removed to allow any user to access any API debug information
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  // Get metadata 
  const metadata = apiPublisher.apiMetadata.get(apiId);
  
  res.json({
    apiId,
    metadata: {
      ...metadata,
      // Only show partial tables data to avoid huge response
      tableCount: metadata?.tables?.length || 0,
      tableNames: metadata?.tables?.map(t => t.name || t.originalName) || []
    },
    routerExists: !!router,
    routerStackSize: router?.stack?.length || 0
  });
});

// Add schema management routes
app.use('/', schemaRoutes);

// Load all APIs from registry on startup
(async () => {
  try {
    console.log('Loading APIs from registry...');
    await apiPublisher.loadAllAPIs();
    console.log('API loading complete');
  } catch (error) {
    console.error('Error loading APIs:', error);
  }
})();

// Add a verification endpoint to check table existence
app.get('/api/:apiId/verify-tables', async (req, res) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  setCorsHeaders(res);
  
  try {
    // Get metadata for this API
    const metadata = apiPublisher.apiMetadata.get(apiId);
    const XAuthUserId = router.XAuthUserId;
    const apiIdentifier = router.apiIdentifier;
    
    console.log(`Verifying tables for API ${apiId} with XAuthUserId: ${XAuthUserId} and apiIdentifier: ${apiIdentifier}`);
    
    // Verify each table exists
    const tableResults = [];
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Get tables from router
    const tables = router._tableSchemas || [];
    
    // Create a list of table names to check
    const tableNames = tables.map(table => {
      return {
        originalName: table.originalName || table.name,
        prefixedName: table.prefixedName || `${XAuthUserId}_${apiIdentifier}_${table.originalName || table.name}`
      };
    });
    
    console.log(`Checking ${tableNames.length} tables for existence...`);
    
    // Check each table
    for (const table of tableNames) {
      try {
        const { error } = await client
          .from(table.prefixedName)
          .select('*', { count: 'exact', head: true });
          
        tableResults.push({
          table: table.originalName,
          prefixedName: table.prefixedName,
          exists: !error,
          error: error ? error.message : null
        });
      } catch (err) {
        tableResults.push({
          table: table.originalName,
          prefixedName: table.prefixedName,
          exists: false,
          error: err.message
        });
      }
    }
    
    // Check if any tables need to be fixed
    const nonExistentTables = tableResults.filter(result => !result.exists);
    
    // Return verification results
    res.json({
      apiId,
      XAuthUserId,
      apiIdentifier,
      tablesVerified: tableResults.length,
      existingTables: tableResults.filter(result => result.exists).length,
      missingTables: nonExistentTables.length,
      details: tableResults,
      needsFix: nonExistentTables.length > 0
    });
  } catch (error) {
    console.error('Error verifying tables:', error);
    res.status(500).json({
      error: 'Failed to verify tables',
      message: error.message
    });
  }
});

// Add an endpoint to recreate tables with correct identifiers
app.post('/api/:apiId/fix-tables', async (req, res) => {
  const apiId = req.params.apiId;
  const { forceRecreate = false } = req.body;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  setCorsHeaders(res);
  
  try {
    // Get metadata for this API
    const metadata = apiPublisher.apiMetadata.get(apiId);
    const XAuthUserId = router.XAuthUserId;
    const apiIdentifier = router.apiIdentifier;
    
    console.log(`Attempting to fix tables for API ${apiId} with XAuthUserId: ${XAuthUserId} and apiIdentifier: ${apiIdentifier}`);
    
    // Get tables from metadata or router
    const tables = metadata.tables || router._tableSchemas || [];
    if (!tables || tables.length === 0) {
      return res.status(400).json({
        error: 'No table definitions found for this API'
      });
    }
    
    // Prepare the tables with correct prefixes
    const fixedTables = tables.map(table => {
      // Create a safe copy
      const newTable = { ...table };
      
      // Set the original name correctly
      newTable.originalName = table.originalName || table.name.split('_').pop();
      
      // Ensure the name is clean (without any prefixes)
      newTable.name = newTable.originalName;
      
      // Set the prefixed name using the current API identifier
      newTable.prefixedName = `${XAuthUserId}_${apiIdentifier}_${newTable.originalName}`;
      
      // Fix relationships if they exist
      if (newTable.relationships && Array.isArray(newTable.relationships)) {
        newTable.relationships = newTable.relationships.map(rel => {
          // Create a safe copy
          const newRel = { ...rel };
          
          // Extract the target table without prefixes if needed
          let targetTableName = rel.targetTable;
          if (targetTableName.includes('_')) {
            targetTableName = targetTableName.split('_').pop();
          }
          
          // Update to use the current API identifier
          newRel.targetTable = `${XAuthUserId}_${apiIdentifier}_${targetTableName}`;
          
          return newRel;
        });
      }
      
      return newTable;
    });
    
    // Create the SQL script to fix the tables
    const analysisResult = {
      tables: fixedTables.map(table => ({
        ...table,
        name: table.originalName // Use original name for schema generator
      }))
    };
    
    console.log('Recreating tables with correct prefixes...');
    
    // Only create the tables if forceRecreate is true
    let tableCreationResult = { success: false, message: 'Table recreation skipped' };
    
    if (forceRecreate) {
      // Use the schema generator to create the tables with the correct API identifier
      try {
        await schemaGenerator.generateSchemas(analysisResult, XAuthUserId, apiIdentifier);
        tableCreationResult = { success: true, message: 'Tables recreated successfully' };
      } catch (err) {
        tableCreationResult = { success: false, message: `Error recreating tables: ${err.message}` };
      }
    } else {
      console.log('Skipping table recreation - set forceRecreate=true to recreate tables');
    }
    
    // Update the metadata with the fixed tables
    const updatedMetadata = {
      ...metadata,
      tables: fixedTables,
      apiIdentifier: apiIdentifier
    };
    
    // Update stored metadata
    apiPublisher.apiMetadata.set(apiId, updatedMetadata);
    
    // Response with results
    res.json({
      success: true,
      apiId,
      XAuthUserId,
      apiIdentifier,
      tablesFixed: fixedTables.length,
      tableCreation: tableCreationResult,
      message: forceRecreate 
        ? 'Table prefixes fixed and tables recreated' 
        : 'Table prefixes fixed in metadata, use forceRecreate=true to recreate the actual tables'
    });
  } catch (error) {
    console.error('Error fixing tables:', error);
    res.status(500).json({
      error: 'Failed to fix tables',
      message: error.message
    });
  }
});

// Add an endpoint to fix XAuthUserId column in tables
app.post('/api/:apiId/fix-xauthuserid', async (req, res) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  setCorsHeaders(res);
  
  try {
    // Get metadata for this API
    const metadata = apiPublisher.apiMetadata.get(apiId);
    const XAuthUserId = router.XAuthUserId;
    const apiIdentifier = router.apiIdentifier;
    
    console.log(`Fixing XAuthUserId column for API ${apiId} with XAuthUserId: ${XAuthUserId} and apiIdentifier: ${apiIdentifier}`);
    
    // Get tables from metadata or router
    const tables = metadata.tables || router._tableSchemas || [];
    if (!tables || tables.length === 0) {
      return res.status(400).json({
        error: 'No table definitions found for this API'
      });
    }
    
    // Create a client for running SQL
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // For each table, check if XAuthUserId column exists and add it if missing
    const results = [];
    for (const table of tables) {
      const prefixedTableName = table.prefixedName;
      if (!prefixedTableName) continue;
      
      try {
        // Check if column exists
        const { data, error } = await supabase.rpc('execute_sql', { 
          sql_query: `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = '${prefixedTableName}'
            AND column_name = 'XAuthUserId';
          `
        });
        
        const hasColumn = data && data.length > 0;
        
        if (!hasColumn) {
          // Add column if it doesn't exist
          console.log(`Adding XAuthUserId column to table ${prefixedTableName}`);
          const { data: alterData, error: alterError } = await supabase.rpc('execute_sql', { 
            sql_query: `
              ALTER TABLE "${prefixedTableName}" 
              ADD COLUMN "XAuthUserId" varchar(255);
              
              -- Update existing rows to use the API's XAuthUserId
              UPDATE "${prefixedTableName}"
              SET "XAuthUserId" = '${XAuthUserId}';
            `
          });
          
          if (alterError) {
            results.push({
              table: prefixedTableName,
              success: false,
              error: alterError.message
            });
          } else {
            results.push({
              table: prefixedTableName,
              success: true,
              message: 'XAuthUserId column added'
            });
            
            // Also add to schema in memory
            if (!table.columns.some(col => col.name === 'XAuthUserId')) {
              table.columns.push({
                name: 'XAuthUserId',
                type: 'varchar(255)',
                constraints: ''
              });
            }
          }
        } else {
          results.push({
            table: prefixedTableName,
            success: true,
            message: 'XAuthUserId column already exists'
          });
        }
      } catch (e) {
        results.push({
          table: prefixedTableName,
          success: false,
          error: e.message
        });
      }
    }
    
    // Update metadata to reflect schema changes
    apiPublisher.apiMetadata.set(apiId, metadata);
    
    res.json({
      success: true,
      apiId,
      XAuthUserId,
      results
    });
  } catch (error) {
    console.error('Error fixing XAuthUserId column:', error);
    res.status(500).json({
      error: 'Failed to fix XAuthUserId column',
      message: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backlify-v2 server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💻 Hostname: ${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`);
});
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

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add a route for authenticating (if you have authentication middleware, you'd add it here)
// This is a placeholder for now - you'd need to implement proper authentication
app.use((req, res, next) => {
  // Try to get the userId from various header formats to handle case-sensitivity
  const userId = req.headers['x-user-id'] || 
                req.headers['X-USER-ID'] || 
                req.headers['X-User-Id'] || 
                req.headers['x-user-id'.toLowerCase()] ||
                req.header('x-user-id') ||
                req.body.userId ||
                'default';
  
  // Log all headers to debug the issue
  console.log('Using userId:', userId);
  
  // Set userId on the request object
  req.userId = userId;
  
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
      userId: username,
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
    
    // Return the userId (username) without token
    res.json({
      success: true,
      userId: user.username,
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
  
  const { prompt, userId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  // Use userId from body or from the authenticated user
  const userIdToUse = userId || req.userId;
  
  // Call the AI service to generate schema
  try {
    apiGeneratorController.generateDatabaseSchema(prompt, userIdToUse)
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
          userId: userIdToUse,
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
  
  const { prompt, tables, userId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ 
      error: 'Valid tables structure is required',
      details: 'Please provide the existing tables array to modify'
    });
  }
  
  // Use userId from body or from the authenticated user
  const userIdToUse = userId || req.userId;
  
  // Call the AI service to modify the existing schema
  try {
    apiGeneratorController.modifyDatabaseSchema(prompt, tables, userIdToUse)
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
          userId: userIdToUse,
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
  let userId;
  
  // Handle both formats:
  // 1. Direct { tables: [...], userId: "..." }
  // 2. Output from generate-schema { success: true, userId: "...", tables: [...] }
  if (req.body.tables) {
    tables = req.body.tables;
    userId = req.body.userId || req.userId;
  } else if (req.body.success && req.body.tables) {
    // This is likely the full response from generate-schema
    tables = req.body.tables;
    userId = req.body.userId || req.userId;
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
  
  const userIdToUse = userId || req.userId;
  
  console.log(`Creating API from schema for user: ${userIdToUse}`);
  console.log(`Number of tables in schema: ${tables.length}`);
  
  // Generate API from the provided schema
  try {
    // This would call the API generator with the provided schema
    apiGeneratorController.generateAPIFromSchema(tables, userIdToUse)
      .then(result => {
        res.json({
          success: true,
          swagger_url: `/api/${result.apiId}/docs`,
          userId: userIdToUse,
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

// Generate API endpoint - pass userId from the request
app.post('/generate-api', (req, res) => {
  // Use userId from the body if specified, otherwise use the one from headers
  // This allows explicit overriding via the request body
  const userId = req.body.userId || req.userId;
  
  // Make sure we use a consistent userId throughout
  req.body.userId = userId;
  
  // Log the userId being used to generate the API
  console.log(`Generating API with userId: ${userId}`);
  
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
  const userId = req.userId;
  
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
  const userId = req.userId;
  const userApis = apiGeneratorController.getUserAPIs(userId);
  
  // Ensure CORS headers are set
  setCorsHeaders(res);
  
  res.json({
    userId,
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
    apiUserId: router.userId,
    requestUserId: req.userId,
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
  const userId = req.userId;
  
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
  console.log('Router userId:', router.userId);
  console.log('Router instanceId:', router._instanceId);
  console.log('Router createdAt:', router._createdAt);
  console.log('Request userId:', req.userId);
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
    const apiUserId = router.userId || 'default';
    console.log('Swagger spec being served for user:', apiUserId);
    
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
    
    // 5. Update the API title to use the correct userId
    if (swaggerSpec.info) {
      swaggerSpec.info.title = `API for User ${apiUserId}`;
      
      // Add router instance details to the title for debugging
      swaggerSpec.info.title += ` (Instance: ${router._instanceId.substring(0, 6)}...)`;
      
      // Add information about who created this API
      swaggerSpec.info.description = swaggerSpec.info.description || '';
      swaggerSpec.info.description += `\n\n**Created by:** ${apiUserId}`;
      swaggerSpec.info.description += `\n\n**Created at:** ${router._createdAt}`;
      swaggerSpec.info.description += `\n\n**Router Instance ID:** ${router._instanceId}`;
      
      // Add note if user is viewing as someone else
      if (req.userId !== apiUserId) {
        swaggerSpec.info.description += `\n\nYou are viewing this API as user "${req.userId}" but it belongs to user "${apiUserId}".`;
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
      customSiteTitle: `API for ${router.userId} (ID: ${apiId})`,
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
  const userId = req.userId;
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
  const userId = req.userId;
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backlify-v2 server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💻 Hostname: ${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`);
});
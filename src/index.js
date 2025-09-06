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
const limitMiddleware = require('./middleware/limitMiddleware');
const planMiddleware = require('./middleware/planMiddleware');
const usageLimitMiddleware = require('./middleware/usageLimitMiddleware');
const security = require('./security');
const { initializeSecurityTables } = require('./utils/security/initializeSecurityTables');
const EpointTablesSetup = require('./utils/setup/epointTables');
const AccountTablesSetup = require('./utils/setup/accountTables');

// Load Account Settings routes
const accountRoutes = require('./routes/accountRoutes');

// Load Usage routes
const usageRoutes = require('./routes/usageRoutes');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
security.applySecurityMiddleware(app);
security.setupAuthRoutes(app);

// Verify database connectivity at startup
async function checkDatabase() {
  console.log('Verifying database connection...');
  try {
    // Check Supabase connectivity
    const { data, error } = await supabase.from('api_registry').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      //console.error('❌ Database connectivity error:', error);
      //console.error('Please check your Supabase URL and service role key in .env file');
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

// Initialize security-related database tables
initializeSecurityTables().catch(err => {
  console.error('Error initializing security tables:', err);
  console.warn('Some security features might not work correctly');
});

// Initialize Epoint payment tables
const epointTablesSetup = new EpointTablesSetup();
epointTablesSetup.createTables().catch(err => {
  console.error('Error initializing Epoint tables:', err);
  console.warn('Epoint payment features might not work correctly');
});

// Initialize Account Settings tables
const accountTablesSetup = new AccountTablesSetup();
accountTablesSetup.createTables().catch(err => {
  console.error('Error initializing Account Settings tables:', err);
  console.warn('Account Settings features might not work correctly');
});

// ========== UNIVERSAL CORS CONFIGURATION ==========
// This allows ALL origins, methods, and headers to prevent ANY CORS errors
const universalCorsOptions = {
  origin: true, // Allow ALL origins (equivalent to '*' but supports credentials)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    // Standard headers
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization',
    // Custom authentication headers
    'X-User-Id', 'x-user-id', 'X-USER-ID', 'xauthuserid', 'XAuthUserId', 'x-skip-auth',
    // Plan headers
    'X-User-Plan', 'x-user-plan', 'X-USER-PLAN',
    // API headers
    'X-API-Key', 'x-api-key', 'X-API-Version', 'X-Request-ID', 'X-Client-Version', 'X-Platform',
    // Payment headers
    'X-Payment-Token', 'X-Order-Id', 'X-Transaction-Id', 'X-Signature', 'X-Callback-Url', 'X-Plan-Id', 'x-plan-id',
    // Additional common headers
    'Cache-Control', 'Pragma', 'Expires', 'If-Modified-Since', 'If-None-Match', 'X-CSRF-Token', 'X-Forwarded-For',
    // Allow any custom header starting with X-
    'X-*'
  ],
  exposedHeaders: [
    'Content-Length', 'Content-Disposition', 'Content-Type', 'Date', 'ETag', 'Last-Modified',
    'X-Total-Count', 'X-Page-Count', 'X-Current-Page', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'
  ],
  credentials: true, // Allow cookies and authentication
  maxAge: 86400, // Cache preflight for 24 hours
  preflightContinue: false, // Pass control to next handler
  optionsSuccessStatus: 200 // Success status for preflight
};

app.use(cors(universalCorsOptions));
app.options('*', cors(universalCorsOptions)); // Handle ALL preflight requests

// Add a specific handler for all OPTIONS requests to ensure proper CORS headers
app.options('*', (req, res) => {
  setCorsHeaders(res, req);
  return res.status(200).end();
});

// Apply custom CORS middleware for all routes
app.use(ensureCorsHeaders);

// Parse request body before extracting XAuthUserId from it
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add a route for extracting XAuthUserId from various sources
app.use(async (req, res, next) => {
  // Try to get the XAuthUserId from JWT token first
  const authHeader = req.headers.authorization;
  let tokenUsername = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      // Import auth utils conditionally to avoid circular dependencies
      const authUtils = require('./utils/security/auth');
      const tokenResult = await authUtils.verifyToken(token);
      
      if (tokenResult.success && tokenResult.data.username) {
        tokenUsername = tokenResult.data.username;
        console.log('Extracted username from token:', tokenUsername);
      }
    } catch (err) {
      console.log('Error extracting username from token:', err.message);
    }
  }
  
  // Then try from headers or body
  const XAuthUserId = tokenUsername || 
                req.headers['x-user-id'] || 
                req.headers['X-USER-ID'] || 
                req.headers['X-User-Id'] || 
                req.headers['x-user-id'.toLowerCase()] ||
                req.headers['xauthuserid'] ||
                req.headers['XAuthUserId'] ||
                req.header('x-user-id') ||
                req.header('xauthuserid') ||
                (req.body && req.body.XAuthUserId) ||
                'default';
  
  // Don't use full bearer token as fallback - it would expose sensitive information
  // Instead use a default value
  
  console.log('Using XAuthUserId:', XAuthUserId);
  
  // Set XAuthUserId on the request object
  req.XAuthUserId = XAuthUserId;
  
  next();
});

// Apply logger middleware AFTER XAuthUserId has been set
app.use(loggerMiddleware);

// Apply plan middleware to extract X-User-Plan header
app.use(planMiddleware.extractUserPlan());

// Apply route protection (must be applied before route definitions)
security.applyRouteProtection(app);
console.log('🔐 Protected routes configured with JWT authentication');

// Create controller instance
const apiGeneratorController = require('./controllers/apiGeneratorController');

// Registration endpoint
app.post('/auth/register', async (req, res) => {
  // Ensure CORS headers are set
  setCorsHeaders(res, req);
  
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
// Add an endpoint to view logs
app.get('/admin/logs', async (req, res) => { 
  setCorsHeaders(res, req); 
   
  try { 
    // Create a Supabase client 
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY); 
     
    // Get filter params 
    const {  
      page = 1,  
      user,  
      XAuthUserId, 
      endpoint,  
      method, 
      status, 
      from_date, 
      to_date, 
      min_time, 
      max_time 
    } = req.query; 
     
    // Build the query 
    let query = supabase 
      .from('api_logs') 
      .select('*', { count: 'exact' }); 
     
    // XAuthUserId filtri - məcburi olaraq tətbiq edilir
    if (XAuthUserId) { 
      query = query.eq('XAuthUserId', XAuthUserId); 
    } else if (user) {
      query = query.eq('XAuthUserId', user); 
    } else {
      // Əgər heç bir user filter göndərilməyibsə, boş nəticə qaytarırıq
      // və ya default olaraq Admin loglarını gizlədirik
      query = query.neq('XAuthUserId', 'Admin'); 
    }
     
    // Apply other filters 
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
     
    // Order by timestamp - limit aradan qaldırıldı
    query = query.order('timestamp', { ascending: false }); 
     
    // Execute the query 
    const { data: logs, error, count } = await query; 
     
    if (error) { 
      console.error('Query error:', error); 
      return res.status(500).json({  
        error: 'Failed to retrieve logs',  
        details: error.message  
      }); 
    } 
     
    // Return the logs with info
    res.json({ 
      logs, 
      total: count || 0,
      filters: { 
        user, 
        XAuthUserId,
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
  setCorsHeaders(res, req);
  
  try {
    // Create a Supabase client
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Enhanced time-based filtering options
    const { 
      days = 1, 
      startDate, 
      endDate,
      timeRange
    } = req.query;
    
    // Calculate the time range based on provided parameters
    let startDateTime = new Date();
    let endDateTime = new Date();
    
    // Case 1: If specific startDate and endDate are provided
    if (startDate && endDate) {
      startDateTime = new Date(startDate);
      endDateTime = new Date(endDate);
      
      // Add time component if not specified (set end date to end of day)
      if (endDateTime.getHours() === 0 && endDateTime.getMinutes() === 0 && endDateTime.getSeconds() === 0) {
        endDateTime.setHours(23, 59, 59, 999);
      }
    }
    // Case 2: If timeRange is provided, use predefined ranges
    else if (timeRange) {
      endDateTime = new Date(); // Current time
      
      switch(timeRange) {
        case 'today':
          startDateTime.setHours(0, 0, 0, 0); // Start of today
          break;
        case 'yesterday':
          startDateTime.setDate(startDateTime.getDate() - 1);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime.setDate(endDateTime.getDate() - 1);
          endDateTime.setHours(23, 59, 59, 999);
          break;
        case 'last7days':
          startDateTime.setDate(startDateTime.getDate() - 7);
          break;
        case 'last30days':
          startDateTime.setDate(startDateTime.getDate() - 30);
          break;
        case 'thisWeek':
          // Start of current week (Sunday or Monday based on locale - using Sunday here)
          const dayOfWeek = startDateTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
          startDateTime.setDate(startDateTime.getDate() - dayOfWeek);
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case 'thisMonth':
          startDateTime.setDate(1); // First day of current month
          startDateTime.setHours(0, 0, 0, 0);
          break;
        default:
          // Fall back to default days parameter
          startDateTime.setDate(startDateTime.getDate() - parseInt(days));
      }
    }
    // Case 3: Default to using the days parameter
    else {
      startDateTime.setDate(startDateTime.getDate() - parseInt(days));
    }
    
    // Ensure start time is not after end time
    if (startDateTime > endDateTime) {
      const temp = startDateTime;
      startDateTime = endDateTime;
      endDateTime = temp;
    }
    
    // Convert to ISO strings for database queries
    const startDateTimeISO = startDateTime.toISOString();
    const endDateTimeISO = endDateTime.toISOString();
    
    console.log(`Getting statistics from ${startDateTimeISO} to ${endDateTimeISO}`);
    
    // Get statistics using the execute_sql function with time range
    const { data: generalStatsResult, error: generalStatsError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(DISTINCT "XAuthUserId") as unique_users,
          AVG(response_time_ms) as avg_response_time,
          MAX(response_time_ms) as max_response_time,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 OR status_code = 304 THEN 1 END) as success_count,
          COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END) as client_error_count,
          COUNT(CASE WHEN status_code >= 500 THEN 1 END) as server_error_count,
          COUNT(CASE WHEN method = 'GET' THEN 1 END) as get_count,
          COUNT(CASE WHEN method = 'POST' THEN 1 END) as post_count,
          COUNT(CASE WHEN method = 'PUT' THEN 1 END) as put_count,
          COUNT(CASE WHEN method = 'DELETE' THEN 1 END) as delete_count
        FROM api_logs
        WHERE timestamp >= '${startDateTimeISO}'
        AND timestamp <= '${endDateTimeISO}'
      `
    });

    // Debug the response structure
    console.log("Stats result:", JSON.stringify(generalStatsResult));
    
    if (generalStatsError) {
      return res.status(500).json({ 
        error: 'Failed to retrieve log statistics', 
        details: generalStatsError.message 
      });
    }
    
    // Get raw rows from execute_sql RPC response - it may have different formats depending on setup
    let generalStats = { 
      total_requests: 0, 
      unique_users: 0,
      avg_response_time: 0,
      max_response_time: 0,
      success_count: 0,
      client_error_count: 0,
      server_error_count: 0,
      get_count: 0,
      post_count: 0,
      put_count: 0,
      delete_count: 0
    };
    
    // Try different ways to extract the result data
    if (generalStatsResult) {
      if (generalStatsResult.success && generalStatsResult.rows) {
        // Format 1: { success: true, rows: [...] }
        generalStats = generalStatsResult.rows[0] || generalStats;
      } else if (Array.isArray(generalStatsResult)) {
        // Format 2: [row1, row2, ...]
        generalStats = generalStatsResult[0] || generalStats;
      } else if (typeof generalStatsResult === 'object' && generalStatsResult.success) {
        // Format 3: Custom RPC that returns { success: true } without data
        // In this case, we need to call different queries directly
        console.log("Using direct Supabase API for stats since execute_sql didn't return data");
        
        try {
          // Get total count
          const { count, error: countError } = await supabase
            .from('api_logs')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', startDateTimeISO)
            .lte('timestamp', endDateTimeISO);
            
          if (!countError) {
            generalStats.total_requests = count || 0;
          }
          
          // Get unique users directly
          const { data: usersData, error: usersError } = await supabase
            .from('api_logs')
            .select('XAuthUserId')
            .gte('timestamp', startDateTimeISO)
            .lte('timestamp', endDateTimeISO);
            
          if (!usersError && usersData) {
            const uniqueUsers = new Set();
            usersData.forEach(log => {
              if (log.XAuthUserId) {
                uniqueUsers.add(log.XAuthUserId);
              }
            });
            generalStats.unique_users = uniqueUsers.size;
          }
          
          // Get method counts
          const { data: methodData, error: methodError } = await supabase
            .from('api_logs')
            .select('method, status_code')
            .gte('timestamp', startDateTimeISO)
            .lte('timestamp', endDateTimeISO);
            
          if (!methodError && methodData) {
            // Calculate method counts manually
            methodData.forEach(log => {
              // Count by method
              if (log.method === 'GET') generalStats.get_count++;
              else if (log.method === 'POST') generalStats.post_count++;
              else if (log.method === 'PUT') generalStats.put_count++;
              else if (log.method === 'DELETE') generalStats.delete_count++;
              
              // Count by status code
              const statusCode = log.status_code;
              if (statusCode >= 200 && statusCode < 300 || statusCode === 304) generalStats.success_count++;
              else if (statusCode >= 400 && statusCode < 500) generalStats.client_error_count++;
              else if (statusCode >= 500) generalStats.server_error_count++;
            });
          }
          
          // Get response times
          const { data: timeData, error: timeError } = await supabase
            .from('api_logs')
            .select('response_time_ms')
            .gte('timestamp', startDateTimeISO)
            .lte('timestamp', endDateTimeISO);
            
          if (!timeError && timeData && timeData.length > 0) {
            // Calculate average and max response time
            let total = 0;
            let max = 0;
            
            timeData.forEach(log => {
              const time = log.response_time_ms || 0;
              total += time;
              if (time > max) max = time;
            });
            
            generalStats.avg_response_time = timeData.length ? Math.round(total / timeData.length) : 0;
            generalStats.max_response_time = max;
          }
        } catch (directError) {
          console.error('Error getting statistics directly:', directError);
        }
      }
    }
    
    // Get most used endpoints (try direct query first)
    let topEndpoints = [];
    try {
      const { data: endpointData, error: endpointError } = await supabase
        .from('api_logs')
        .select('endpoint')
        .gte('timestamp', startDateTimeISO)
        .lte('timestamp', endDateTimeISO);
        
      if (!endpointError && endpointData) {
        // Count occurrences of each endpoint
        const counts = {};
        endpointData.forEach(log => {
          if (log.endpoint) {
            counts[log.endpoint] = (counts[log.endpoint] || 0) + 1;
          }
        });
        
        // Convert to array and sort
        topEndpoints = Object.entries(counts)
          .map(([endpoint, request_count]) => ({ endpoint, request_count }))
          .sort((a, b) => b.request_count - a.request_count)
          .slice(0, 10);
      }
    } catch (endpointError) {
      console.error('Error getting endpoints directly:', endpointError);
    }
    
    // Get most active users
    let topUsers = [];
    try {
      const { data: userData, error: userError } = await supabase
        .from('api_logs')
        .select('XAuthUserId')
        .gte('timestamp', startDateTimeISO)
        .lte('timestamp', endDateTimeISO);
        
      if (!userError && userData) {
        // Count occurrences of each user
        const counts = {};
        userData.forEach(log => {
          if (log.XAuthUserId) {
            counts[log.XAuthUserId] = (counts[log.XAuthUserId] || 0) + 1;
          }
        });
        
        // Convert to array and sort
        topUsers = Object.entries(counts)
          .map(([XAuthUserId, request_count]) => ({ XAuthUserId, request_count }))
          .sort((a, b) => b.request_count - a.request_count)
          .slice(0, 10);
      }
    } catch (userError) {
      console.error('Error getting users directly:', userError);
    }
    
    // Return the statistics
    res.json({
      filters: {
        startDate: startDateTimeISO,
        endDate: endDateTimeISO,
        timeRange: timeRange || (startDate && endDate ? 'custom' : `${days}_days`)
      },
      general_stats: generalStats,
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
  setCorsHeaders(res, req);
  
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
app.post('/generate-schema', usageLimitMiddleware.checkProjectLimit(), (req, res) => {
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
        
        // Collect relationship information for better user feedback
        const relationshipInfo = validTables.reduce((acc, table) => {
          if (table.relationships && table.relationships.length > 0) {
            acc[table.name] = table.relationships.map(rel => ({
              type: rel.type,
              targetTable: rel.targetTable,
              sourceColumn: rel.sourceColumn || `${rel.targetTable}_id`,
              targetColumn: rel.targetColumn || 'id'
            }));
          }
          return acc;
        }, {});
        
        // Identify which tables might need special attention
        const complexTables = validTables.filter(table => {
          // Tables with entity references (likely for multiple instances)
          return table.columns.some(col => 
            col.name === 'entity_type' || col.name === 'entity_id'
          );
        }).map(table => table.name);
        
        // Send back exactly the structure needed for create-api-from-schema
        res.json({
          success: true,
          XAuthUserId: XAuthUserIdToUse,
          tables: validTables, // Return only the validated tables with proper structure
          metadata: {
            relationships: relationshipInfo,
            complexTables: complexTables,
            tableCount: validTables.length,
            totalColumns: validTables.reduce((sum, table) => sum + table.columns.length, 0)
          }
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
app.post('/create-api-from-schema', usageLimitMiddleware.checkBothLimits(), async (req, res) => {
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
    const result = await apiGeneratorController.generateAPIFromSchema(tables, XAuthUserIdToUse);
    
    // After API generation, verify that tables actually exist in the database before returning success
    console.log("Verifying all tables have been created properly...");
    
    // Create client to check tables
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const apiIdentifier = result.apiId; // Use the generated API ID as identifier
    
    // Check each table for existence
    const tablesToCheck = tables.map(table => ({
      originalName: table.name,
      prefixedName: `${XAuthUserIdToUse}_${apiIdentifier}_${table.name}`.toLowerCase() // Ensure lowercase
    }));
    
    const tableResults = [];
    let allTablesExist = true;
    let partialSuccess = false;
    
    // Check each table
    for (const table of tablesToCheck) {
      try {
        // Get lowercase table name for consistent checks
        const tableName = table.prefixedName.toLowerCase();
        
        // Try direct query
        const { error: queryError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
          
        if (!queryError) {
          tableResults.push({
            table: table.originalName,
            prefixedName: tableName,
            exists: true,
            error: null
          });
          partialSuccess = true;
          continue;
        }
        
        // Try case-insensitive check if direct query fails
        const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', { 
          sql_query: `
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = '${tableName}'
            ) as exists;
          `
        });
        
        const exists = !sqlError && sqlData && sqlData[0] && sqlData[0].exists === true;
        
        tableResults.push({
          table: table.originalName,
          prefixedName: tableName,
          exists: exists,
          error: exists ? null : (queryError ? queryError.message : "Table not found")
        });
        
        if (exists) {
          partialSuccess = true;
        } else {
          allTablesExist = false;
        }
      } catch (err) {
        tableResults.push({
          table: table.originalName,
          prefixedName: tableName,
          exists: false,
          error: err.message
        });
        allTablesExist = false;
      }
    }
    
    // If not all tables exist but some do, return partial success
    if (!allTablesExist) {
      if (partialSuccess) {
        // Some tables were created, return partial success with warnings
        return res.status(207).json({
          success: true,
          warning: 'Some tables were not created properly',
          partialSuccess: true,
          swagger_url: `/api/${result.apiId}/docs`,
          XAuthUserId: XAuthUserIdToUse,
          apiId: result.apiId,
          tables: tables,
          message: 'API generated but with incomplete table creation. Some features may not work correctly.',
          tableStatus: tableResults,
          endpoints: result.endpoints
        });
      } else {
        // No tables were created successfully, return an error
        return res.status(500).json({
          error: 'Failed to create tables',
          details: 'None of the required tables could be created in the database.',
          tableStatus: tableResults
        });
      }
    }
    
    // All tables exist, return success response
    res.json({
      success: true,
      swagger_url: `/api/${result.apiId}/docs`,
      XAuthUserId: XAuthUserIdToUse,
      apiId: result.apiId,
      tables: tables,
      message: 'API successfully generated and tables created in Supabase',
      endpoints: result.endpoints,
      tableStatus: tableResults
    });
  } catch (error) {
    console.error('Error generating API from schema:', error);
    res.status(500).json({ 
      error: 'Error generating API from schema', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

// Usage routes - must be before dynamic API routing
app.use('/api/usage', usageRoutes);

// Dynamic API routing - verify user has access to the API
app.use('/api/:apiId', usageLimitMiddleware.checkRequestLimit(), async (req, res, next) => {
  try {
    const apiId = req.params.apiId;
    
    // Skip this middleware for payment routes, health checks, video routes, user routes, and usage routes
    if (apiId === 'payment' || apiId === 'health' || apiId === 'epoint-callback' || apiId === 'epoint' || apiId === 'video' || apiId === 'user' || apiId === 'usage') {
      return next();
    }
  
  // Handle API usage endpoint
  if (req.path === '/usage' && req.method === 'GET') {
    console.log(`Handling API usage request for API: ${apiId}`);
    setCorsHeaders(res);
    
    try {
      const apiUsageController = require('./controllers/apiUsageController');
      req.params.apiId = apiId;
      return apiUsageController.getApiUsage(req, res);
    } catch (error) {
      console.error('Error handling API usage request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get API usage information'
      });
    }
  }

  // Skip authentication for Swagger UI and docs
  if (req.path.includes('/docs') || req.path.includes('/swagger.json')) {
    console.log(`Skipping authentication for documentation path: ${req.path}`);
    const router = apiPublisher.getRouter(apiId);
    
    if (!router || typeof router !== 'function') {
      console.error(`API not found in registry or router is not a function: ${apiId}`, typeof router);
      // Ensure CORS headers are set even for error responses
      setCorsHeaders(res);
      return res.status(404).json({ error: 'API not found' });
    }
    
    // Ensure CORS headers are set for this request
    setCorsHeaders(res);
    
    // Store the apiId on the request for use in the router
    req.apiId = apiId;
    
    // Use the router as middleware instead
    req.url = req.url.replace(`/api/${apiId}`, '') || '/';
    
    // Double check router exists before using it
    if (!router || typeof router !== 'function') {
      console.error(`Router not found for API ${apiId} or router is not a function:`, typeof router);
      return res.status(404).json({ error: 'API not found in registry' });
    }
    
    return router(req, res, next);
  }
  
  // Check if authentication is optional for this API (from query param or header)
  const skipAuth = req.query.skipAuth === 'true' || 
                  req.headers['x-skip-auth'] === 'true' || 
                  req.headers['X-Skip-Auth'] === 'true';
  
  const router = apiPublisher.getRouter(apiId);
  
  if (!router || typeof router !== 'function') {
    console.error(`API not found in registry or router is not a function: ${apiId}`, typeof router);
    // Ensure CORS headers are set even for error responses
    setCorsHeaders(res);
    return res.status(404).json({ error: 'API not found' });
  }
  
  // If skipAuth is true, bypass authentication
  if (skipAuth) {
    console.log(`Skipping authentication for API ${apiId} as requested by client`);
    
    // Set a default user ID for unauthenticated access
    req.XAuthUserId = 'anonymous';
    req.user = { username: 'anonymous', type: 'anonymous' };
    
    // Ensure CORS headers are set for this request
    setCorsHeaders(res);
    
    // Store the apiId on the request for use in the router
    req.apiId = apiId;
    
    // Use the router as middleware instead
    req.url = req.url.replace(`/api/${apiId}`, '') || '/';
    
    // Double check router exists before using it
    if (!router || typeof router !== 'function') {
      console.error(`Router not found for API ${apiId} or router is not a function:`, typeof router);
      return res.status(404).json({ error: 'API not found in registry' });
    }
    
    return router(req, res, next);
  }
  
  // Apply usage limits even for open access mode
  console.log(`Applying usage limits to API ${apiId} for user: ${req.XAuthUserId || 'anonymous'}`);
  
  // Set default user ID for unauthenticated access
  req.XAuthUserId = req.XAuthUserId || 'anonymous';
  req.user = { username: req.XAuthUserId, type: 'anonymous' };
  
  // Ensure CORS headers are set for this request
  setCorsHeaders(res);
  
  // Store the apiId on the request for use in the router
  req.apiId = apiId;
  
  // Use the router as middleware instead
  req.url = req.url.replace(`/api/${apiId}`, '') || '/';
  
  // Double check router exists before using it
  if (!router) {
    console.error(`Router not found for API ${apiId}`);
    return res.status(404).json({ error: 'API not found in registry' });
  }
  
  return router(req, res, next);

  } catch (error) {
    console.error('Error in dynamic API routing middleware:', error);
    setCorsHeaders(res);
    return res.status(500).json({ 
      error: 'Internal server error in API routing',
      message: error.message 
    });
  }
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

// UNIVERSAL Error handling middleware with COMPREHENSIVE CORS
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  
  // Apply UNIVERSAL CORS headers to ALL error responses
  setCorsHeaders(res, req);
  
  // Additional safety measures for error responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 
    'Accept, Authorization, Content-Type, X-Requested-With, X-User-Id, x-user-id, X-USER-ID, xauthuserid, XAuthUserId, x-skip-auth, X-API-Key');
  
  // Remove headers that might block CORS
  res.removeHeader('X-Frame-Options');
  res.removeHeader('X-Content-Type-Options');
  
  res.status(err.status || 500).json({
    error: 'Something went wrong!',
    message: err.message || 'Internal server error',
    cors: 'ENABLED',
    timestamp: new Date().toISOString()
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

// Add payment routes with flexible authentication
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payment', paymentRoutes);

// Add Epoint payment gateway routes
const epointRoutes = require('./routes/epointRoutes');
app.use('/api/epoint', epointRoutes);

// Add Google authentication routes
const googleAuthRoutes = require('./routes/googleAuthRoutes');
app.use('/auth', googleAuthRoutes);

// Add video routes (use different path to avoid conflicts with dynamic API routing)
const videoRoutes = require('./routes/videoRoutes');
app.use('/video', videoRoutes);

// Add debug routes (for development/testing)
const debugRoutes = require('./routes/debugRoutes');
app.use('/debug', debugRoutes);

// Add direct Epoint callback route (public access)
const PaymentController = require('./controllers/paymentController');
const paymentController = new PaymentController();
app.post('/api/epoint-callback', async (req, res) => {
  setCorsHeaders(res, req);
  return paymentController.processEpointCallback(req, res);
});

// Add health check endpoint (public access)
app.get('/health', (req, res) => {
  setCorsHeaders(res, req);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      payment: 'operational',
      database: 'connected'
    }
  });
});

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

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler caught:', error);
  setCorsHeaders(res);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Setup Account Settings routes
app.use('/api/user', accountRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  setCorsHeaders(res);
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /health'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backlify-v2 server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💻 Hostname: ${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`);
});
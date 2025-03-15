const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const APIGeneratorController = require('./controllers/apiGeneratorController');
const apiPublisher = require('./services/apiPublisher');
const swaggerUi = require('swagger-ui-express');
// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create controller instance
const apiGeneratorController = new APIGeneratorController();

// Generate API endpoint
app.post('/generate-api', (req, res) => apiGeneratorController.generateAPI(req, res));

// Get SQL for an API
app.get('/api/:apiId/sql', (req, res) => apiGeneratorController.getSQL(req, res));

// Dynamic API routing
app.use('/api/:apiId', (req, res, next) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Use the router as middleware instead
  req.url = req.url.replace(`/api/${apiId}`, '') || '/';
  return router(req, res, next);
});

// Add this route after your existing routes
app.get('/setup-script/:apiId', (req, res) => {
  const { apiId } = req.params;
  
  if (!apiGeneratorController.generatedApis.has(apiId)) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  const api = apiGeneratorController.generatedApis.get(apiId);
  
  // Set header for SQL file download
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="backlify-setup-${apiId}.sql"`);
  
  // Send the SQL
  res.send(api.sql);
});

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Backlify-v2',
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Get the swagger spec from the router
  let swaggerSpec;
  
  try {
    // Try different methods to get the spec
    if (typeof router._generateSwaggerSpec === 'function') {
      // If router has a method to generate spec
      swaggerSpec = router._generateSwaggerSpec();
    } else {
      // Try to find a route handler for /swagger
      const swaggerRoute = router.stack?.find(layer => 
        layer.route && (layer.route.path === '/swagger' || layer.route.path === '/swagger.json')
      );
      
      if (swaggerRoute) {
        // Execute the handler with a mock response to get the spec
        const mockRes = { json: (data) => { swaggerSpec = data; } };
        swaggerRoute.route.stack[0].handle({ params: {}, query: {} }, mockRes);
      }
    }
    
    if (!swaggerSpec) {
      return res.status(404).json({ error: 'Swagger specification not available' });
    }
    
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
    
    // Modify the Swagger spec paths to be relative
    if (swaggerSpec && swaggerSpec.paths) {
      const apiId = req.params.apiId;
      
      // Update the servers array to use the correct base URL
      swaggerSpec.servers = [
        {
          url: `/api/${apiId}`  // This will make all paths start with /api/{apiId}
        }
      ];
    }
    
    // For debugging - Log the fixed spec (optional - remove in production)
    console.log('Swagger spec being served:', JSON.stringify(swaggerSpec, null, 2));
    
    // Pass the spec directly to Swagger UI setup
    swaggerUi.setup(swaggerSpec, { explorer: true })(req, res, next);
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
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    return res.status(404).json({ error: 'API not found' });
  }
  
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
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    return res.status(404).json({ error: 'API not found' });
  }
  
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
app.listen(PORT, () => {
  console.log(`🚀 Backlify-v2 server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});

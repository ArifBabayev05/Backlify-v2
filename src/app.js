const swaggerUi = require('swagger-ui-express');
const apiGenerator = require('./services/apiGenerator');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const { ensureCorsHeaders } = require('./middleware/corsMiddleware');

// Load security modules
const security = require('./security');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Configure CORS for all routes
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  exposedHeaders: '*',
  credentials: true
}));

// Apply custom CORS middleware to ensure headers are set in all cases
app.use(ensureCorsHeaders);

// ========== IMPORTANT ==========
// Apply security middleware - This MUST come after CORS middleware
// to ensure IP blacklisting works properly
// ==============================
security.applySecurityMiddleware(app);

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Add this route to serve Swagger UI for each API
app.use('/api/:apiId/docs', (req, res, next) => {
  const apiId = req.params.apiId;
  const apiRouter = apiPublisher.getRouter(apiId);
  
  if (!apiRouter) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Get the swagger spec for this API
  const swaggerSpec = apiGenerator._generateSwaggerSpec(
    apiGeneratorController.generatedApis.get(apiId).tables,
    apiGeneratorController.generatedApis.get(apiId).XAuthUserId
  );
  
  // Serve Swagger UI with this spec
  const swaggerUiHandler = swaggerUi.setup(swaggerSpec);
  swaggerUi.serve(req, res, next);
}, swaggerUi.setup(null));

// Setup secure authentication routes
security.setupAuthRoutes(app);

// ... rest of the existing app code ...
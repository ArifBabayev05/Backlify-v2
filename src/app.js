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

// CORS middleware must be the very first middleware
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

// Payment routes are now integrated in the main index.js file
// to ensure they bypass authentication middleware

// Add a global error handler to always set CORS headers
app.use((err, req, res, next) => {
  ensureCorsHeaders(req, res, () => {});
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ... rest of the existing app code ...
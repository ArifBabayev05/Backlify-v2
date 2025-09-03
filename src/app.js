const swaggerUi = require('swagger-ui-express');
const apiGenerator = require('./services/apiGenerator');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const { ensureCorsHeaders } = require('./middleware/corsMiddleware');

// Load new flexible authentication middleware
const { authenticate, authMiddleware } = require('./middleware/authMiddleware');

// Load basic security modules (without the old route protection)
const rateLimiter = require('./middleware/security/rateLimiter');
const ipBlacklist = require('./middleware/security/ipBlacklist');
const securityHeaders = require('./middleware/security/securityHeaders');

// Load payment routes
const paymentRoutes = require('./routes/paymentRoutes');

// Load Epoint payment gateway routes
const epointRoutes = require('./routes/epointRoutes');

// Load Account Settings routes
const accountRoutes = require('./routes/accountRoutes');

// Load API Usage middleware
const apiUsageMiddleware = require('./middleware/apiUsageMiddleware');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// CORS middleware must be the very first middleware
app.use(ensureCorsHeaders);

// Apply basic security middleware
app.use(ipBlacklist);
app.use(rateLimiter);
securityHeaders(app);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply the new flexible authentication middleware globally
// This will automatically handle public vs protected routes
app.use(authenticate());

// Apply API usage tracking middleware
app.use(apiUsageMiddleware.trackUsage());

console.log('🔧 Authentication middleware configuration:');
const config = authMiddleware.getRouteConfiguration();
console.log(`📖 Public routes: ${config.totalPublic}`);
console.log(`🔒 Protected routes: ${config.totalProtected}`);

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Setup payment routes (they already have their own auth middleware)
app.use('/api/payment', paymentRoutes);

// Setup Epoint payment gateway routes
app.use('/api/epoint', epointRoutes);

// Setup Account Settings routes
app.use('/api/user', accountRoutes);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  ensureCorsHeaders(req, res, () => {});
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      payment: 'operational'
    }
  });
});

// Add a global error handler to always set CORS headers
app.use((err, req, res, next) => {
  ensureCorsHeaders(req, res, () => {});
  
  // Handle authentication errors specifically
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide a valid authentication token'
    });
  }
  
  res.status(err.status || 500).json({ 
    success: false,
    error: err.message || 'Internal Server Error' 
  });
});

module.exports = app;

// ... rest of the existing app code ...
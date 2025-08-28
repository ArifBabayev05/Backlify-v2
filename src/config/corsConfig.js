/**
 * Comprehensive CORS Configuration for Backlify Payment System
 * This configuration ensures all APIs are accessible from any origin
 */

const corsConfig = {
  // Allow all origins
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins for development and production
    callback(null, true);
  },
  
  // Allow all methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // Allow all headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-User-Id',
    'x-user-id',
    'X-USER-ID',
    'xauthuserid',
    'XAuthUserId',
    'x-skip-auth',
    'X-API-Key',
    'x-api-key',
    'X-Plan-Id',
    'x-plan-id'
  ],
  
  // Expose additional headers
  exposedHeaders: [
    'Content-Length',
    'Content-Disposition',
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page'
  ],
  
  // Allow credentials
  credentials: true,
  
  // Cache preflight response for 24 hours
  maxAge: 86400,
  
  // Handle preflight requests
  preflightContinue: false,
  
  // Handle OPTIONS method
  optionsSuccessStatus: 200
};

/**
 * CORS configuration specifically for payment endpoints
 */
const paymentCorsConfig = {
  ...corsConfig,
  // Additional headers for payment system
  allowedHeaders: [
    ...corsConfig.allowedHeaders,
    'X-Payment-Token',
    'X-Order-Id',
    'X-Transaction-Id',
    'X-Signature',
    'X-Callback-Url'
  ]
};

/**
 * CORS configuration for API endpoints
 */
const apiCorsConfig = {
  ...corsConfig,
  // Additional headers for API access
  allowedHeaders: [
    ...corsConfig.allowedHeaders,
    'X-API-Version',
    'X-Request-ID',
    'X-Client-Version',
    'X-Platform'
  ]
};

/**
 * Function to apply CORS headers to any response
 */
const applyCorsHeaders = (res, origin = null) => {
  // Set origin header
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  
  // Set method headers
  res.header('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
  
  // Set header headers
  res.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
  
  // Set exposed headers
  res.header('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
  
  // Set credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Set max age
  res.header('Access-Control-Max-Age', corsConfig.maxAge.toString());
};

/**
 * Function to handle CORS preflight requests
 */
const handleCorsPreflight = (req, res) => {
  applyCorsHeaders(res, req.headers.origin);
  
  if (req.method === 'OPTIONS') {
    res.status(200).json({
      message: 'CORS preflight OK',
      allowedMethods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders
    });
    return true; // Request handled
  }
  
  return false; // Request not handled
};

/**
 * Middleware to ensure CORS headers are always set
 */
const ensureCorsHeaders = (req, res, next) => {
  // Handle preflight requests
  if (handleCorsPreflight(req, res)) {
    return;
  }
  
  // Apply CORS headers for all requests
  applyCorsHeaders(res, req.headers.origin);
  
  next();
};

/**
 * Middleware specifically for payment endpoints
 */
const paymentCorsMiddleware = (req, res, next) => {
  // Apply payment-specific CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', paymentCorsConfig.methods.join(', '));
  res.header('Access-Control-Allow-Headers', paymentCorsConfig.allowedHeaders.join(', '));
  res.header('Access-Control-Expose-Headers', paymentCorsConfig.exposedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', paymentCorsConfig.maxAge.toString());
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      message: 'Payment CORS preflight OK',
      allowedMethods: paymentCorsConfig.methods,
      allowedHeaders: paymentCorsConfig.allowedHeaders
    });
  }
  
  next();
};

/**
 * Middleware specifically for API endpoints
 */
const apiCorsMiddleware = (req, res, next) => {
  // Apply API-specific CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', apiCorsConfig.methods.join(', '));
  res.header('Access-Control-Allow-Headers', apiCorsConfig.allowedHeaders.join(', '));
  res.header('Access-Control-Expose-Headers', apiCorsConfig.exposedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', apiCorsConfig.maxAge.toString());
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      message: 'API CORS preflight OK',
      allowedMethods: apiCorsConfig.methods,
      allowedHeaders: apiCorsConfig.allowedHeaders
    });
  }
  
  next();
};

module.exports = {
  corsConfig,
  paymentCorsConfig,
  apiCorsConfig,
  applyCorsHeaders,
  handleCorsPreflight,
  ensureCorsHeaders,
  paymentCorsMiddleware,
  apiCorsMiddleware
};

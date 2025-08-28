const { corsConfig, paymentCorsConfig, apiCorsConfig } = require('../config/corsConfig');

/**
 * Enhanced CORS middleware to ensure headers are properly set
 * even in error cases or direct responses.
 * This middleware allows ALL origins and methods for maximum compatibility.
 */
const ensureCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow ALL origins - this is the key change for maximum accessibility
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  
  // Allow ALL methods
  res.header('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
  
  // Allow ALL headers including custom ones
  res.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
  
  // Expose additional headers
  res.header('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
  
  // Allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Cache preflight response for 24 hours
  res.header('Access-Control-Max-Age', corsConfig.maxAge.toString());

  // Handle OPTIONS method globally for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ 
      message: 'CORS preflight OK',
      allowedMethods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      allowedOrigins: 'All origins allowed'
    });
  }
  
  next();
};

/**
 * Payment-specific CORS middleware
 */
const ensurePaymentCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow ALL origins for payment endpoints
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  
  // Allow ALL methods for payments
  res.header('Access-Control-Allow-Methods', paymentCorsConfig.methods.join(', '));
  
  // Allow ALL headers including payment-specific ones
  res.header('Access-Control-Allow-Headers', paymentCorsConfig.allowedHeaders.join(', '));
  
  // Expose additional headers
  res.header('Access-Control-Expose-Headers', paymentCorsConfig.exposedHeaders.join(', '));
  
  // Allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Cache preflight response
  res.header('Access-Control-Max-Age', paymentCorsConfig.maxAge.toString());

  // Handle OPTIONS method for payment endpoints
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ 
      message: 'Payment CORS preflight OK',
      allowedMethods: paymentCorsConfig.methods,
      allowedHeaders: paymentCorsConfig.allowedHeaders,
      allowedOrigins: 'All origins allowed for payments'
    });
  }
  
  next();
};

/**
 * API-specific CORS middleware
 */
const ensureApiCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow ALL origins for API endpoints
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  
  // Allow ALL methods for APIs
  res.header('Access-Control-Allow-Methods', apiCorsConfig.methods.join(', '));
  
  // Allow ALL headers including API-specific ones
  res.header('Access-Control-Allow-Headers', apiCorsConfig.allowedHeaders.join(', '));
  
  // Expose additional headers
  res.header('Access-Control-Expose-Headers', apiCorsConfig.exposedHeaders.join(', '));
  
  // Allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Cache preflight response
  res.header('Access-Control-Max-Age', apiCorsConfig.maxAge.toString());

  // Handle OPTIONS method for API endpoints
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ 
      message: 'API CORS preflight OK',
      allowedMethods: apiCorsConfig.methods,
      allowedHeaders: apiCorsConfig.allowedHeaders,
      allowedOrigins: 'All origins allowed for APIs'
    });
  }
  
  next();
};

/**
 * Utility function to set CORS headers for any response
 * Can be used in dynamic routes or custom handlers
 */
const setCorsHeaders = (res, req = null) => {
  const origin = req && req.headers.origin;
  
  // Always allow all origins
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  
  // Allow all methods
  res.header('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
  
  // Allow all headers
  res.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
  
  // Expose additional headers
  res.header('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
  
  // Allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Cache preflight response
  res.header('Access-Control-Max-Age', corsConfig.maxAge.toString());
};

/**
 * Global CORS error handler
 */
const handleCorsError = (err, req, res, next) => {
  // Always set CORS headers even on errors
  setCorsHeaders(res, req);
  
  // Handle CORS-specific errors
  if (err.code === 'CORS_ERROR') {
    return res.status(400).json({
      success: false,
      error: 'CORS error',
      message: err.message,
      allowedOrigins: 'All origins allowed',
      allowedMethods: corsConfig.methods
    });
  }
  
  next(err);
};

module.exports = {
  ensureCorsHeaders,
  ensurePaymentCorsHeaders,
  ensureApiCorsHeaders,
  setCorsHeaders,
  handleCorsError,
  corsConfig,
  paymentCorsConfig,
  apiCorsConfig
};
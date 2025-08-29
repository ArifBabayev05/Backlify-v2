const { corsConfig, paymentCorsConfig, apiCorsConfig } = require('../config/corsConfig');

/**
 * UNIVERSAL CORS middleware to ensure NO CORS errors EVER
 * This middleware allows ALL origins, methods, headers, and handles ALL edge cases
 */
const ensureCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  
  // CRITICAL: Allow ALL origins with proper credential support
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  // Allow ALL HTTP methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, CONNECT');
  
  // Allow ALL possible headers (including wildcards)
  const requestedHeaders = req.headers['access-control-request-headers'];
  if (requestedHeaders) {
    res.header('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    res.header('Access-Control-Allow-Headers', [
      'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization', 'Cache-Control', 'Connection',
      'Content-Length', 'Content-Type', 'Cookie', 'DNT', 'Date', 'Expect', 'Host', 'Keep-Alive',
      'Origin', 'Pragma', 'Referer', 'User-Agent', 'X-Requested-With', 'X-CSRF-Token', 'X-Forwarded-For',
      'X-User-Id', 'x-user-id', 'X-USER-ID', 'xauthuserid', 'XAuthUserId', 'x-skip-auth',
      'X-API-Key', 'x-api-key', 'X-API-Version', 'X-Request-ID', 'X-Client-Version', 'X-Platform',
      'X-Payment-Token', 'X-Order-Id', 'X-Transaction-Id', 'X-Signature', 'X-Callback-Url', 'X-Plan-Id'
    ].join(', '));
  }
  
  // Expose ALL useful headers
  res.header('Access-Control-Expose-Headers', [
    'Content-Length', 'Content-Type', 'Content-Disposition', 'Date', 'ETag', 'Last-Modified',
    'Location', 'Server', 'X-Total-Count', 'X-Page-Count', 'X-Current-Page', 'X-RateLimit-Limit',
    'X-RateLimit-Remaining', 'X-Request-ID', 'X-Response-Time', 'X-Powered-By'
  ].join(', '));
  
  // ALWAYS allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Maximum cache time for preflight
  res.header('Access-Control-Max-Age', '86400');
  
  // Remove any restrictive headers that might cause issues
  res.removeHeader('X-Frame-Options');
  res.removeHeader('X-Content-Type-Options');

  // Handle OPTIONS preflight requests IMMEDIATELY
  if (req.method === 'OPTIONS') {
    res.status(200).json({ 
      message: 'Universal CORS preflight - ALL origins, methods, and headers allowed',
      cors: 'ENABLED',
      timestamp: new Date().toISOString()
    });
    return; // Don't call next() for OPTIONS
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
 * UNIVERSAL setCorsHeaders utility - Use this EVERYWHERE for guaranteed CORS compatibility
 * This function sets the most permissive CORS headers possible
 */
const setCorsHeaders = (res, req = null) => {
  const origin = req && req.headers.origin;
  
  // UNIVERSAL origin handling - supports ALL scenarios
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  // Allow EVERY possible HTTP method
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, CONNECT');
  
  // Dynamic header handling - if client requests specific headers, allow them
  const requestedHeaders = req && req.headers['access-control-request-headers'];
  if (requestedHeaders) {
    res.header('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    // Comprehensive header list covering ALL possible scenarios
    res.header('Access-Control-Allow-Headers', [
      // Standard browser headers
      'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization', 'Cache-Control', 'Connection',
      'Content-Length', 'Content-Type', 'Cookie', 'DNT', 'Date', 'Expect', 'Host', 'Keep-Alive',
      'Origin', 'Pragma', 'Referer', 'User-Agent', 'X-Requested-With', 'X-CSRF-Token', 'X-Forwarded-For',
      // Authentication headers
      'X-User-Id', 'x-user-id', 'X-USER-ID', 'xauthuserid', 'XAuthUserId', 'x-skip-auth', 'Bearer',
      // API headers
      'X-API-Key', 'x-api-key', 'X-API-Version', 'X-Request-ID', 'X-Client-Version', 'X-Platform',
      // Payment system headers
      'X-Payment-Token', 'X-Order-Id', 'X-Transaction-Id', 'X-Signature', 'X-Callback-Url', 'X-Plan-Id',
      // Framework specific headers
      'X-Angular-Request', 'X-React-Request', 'X-Vue-Request', 'X-Svelte-Request',
      // Mobile and native app headers
      'X-Mobile-App', 'X-Native-App', 'X-Cordova', 'X-PhoneGap', 'X-Ionic',
      // Development and debugging headers
      'X-Debug', 'X-Test', 'X-Environment', 'X-Version'
    ].join(', '));
  }
  
  // Expose ALL useful response headers
  res.header('Access-Control-Expose-Headers', [
    'Content-Length', 'Content-Type', 'Content-Disposition', 'Content-Encoding', 'Content-Range',
    'Date', 'ETag', 'Expires', 'Last-Modified', 'Location', 'Server', 'Transfer-Encoding',
    'X-Total-Count', 'X-Page-Count', 'X-Current-Page', 'X-Per-Page', 'X-RateLimit-Limit',
    'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-ID', 'X-Response-Time', 'X-Powered-By',
    'X-API-Version', 'X-Build-Version', 'X-Deployment-ID', 'X-Environment'
  ].join(', '));
  
  // ALWAYS allow credentials for maximum compatibility
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Maximum cache time for preflight requests
  res.header('Access-Control-Max-Age', '86400');
  
  // Remove potentially problematic security headers
  res.removeHeader('X-Frame-Options');
  res.removeHeader('X-Content-Type-Options');
  res.removeHeader('Strict-Transport-Security');
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
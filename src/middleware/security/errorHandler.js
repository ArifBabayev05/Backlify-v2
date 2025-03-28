const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Centralized error handling middleware
 * Logs errors to the error_logs table and returns appropriate error responses
 */
const errorHandler = async (err, req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userId = req.XAuthUserId || 'anonymous';
  const method = req.method;
  const path = req.path;
  const requestId = req.requestId || 'unknown';
  
  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS')) {
    // For CORS errors, we need to ensure proper CORS headers are set
    // Import the CORS utils
    const { setCorsHeaders } = require('../corsMiddleware');
    setCorsHeaders(res, req);
    
    // For OPTIONS requests, just return 200 OK
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // For other requests with CORS errors, return 403
    return res.status(403).json({
      error: true,
      message: 'CORS error: Origin not allowed',
      requestId: requestId
    });
  }
  
  // Determine error status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Create a sanitized error message
  const errorMessage = err.message || 'Internal Server Error';
  
  // Get stack trace but sanitize it for sensitive information
  const stackTrace = err.stack 
    ? err.stack
        .split('\n')
        .map(line => line.trim())
        .join('\n')
    : 'No stack trace available';
  
  try {
    // Log error to error_logs table
    await supabase.from('error_logs').insert([{
      request_id: requestId,
      ip,
      user_id: userId,
      method,
      path,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      stack: stackTrace,
      status: statusCode,
      created_at: new Date().toISOString()
    }]);
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
  
  // For security, don't expose detailed error information in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Send appropriate error response
  res.status(statusCode).json({
    error: true,
    message: isProduction && statusCode === 500 
      ? 'An unexpected error occurred' // Generic message in production for 500 errors
      : errorMessage,
    requestId: requestId,
    // Only include additional details in development
    ...((!isProduction && statusCode === 500) && {
      stack: stackTrace
    })
  });
};

/**
 * Uncaught exception and unhandled rejection handlers
 */
const setupGlobalErrorHandlers = () => {
  // Handle uncaught exceptions
  process.on('uncaughtException', async (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    
    try {
      await supabase.from('error_logs').insert([{
        request_id: 'global-uncaught',
        ip: 'server',
        user_id: 'system',
        method: 'SYSTEM',
        path: 'GLOBAL',
        timestamp: new Date().toISOString(),
        error: err.message || 'Uncaught Exception',
        stack: err.stack || 'No stack trace available',
        status: 500,
        created_at: new Date().toISOString()
      }]);
    } catch (logError) {
      console.error('Failed to log uncaught exception:', logError);
    }
    
    // In production, keep the process alive but log the error
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    
    try {
      await supabase.from('error_logs').insert([{
        request_id: 'global-unhandled',
        ip: 'server',
        user_id: 'system',
        method: 'SYSTEM',
        path: 'GLOBAL',
        timestamp: new Date().toISOString(),
        error: reason.message || 'Unhandled Promise Rejection',
        stack: reason.stack || 'No stack trace available',
        status: 500,
        created_at: new Date().toISOString()
      }]);
    } catch (logError) {
      console.error('Failed to log unhandled rejection:', logError);
    }
    
    // In production, keep the process alive but log the error
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
};

module.exports = {
  errorHandler,
  setupGlobalErrorHandlers
}; 
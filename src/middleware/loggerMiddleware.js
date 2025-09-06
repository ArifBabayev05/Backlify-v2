const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

/**
 * Logger middleware that logs all API requests to Supabase
 */
const loggerMiddleware = async (req, res, next) => {
  // Store original timestamp when request started
  const startTime = new Date();
  const requestTimestamp = startTime.toISOString();
  
  // First check if XAuthUserId is already set on the request object (from previous middleware)
  const XAuthUserId = req.XAuthUserId || 
                       req.headers['x-user-id'] || 
                       req.headers['X-USER-ID'] || 
                       req.headers['X-User-Id'] || 
                       req.header('x-user-id') ||
                       req.headers['xauthuserid'] ||
                       req.headers['XAuthUserId'] ||
                       req.header('xauthuserid') ||
                       (req.body ? req.body.XAuthUserId : null) ||
                       'ADMIN';
  
  // Also set XAuthUserId on the request for other middleware to use
  req.XAuthUserId = XAuthUserId;
  
  // Check if this is a request to a specific API
  let apiId = null;
  let isApiRequest = false;
  let actualUserId = XAuthUserId; // Default to the detected user ID
  
  // Extract API ID from URL if it's an API request
  const apiMatch = req.originalUrl.match(/\/api\/([^/]+)/);
  if (apiMatch && apiMatch[1]) {
    apiId = apiMatch[1];
    
    // Don't count /api/user/* endpoints as API requests
    if (apiId !== 'user') {
      isApiRequest = true;
    }
    
    // If XAuthUserId is ADMIN or missing, try to find the actual API owner
    if (XAuthUserId === 'ADMIN' || !XAuthUserId) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL || config.supabase.url,
          process.env.SUPABASE_KEY || config.supabase.key
        );
        
        // Look up the API owner by API ID from api_registry table
        const { data: apiData, error: apiError } = await supabase
          .from('api_registry')
          .select('metadata')
          .eq('api_id', apiId)
          .single();
        
        if (!apiError && apiData && apiData.metadata) {
          // Parse metadata to get XAuthUserId
          let metadata;
          try {
            metadata = typeof apiData.metadata === 'string' 
              ? JSON.parse(apiData.metadata) 
              : apiData.metadata;
          } catch (parseError) {
            console.error('Error parsing API metadata:', parseError);
            metadata = apiData.metadata;
          }
          
          if (metadata && metadata.XAuthUserId && metadata.XAuthUserId !== 'ADMIN') {
            actualUserId = metadata.XAuthUserId;
            console.log(`[API LOG] Found API owner: ${actualUserId} for API: ${apiId}`);
          }
        }
      } catch (error) {
        console.error('Error finding API owner:', error);
        // Keep using ADMIN if lookup fails
      }
    }
  }
  
  // Capture request details - sanitize sensitive information
  const requestInfo = {
    method: req.method,
    path: req.originalUrl || req.url,
    query: JSON.stringify(sanitizeObject(req.query) || {}),
    // Only include body for non-GET requests and remove sensitive fields
    body: req.method !== 'GET' ? JSON.stringify(sanitizeObject(req.body) || {}) : '{}',
    // Only include essential headers
    headers: JSON.stringify(filterHeaders(req.headers) || {})
  };
  
  // Create a response interceptor by wrapping the original res.send
  const originalSend = res.send;
  let responseBody;
  let shouldSkipLogging = false;
  
  // Skip logging for static content and very large responses
  if (req.path.includes('/docs') && req.path.endsWith('.js') || 
      req.path.endsWith('.css') || 
      req.path.endsWith('.png') || 
      req.path.endsWith('.ico')) {
    shouldSkipLogging = true;
  }
  
  res.send = function(body) {
    // Only store response body for JSON responses and not too large
    if (!shouldSkipLogging && 
        res.getHeader('content-type')?.includes('application/json') && 
        body && 
        body.length < 10000) {
      try {
        responseBody = body;
      } catch (err) {
        responseBody = 'Error capturing response body';
      }
    }
    originalSend.apply(res, arguments);
    return res;
  };
  
  // Continue with request handling
  next();
  
  // After response is sent, log the complete request/response info
  res.on('finish', async () => {
    // Skip logging for static assets
    if (shouldSkipLogging) {
      return;
    }
    
    try {
      const endTime = new Date();
      const responseTime = endTime.getTime() - startTime.getTime();
      
      // Format response information - sanitize large or sensitive responses
      const responseInfo = {
        status: res.statusCode,
        statusMessage: res.statusMessage,
        // Only include important headers
        headers: JSON.stringify(filterResponseHeaders(res.getHeaders ? res.getHeaders() : {})),
        // Limit response size and sanitize
        body: responseBody ? sanitizeResponseBody(responseBody.toString(), 500) : '',
        time: responseTime
      };
      
      // Log to console first in case Supabase insert fails
      // Add color indicators for status codes: green for success (including 304), red for errors
      const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
      const statusIndicator = isSuccess ? '✓' : '✗';
      console.log(`[API LOG] ${actualUserId} - ${req.method} ${req.originalUrl} - ${res.statusCode} ${statusIndicator} (${responseTime}ms)${apiId ? ` [API: ${apiId}]` : ''}`);
      
      const excludedPaths = ['/health', '/my-apis', '/', '/admin/users/search'];

      if (
        (req.path === '/health' && res.statusCode === 200) ||
        excludedPaths.includes(req.path) ||
        req.path.startsWith('/admin/logs')
      ) {
        return;
      }

      
      // Log to Supabase
      await logToSupabase({
        timestamp: requestTimestamp,
        XAuthUserId: actualUserId, // Use the actual user ID (API owner if found)
        endpoint: requestInfo.path,
        method: requestInfo.method,
        api_id: apiId,
        is_api_request: isApiRequest,
        request: requestInfo,
        response: responseInfo,
        response_time_ms: responseTime,
        status_code: res.statusCode
      });
    } catch (error) {
      console.error('Error logging request:', error);
    }
  });
};

/**
 * Remove sensitive information from objects
 */
function sanitizeObject(obj) {
  if (!obj) return {};
  
  // Create a copy to avoid modifying the original
  const sanitized = { ...obj };
  
  // List of sensitive fields to mask
  const sensitiveFields = [
    'password', 'token', 'key', 'secret', 'authorization', 
    'auth', 'credentials', 'credit_card', 'cardnumber', 'cvv'
  ];
  
  // Recursively sanitize the object
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Check if this key contains sensitive information
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '***REDACTED***';
    } 
    // Recursively sanitize nested objects
    else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  });
  
  return sanitized;
}

/**
 * Filter headers to only include important ones
 */
function filterHeaders(headers) {
  if (!headers) return {};
  
  const filteredHeaders = {};
  const allowedHeaders = [
    'x-user-id', 'user-agent', 'content-type', 'accept', 'referer',
    'x-requested-with', 'origin', 'host'
  ];
  
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (allowedHeaders.includes(lowerKey)) {
      // Don't include authorization headers
      if (!lowerKey.includes('auth')) {
        filteredHeaders[key] = headers[key];
      }
    }
  });
  
  return filteredHeaders;
}

/**
 * Filter response headers to only include important ones
 */
function filterResponseHeaders(headers) {
  if (!headers) return {};
  
  const filteredHeaders = {};
  const allowedHeaders = [
    'content-type', 'x-ratelimit-limit', 'x-ratelimit-remaining',
    'cache-control', 'content-length'
  ];
  
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (allowedHeaders.includes(lowerKey)) {
      filteredHeaders[key] = headers[key];
    }
  });
  
  return filteredHeaders;
}

/**
 * Sanitize response body by limiting size and removing sensitive data
 */
function sanitizeResponseBody(body, maxLength = 1000) {
  if (!body) return '';
  
  // Try to parse JSON to redact sensitive fields
  try {
    const parsed = JSON.parse(body);
    const sanitized = sanitizeObject(parsed);
    const stringified = JSON.stringify(sanitized);
    
    // Limit size
    return stringified.length > maxLength 
      ? stringified.substring(0, maxLength) + '...[truncated]' 
      : stringified;
  } catch (e) {
    // If not JSON or parsing fails, just truncate
    return body.length > maxLength 
      ? body.substring(0, maxLength) + '...[truncated]' 
      : body;
  }
}

/**
 * Insert log entry into Supabase
 */
async function logToSupabase(logEntry) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || config.supabase.url,
      process.env.SUPABASE_KEY || config.supabase.key
    );
    
    // Insert log in api_logs table
    const { data, error } = await supabase
      .from('api_logs')
      .insert([logEntry]);
    
    if (error) {
      // If table doesn't exist, try to create it
      if (error.code === '42P01') { // PostgreSQL table not found error
        await createLogTable(supabase);
        
        // Try insert again
        const retryInsert = await supabase.from('api_logs').insert([logEntry]);
        if (retryInsert.error) {
          console.error('Failed to log after table creation:', retryInsert.error);
        }
      } else {
        console.error('Error inserting log:', error);
      }
    }
  } catch (error) {
    console.error('Failed to log to Supabase:', error);
  }
}

/**
 * Create the api_logs table in Supabase if it doesn't exist
 */
async function createLogTable(supabase) {
  try {
    // Use the execute_sql RPC function to create the table
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS api_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "XAuthUserId" VARCHAR(255),
          endpoint TEXT,
          method VARCHAR(10),
          api_id VARCHAR(100),
          is_api_request BOOLEAN DEFAULT false,
          request JSONB,
          response JSONB,
          response_time_ms INTEGER,
          status_code INTEGER
        );
        
        -- Add index on timestamp for better query performance
        CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs (timestamp);
        
        -- Add index on XAuthUserId for filtering by user
        CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_logs ("XAuthUserId");
        
        -- Add index on api_id for filtering by API
        CREATE INDEX IF NOT EXISTS idx_api_logs_api ON api_logs (api_id);
        
        -- Add index on status_code for filtering by status
        CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs (status_code);
      `
    });
    
    if (error) {
      console.error('Error creating api_logs table:', error);
    } else {
      console.log('Successfully created api_logs table');
    }
  } catch (error) {
    console.error('Failed to create api_logs table:', error);
  }
}

module.exports = loggerMiddleware; 
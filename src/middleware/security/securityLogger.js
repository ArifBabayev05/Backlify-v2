const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Security Logger middleware
 * Logs suspicious activities and security events to the security_logs table
 */
const securityLogger = async (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userId = req.XAuthUserId || 'anonymous';
  const method = req.method;
  const path = req.path;
  const originalUrl = req.originalUrl;
  const headers = req.headers;
  
  try {
    // Generate a request ID for tracking
    const requestId = uuidv4();
    req.requestId = requestId;
    
    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    // Track response status
    let responseStatus = 200;
    res.status = function(code) {
      responseStatus = code;
      return originalStatus.apply(this, arguments);
    };
    
    // Check for suspicious behavior
    const suspiciousPatterns = detectSuspiciousPatterns(req);
    
    // Log immediately if suspicious
    if (suspiciousPatterns.isSuspicious) {
      await logSecurityEvent(
        ip,
        userId,
        method,
        path,
        headers,
        'SUSPICIOUS_REQUEST',
        suspiciousPatterns.detections,
        originalUrl,
        `Suspicious request detected: ${suspiciousPatterns.reason}`
      );
    }
    
    // Intercept response to track status codes
    res.send = function(body) {
      // Log security events for error responses
      if (responseStatus >= 400) {
        const eventType = determineSecurityEventType(responseStatus);
        if (eventType) {
          logSecurityEvent(
            ip,
            userId,
            method,
            path,
            headers,
            eventType,
            { statusCode: responseStatus },
            originalUrl,
            `Request resulted in ${responseStatus} response`
          ).catch(err => console.error('Error logging security event:', err));
        }
      }
      
      return originalSend.apply(this, arguments);
    };
    
    // Intercept JSON responses as well
    res.json = function(body) {
      // Log security events for error responses
      if (responseStatus >= 400) {
        const eventType = determineSecurityEventType(responseStatus);
        if (eventType) {
          logSecurityEvent(
            ip,
            userId,
            method,
            path,
            headers,
            eventType,
            { statusCode: responseStatus },
            originalUrl,
            `Request resulted in ${responseStatus} response`
          ).catch(err => console.error('Error logging security event:', err));
        }
      }
      
      return originalJson.apply(this, arguments);
    };
    
    next();
  } catch (error) {
    console.error('Security logger error:', error);
    next(); // Proceed on error to avoid blocking legitimate traffic
  }
};

/**
 * Detects suspicious patterns in requests
 * @param {Object} req - Express request object
 * @returns {Object} Detection results
 */
const detectSuspiciousPatterns = (req) => {
  const result = {
    isSuspicious: false,
    reason: '',
    detections: {}
  };
  
  const path = req.path;
  const method = req.method;
  const query = req.query;
  const body = req.body;
  const headers = req.headers;
  
  // Check for unauthorized access to admin routes
  if (path.includes('/admin/') && (!req.XAuthUserId || req.XAuthUserId === 'anonymous')) {
    result.isSuspicious = true;
    result.reason = 'Unauthorized admin access attempt';
    result.detections.adminAccessAttempt = true;
  }
  
  // Check for excessive payload size
  const contentLength = parseInt(headers['content-length'] || '0');
  if (contentLength > 10000000) { // 10MB
    result.isSuspicious = true;
    result.reason = 'Excessive payload size';
    result.detections.largePayload = { size: contentLength };
  }
  
  // Check for suspicious query parameters like SQL injection
  const queryStr = JSON.stringify(query).toLowerCase();
  if (queryStr.includes('select') && queryStr.includes('from') || 
      queryStr.includes('union') || 
      queryStr.includes('--') || 
      queryStr.includes(';')) {
    result.isSuspicious = true;
    result.reason = 'Potential SQL injection in query params';
    result.detections.sqlInjection = { query: query };
  }
  
  // Check for suspicious headers
  const userAgent = headers['user-agent'] || '';
  if (!userAgent || 
      userAgent.includes('sqlmap') || 
      userAgent.includes('nikto') || 
      userAgent.includes('nmap') || 
      userAgent.includes('curl') ||
      userAgent.includes('wget')) {
    result.isSuspicious = true;
    result.reason = 'Suspicious user agent';
    result.detections.suspiciousUserAgent = { userAgent };
  }
  
  // Check for path traversal attempts
  if (path.includes('../') || path.includes('..\\')) {
    result.isSuspicious = true;
    result.reason = 'Path traversal attempt';
    result.detections.pathTraversal = { path };
  }
  
  return result;
};

/**
 * Determines security event type based on response status code
 * @param {number} statusCode - HTTP status code
 * @returns {string|null} Event type or null if not a security event
 */
const determineSecurityEventType = (statusCode) => {
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    default:
      return statusCode >= 500 ? 'SERVER_ERROR' : null;
  }
};

/**
 * Logs a security event to the security_logs table
 * @param {string} ip - IP address
 * @param {string} userId - User ID
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {Object} headers - Request headers
 * @param {string} type - Event type
 * @param {Object} detection - Detection details
 * @param {string} endpoint - Full endpoint URL
 * @param {string} details - Additional details
 */
const logSecurityEvent = async (ip, userId, method, path, headers, type, detection, endpoint, details) => {
  try {
    await supabase.from('security_logs').insert([{
      ip,
      user_id: userId,
      method,
      path,
      headers,
      type,
      detection,
      endpoint,
      details,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    }]);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

module.exports = {
  securityLogger,
  logSecurityEvent
}; 
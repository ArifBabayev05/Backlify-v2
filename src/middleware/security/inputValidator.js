const validator = require('validator');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Validation rules for common fields
 */
const validationRules = {
  email: {
    validate: (value) => validator.isEmail(value),
    sanitize: (value) => validator.normalizeEmail(value)
  },
  username: {
    validate: (value) => validator.isAlphanumeric(value) && value.length >= 3 && value.length <= 30,
    sanitize: (value) => validator.escape(value)
  },
  password: {
    validate: (value) => validator.isLength(value, { min: 8 }) && 
                        /[A-Z]/.test(value) && 
                        /[a-z]/.test(value) && 
                        /[0-9]/.test(value) && 
                        /[^A-Za-z0-9]/.test(value),
    sanitize: (value) => value // Passwords are not sanitized, only validated
  }
};

/**
 * SQL Injection pattern detection
 */
const sqlInjectionPatterns = [
  /(\b|'|")SELECT(\s+\*|\s+[A-Za-z0-9_]+\s+FROM)/i,  // More specific SELECT
  /(\b|'|")INSERT(\s+INTO)/i,  // More specific INSERT
  /(\b|'|")UPDATE(\s+[A-Za-z0-9_]+\s+SET)/i,  // More specific UPDATE
  /(\b|'|")DELETE(\s+FROM)/i,  // More specific DELETE
  /(\b|'|")DROP(\s+TABLE|\s+DATABASE)/i,  // More specific DROP
  /(\b|'|")UNION(\s+SELECT|\s+ALL)/i,  // More specific UNION
  /(\b|'|")ALTER(\s+TABLE|\s+DATABASE)/i,  // More specific ALTER
  /(\b|'|")TRUNCATE(\s+TABLE)/i,  // More specific TRUNCATE
  /(\b|'|")EXEC(\s*\()/i,  // More specific EXEC
  /--.*$/,  // SQL comments at end of line
  /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)/i,  // Chained SQL
  /\/\*.*?\*\//,  // SQL block comments
  /'.*'.*'.*'/,  // Multiple single quotes
  /".*".*".*"/,  // Multiple double quotes
  /(\b|'|")DECLARE(\s+@)/i,  // SQL variable declaration
  /(\b|'|")WAITFOR(\s+DELAY)/i,  // SQL timing attack
  /(\b|'|")SHUTDOWN/i,  // Database shutdown
  /(\b|'|")INFORMATION_SCHEMA/i  // Information schema access
];

/**
 * XSS attack pattern detection
 */
const xssPatterns = [
  /<script.*>.*<\/script>/i,
  /javascript:/i,
  /onerror=/i,
  /onload=/i,
  /onclick=/i,
  /onmouseover=/i,
  /eval\(/i,
  /document\.cookie/i,
  /alert\(/i
];

/**
 * Detects if a string contains SQL injection patterns
 * @param {string} value - The string to check
 * @returns {boolean} true if SQL injection is detected
 */
const detectSqlInjection = (value) => {
  if (typeof value !== 'string') return false;
  
  // Skip checking schema-related paths for API routes
  // For the specific schema API endpoints, we'll handle SQL patterns separately
  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(value)) return true;
  }
  
  return false;
};

/**
 * Detects if a string contains XSS attack patterns
 * @param {string} value - The string to check
 * @returns {boolean} true if XSS attack is detected
 */
const detectXss = (value) => {
  if (typeof value !== 'string') return false;
  
  for (const pattern of xssPatterns) {
    if (pattern.test(value)) return true;
  }
  
  return false;
};

/**
 * Recursively checks an object for injection attempts
 * @param {object} obj - The object to scan
 * @returns {object} Detection results
 */
const scanObjectForAttacks = (obj) => {
  const detections = {
    hasSqlInjection: false,
    hasXss: false,
    fields: {}
  };
  
  const scan = (object, path = '') => {
    if (!object || typeof object !== 'object') return;
    
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        const value = object[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string') {
          const sqlDetected = detectSqlInjection(value);
          const xssDetected = detectXss(value);
          
          if (sqlDetected || xssDetected) {
            detections.fields[currentPath] = {
              value: value.substring(0, 100), // Truncate for log safety
              sqlInjection: sqlDetected,
              xss: xssDetected
            };
            
            if (sqlDetected) detections.hasSqlInjection = true;
            if (xssDetected) detections.hasXss = true;
          }
        } else if (typeof value === 'object' && value !== null) {
          scan(value, currentPath);
        }
      }
    }
  };
  
  scan(obj);
  return detections;
};

/**
 * Safe schema patterns that are allowed in our API
 */
const safeSchemaPatterns = [
  /primary key/i,
  /foreign key/i,
  /not null/i,
  /unique/i,
  /default/i,
  /varchar\(\d+\)/i,
  /check/i,
  /references/i,
  /on delete cascade/i,
  /on update cascade/i,
  /serializable/i,
  /uuid_generate_v4\(\)/i
];

/**
 * Recursively checks an object for XSS attacks only (not SQL injection)
 * @param {object} obj - The object to scan
 * @returns {object} Detection results
 */
const scanObjectForXssOnly = (obj) => {
  const detections = {
    hasXss: false,
    fields: {}
  };
  
  const scan = (object, path = '') => {
    if (!object || typeof object !== 'object') return;
    
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        const value = object[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string') {
          const xssDetected = detectXss(value);
          
          if (xssDetected) {
            detections.fields[currentPath] = {
              value: value.substring(0, 100), // Truncate for log safety
              xss: xssDetected
            };
            
            detections.hasXss = true;
          }
        } else if (typeof value === 'object' && value !== null) {
          scan(value, currentPath);
        }
      }
    }
  };
  
  scan(obj);
  return detections;
};

/**
 * Sanitizes all string inputs in an object to prevent XSS
 * @param {object} obj - The object to sanitize
 * @returns {object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'string' && key !== 'password') {
        obj[key] = validator.escape(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
  }
  
  return obj;
};

/**
 * Checks if an object is part of a schema API request
 * @param {object} obj - The object to check
 * @returns {boolean} true if it's a schema object structure
 */
const isSchemaObject = (obj) => {
  // Check if it looks like a table schema
  if (obj && typeof obj === 'object') {
    // Check for tables array
    if (Array.isArray(obj.tables)) {
      return true;
    }
    
    // Check if it looks like a table definition
    if (obj.name && Array.isArray(obj.columns)) {
      return true;
    }
    
    // Check if it's a column definition
    if (obj.name && obj.type && (Array.isArray(obj.constraints) || typeof obj.constraints === 'string')) {
      return true;
    }
    
    // Check if it's a relationship definition
    if (obj.targetTable && obj.type && (obj.sourceColumn || obj.targetColumn)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Safe scan specifically for schema-related requests
 * @param {object} obj - The object to scan
 * @returns {object} Detection results
 */
const scanSchemaForSecurity = (obj) => {
  const detections = {
    hasXss: false,
    fields: {}
  };
  
  const scan = (object, path = '') => {
    if (!object || typeof object !== 'object') return;
    
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        const value = object[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        // Skip schema-related objects 
        if (isSchemaObject(value)) {
          continue;
        }
        
        if (typeof value === 'string') {
          // Only check for XSS, not SQL patterns
          const xssDetected = detectXss(value);
          
          if (xssDetected) {
            detections.fields[currentPath] = {
              value: value.substring(0, 100), // Truncate for log safety
              xss: xssDetected
            };
            
            detections.hasXss = true;
          }
        } else if (typeof value === 'object' && value !== null) {
          scan(value, currentPath);
        }
      }
    }
  };
  
  scan(obj);
  return detections;
};

/**
 * Basic security check for email content
 * @param {object} obj - The object to check
 * @returns {object} Detection results
 */
const checkBasicEmailSecurity = (obj) => {
  const detections = {
    hasMaliciousContent: false,
    fields: {}
  };
  
  // Only check for obvious malicious patterns, not legitimate HTML
  const maliciousPatterns = [
    /<script.*>.*<\/script>/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /eval\(/i,
    /document\.cookie/i,
    /alert\(/i
  ];
  
  const scan = (object, path = '') => {
    if (!object || typeof object !== 'object') return;
    
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        const value = object[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string') {
          for (const pattern of maliciousPatterns) {
            if (pattern.test(value)) {
              detections.fields[currentPath] = {
                value: value.substring(0, 100),
                pattern: pattern.toString()
              };
              detections.hasMaliciousContent = true;
              break;
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          scan(value, currentPath);
        }
      }
    }
  };
  
  scan(obj);
  return detections;
};

/**
 * Middleware for input validation and sanitization
 * Prevents SQL injection and XSS attacks
 */
const inputValidator = async (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userId = req.XAuthUserId || 'anonymous';
  
  try {
    // First, check if this is a schema-related API - these have special rules
    const isSchemaAPI = req.path === '/generate-schema' || 
                       req.path === '/modify-schema' || 
                       req.path === '/create-api-from-schema';
    
    // Check if this is an email API - these need special handling for HTML content
    const isEmailAPI = req.path.startsWith('/api/email/');
    
    // For schema APIs, skip the SQL pattern check as they legitimately contain SQL-like content
    // For email APIs, skip both SQL and XSS checks as they legitimately contain HTML content
    if (!isSchemaAPI && !isEmailAPI) {
      // Check for attack patterns in request body, query params, and URL
      const bodyDetection = scanObjectForAttacks(req.body);
      const queryDetection = scanObjectForAttacks(req.query);
      const paramsDetection = scanObjectForAttacks(req.params);
      
      // Combine all detections
      const hasAttack = bodyDetection.hasSqlInjection || 
                      bodyDetection.hasXss || 
                      queryDetection.hasSqlInjection || 
                      queryDetection.hasXss ||
                      paramsDetection.hasSqlInjection ||
                      paramsDetection.hasXss;
      
      if (hasAttack) {
        // Record security incident
        await supabase.from('security_logs').insert([{
          ip,
          user_id: userId,
          method: req.method,
          path: req.path,
          headers: req.headers,
          type: 'INJECTION_ATTEMPT',
          detection: {
            body: bodyDetection,
            query: queryDetection,
            params: paramsDetection
          },
          endpoint: req.originalUrl,
          details: 'Potential injection attack detected and blocked'
        }]);
        
        // Automatically blacklist IP after multiple attempts
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        const { count } = await supabase
          .from('security_logs')
          .select('*', { count: 'exact', head: true })
          .eq('ip', ip)
          .eq('type', 'INJECTION_ATTEMPT')
          .gte('timestamp', fiveMinutesAgo);
        
        // If multiple attempts in short period, temporarily blacklist
        if (count >= 3) {
          const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hour blacklist
          
          await supabase.from('ip_blacklist').insert([{
            ip,
            reason: 'Multiple injection attempts',
            expiry: expiryTime.toISOString(),
            added_by: 'system'
          }]);
          
          console.warn(`IP ${ip} blacklisted for multiple injection attempts`);
        }
        
        // Block the request
        return res.status(400).json({
          error: 'Invalid input',
          message: 'The request contains potentially malicious content'
        });
      }
      
      // Sanitize inputs for non-schema APIs
      if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
      }
      
      if (req.query && typeof req.query === 'object') {
        sanitizeObject(req.query);
      }
      
      if (req.params && typeof req.params === 'object') {
        sanitizeObject(req.params);
      }
    } else if (isSchemaAPI) {
      // For schema API, just check for XSS patterns
      const bodyXssDetection = scanSchemaForSecurity(req.body);
      
      if (bodyXssDetection.hasXss) {
        // Record security incident for XSS only
        await supabase.from('security_logs').insert([{
          ip,
          user_id: userId,
          method: req.method,
          path: req.path,
          headers: req.headers,
          type: 'XSS_ATTEMPT',
          detection: {
            body: bodyXssDetection
          },
          endpoint: req.originalUrl,
          details: 'Potential XSS attack detected in schema API'
        }]);
        
        // Block the request
        return res.status(400).json({
          error: 'Invalid input',
          message: 'The request contains potentially malicious content'
        });
      }
      
      // For schema API endpoints, we accept SQL-like content but still proceed
      console.log(`Schema API endpoint detected: ${req.path}, skipping SQL injection checks`);
    } else if (isEmailAPI) {
      // For email API endpoints, we accept HTML content but still check for basic security
      console.log(`Email API endpoint detected: ${req.path}, skipping HTML content validation`);
      
      // Only check for obvious malicious patterns, not legitimate HTML
      const basicSecurityCheck = checkBasicEmailSecurity(req.body);
      
      if (basicSecurityCheck.hasMaliciousContent) {
        // Record security incident
        await supabase.from('security_logs').insert([{
          ip,
          user_id: userId,
          method: req.method,
          path: req.path,
          headers: req.headers,
          type: 'EMAIL_MALICIOUS_CONTENT',
          detection: basicSecurityCheck,
          endpoint: req.originalUrl,
          details: 'Malicious content detected in email API'
        }]);
        
        // Block the request
        return res.status(400).json({
          error: 'Invalid input',
          message: 'The email contains potentially malicious content'
        });
      }
    }
    
    // If we reach here, all checks have passed
    next();
  } catch (error) {
    console.error('Input validation error:', error);
    next(error);
  }
};

module.exports = inputValidator; 
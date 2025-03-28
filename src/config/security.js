/**
 * Main security configuration file
 * Centralized location for all security-related settings
 */

const securityConfig = {
  /**
   * Rate limiting configuration
   */
  rateLimiting: {
    // General API requests: 100 requests per 15 minutes
    standard: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      maxRequests: 100
    },
    // Login/register/password reset: 10 requests per hour
    sensitive: {
      windowMs: 60 * 60 * 1000,  // 1 hour
      maxRequests: 10
    },
    // Time to blacklist IP after repeat abuse (minutes)
    tempBlacklistDuration: 30
  },
  
  /**
   * Account security configuration
   */
  account: {
    // Maximum failed login attempts before locking account
    maxLoginAttempts: 5,
    
    // Account lock duration (minutes)
    lockDuration: 5,
    
    // Session timeout (minutes)
    sessionTimeout: 30,
    
    // Require re-authentication for sensitive operations
    requireReauthForSensitiveOps: true
  },
  
  /**
   * Authentication configuration
   */
  auth: {
    // JWT token expiry (seconds)
    jwtExpiry: 3600,  // 1 hour
    
    // Refresh token expiry (seconds)
    refreshTokenExpiry: 604800,  // 7 days
    
    // Minimum password length
    minPasswordLength: 8,
    
    // Require varied character types in password
    passwordComplexity: true
  },
  
  /**
   * CORS and security headers
   */
  headers: {
    // CORS allowed origins (for production, this should be restrictive)
    corsAllowedOrigins: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
      : ['*'],
    
    // Content Security Policy settings 
    csp: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    
    // HTTP Strict Transport Security max age (seconds)
    hstsMaxAge: 15552000,  // 180 days
    
    // X-Frame-Options header
    frameOptions: 'SAMEORIGIN',
    
    // X-Content-Type-Options header
    contentTypeOptions: 'nosniff',
    
    // Referrer-Policy header
    referrerPolicy: 'strict-origin-when-cross-origin'
  },
  
  /**
   * Request validation
   */
  validation: {
    // Maximum upload size (bytes)
    maxUploadSize: 10 * 1024 * 1024,  // 10MB
    
    // Maximum JSON payload size (bytes)
    maxJsonSize: 1 * 1024 * 1024,  // 1MB
    
    // List of disallowed file extensions for uploads
    disallowedExtensions: [
      'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 
      'exe', 'dll', 'js', 'jsp', 'bat', 'cmd', 'sh', 
      'cgi', 'pl', 'asp', 'aspx', 'htaccess'
    ]
  },
  
  /**
   * Logging configuration
   */
  logging: {
    // Maximum size of logged request/response bodies (bytes)
    maxLogSize: 10 * 1024,  // 10KB
    
    // Sensitive headers that should be masked in logs
    sensitiveHeaders: [
      'authorization', 'cookie', 'x-api-key', 'x-auth-token',
      'api-key', 'password', 'token', 'secret'
    ],
    
    // Paths that should not be logged (e.g., health checks)
    excludePaths: [
      '/health', '/ping', '/metrics', '/favicon.ico'
    ],
    
    // Fields to mask in request/response logs
    sensitiveFields: [
      'password', 'token', 'secret', 'credit_card', 'creditCard',
      'ssn', 'social_security', 'socialSecurity', 'auth', 'key'
    ]
  },
  
  /**
   * SQL injection protection
   */
  sqlInjection: {
    // SQL keywords to check for in user input
    dangerousKeywords: [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER',
      'TRUNCATE', 'UNION', 'EXEC', 'EXECUTE'
    ],
    
    // Auto-blacklist IPs with multiple SQL injection attempts
    blacklistAfterAttempts: 3,
    
    // Time window for counting attempts (minutes)
    attemptWindow: 5
  },
  
  /**
   * XSS protection
   */
  xss: {
    // Content types that should have XSS protection
    protectedContentTypes: [
      'text/html', 'application/xhtml+xml', 'application/xml',
      'text/xml', 'text/plain'
    ]
  },
  
  /**
   * IP blacklisting
   */
  ipBlacklist: {
    // Time to keep temporary blacklisted IPs (hours)
    temporaryBlacklistDuration: 24,
    
    // Check known malicious IP lists (if integrated with a service)
    checkKnownMaliciousLists: true
  }
};

module.exports = securityConfig; 
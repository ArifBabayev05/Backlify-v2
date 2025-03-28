const helmet = require('helmet');

/**
 * Security headers middleware using Helmet
 * Adds various security headers to protect against common web vulnerabilities
 */
const securityHeaders = (app) => {
  // Apply Helmet with customized settings
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Relaxed for compatibility
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false, // Disabled for compatibility with embedded resources
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for APIs
    expectCt: {
      maxAge: 86400,
      enforce: true
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    hsts: {
      maxAge: 15552000, // 180 days
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    originAgentCluster: true,
    xssFilter: true
  }));
  
  // Add custom security headers in addition to Helmet
  app.use((req, res, next) => {
    // Prevent clickjacking with X-Frame-Options
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Feature-Policy/Permissions-Policy to limit browser features
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), interest-cohort=()');
    
    // Discourage caching of sensitive API endpoints
    if (req.path.includes('/auth/') || req.path.includes('/admin/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    
    next();
  });
};

module.exports = securityHeaders; 
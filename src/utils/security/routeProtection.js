/**
 * Route protection configuration
 * This file centralizes the management of which routes require authentication
 */

const { authMiddleware } = require('./auth');

// List of protected routes that require authentication
const protectedRoutes = [
  // Schema and API generator endpoints
  { path: '/generate-schema', method: 'POST' },
  { path: '/modify-schema', method: 'POST' },
  { path: '/create-api-from-schema', method: 'POST' },
  
  // Add more protected routes here as needed
  // Example: { path: '/api/users', method: 'GET' },
];

/**
 * Create a middleware that checks if a route should be protected
 * and applies authentication if needed
 * @returns {Function} Express middleware function
 */
const createProtectionMiddleware = () => {
  return (req, res, next) => {
    // Get the path and method from the request
    const { path, method } = req;
    
    // Check if this route should be protected
    const shouldProtect = protectedRoutes.some(route => 
      route.path === path && 
      route.method.toLowerCase() === method.toLowerCase()
    );
    
    if (shouldProtect) {
      console.log(`🔒 Route ${method} ${path} is protected, applying authentication`);
      // Apply authentication middleware
      return authMiddleware(req, res, next);
    }
    
    // Not a protected route, proceed normally
    next();
  };
};

/**
 * Apply route protection middleware to Express app
 * @param {Object} app - Express application instance
 */
const applyRouteProtection = (app) => {
  console.log('🔒 Applying route protection middleware...');
  
  // Apply the protection middleware to all routes
  app.use(createProtectionMiddleware());
  
  console.log('🛡️ Route protection middleware applied successfully');
  console.log('🔐 Protected routes:');
  protectedRoutes.forEach(route => {
    console.log(`  - ${route.method} ${route.path}`);
  });
};

/**
 * Add a new protected route
 * @param {string} path - Route path
 * @param {string} method - HTTP method (GET, POST, etc.)
 */
const addProtectedRoute = (path, method) => {
  protectedRoutes.push({ path, method: method.toUpperCase() });
};

/**
 * Remove protection from a route
 * @param {string} path - Route path
 * @param {string} method - HTTP method (GET, POST, etc.)
 */
const removeProtectedRoute = (path, method) => {
  const index = protectedRoutes.findIndex(
    route => route.path === path && route.method === method.toUpperCase()
  );
  
  if (index !== -1) {
    protectedRoutes.splice(index, 1);
  }
};

/**
 * Get list of all currently protected routes
 * @returns {Array} List of protected routes
 */
const getProtectedRoutes = () => {
  return [...protectedRoutes];
};

module.exports = {
  applyRouteProtection,
  addProtectedRoute,
  removeProtectedRoute,
  getProtectedRoutes,
  authMiddleware
}; 
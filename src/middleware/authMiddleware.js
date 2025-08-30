const { setCorsHeaders } = require('./corsMiddleware');

/**
 * Flexible Authentication Middleware
 * Supports both public and protected routes based on configuration
 */
class AuthenticationMiddleware {
  constructor() {
    this.publicRoutes = new Set();
    this.protectedRoutes = new Set();
    this.routeConfig = new Map();
  }

  /**
   * Register a public route (no authentication required)
   */
  addPublicRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    this.publicRoutes.add(routeKey);
    this.routeConfig.set(routeKey, { method, path, auth: false });
    console.log(`📖 Registered public route: ${routeKey}`);
  }

  /**
   * Register a protected route (authentication required)
   */
  addProtectedRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    this.protectedRoutes.add(routeKey);
    this.routeConfig.set(routeKey, { method, path, auth: true });
    console.log(`🔒 Registered protected route: ${routeKey}`);
  }

  /**
   * Check if a route is public (no auth required)
   */
  isPublicRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    
    // Check exact match first
    if (this.publicRoutes.has(routeKey)) {
      return true;
    }

    // Check for wildcard patterns
    for (const publicRoute of this.publicRoutes) {
      if (this.matchesPattern(routeKey, publicRoute)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a route pattern matches
   */
  matchesPattern(route, pattern) {
    // Convert pattern to regex (simple wildcard support)
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/:\w+/g, '[^/]+'); // Replace :param with regex
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(route);
  }

  /**
   * Main authentication middleware
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        // Always set CORS headers first
        setCorsHeaders(res, req);

        // Handle OPTIONS preflight requests
        if (req.method === 'OPTIONS') {
          return res.status(200).json({ message: 'CORS preflight OK' });
        }

        const method = req.method;
        const path = req.path || req.url;

        console.log(`🔍 Checking authentication for: ${method} ${path}`);

        // Check if this is a public route
        if (this.isPublicRoute(method, path)) {
          console.log(`📖 Public route access granted: ${method} ${path}`);
          // Set default user for public routes
          req.user = { username: 'anonymous', type: 'public' };
          req.XAuthUserId = 'anonymous';
          return next();
        }

        // For protected routes, require authentication
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication token is required for this endpoint'
          });
        }

        // Verify the token
        const authUtils = require('../utils/security/auth');
        const result = await authUtils.verifyToken(token);

        if (!result.success || result.data.type !== 'access') {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token'
          });
        }

        // Set verified user data on request
        req.user = result.data;
        req.XAuthUserId = result.data.username;
        console.log(`🔒 Protected route access granted: ${method} ${path} for user: ${req.XAuthUserId}`);

        next();
      } catch (error) {
        console.error('Authentication middleware error:', error);
        setCorsHeaders(res, req);
        res.status(500).json({
          success: false,
          error: 'Authentication error',
          message: 'Failed to verify authentication'
        });
      }
    };
  }

  /**
   * Middleware specifically for public routes
   */
  publicRoute() {
    return (req, res, next) => {
      setCorsHeaders(res, req);
      
      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).json({ message: 'CORS preflight OK' });
      }

      // Set default user for public routes
      req.user = { username: 'anonymous', type: 'public' };
      req.XAuthUserId = 'anonymous';
      
      console.log(`📖 Public route accessed: ${req.method} ${req.path}`);
      next();
    };
  }

  /**
   * Middleware specifically for protected routes
   */
  protectedRoute() {
    return async (req, res, next) => {
      try {
        setCorsHeaders(res, req);

        // Handle OPTIONS preflight
        if (req.method === 'OPTIONS') {
          return res.status(200).json({ message: 'CORS preflight OK' });
        }

        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication token is required'
          });
        }

        // Verify the token
        const authUtils = require('../utils/security/auth');
        const result = await authUtils.verifyToken(token);

        if (!result.success || result.data.type !== 'access') {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token'
          });
        }

        // Set verified user data on request
        req.user = result.data;
        req.XAuthUserId = result.data.username;
        
        console.log(`🔒 Protected route accessed: ${req.method} ${req.path} by user: ${req.XAuthUserId}`);
        next();
      } catch (error) {
        console.error('Protected route authentication error:', error);
        setCorsHeaders(res, req);
        res.status(500).json({
          success: false,
          error: 'Authentication error',
          message: 'Failed to verify authentication'
        });
      }
    };
  }

  /**
   * Initialize default route configurations
   */
  initializeDefaultRoutes() {
    // Public payment routes
    this.addPublicRoute('GET', '/api/payment/plans');
    this.addPublicRoute('POST', '/api/epoint-callback');
    this.addPublicRoute('GET', '/api/payment/success');
    this.addPublicRoute('GET', '/api/payment/cancel');
    
    // Public auth routes
    this.addPublicRoute('POST', '/auth/register');
    this.addPublicRoute('POST', '/auth/login');
    this.addPublicRoute('POST', '/auth/refresh');
    
    // Public Google auth routes
    this.addPublicRoute('POST', '/auth/google-login');
    this.addPublicRoute('POST', '/auth/google-verify');
    
    // Public debug routes (for development/testing)
    this.addPublicRoute('POST', '/debug/google-user-creation');
    this.addPublicRoute('POST', '/debug/google-full-flow');
    this.addPublicRoute('GET', '/debug/database-status');
    
    // Public health check
    this.addPublicRoute('GET', '/health');
    this.addPublicRoute('GET', '/api/health');
    
    // Protected payment routes
    this.addProtectedRoute('POST', '/api/payment/order');
    this.addProtectedRoute('GET', '/api/payment/history');
    this.addProtectedRoute('GET', '/api/payment/subscription');
    this.addProtectedRoute('GET', '/api/payment/check-subscription');
    
    // Protected auth routes
    this.addProtectedRoute('POST', '/auth/logout');
    this.addProtectedRoute('GET', '/auth/profile');
    this.addProtectedRoute('PUT', '/auth/profile');
    this.addProtectedRoute('POST', '/auth/change-password');
    
    // Protected Google auth routes
    this.addProtectedRoute('GET', '/auth/google-profile');
  }

  /**
   * Get route configuration for debugging
   */
  getRouteConfiguration() {
    return {
      publicRoutes: Array.from(this.publicRoutes),
      protectedRoutes: Array.from(this.protectedRoutes),
      totalPublic: this.publicRoutes.size,
      totalProtected: this.protectedRoutes.size
    };
  }
}

// Create singleton instance
const authMiddleware = new AuthenticationMiddleware();

// Initialize default routes
authMiddleware.initializeDefaultRoutes();

module.exports = {
  authMiddleware,
  authenticate: authMiddleware.authenticate.bind(authMiddleware),
  publicRoute: authMiddleware.publicRoute.bind(authMiddleware),
  protectedRoute: authMiddleware.protectedRoute.bind(authMiddleware)
};

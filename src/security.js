/**
 * Main security integration file
 * Applies all security middleware to the Express application
 */

// Load security modules
const rateLimiter = require('./middleware/security/rateLimiter');
const ipBlacklist = require('./middleware/security/ipBlacklist');
const inputValidator = require('./middleware/security/inputValidator');
const { accountLockMiddleware } = require('./middleware/security/accountLock');
const securityHeaders = require('./middleware/security/securityHeaders');
const { securityLogger } = require('./middleware/security/securityLogger');
const { errorHandler, setupGlobalErrorHandlers } = require('./middleware/security/errorHandler');
const routeProtection = require('./utils/security/routeProtection');

// Load security configuration
const securityConfig = require('./config/security');

// Import additional security packages
const helmet = require('helmet');
const cors = require('cors');
const express = require('express');

/**
 * Apply all security middleware to Express app
 * @param {Object} app - Express application instance
 */
const applySecurityMiddleware = (app) => {
  console.log('🔒 Applying security middleware...');
  
  // Apply IP blacklist checking first
  // This ensures blocked IPs are rejected before any other processing
  app.use(ipBlacklist);
  console.log('✅ IP blacklist checking enabled (primary)');
  
  // Apply rate limiter (should be early in the middleware chain)
  app.use(rateLimiter);
  console.log('✅ Rate limiting enabled');
  
  // Enable security headers via Helmet
  securityHeaders(app);
  console.log('✅ Security headers enabled');
  
  // Configure CORS with secure settings
  const corsOptions = {
    origin: function(origin, callback) {
      // In development mode, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      // In production, restrict to allowed origins
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : securityConfig.headers.corsAllowedOrigins;
      
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id', 'x-user-id', 'X-USER-ID', 'xauthuserid', 'XAuthUserId'],
    exposedHeaders: ['Content-Length'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };
  
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
  console.log('✅ CORS protection configured');
  
  // Add request size limits for DoS protection
  app.use(express.json({ 
    limit: securityConfig.validation.maxJsonSize 
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: securityConfig.validation.maxJsonSize
  }));
  console.log('✅ Request size limits configured');
  
  // Apply input validation and sanitization
  app.use(inputValidator);
  console.log('✅ Input validation and sanitization enabled');
  
  // Apply account locking for login attempts
  app.use(accountLockMiddleware);
  console.log('✅ Account locking protection enabled');
  
  // Apply security logger for suspicious behavior detection
  app.use(securityLogger);
  console.log('✅ Security logging enabled');
  
  // Setup global error handlers for uncaught exceptions
  setupGlobalErrorHandlers();
  console.log('✅ Global error handlers configured');
  
  // Error handler should be the last middleware
  app.use(errorHandler);
  console.log('✅ Error handling middleware configured');
  
  console.log('🛡️ All security middleware successfully applied');
};

/**
 * Setup authentication routes
 * @param {Object} app - Express application instance
 */
const setupAuthRoutes = (app) => {
  const authUtils = require('./utils/security/auth');
  const passwordPolicy = require('./utils/security/passwordPolicy');
  
  // Handle token refresh
  app.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Refresh token is required'
      });
    }
    
    const result = await authUtils.refreshAccessToken(refreshToken);
    
    if (!result.success) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: result.message
      });
    }
    
    res.json({
      accessToken: result.accessToken,
      username: result.username
    });
  });
  
  // Login endpoint that uses account lock features
  app.post('/auth/login', async (req, res) => {
    const { username, email, password } = req.body;
    
    if ((!username && !email) || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username/email and password are required'
      });
    }
    
    const result = await authUtils.authenticateUser(username || email, password, req);
    
    if (!result.success) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.message
      });
    }
    
    res.json({
      success: true,
      username: result.username,
      email: result.email,
      XAuthUserId: result.username,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  });
  
  // Add logout endpoint
  app.post('/auth/logout', async (req, res) => {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Refresh token is required for logout'
      });
    }
    
    // Get username from token if possible
    let username = null;
    if (accessToken) {
      const accessResult = await authUtils.verifyToken(accessToken);
      if (accessResult.success) {
        username = accessResult.data.username;
      }
    }
    
    // Invalidate the refresh token
    const result = await authUtils.invalidateToken(refreshToken, username, req);
    
    if (!result.success) {
      // Even if token invalidation fails, we want to respond with a success
      // status to the client, as the end result is still a "logged out" user
      console.warn('Token invalidation failed:', result.message);
    }
    
    // Add cache control headers to prevent caching of the logout response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  });
  
  // Update password with validation
  app.post('/auth/update-password', authUtils.authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const username = req.user.username;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing password data',
        message: 'Current password and new password are required'
      });
    }
    
    try {
      // Get user from database
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
      );
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      
      if (error || !user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Unable to find user account'
        });
      }
      
      // Verify current password
      const isValidPassword = await passwordPolicy.verifyPassword(currentPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid password',
          message: 'Current password is incorrect'
        });
      }
      
      // Validate new password
      const validation = passwordPolicy.validatePassword(newPassword, {
        username: user.username,
        email: user.email
      });
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Password policy violation',
          message: 'New password does not meet security requirements',
          details: validation.errors
        });
      }
      
      // Hash new password
      const hashedPassword = await passwordPolicy.hashPassword(newPassword);
      
      // Update password in database
      await supabase
        .from('users')
        .update({
          password: hashedPassword,
          // Reset login attempts on password change
          login_attempts: 0
        })
        .eq('username', username);
      
      // Log security event
      await supabase.from('security_logs').insert([{
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_id: username,
        method: req.method,
        path: req.path,
        type: 'PASSWORD_CHANGED',
        endpoint: req.originalUrl,
        details: `Password updated for user: ${username}`
      }]);
      
      return res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Password update error:', error);
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to update password'
      });
    }
  });
  
  console.log('✅ Security authentication routes configured');
};

/**
 * Apply route protection to Express app
 * This should be called after all routes are defined
 * @param {Object} app - Express application instance
 */
const applyRouteProtection = (app) => {
  routeProtection.applyRouteProtection(app);
};

/**
 * Add a test IP to blacklist (for development/testing only)
 */
const addTestIPToBlacklist = async (ip, reason = 'Test blacklist entry') => {
  try {
    if (!ip) {
      console.error('No IP provided for blacklist test');
      return;
    }
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    console.log(`Adding test IP to blacklist: ${ip}`);
    
    // Remove any existing entries for this IP first
    await supabase
      .from('ip_blacklist')
      .delete()
      .eq('ip', ip);
    
    // Add the IP to the blacklist
    const { data, error } = await supabase
      .from('ip_blacklist')
      .insert([{
        ip,
        reason,
        created_at: new Date().toISOString(),
        created_by: 'system-test'
      }])
      .select();
    
    if (error) {
      console.error('Failed to add test IP to blacklist:', error);
    } else {
      console.log('Test IP added to blacklist:', data);
    }
  } catch (error) {
    console.error('Error in addTestIPToBlacklist:', error);
  }
};

module.exports = {
  applySecurityMiddleware,
  setupAuthRoutes,
  applyRouteProtection,
  addTestIPToBlacklist,
  authMiddleware: routeProtection.authMiddleware
}; 
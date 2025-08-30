const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Get JWT secret from env or generate a secure one
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

/**
 * Authenticate user with username/email and password
 * @param {string} usernameOrEmail - Username or email
 * @param {string} password - User password
 * @param {Object} req - Express request object for logging
 * @returns {Object} Authentication result
 */
const authenticateUser = async (usernameOrEmail, password, req) => {
  try {
    // Find user by username or email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
      .maybeSingle();
    
    if (error) {
      throw new Error('Authentication error');
    }
    
    if (!user) {
      return {
        success: false,
        message: 'Invalid username/email or password'
      };
    }
    
    // Check if account is locked
    if (user.account_status === 'locked') {
      return {
        success: false,
        message: 'Account is locked due to multiple failed login attempts'
      };
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    // Import account lock functions if needed
    let accountLock;
    try {
      accountLock = require('../../middleware/security/accountLock');
    } catch (err) {
      console.warn('Account locking module not available');
    }
    
    if (!passwordMatch) {
      // Record failed login attempt if account lock module is available
      if (accountLock && accountLock.recordFailedLogin) {
        await accountLock.recordFailedLogin(user.username, req);
      }
      
      return {
        success: false,
        message: 'Invalid username/email or password'
      };
    }
    
    // Generate access token
    const accessToken = generateAccessToken(user.username);
    
    // Generate refresh token
    const refreshToken = generateRefreshToken(user.username);
    
    // Record successful login if account lock module is available
    if (accountLock && accountLock.recordSuccessfulLogin) {
      await accountLock.recordSuccessfulLogin(user.username, req);
    }
    
    return {
      success: true,
      username: user.username,
      email: user.email,
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      message: 'An error occurred during authentication'
    };
  }
};

/**
 * Generate JWT access token
 * @param {string} username - User's username
 * @returns {string} JWT token
 */
const generateAccessToken = (username) => {
  return jwt.sign(
    { 
      username,
      type: 'access' 
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRY
    }
  );
};

/**
 * Generate JWT refresh token
 * @param {string} username - User's username
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (username) => {
  const tokenId = crypto.randomBytes(16).toString('hex');
  
  return jwt.sign(
    { 
      username,
      type: 'refresh',
      id: tokenId
    },
    JWT_SECRET,
    { 
      expiresIn: REFRESH_TOKEN_EXPIRY
    }
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Verification result
 */
const verifyToken = async (token) => {
  try {
    // First, verify the token signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // If this is a refresh token, check if it has been invalidated
    if (decoded.type === 'refresh' && decoded.id) {
      // Check if token is in the invalid_tokens table
      const { data, error } = await supabase
        .from('invalid_tokens')
        .select('*')
        .eq('token_id', decoded.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking token validity:', error);
      }
      
      // If the token is found in the invalid_tokens table, it has been invalidated
      if (data) {
        return {
          success: false,
          message: 'Token has been invalidated'
        };
      }
    }
    
    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} New tokens or error
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const result = await verifyToken(refreshToken);
    
    if (!result.success || result.data.type !== 'refresh') {
      return {
        success: false,
        message: 'Invalid refresh token'
      };
    }
    
    const { username } = result.data;
    
    // Check if user exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('account_status')
      .eq('username', username)
      .maybeSingle();
    
    if (error || !user || user.account_status !== 'active') {
      return {
        success: false,
        message: 'User not found or account inactive'
      };
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(username);
    
    return {
      success: true,
      accessToken,
      username
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      message: 'Failed to refresh token'
    };
  }
};

/**
 * Invalidate a refresh token
 * This adds the token to a blacklist or marks it as invalid in the database
 * @param {string} refreshToken - The refresh token to invalidate
 * @param {string} username - The username associated with the token
 * @param {Object} req - Express request object for logging
 * @returns {Object} Result of the operation
 */
const invalidateToken = async (refreshToken, username, req) => {
  try {
    if (!refreshToken) {
      return {
        success: false,
        message: 'No token provided'
      };
    }

    // Verify the token first
    const result = await verifyToken(refreshToken);
    if (!result.success) {
      return {
        success: false,
        message: 'Invalid token'
      };
    }

    // Extract token ID and verify token type
    const { id, type, username: tokenUsername } = result.data;
    
    if (type !== 'refresh') {
      return {
        success: false,
        message: 'Not a refresh token'
      };
    }

    // Verify the username matches (additional security check)
    if (username && tokenUsername !== username) {
      return {
        success: false,
        message: 'Token does not match user'
      };
    }

    // Add token to the invalid_tokens table in Supabase
    // This will allow us to check if a token is blacklisted during verification
    const { error } = await supabase.from('invalid_tokens').insert([{
      token_id: id,
      username: tokenUsername,
      expires_at: new Date(result.data.exp * 1000).toISOString(),
      invalidated_at: new Date().toISOString(),
      invalidated_by: username || tokenUsername,
      ip: req ? (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress) : 'unknown'
    }]);

    if (error) {
      console.error('Error invalidating token:', error);
      return {
        success: false,
        message: 'Failed to invalidate token'
      };
    }

    // Log security event if request object is provided
    if (req) {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      
      try {
        await supabase.from('security_logs').insert([{
          ip,
          user_id: tokenUsername,
          method: req.method,
          path: req.path,
          type: 'USER_LOGOUT',
          endpoint: req.originalUrl,
          details: `User logged out: ${tokenUsername}`
        }]);
      } catch (logError) {
        console.error('Failed to log logout event:', logError);
      }
    }

    return {
      success: true,
      message: 'Token invalidated successfully'
    };
  } catch (error) {
    console.error('Token invalidation error:', error);
    return {
      success: false,
      message: 'An error occurred during token invalidation'
    };
  }
};

/**
 * Authentication middleware
 * Verifies JWT token in Authorization header
 */
const authMiddleware = async (req, res, next) => {
  // Get token from headers
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required'
    });
  }
  
  // Verify token
  const result = await verifyToken(token);
  
  if (!result.success || result.data.type !== 'access') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
  
  // Set user data on request
  req.user = result.data;
  req.XAuthUserId = result.data.username;
  
  next();
};

/**
 * Store refresh token (for consistency with Google auth)
 * @param {string} username - User's username
 * @param {string} refreshToken - Refresh token to store
 * @returns {Object} Result of operation
 */
const storeRefreshToken = async (username, refreshToken) => {
  try {
    // For now, we just return success since refresh tokens are stateless JWT
    // In the future, this could store token metadata in database
    console.log(`✅ Refresh token generated for user: ${username}`);
    return {
      success: true,
      message: 'Refresh token stored successfully'
    };
  } catch (error) {
    console.error('Error storing refresh token:', error);
    return {
      success: false,
      message: 'Failed to store refresh token'
    };
  }
};

/**
 * Generate token wrapper for backward compatibility
 * @param {string} username - User's username
 * @param {string} type - Token type ('access' or 'refresh')
 * @returns {string} Generated token
 */
const generateToken = (username, type) => {
  if (type === 'access') {
    return generateAccessToken(username);
  } else if (type === 'refresh') {
    return generateRefreshToken(username);
  } else {
    throw new Error(`Invalid token type: ${type}`);
  }
};

module.exports = {
  authenticateUser,
  generateAccessToken,
  generateRefreshToken,
  generateToken,
  storeRefreshToken,
  verifyToken,
  refreshAccessToken,
  invalidateToken,
  authMiddleware
}; 
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const authUtils = require('../utils/security/auth');

class GoogleAuthController {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  /**
   * Google OAuth Login/Register endpoint
   * POST /auth/google-login
   */
  async googleLogin(req, res) {
    try {
      setCorsHeaders(res, req);

      const { google_token, email, name, picture, google_id } = req.body;

      // Validate required fields
      if (!google_token || !email || !google_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'google_token, email, and google_id are required'
        });
      }

      // Verify Google token with Google's API
      const googleUserInfo = await this.verifyGoogleToken(google_token);
      
      if (!googleUserInfo || googleUserInfo.email !== email) {
        return res.status(401).json({
          success: false,
          error: 'Invalid Google token',
          details: 'Token verification failed or email mismatch'
        });
      }

      // Check if user exists with this Google ID
      let user = await this.findUserByGoogleId(google_id);
      
      if (!user) {
        // Check if user exists with this email (regular account)
        user = await this.findUserByEmail(email);
        
        if (user) {
          // Link Google ID to existing account
          await this.linkGoogleIdToUser(user.id, google_id, picture);
          console.log(`Linked Google ID ${google_id} to existing user ${user.username}`);
        } else {
          // Create new user with Google info
          user = await this.createGoogleUser(email, name, picture, google_id);
          console.log(`Created new Google user: ${user.username}`);
        }
      } else {
        // Update user info if needed
        await this.updateUserGoogleInfo(user.id, name, picture);
        console.log(`Updated Google user info: ${user.username}`);
      }

      // Generate JWT tokens
      const accessToken = await authUtils.generateToken(user.username, 'access');
      const refreshToken = await authUtils.generateToken(user.username, 'refresh');

      // Store refresh token
      await authUtils.storeRefreshToken(user.username, refreshToken);

      // Log successful login
      console.log(`Google login successful for user: ${user.username}`);

      res.json({
        success: true,
        XAuthUserId: user.username,
        email: user.email,
        name: user.full_name || name,
        picture: user.profile_picture || picture,
        accessToken,
        refreshToken,
        loginMethod: 'google',
        message: 'Google authentication successful'
      });

    } catch (error) {
      console.error('Google login error:', error);
      setCorsHeaders(res, req);
      res.status(500).json({
        success: false,
        error: 'Google authentication failed',
        details: error.message
      });
    }
  }

  /**
   * Verify Google token with Google's API
   */
  async verifyGoogleToken(token) {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000
      });

      if (response.status === 200) {
        return response.data;
      }
      
      throw new Error('Invalid Google token response');
    } catch (error) {
      console.error('Google token verification failed:', error.message);
      throw new Error('Failed to verify Google token');
    }
  }

  /**
   * Find user by Google ID
   */
  async findUserByGoogleId(googleId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('google_id', googleId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      return null;
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Create new user with Google info
   */
  async createGoogleUser(email, name, picture, googleId) {
    try {
      // Generate username from email
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let username = baseUsername;
      
      // Ensure username is unique
      let counter = 1;
      while (await this.isUsernameTaken(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      // Create password hash (won't be used for Google login, but required for DB)
      const hashedPassword = await bcrypt.hash(`google_${googleId}_${Date.now()}`, 10);

      const userData = {
        username,
        email,
        password: hashedPassword,
        full_name: name,
        profile_picture: picture,
        google_id: googleId,
        email_verified: true, // Google emails are pre-verified
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        login_method: 'google'
      };

      const { data, error } = await this.supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating Google user:', error);
      throw new Error('Failed to create user account');
    }
  }

  /**
   * Link Google ID to existing user
   */
  async linkGoogleIdToUser(userId, googleId, picture) {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          google_id: googleId,
          profile_picture: picture,
          email_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error linking Google ID to user:', error);
      throw new Error('Failed to link Google account');
    }
  }

  /**
   * Update user Google info
   */
  async updateUserGoogleInfo(userId, name, picture) {
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (name) updateData.full_name = name;
      if (picture) updateData.profile_picture = picture;

      const { error } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating user Google info:', error);
      // Don't throw error, this is not critical
    }
  }

  /**
   * Check if username is taken
   */
  async isUsernameTaken(username) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  }

  /**
   * Get user profile (for authenticated Google users)
   */
  async getGoogleUserProfile(req, res) {
    try {
      setCorsHeaders(res, req);

      const userId = req.user?.username || req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { data: user, error } = await this.supabase
        .from('users')
        .select('username, email, full_name, profile_picture, google_id, email_verified, created_at')
        .eq('username', userId)
        .single();

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        user: {
          username: user.username,
          email: user.email,
          name: user.full_name,
          picture: user.profile_picture,
          googleLinked: !!user.google_id,
          emailVerified: user.email_verified,
          joinedAt: user.created_at
        }
      });

    } catch (error) {
      console.error('Error getting Google user profile:', error);
      setCorsHeaders(res, req);
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile'
      });
    }
  }
}

module.exports = GoogleAuthController;

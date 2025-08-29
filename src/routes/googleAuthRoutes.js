const express = require('express');
const GoogleAuthController = require('../controllers/googleAuthController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { publicRoute, protectedRoute } = require('../middleware/authMiddleware');

const router = express.Router();
const googleAuthController = new GoogleAuthController();

// Apply CORS headers to all Google auth routes
router.use((req, res, next) => {
  setCorsHeaders(res, req);
  next();
});

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
  setCorsHeaders(res, req);
  res.status(200).json({ message: 'CORS preflight OK for Google Auth' });
});

/**
 * @route POST /auth/google-login
 * @desc Google OAuth login/register endpoint
 * @access Public - No authentication required
 * @body {
 *   google_token: string,
 *   email: string,
 *   name: string,
 *   picture: string,
 *   google_id: string
 * }
 * @returns {
 *   XAuthUserId: string,
 *   email: string,
 *   name: string,
 *   picture: string,
 *   accessToken: string,
 *   refreshToken: string
 * }
 */
router.post('/google-login', publicRoute(), googleAuthController.googleLogin.bind(googleAuthController));

/**
 * @route GET /auth/google-profile
 * @desc Get Google user profile information
 * @access Private - Authentication required
 * @returns User profile with Google information
 */
router.get('/google-profile', protectedRoute(), googleAuthController.getGoogleUserProfile.bind(googleAuthController));

/**
 * @route POST /auth/google-verify
 * @desc Verify Google token without login (for testing)
 * @access Public
 */
router.post('/google-verify', publicRoute(), async (req, res) => {
  try {
    setCorsHeaders(res, req);
    
    const { google_token } = req.body;
    
    if (!google_token) {
      return res.status(400).json({
        success: false,
        error: 'Google token is required'
      });
    }

    const controller = new GoogleAuthController();
    const googleUserInfo = await controller.verifyGoogleToken(google_token);
    
    res.json({
      success: true,
      message: 'Google token is valid',
      userInfo: {
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        picture: googleUserInfo.picture,
        id: googleUserInfo.id,
        verified_email: googleUserInfo.verified_email
      }
    });

  } catch (error) {
    console.error('Google token verification error:', error);
    setCorsHeaders(res, req);
    res.status(401).json({
      success: false,
      error: 'Invalid Google token',
      details: error.message
    });
  }
});

module.exports = router;

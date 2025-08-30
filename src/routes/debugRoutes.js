const express = require('express');
const GoogleAuthController = require('../controllers/googleAuthController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { publicRoute } = require('../middleware/authMiddleware');

const router = express.Router();
const googleAuthController = new GoogleAuthController();

// Apply CORS headers to all debug routes
router.use((req, res, next) => {
  setCorsHeaders(res, req);
  next();
});

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
  setCorsHeaders(res, req);
  res.status(200).json({ message: 'CORS preflight OK for Debug Routes' });
});

/**
 * @route POST /debug/google-user-creation
 * @desc Test Google user creation with detailed logging
 * @access Public - For debugging only
 */
router.post('/google-user-creation', publicRoute(), async (req, res) => {
  try {
    setCorsHeaders(res, req);
    
    console.log('🐛 DEBUG: Starting Google user creation test');
    console.log('📨 Request body:', req.body);
    
    const { email, name, picture, google_id } = req.body;
    
    if (!email || !google_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'email and google_id are required for testing',
        received: req.body
      });
    }

    // Test user creation directly
    try {
      const newUser = await googleAuthController.createGoogleUser(email, name, picture, google_id);
      
      console.log('🎉 DEBUG: User creation successful!');
      
      res.json({
        success: true,
        message: 'Google user creation test successful',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          google_id: newUser.google_id,
          login_method: newUser.login_method
        }
      });
      
    } catch (createError) {
      console.error('💥 DEBUG: User creation failed:', createError);
      
      res.status(500).json({
        success: false,
        error: 'User creation failed',
        details: createError.message,
        debugInfo: {
          errorType: createError.constructor.name,
          stack: createError.stack
        }
      });
    }

  } catch (error) {
    console.error('💥 DEBUG: Endpoint error:', error);
    setCorsHeaders(res, req);
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      details: error.message
    });
  }
});

/**
 * @route POST /debug/google-full-flow
 * @desc Test complete Google authentication flow
 * @access Public - For debugging only
 */
router.post('/google-full-flow', publicRoute(), async (req, res) => {
  try {
    setCorsHeaders(res, req);
    
    console.log('🐛 DEBUG: Starting full Google auth flow test');
    console.log('📨 Request body:', req.body);
    
    // Simulate the same flow as googleLogin but with more logging
    const { google_token, email, name, picture, google_id } = req.body;

    if (!google_token || !email || !google_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'google_token, email, and google_id are required'
      });
    }

    console.log('🔍 DEBUG: Checking for existing Google user...');
    
    // Check if user exists with this Google ID
    let user = await googleAuthController.findUserByGoogleId(google_id);
    
    if (!user) {
      console.log('🔍 DEBUG: No Google user found, checking by email...');
      // Check if user exists with this email
      user = await googleAuthController.findUserByEmail(email);
      
      if (user) {
        console.log('🔗 DEBUG: Found existing email user, linking Google ID...');
        await googleAuthController.linkGoogleIdToUser(user.id, google_id, picture);
        console.log('✅ DEBUG: Google ID linked successfully');
      } else {
        console.log('👤 DEBUG: No existing user, creating new Google user...');
        user = await googleAuthController.createGoogleUser(email, name, picture, google_id);
        console.log('✅ DEBUG: New Google user created');
      }
    } else {
      console.log('✅ DEBUG: Existing Google user found, updating info...');
      await googleAuthController.updateUserGoogleInfo(user.id, name, picture);
    }

    res.json({
      success: true,
      message: 'Google auth flow test successful',
      flow: user ? 'completed' : 'failed',
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        google_id: user.google_id,
        login_method: user.login_method
      } : null
    });

  } catch (error) {
    console.error('💥 DEBUG: Full flow error:', error);
    setCorsHeaders(res, req);
    res.status(500).json({
      success: false,
      error: 'Debug full flow failed',
      details: error.message,
      debugInfo: {
        errorType: error.constructor.name,
        stack: error.stack
      }
    });
  }
});

/**
 * @route GET /debug/database-status
 * @desc Check database connection and table structure
 * @access Public - For debugging only
 */
router.get('/database-status', publicRoute(), async (req, res) => {
  try {
    setCorsHeaders(res, req);
    
    console.log('🐛 DEBUG: Checking database status...');
    
    const supabase = googleAuthController.supabase;
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('username, email, google_id, login_method')
      .limit(3);

    if (testError) {
      throw testError;
    }

    // Check for Google users
    const { data: googleUsers, error: googleError } = await supabase
      .from('users')
      .select('username, email, google_id, login_method')
      .not('google_id', 'is', null)
      .limit(5);

    res.json({
      success: true,
      message: 'Database status check successful',
      connection: 'working',
      totalSampleUsers: testData ? testData.length : 0,
      googleUsers: googleUsers ? googleUsers.length : 0,
      sampleUserColumns: testData && testData.length > 0 ? Object.keys(testData[0]) : [],
      googleUserSample: googleUsers && googleUsers.length > 0 ? googleUsers[0] : null
    });

  } catch (error) {
    console.error('💥 DEBUG: Database status error:', error);
    setCorsHeaders(res, req);
    res.status(500).json({
      success: false,
      error: 'Database status check failed',
      details: error.message
    });
  }
});

module.exports = router;

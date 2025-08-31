const express = require('express');
const multer = require('multer');
const VideoController = require('../controllers/videoController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { publicRoute, protectedRoute } = require('../middleware/authMiddleware');

const router = express.Router();
const videoController = new VideoController();

// Configure multer for video uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for database insertion
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  }
});

// Apply CORS headers to all video routes
router.use((req, res, next) => {
  setCorsHeaders(res, req);
  next();
});

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
  setCorsHeaders(res, req);
  res.status(200).json({ message: 'CORS preflight OK' });
});

/**
 * @route POST /video/upload
 * @desc Upload a video file
 * @access Public - No authentication required for testing
 */
router.post('/upload', 
  publicRoute(), // Allow public access for testing
  upload.single('video'), // 'video' is the field name in form-data
  videoController.uploadVideo.bind(videoController)
);

/**
 * @route GET /video/stats
 * @desc Get video upload statistics
 * @access Public - No authentication required for testing
 */
router.get('/stats', 
  publicRoute(), // Allow public access for testing
  videoController.getVideoStats.bind(videoController)
);

/**
 * @route GET /video/list
 * @desc Get list of all uploaded videos
 * @access Public - No authentication required for testing
 */
router.get('/list', 
  publicRoute(), // Allow public access for testing
  videoController.getVideoList.bind(videoController)
);

/**
 * @route GET /video/:id/info
 * @desc Get video information by ID (without binary data)
 * @access Public - No authentication required for testing
 */
router.get('/:id/info', 
  publicRoute(), // Allow public access for testing
  videoController.getVideoInfo.bind(videoController)
);

/**
 * @route GET /video/:id
 * @desc Stream video file by ID
 * @access Public - No authentication required for testing
 */
router.get('/:id', 
  publicRoute(), // Allow public access for testing
  videoController.streamVideo.bind(videoController)
);

/**
 * @route DELETE /video/:id
 * @desc Delete video by ID
 * @access Public - No authentication required for testing
 */
router.delete('/:id', 
  publicRoute(), // Allow public access for testing
  videoController.deleteVideo.bind(videoController)
);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        details: 'File size exceeds the 100MB limit'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Upload error',
      details: error.message
    });
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      details: error.message
    });
  }
  
  next(error);
});

module.exports = router; 

const express = require('express');
const AnalysisController = require('../controllers/analysisController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');

const router = express.Router();
const analysisController = new AnalysisController();

// Apply CORS headers to all analysis routes
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
 * @route POST /api/analysis
 * @desc Receives raw Windows Security log JSON(s), analyzes them via AI, and writes the structured result to the database
 * @access Public - No authentication required
 */
router.post('/', analysisController.analyzeLogs.bind(analysisController));

/**
 * @route GET /api/analysis
 * @desc Returns all historical analysis results (structured logs) with filtering support
 * @access Public - No authentication required
 */
router.get('/', analysisController.getAllAnalysis.bind(analysisController));

/**
 * @route GET /api/analysis/:id
 * @desc Returns a specific analysis result based on a unique ID
 * @access Public - No authentication required
 */
router.get('/:id', analysisController.getAnalysisById.bind(analysisController));

module.exports = router;

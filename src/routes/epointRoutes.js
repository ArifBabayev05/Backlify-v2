const express = require('express');
const EpointController = require('../controllers/epointController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { publicRoute, protectedRoute } = require('../middleware/authMiddleware');

const router = express.Router();
const epointController = new EpointController();

// Apply CORS headers to all Epoint routes
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
 * @route POST /api/epoint/create-payment
 * @desc Create standard payment request
 * @access Public - No authentication required
 */
router.post('/create-payment', publicRoute(), epointController.createStandardPayment.bind(epointController));

/**
 * @route POST /api/epoint/request
 * @desc Create payment request that matches frontend expectations
 * @access Public - No authentication required
 */
router.post('/request', publicRoute(), epointController.createPaymentRequest.bind(epointController));

/**
 * @route POST /api/epoint/callback
 * @desc Epoint payment callback webhook
 * @access Public - No authentication required (called by Epoint)
 */
router.post('/callback', publicRoute(), epointController.handlePaymentCallback.bind(epointController));

/**
 * @route POST /api/epoint/check-status
 * @desc Check payment transaction status
 * @access Public - No authentication required
 */
router.post('/check-status', publicRoute(), epointController.checkPaymentStatus.bind(epointController));

/**
 * @route POST /api/epoint/save-card
 * @desc Initiate card saving process
 * @access Public - No authentication required
 */
router.post('/save-card', publicRoute(), epointController.saveCard.bind(epointController));

/**
 * @route POST /api/epoint/execute-saved-card-payment
 * @desc Execute payment with saved card
 * @access Public - No authentication required
 */
router.post('/execute-saved-card-payment', publicRoute(), epointController.executeSavedCardPayment.bind(epointController));

/**
 * @route POST /api/epoint/reverse-payment
 * @desc Reverse/cancel a payment transaction
 * @access Public - No authentication required
 */
router.post('/reverse-payment', publicRoute(), epointController.reversePayment.bind(epointController));

/**
 * @route POST /api/epoint/pre-auth/create
 * @desc Create pre-authorization request
 * @access Public - No authentication required
 */
router.post('/pre-auth/create', publicRoute(), epointController.createPreAuth.bind(epointController));

/**
 * @route POST /api/epoint/pre-auth/complete
 * @desc Complete pre-authorization
 * @access Public - No authentication required
 */
router.post('/pre-auth/complete', publicRoute(), epointController.completePreAuth.bind(epointController));

module.exports = router;

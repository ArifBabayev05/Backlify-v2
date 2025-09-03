const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { setCorsHeaders } = require('../middleware/corsMiddleware');
const { publicRoute, protectedRoute } = require('../middleware/authMiddleware');

const router = express.Router();
const paymentController = new PaymentController();

// Apply CORS headers to all payment routes
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
 * @route GET /api/payment/plans
 * @desc Get available payment plans
 * @access Public - No authentication required
 */
router.get('/plans', publicRoute(), paymentController.getPlans.bind(paymentController));

/**
 * @route POST /api/payment/order
 * @desc Create a new payment order
 * @access Private - Authentication required
 */
router.post('/order', protectedRoute(), paymentController.createOrder.bind(paymentController));

/**
 * @route GET /api/payment/history
 * @desc Get user's payment history
 * @access Private - Authentication required
 */
router.get('/history', protectedRoute(), paymentController.getPaymentHistory.bind(paymentController));

/**
 * @route GET /api/payment/subscription
 * @desc Get user's active subscription
 * @access Private - Authentication required
 */
router.get('/subscription', protectedRoute(), paymentController.getSubscription.bind(paymentController));

/**
 * @route GET /api/payment/check-subscription
 * @desc Check if user has active subscription
 * @access Private - Authentication required
 */
router.get('/check-subscription', protectedRoute(), paymentController.checkSubscription.bind(paymentController));

/**
 * @route POST /api/epoint-callback
 * @desc Epoint payment callback endpoint (legacy - now handled by /api/epoint/callback)
 * @access Public - No authentication required (called by Epoint)
 */
router.post('/epoint-callback', publicRoute(), paymentController.processEpointCallback.bind(paymentController));

/**
 * @route GET /api/payment/success
 * @desc Payment success page
 * @access Public - No authentication required
 */
router.get('/success', publicRoute(), paymentController.paymentSuccess.bind(paymentController));

/**
 * @route GET /api/payment/cancel
 * @desc Payment cancel page
 * @access Public - No authentication required
 */
router.get('/cancel', publicRoute(), paymentController.paymentCancel.bind(paymentController));

module.exports = router;

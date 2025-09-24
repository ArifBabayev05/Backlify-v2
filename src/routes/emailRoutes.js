const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { protectedRoute } = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/security/rateLimiter');

// Apply rate limiting to all email routes
router.use(rateLimiter);


/**
 * @swagger
 * /api/email/flexible:
 *   post:
 *     summary: Send flexible email with full control
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - from
 *               - subject
 *               - html
 *             properties:
 *               to:
 *                 oneOf:
 *                   - type: string
 *                     format: email
 *                   - type: array
 *                     items:
 *                       type: string
 *                       format: email
 *                 description: Recipient email(s)
 *               from:
 *                 type: string
 *                 format: email
 *                 description: Sender email
 *               subject:
 *                 type: string
 *                 description: Email subject
 *               html:
 *                 type: string
 *                 description: HTML content
 *               text:
 *                 type: string
 *                 description: Plain text content
 *               replyTo:
 *                 type: string
 *                 format: email
 *                 description: Reply-to email
 *               cc:
 *                 oneOf:
 *                   - type: string
 *                     format: email
 *                   - type: array
 *                     items:
 *                       type: string
 *                       format: email
 *                 description: CC email(s)
 *               bcc:
 *                 oneOf:
 *                   - type: string
 *                     format: email
 *                   - type: array
 *                     items:
 *                       type: string
 *                       format: email
 *                 description: BCC email(s)
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     content:
 *                       type: string
 *                     path:
 *                       type: string
 *                 description: Email attachments
 *               headers:
 *                 type: object
 *                 description: Custom headers
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high]
 *                 description: Email priority
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       200:
 *         description: Flexible email sent successfully
 *       400:
 *         description: Bad request - missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/flexible', emailController.sendFlexibleEmail);

/**
 * @swagger
 * /api/email/logs:
 *   get:
 *     summary: Get email logs (Admin only)
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [sent, failed]
 *         description: Filter by email status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by email type
 *       - in: query
 *         name: fromEmail
 *         schema:
 *           type: string
 *         description: Filter by sender email
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of logs to return
 *     responses:
 *       200:
 *         description: Email logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized - admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/logs', protectedRoute, emailController.getEmailLogs);

/**
 * @swagger
 * /api/email/test:
 *   get:
 *     summary: Test email configuration
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email configuration test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/test', protectedRoute, emailController.testEmailConfiguration);

module.exports = router;

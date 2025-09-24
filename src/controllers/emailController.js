const emailService = require('../services/emailService');
const { createClient } = require('@supabase/supabase-js');

class EmailController {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }


  /**
   * Get email logs (admin only)
   * GET /api/email/logs
   */
  async getEmailLogs(req, res) {
    try {
      const {
        status,
        type,
        fromEmail,
        limit = 50
      } = req.query;

      const filters = {
        status,
        type,
        fromEmail,
        limit: parseInt(limit)
      };

      const logs = await emailService.getEmailLogs(filters);

      res.status(200).json({
        success: true,
        data: logs,
        count: logs.length
      });

    } catch (error) {
      console.error('Get email logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve email logs'
      });
    }
  }

  /**
   * Test email configuration
   * GET /api/email/test
   */
  async testEmailConfiguration(req, res) {
    try {
      const result = await emailService.testConfiguration();

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Email configuration test failed'
        });
      }

    } catch (error) {
      console.error('Email configuration test error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to test email configuration'
      });
    }
  }


  /**
   * Send flexible email with full control
   * POST /api/email/flexible
   */
  async sendFlexibleEmail(req, res) {
    try {
      const {
        to,                    // Kimə göndəriləcək (array və ya string)
        from,                  // Kimdən göndəriləcək
        subject,               // Mövzu
        html,                  // HTML content
        text,                  // Plain text content
        replyTo,               // Cavab ünvanı
        cc,                    // Kopya
        bcc,                   // Gizli kopya
        attachments,           // Əlavələr
        headers,               // Xüsusi header-lar
        priority,              // Prioritet
        metadata = {}          // Əlavə məlumatlar
      } = req.body;

      // Validate required fields
      if (!to || !from || !subject || (!html && !text)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'to, from, subject, and (html or text) are required'
        });
      }

      // Validate email format for 'from'
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(from)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid from email format',
          message: 'Please provide a valid from email address'
        });
      }

      // Send flexible email
      const result = await emailService.sendFlexibleEmail({
        to,
        from,
        subject,
        html,
        text,
        replyTo,
        cc,
        bcc,
        attachments,
        headers,
        priority,
        metadata
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Flexible email sent successfully',
          messageId: result.messageId
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Failed to send flexible email'
        });
      }

    } catch (error) {
      console.error('Flexible email controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }
}

module.exports = new EmailController();

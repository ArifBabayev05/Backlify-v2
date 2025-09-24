const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

class EmailService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Email configuration
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
      }
    });

    // Default recipient
    this.defaultRecipient = 'info@backlify.app';
  }

  /**
   * Send email to info@backlify.app
   * @param {Object} emailData - Email data
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.message - Email message/body
   * @param {string} emailData.fromEmail - Sender's email
   * @param {string} emailData.fromName - Sender's name (optional)
   * @param {string} emailData.type - Type of email (contact, support, feedback, etc.)
   * @param {Object} emailData.metadata - Additional metadata (optional)
   * @returns {Promise<Object>} - Result object
   */
  async sendEmail(emailData) {
    try {
      console.log('=== EMAIL SENDING DEBUG ===');
      console.log('Email data:', emailData);
      console.log('SMTP Host:', process.env.SMTP_HOST);
      console.log('SMTP Port:', process.env.SMTP_PORT);
      console.log('SMTP User:', process.env.SMTP_USER);
      console.log('SMTP Pass exists:', !!process.env.SMTP_PASS);
      
      const {
        subject,
        message,
        fromEmail,
        fromName = 'Backlify User',
        type = 'general',
        metadata = {}
      } = emailData;

      // Validate required fields
      if (!subject || !message || !fromEmail) {
        throw new Error('Subject, message, and fromEmail are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(fromEmail)) {
        throw new Error('Invalid email format');
      }

      // Check SMTP configuration
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP configuration is incomplete. Please check your .env file.');
      }

      // Test SMTP connection first
      console.log('Testing SMTP connection...');
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');

      // Prepare email content
      const mailOptions = {
        from: `"${fromName}" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
        to: this.defaultRecipient,
        replyTo: fromEmail,
        subject: `[${type.toUpperCase()}] ${subject}`,
        html: this.formatEmailHTML(emailData),
        text: this.formatEmailText(emailData)
      };

      console.log('Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);

      // Log email to database
      await this.logEmailToDatabase({
        ...emailData,
        messageId: result.messageId,
        status: 'sent',
        sentAt: new Date().toISOString()
      });

      return {
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully'
      };

    } catch (error) {
      console.error('=== EMAIL SENDING ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error response:', error.response);
      console.error('Full error:', error);
      
      // Log failed email to database
      await this.logEmailToDatabase({
        ...emailData,
        status: 'failed',
        error: error.message,
        sentAt: new Date().toISOString()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format email as HTML
   * @param {Object} emailData - Email data
   * @returns {string} - HTML formatted email
   */
  formatEmailHTML(emailData) {
    const {
      subject,
      message,
      fromEmail,
      fromName,
      type,
      metadata
    } = emailData;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .content { background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .footer { margin-top: 20px; padding: 10px; font-size: 12px; color: #666; }
          .metadata { background: #f9f9f9; padding: 10px; margin: 10px 0; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New ${type.charAt(0).toUpperCase() + type.slice(1)} Email</h2>
            <p><strong>From:</strong> ${fromName} (${fromEmail})</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="content">
            <h3>Message:</h3>
            <div style="white-space: pre-wrap;">${message}</div>
          </div>

          ${Object.keys(metadata).length > 0 ? `
            <div class="metadata">
              <h4>Additional Information:</h4>
              <ul>
                ${Object.entries(metadata).map(([key, value]) => 
                  `<li><strong>${key}:</strong> ${value}</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="footer">
            <p>This email was sent via Backlify API</p>
            <p>Reply directly to this email to respond to ${fromEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format email as plain text
   * @param {Object} emailData - Email data
   * @returns {string} - Plain text formatted email
   */
  formatEmailText(emailData) {
    const {
      subject,
      message,
      fromEmail,
      fromName,
      type,
      metadata
    } = emailData;

    let text = `New ${type.charAt(0).toUpperCase() + type.slice(1)} Email\n`;
    text += `From: ${fromName} (${fromEmail})\n`;
    text += `Subject: ${subject}\n`;
    text += `Received: ${new Date().toLocaleString()}\n\n`;
    text += `Message:\n${message}\n\n`;

    if (Object.keys(metadata).length > 0) {
      text += `Additional Information:\n`;
      Object.entries(metadata).forEach(([key, value]) => {
        text += `${key}: ${value}\n`;
      });
      text += `\n`;
    }

    text += `This email was sent via Backlify API\n`;
    text += `Reply directly to this email to respond to ${fromEmail}`;

    return text;
  }

  /**
   * Log email to database
   * @param {Object} emailLog - Email log data
   */
  async logEmailToDatabase(emailLog) {
    try {
      const { data, error } = await this.supabase
        .from('email_logs')
        .insert([{
          from_email: emailLog.fromEmail,
          from_name: emailLog.fromName,
          subject: emailLog.subject,
          message: emailLog.message,
          type: emailLog.type,
          metadata: emailLog.metadata || {},
          message_id: emailLog.messageId,
          status: emailLog.status,
          error: emailLog.error,
          sent_at: emailLog.sentAt,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Email_logs table not found. Email logging disabled. Please create the table manually.');
        } else {
          console.error('Failed to log email to database:', error);
        }
      }
    } catch (error) {
      console.error('Database logging error:', error);
    }
  }

  /**
   * Get email logs
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - Email logs
   */
  async getEmailLogs(filters = {}) {
    try {
      let query = this.supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.fromEmail) {
        query = query.eq('from_email', filters.fromEmail);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get email logs:', error);
      return [];
    }
  }

  /**
   * Send flexible email with full control over all parameters
   * @param {Object} emailData - Email data with full control
   * @returns {Promise<Object>} - Result object
   */
  async sendFlexibleEmail(emailData) {
    try {
      console.log('=== FLEXIBLE EMAIL SENDING DEBUG ===');
      console.log('Email data:', emailData);
      
      const {
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
        metadata = {}
      } = emailData;

      // Validate required fields
      if (!to || !from || !subject || (!html && !text)) {
        throw new Error('to, from, subject, and (html or text) are required');
      }

      // Validate email format for 'from'
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(from)) {
        throw new Error('Invalid from email format');
      }

      // Check SMTP configuration
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP configuration is incomplete. Please check your .env file.');
      }

      // Test SMTP connection first
      console.log('Testing SMTP connection...');
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');

      // Prepare email content
      const mailOptions = {
        from: from,
        to: to,
        subject: subject,
        html: html,
        text: text,
        replyTo: replyTo,
        cc: cc,
        bcc: bcc,
        attachments: attachments,
        headers: headers,
        priority: priority
      };

      // Remove undefined values
      Object.keys(mailOptions).forEach(key => {
        if (mailOptions[key] === undefined) {
          delete mailOptions[key];
        }
      });

      console.log('Sending flexible email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        hasText: !!mailOptions.text,
        hasAttachments: !!mailOptions.attachments
      });

      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Flexible email sent successfully:', result.messageId);

      // Log email to database
      await this.logEmailToDatabase({
        fromEmail: from,
        fromName: from.split('@')[0],
        subject: subject,
        message: html || text,
        type: 'flexible',
        metadata: {
          ...metadata,
          to: to,
          replyTo: replyTo,
          cc: cc,
          bcc: bcc,
          hasAttachments: !!attachments,
          priority: priority
        },
        messageId: result.messageId,
        status: 'sent',
        sentAt: new Date().toISOString()
      });

      return {
        success: true,
        messageId: result.messageId,
        message: 'Flexible email sent successfully'
      };

    } catch (error) {
      console.error('=== FLEXIBLE EMAIL SENDING ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Full error:', error);
      
      // Log failed email to database
      await this.logEmailToDatabase({
        fromEmail: emailData.from,
        fromName: emailData.from?.split('@')[0] || 'Unknown',
        subject: emailData.subject,
        message: emailData.html || emailData.text,
        type: 'flexible',
        metadata: emailData.metadata || {},
        status: 'failed',
        error: error.message,
        sentAt: new Date().toISOString()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test email configuration
   * @returns {Promise<Object>} - Test result
   */
  async testConfiguration() {
    try {
      console.log('Testing email configuration...');
      console.log('SMTP Host:', process.env.SMTP_HOST);
      console.log('SMTP Port:', process.env.SMTP_PORT);
      console.log('SMTP User:', process.env.SMTP_USER);
      console.log('SMTP Pass exists:', !!process.env.SMTP_PASS);
      
      await this.transporter.verify();
      console.log('Email configuration verified successfully');
      return {
        success: true,
        message: 'Email configuration is valid'
      };
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();

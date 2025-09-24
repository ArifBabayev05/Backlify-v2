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

  /**
   * Generate welcome email HTML template
   * @param {object} userData - User data
   * @returns {string} HTML template
   */
  generateWelcomeEmailTemplate(userData) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Backlify AI</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4; line-height: 1.6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #00D2FF 0%, #3A7BD5 50%, #8B5CF6 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Welcome to Backlify AI</h1>
                            <p style="margin: 15px 0 0; color: #ffffff; font-size: 18px; opacity: 0.95;">Your AI-powered backend journey starts now</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 25px; color: #333333; font-size: 24px; font-weight: bold;">Hey ${userData.username || userData.email?.split('@')[0] || 'there'}!</h2>
                            
                            <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.6;">
                                Welcome to Backlify AI! We're excited to have you on board. Our goal is to make backend development simple and seamless, so you can focus on what you do best: building amazing applications.
                            </p>

                            <!-- Account Details Card -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px; color: #00D2FF; font-size: 18px; font-weight: bold; display: flex; align-items: center;">
                                            <span style="margin-right: 10px;">⚡</span>
                                            Your Account Details
                                        </h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Username</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${userData.username || 'N/A'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Email</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${userData.email}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Registration Date</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${currentDate}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Account Status</td>
                                                            <td style="color: #10B981; font-size: 14px; font-weight: 700; text-align: right;">✅ Active</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Basic Plan Card -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px; color: #00D2FF; font-size: 18px; font-weight: bold; display: flex; align-items: center;">
                                            <span style="margin-right: 10px;">👑</span>
                                            Your Basic Plan
                                        </h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Plan Name</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">Basic Plan</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Price</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">Free</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Features</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">
                                                                <div style="text-align: right;">
                                                                    <div>Basic API access</div>
                                                                    <div>1000 requests/month</div>
                                                                    <div>Email support</div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                                To get started, you can easily create your first API with just a few clicks from your dashboard. Simply describe the data or service you need, and our AI will generate a fully functional API for you. It's that simple!
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="https://backlify.app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #00D2FF 0%, #3A7BD5 50%, #8B5CF6 100%); color: #ffffff; text-decoration: none; padding: 18px 35px; border-radius: 8px; font-weight: bold; font-size: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0, 210, 255, 0.3);">
                                            Get Started
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 16px;"><strong>Cheers,</strong></p>
                            <p style="margin: 0 0 20px; color: #666666; font-size: 16px;">The Backlify AI Team</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="https://backlify.app/docs" style="color: #00D2FF; text-decoration: none; font-weight: 500; margin: 0 15px; font-size: 14px;">Documentation</a>
                                        <a href="https://backlify.app/support" style="color: #00D2FF; text-decoration: none; font-weight: 500; margin: 0 15px; font-size: 14px;">Support</a>
                                        <a href="https://backlify.app/contact" style="color: #00D2FF; text-decoration: none; font-weight: 500; margin: 0 15px; font-size: 14px;">Contact Us</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0; font-size: 12px; color: #999999;">© 2025 Backlify AI. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  /**
   * Generate plan upgrade email HTML template
   * @param {object} userData - User data
   * @param {object} planData - Plan data
   * @returns {string} HTML template
   */
  generateUpgradeEmailTemplate(userData, planData) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan Upgraded - Backlify AI</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4; line-height: 1.6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #00D2FF 0%, #3A7BD5 50%, #8B5CF6 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎉 Plan Upgraded!</h1>
                            <p style="margin: 15px 0 0; color: #ffffff; font-size: 18px; opacity: 0.95;">You've unlocked new possibilities</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 25px; color: #333333; font-size: 24px; font-weight: bold;">Hey ${userData.username || userData.email?.split('@')[0] || 'there'}!</h2>

                            <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.6;">
                                Congratulations! Your Backlify AI plan has been successfully upgraded. You now have access to more powerful features and higher limits to supercharge your backend development.
                            </p>

                            <!-- Plan Details Card -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px; color: #00D2FF; font-size: 18px; font-weight: bold; display: flex; align-items: center;">
                                            <span style="margin-right: 10px;">📈</span>
                                            Your New Plan Details
                                        </h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Plan Name</td>
                                                            <td style="color: #10B981; font-size: 14px; font-weight: 700; text-align: right;">${planData.name || 'Upgraded Plan'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Upgrade Date</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${currentDate}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Status</td>
                                                            <td style="color: #10B981; font-size: 14px; font-weight: 700; text-align: right;">✅ Active</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Amount Paid</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${planData.amount ? planData.amount + ' ' + (planData.currency || 'AZN') : 'N/A'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Subscription Expires</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${planData.expirationDate || 'N/A'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Payment Method</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${planData.paymentMethod || 'Epoint'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Features Card -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px; color: #00D2FF; font-size: 18px; font-weight: bold; display: flex; align-items: center;">
                                            <span style="margin-right: 10px;">⭐</span>
                                            New Features Unlocked
                                        </h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">API Requests</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${planData.requestsLimit || 'Unlimited'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Projects</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${planData.projectsLimit || 'Unlimited'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 500;">Support Level</td>
                                                            <td style="color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${planData.supportLevel || 'Priority Support'}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                                Ready to explore your new features? Head over to your dashboard and start building with your enhanced capabilities!
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="https://backlify.app" style="display: inline-block; background: linear-gradient(135deg, #00D2FF 0%, #3A7BD5 50%, #8B5CF6 100%); color: #ffffff; text-decoration: none; padding: 18px 35px; border-radius: 8px; font-weight: bold; font-size: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0, 210, 255, 0.3);">
                                            🚀 Go to Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 16px;"><strong>Happy Building!</strong></p>
                            <p style="margin: 0 0 20px; color: #666666; font-size: 16px;">The Backlify AI Team</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="https://backlify.app/docs" style="color: #00D2FF; text-decoration: none; font-weight: 500; margin: 0 15px; font-size: 14px;">Documentation</a>
                                        <a href="https://backlify.app/support" style="color: #00D2FF; text-decoration: none; font-weight: 500; margin: 0 15px; font-size: 14px;">Support</a>
                                        <a href="https://backlify.app/contact" style="color: #00D2FF; text-decoration: none; font-weight: 500; margin: 0 15px; font-size: 14px;">Contact Us</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0; font-size: 12px; color: #999999;">© 2025 Backlify AI. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
  }

  /**
   * Send welcome email to new user
   * @param {object} userData - User data
   * @returns {object} Result
   */
  async sendWelcomeEmail(userData) {
    try {
      console.log('=== SENDING WELCOME EMAIL ===');
      console.log('User data:', userData);

      // Check if welcome email was already sent
      const userId = userData.id || userData.user_id;
      if (userId && await this.wasEmailSent(userId, 'welcome')) {
        console.log('Welcome email already sent to user:', userId);
        return { success: true, message: 'Welcome email already sent' };
      }

      const html = this.generateWelcomeEmailTemplate(userData);
      
      const emailData = {
        to: userData.email,
        from: 'info@backlify.app',
        subject: '🚀 Welcome to Backlify AI - Your AI Backend Journey Starts Now!',
        html: html,
        metadata: {
          type: 'welcome',
          userId: userId,
          username: userData.username,
          registrationDate: new Date().toISOString()
        }
      };

      return await this.sendFlexibleEmail(emailData);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send plan upgrade email
   * @param {object} userData - User data
   * @param {object} planData - Plan data
   * @returns {object} Result
   */
  async sendUpgradeEmail(userData, planData) {
    try {
      console.log('=== SENDING UPGRADE EMAIL ===');
      console.log('User data:', userData);
      console.log('Plan data:', planData);

      // Check if upgrade email was already sent for this plan
      const userId = userData.id || userData.user_id;
      if (userId && await this.wasEmailSent(userId, 'upgrade')) {
        console.log('Upgrade email already sent to user:', userId);
        return { success: true, message: 'Upgrade email already sent' };
      }

      const html = this.generateUpgradeEmailTemplate(userData, planData);
      
      const emailData = {
        to: userData.email,
        from: 'info@backlify.app',
        subject: '🎉 Plan Upgraded! - Unlock New Possibilities with Backlify AI',
        html: html,
        metadata: {
          type: 'upgrade',
          userId: userId,
          username: userData.username,
          planName: planData.name,
          upgradeDate: new Date().toISOString()
        }
      };

      return await this.sendFlexibleEmail(emailData);
    } catch (error) {
      console.error('Error sending upgrade email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if email was already sent to prevent duplicates
   * @param {string} userId - User ID
   * @param {string} emailType - Type of email (welcome, upgrade)
   * @returns {boolean} True if email was already sent
   */
  async wasEmailSent(userId, emailType) {
    try {
      const { data, error } = await this.supabase
        .from('email_logs')
        .select('id')
        .eq('metadata->>userId', userId)
        .eq('metadata->>type', emailType)
        .limit(1);

      if (error) {
        console.error('Error checking email history:', error);
        return false; // If we can't check, allow sending
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in wasEmailSent:', error);
      return false; // If we can't check, allow sending
    }
  }
}

module.exports = new EmailService();

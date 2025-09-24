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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0B0D17;
            --bg-card: #1A1D29;
            --text-primary: #FFFFFF;
            --text-secondary: #B8BCC8;
            --accent-primary: #00D2FF;
            --accent-secondary: #3A7BD5;
            --accent-tertiary: #8B5CF6;
            --success-color: #10B981;
            --border-color: rgba(255, 255, 255, 0.1);
            --gradient-primary: linear-gradient(135deg, #00D2FF 0%, #3A7BD5 50%, #8B5CF6 100%);
            --gradient-secondary: linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(58, 123, 213, 0.1) 100%);
        }

        body {
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: linear-gradient(135deg, #0B0D17 0%, #1A1D29 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }

        .email-container {
            max-width: 600px;
            width: 100%;
            margin: 0 auto;
            background: var(--bg-card);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border-color);
        }

        .header {
            background: var(--gradient-primary);
            padding: 50px 40px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }

        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: shimmer 4s ease-in-out infinite;
        }

        @keyframes shimmer {
            0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .header h1 {
            font-size: 36px;
            font-weight: 800;
            margin: 0;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .header p {
            font-size: 20px;
            font-weight: 500;
            opacity: 0.95;
            margin: 15px 0 0;
            position: relative;
            z-index: 1;
        }

        .content {
            padding: 40px;
            text-align: left;
        }

        .content h2 {
            font-size: 28px;
            color: var(--text-primary);
            margin-top: 0;
            margin-bottom: 25px;
            font-weight: 700;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .content p {
            font-size: 17px;
            color: var(--text-secondary);
            margin-bottom: 30px;
            line-height: 1.7;
        }

        .card {
            background: var(--gradient-secondary);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            backdrop-filter: blur(10px);
        }

        .card-title {
            font-size: 20px;
            font-weight: 700;
            color: var(--accent-primary);
            margin-top: 0;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .plan-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .plan-item:last-child {
            border-bottom: none;
        }

        .plan-label {
            color: var(--text-secondary);
            font-size: 15px;
            font-weight: 500;
        }

        .plan-value {
            color: var(--text-primary);
            font-weight: 600;
            font-size: 15px;
        }

        .plan-value.active {
            color: var(--success-color);
            font-weight: 700;
        }

        .cta-button {
            display: block;
            width: fit-content;
            margin: 40px auto 0;
            background: var(--gradient-primary);
            color: white;
            text-decoration: none;
            padding: 18px 35px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 18px;
            box-shadow: 0 10px 30px rgba(0, 210, 255, 0.3);
            transition: all 0.3s ease;
            text-align: center;
        }

        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(0, 210, 255, 0.4);
        }

        .footer {
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%);
            padding: 40px;
            text-align: center;
            font-size: 15px;
            border-top: 1px solid var(--border-color);
        }

        .footer p {
            margin: 0;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .footer-links {
            margin-top: 20px;
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .footer-link {
            color: var(--accent-primary);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .footer-link:hover {
            color: var(--accent-secondary);
        }

        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-container {
                border-radius: 12px;
            }
            .header, .content, .footer {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 30px;
            }
            .header p {
                font-size: 18px;
            }
            .content h2 {
                font-size: 24px;
            }
            .footer-links {
                flex-direction: column;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Welcome to Backlify AI</h1>
            <p>Your AI-powered backend journey starts now</p>
        </div>
        
        <div class="content">
            <h2>Hey ${userData.username || userData.email?.split('@')[0] || 'there'}!</h2>
            
            <p>
                Welcome to Backlify AI! We're excited to have you on board. Our goal is to make backend development simple and seamless, so you can focus on what you do best: building amazing applications.
            </p>

            <div class="card">
                <h3 class="card-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    Your Account Details
                </h3>
                <div class="plan-item">
                    <span class="plan-label">Username</span>
                    <span class="plan-value">${userData.username || 'N/A'}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Email</span>
                    <span class="plan-value">${userData.email}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Registration Date</span>
                    <span class="plan-value">${currentDate}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Account Status</span>
                    <span class="plan-value active">✅ Active</span>
                </div>
            </div>

            <div class="card">
                <h3 class="card-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-crown"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21l-2.99 1.42c-.53.24-1.04.24-1.57 0L2.97 18.21c-.5-.23-.97-.66-.97-1.21v-2.34"/><path d="M14 14.66V17c0 .55.47.98.97 1.21l2.99 1.42c.53.24 1.04.24 1.57 0L21.03 18.21c.5-.23.97-.66.97-1.21v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                    Your Basic Plan
                </h3>
                <div class="plan-item">
                    <span class="plan-label">Plan Name</span>
                    <span class="plan-value">Basic Plan</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Price</span>
                    <span class="plan-value">Free</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Features</span>
                    <ul style="list-style-type: none; padding: 0; margin: 0; text-align: right;">
                        <li class="plan-value">Basic API access</li>
                        <li class="plan-value">1000 requests/month</li>
                        <li class="plan-value">Email support</li>
                    </ul>
                </div>
            </div>

            <p>
                To get started, you can easily create your first API with just a few clicks from your dashboard. Simply describe the data or service you need, and our AI will generate a fully functional API for you. It's that simple!
            </p>

            <a href="https://backlify.app/dashboard" class="cta-button">
                Get Started
            </a>
            
        </div>
        
        <div class="footer">
            <p><strong>Cheers,</strong></p>
            <p>The Backlify AI Team</p>
            <div class="footer-links">
                <a href="https://backlify.app/docs" class="footer-link">Documentation</a>
                <a href="https://backlify.app/support" class="footer-link">Support</a>
                <a href="https://backlify.app/contact" class="footer-link">Contact Us</a>
            </div>
            <p style="margin-top: 20px; font-size: 13px; opacity: 0.7;">© 2025 Backlify AI. All rights reserved.</p>
        </div>
    </div>
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0B0D17;
            --bg-card: #1A1D29;
            --text-primary: #FFFFFF;
            --text-secondary: #B8BCC8;
            --accent-primary: #00D2FF;
            --accent-secondary: #3A7BD5;
            --accent-tertiary: #8B5CF6;
            --success-color: #10B981;
            --border-color: rgba(255, 255, 255, 0.1);
            --gradient-primary: linear-gradient(135deg, #00D2FF 0%, #3A7BD5 50%, #8B5CF6 100%);
            --gradient-secondary: linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(58, 123, 213, 0.1) 100%);
            --gradient-success: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(0, 210, 255, 0.1) 100%);
        }

        body {
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: linear-gradient(135deg, #0B0D17 0%, #1A1D29 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }

        .email-container {
            max-width: 600px;
            width: 100%;
            margin: 0 auto;
            background: var(--bg-card);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border-color);
        }

        .header {
            background: var(--gradient-primary);
            padding: 50px 40px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }

        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: shimmer 4s ease-in-out infinite;
        }

        @keyframes shimmer {
            0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .header h1 {
            font-size: 36px;
            font-weight: 800;
            margin: 0;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .header p {
            font-size: 20px;
            font-weight: 500;
            opacity: 0.95;
            margin: 15px 0 0;
            position: relative;
            z-index: 1;
        }

        .content {
            padding: 40px;
            text-align: left;
        }

        .content h2 {
            font-size: 28px;
            color: var(--text-primary);
            margin-top: 0;
            margin-bottom: 25px;
            font-weight: 700;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .content p {
            font-size: 17px;
            color: var(--text-secondary);
            margin-bottom: 30px;
            line-height: 1.7;
        }

        .card {
            background: var(--gradient-secondary);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            backdrop-filter: blur(10px);
        }

        .card-title {
            font-size: 20px;
            font-weight: 700;
            color: var(--accent-primary);
            margin-top: 0;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .plan-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .plan-item:last-child {
            border-bottom: none;
        }

        .plan-label {
            color: var(--text-secondary);
            font-size: 15px;
            font-weight: 500;
        }

        .plan-value {
            color: var(--text-primary);
            font-weight: 600;
            font-size: 15px;
        }

        .plan-value.active {
            color: var(--success-color);
            font-weight: 700;
        }

        .cta-button {
            display: block;
            width: fit-content;
            margin: 40px auto 0;
            background: var(--gradient-primary);
            color: white;
            text-decoration: none;
            padding: 18px 35px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 18px;
            box-shadow: 0 10px 30px rgba(0, 210, 255, 0.3);
            transition: all 0.3s ease;
            text-align: center;
        }

        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(0, 210, 255, 0.4);
        }

        .footer {
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%);
            padding: 40px;
            text-align: center;
            font-size: 15px;
            border-top: 1px solid var(--border-color);
        }

        .footer p {
            margin: 0;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .footer-links {
            margin-top: 20px;
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .footer-link {
            color: var(--accent-primary);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .footer-link:hover {
            color: var(--accent-secondary);
        }

        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-container {
                border-radius: 12px;
            }
            .header, .content, .footer {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 30px;
            }
            .header p {
                font-size: 18px;
            }
            .content h2 {
                font-size: 24px;
            }
            .footer-links {
                flex-direction: column;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🎉 Plan Upgraded!</h1>
            <p>You've unlocked new possibilities</p>
        </div>

        <div class="content">
            <h2>Hey ${userData.username || userData.email?.split('@')[0] || 'there'}!</h2>

            <p>
                Congratulations! Your Backlify AI plan has been successfully upgraded. You now have access to more powerful features and higher limits to supercharge your backend development.
            </p>

            <div class="card">
                <h3 class="card-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                    Your New Plan Details
                </h3>
                <div class="plan-item">
                    <span class="plan-label">Plan Name</span>
                    <span class="plan-value active">${planData.name || 'Upgraded Plan'}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Upgrade Date</span>
                    <span class="plan-value">${currentDate}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Status</span>
                    <span class="plan-value active">✅ Active</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Amount Paid</span>
                    <span class="plan-value">${planData.amount ? planData.amount + ' ' + (planData.currency || 'AZN') : 'N/A'}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Subscription Expires</span>
                    <span class="plan-value">${planData.expirationDate || 'N/A'}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Payment Method</span>
                    <span class="plan-value">${planData.paymentMethod || 'Epoint'}</span>
                </div>
            </div>

            <div class="card">
                <h3 class="card-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    New Features Unlocked
                </h3>
                <div class="plan-item">
                    <span class="plan-label">API Requests</span>
                    <span class="plan-value">${planData.requestsLimit || 'Unlimited'}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Projects</span>
                    <span class="plan-value">${planData.projectsLimit || 'Unlimited'}</span>
                </div>
                <div class="plan-item">
                    <span class="plan-label">Support Level</span>
                    <span class="plan-value">${planData.supportLevel || 'Priority Support'}</span>
                </div>
            </div>
            
            <p>
                Ready to explore your new features? Head over to your dashboard and start building with your enhanced capabilities!
            </p>

            <a href="https://backlify.app" class="cta-button">
                🚀 Go to Dashboard
            </a>

        </div>

        <div class="footer">
            <p><strong>Happy Building!</strong></p>
            <p>The Backlify AI Team</p>
            <div class="footer-links">
                <a href="https://backlify.app/docs" class="footer-link">Documentation</a>
                <a href="https://backlify.app/support" class="footer-link">Support</a>
                <a href="https://backlify.app/contact" class="footer-link">Contact Us</a>
            </div>
            <p style="margin-top: 20px; font-size: 13px; opacity: 0.7;">© 2025 Backlify AI. All rights reserved.</p>
        </div>
    </div>
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

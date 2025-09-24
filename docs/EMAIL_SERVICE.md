# Email Service Documentation

## Overview

The Email Service provides a comprehensive solution for sending emails to `info@backlify.app` from various sources within the Backlify application. All emails are automatically routed to the main email address with proper formatting and logging.

## Features

- **Multiple Email Types**: Support for general, contact, support, feedback, and custom emails
- **Automatic Routing**: All emails are sent to `info@backlify.app`
- **Email Logging**: All email activities are logged to the database
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **HTML & Text Formatting**: Emails are sent in both HTML and plain text formats
- **Metadata Support**: Additional metadata can be attached to emails
- **Error Handling**: Comprehensive error handling and logging

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Alternative naming (for compatibility)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## API Endpoints

### 1. General Email
**POST** `/api/email/send`

Send a general email to info@backlify.app.

**Request Body:**
```json
{
  "subject": "Email Subject",
  "message": "Email message content",
  "fromEmail": "sender@example.com",
  "fromName": "Sender Name (optional)",
  "type": "general",
  "metadata": {
    "customField": "custom value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "unique-message-id"
}
```

### 2. Contact Form Email
**POST** `/api/email/contact`

Send a contact form email.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Contact Subject",
  "message": "Contact message",
  "company": "Company Name (optional)",
  "phone": "+1234567890 (optional)"
}
```

### 3. Support Request Email
**POST** `/api/email/support`

Send a support request email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "subject": "Support Request",
  "message": "Support message",
  "priority": "medium",
  "category": "account",
  "userId": "user-123"
}
```

**Priority Levels:** `low`, `medium`, `high`, `urgent`

### 4. Feedback Email
**POST** `/api/email/feedback`

Send a feedback email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "subject": "Feedback",
  "message": "Feedback message",
  "rating": "5",
  "category": "general",
  "userId": "user-123"
}
```

### 5. Custom Email
**POST** `/api/email/custom`

Send a custom email with template support.

**Request Body:**
```json
{
  "subject": "Custom Subject",
  "message": "Custom message",
  "fromEmail": "sender@example.com",
  "fromName": "Sender Name",
  "type": "custom",
  "template": "special",
  "metadata": {
    "customField": "value"
  }
}
```

### 6. Get Email Logs (Admin Only)
**GET** `/api/email/logs`

Retrieve email logs with optional filtering.

**Query Parameters:**
- `status`: Filter by status (`sent`, `failed`)
- `type`: Filter by email type
- `fromEmail`: Filter by sender email
- `limit`: Number of logs to return (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "from_email": "sender@example.com",
      "from_name": "Sender Name",
      "subject": "Email Subject",
      "message": "Email content",
      "type": "general",
      "metadata": {},
      "message_id": "message-id",
      "status": "sent",
      "sent_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### 7. Test Email Configuration (Admin Only)
**GET** `/api/email/test`

Test the email configuration.

**Response:**
```json
{
  "success": true,
  "message": "Email configuration is valid"
}
```

## Rate Limiting

All email endpoints have rate limiting applied:
- **Window**: 15 minutes
- **Limit**: 10 requests per IP address
- **Response**: 429 Too Many Requests when limit exceeded

## Database Schema

The service creates an `email_logs` table with the following structure:

```sql
CREATE TABLE email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  message_id VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Email Formatting

### HTML Format
Emails are sent with a professional HTML template including:
- Header with sender information
- Formatted message content
- Metadata display (if provided)
- Footer with reply instructions

### Plain Text Format
A clean plain text version is also included for email clients that don't support HTML.

## Error Handling

The service includes comprehensive error handling:
- **Validation Errors**: 400 Bad Request for missing/invalid data
- **Email Format Errors**: 400 Bad Request for invalid email addresses
- **SMTP Errors**: 500 Internal Server Error for email sending failures
- **Database Errors**: Logged but don't prevent email sending

## Usage Examples

### Frontend Integration

```javascript
// Send contact form
const sendContactForm = async (formData) => {
  try {
    const response = await fetch('/api/email/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending contact form:', error);
    throw error;
  }
};

// Send support request
const sendSupportRequest = async (supportData) => {
  try {
    const response = await fetch('/api/email/support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supportData)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending support request:', error);
    throw error;
  }
};
```

### Backend Integration

```javascript
const emailService = require('./services/emailService');

// Send email from any part of the application
const sendEmail = async () => {
  const result = await emailService.sendEmail({
    subject: 'System Notification',
    message: 'This is a system notification',
    fromEmail: 'system@backlify.app',
    fromName: 'Backlify System',
    type: 'system',
    metadata: {
      component: 'user-registration',
      userId: 'user-123'
    }
  });
  
  if (result.success) {
    console.log('Email sent successfully:', result.messageId);
  } else {
    console.error('Failed to send email:', result.error);
  }
};
```

## Testing

Run the test script to verify email functionality:

```bash
node test-email.js
```

This will test all email endpoints and verify the configuration.

## Security Considerations

1. **Rate Limiting**: Prevents abuse and spam
2. **Input Validation**: All inputs are validated before processing
3. **Email Sanitization**: Email addresses are validated using regex
4. **Database Logging**: All activities are logged for audit purposes
5. **Error Handling**: Sensitive information is not exposed in error messages

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Check SMTP credentials in environment variables
   - Ensure app password is used for Gmail (not regular password)
   - Verify SMTP host and port settings

2. **Rate Limit Exceeded**
   - Wait 15 minutes before retrying
   - Implement exponential backoff in client applications

3. **Database Connection Issues**
   - Check Supabase configuration
   - Verify database permissions
   - Ensure email_logs table exists

4. **Email Not Received**
   - Check spam folder
   - Verify SMTP configuration
   - Check email logs for error messages

### Debug Mode

Enable debug logging by setting the log level in your environment:

```env
LOG_LEVEL=debug
```

This will provide detailed information about email sending processes.

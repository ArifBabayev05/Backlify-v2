const EmailService = require('./src/services/emailService');

async function testEmail() {
  console.log('🧪 Testing Email Configuration...');
  console.log('================================');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
  console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
  console.log('- SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
  console.log('- SMTP_PASS:', process.env.SMTP_PASS ? 'SET' : 'NOT SET');
  console.log('');

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ SMTP configuration is incomplete!');
    console.error('Please set the following environment variables:');
    console.error('- SMTP_HOST (e.g., smtp.gmail.com)');
    console.error('- SMTP_PORT (e.g., 587 or 465)');
    console.error('- SMTP_USER (your email address)');
    console.error('- SMTP_PASS (your email password or app password)');
    return;
  }

  try {
    // Test basic email sending
    console.log('Sending test email...');
    
     const testEmailData = {
       to: 'arifrb@code.edu.az',
       from: process.env.SMTP_USER, // Use the authenticated SMTP user
       subject: '🧪 Email Test - Backlify Security System',
       html: `
         <h2>Email Configuration Test</h2>
         <p>This is a test email to verify that the email service is working correctly.</p>
         <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
         <p><strong>System:</strong> Backlify Security Analysis</p>
         <p><strong>Recipient:</strong> arifrb@code.edu.az</p>
         <p><strong>Sender:</strong> ${process.env.SMTP_USER}</p>
         <p><strong>Status:</strong> ✅ Email service is working!</p>
       `,
       replyTo: 'security@backlify.app', // Set reply-to for responses
       metadata: {
         type: 'test',
         timestamp: new Date().toISOString()
       }
     };

    const result = await EmailService.sendFlexibleEmail(testEmailData);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Check your email inbox at arifrb@code.edu.az');
    } else {
      console.error('❌ Email sending failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error testing email:', error.message);
  }
}

// Run the test
testEmail().catch(console.error);
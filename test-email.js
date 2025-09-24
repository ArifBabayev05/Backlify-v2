const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testEmailEndpoints() {
  console.log('🧪 Testing Email Endpoints...\n');

  try {
    // Test 1: General email
    console.log('1. Testing general email endpoint...');
    const generalEmailResponse = await axios.post(`${BASE_URL}/api/email/send`, {
      subject: 'Test Email from API',
      message: 'This is a test email sent from the Backlify API.',
      fromEmail: 'test@example.com',
      fromName: 'Test User',
      type: 'general',
      metadata: {
        testType: 'general',
        timestamp: new Date().toISOString()
      }
    });
    console.log('✅ General email sent:', generalEmailResponse.data);

    // Test 2: Contact form email
    console.log('\n2. Testing contact form endpoint...');
    const contactEmailResponse = await axios.post(`${BASE_URL}/api/email/contact`, {
      name: 'John Doe',
      email: 'john.doe@example.com',
      subject: 'Contact Form Test',
      message: 'This is a test contact form submission.',
      company: 'Test Company',
      phone: '+1234567890'
    });
    console.log('✅ Contact email sent:', contactEmailResponse.data);

    // Test 3: Support request email
    console.log('\n3. Testing support request endpoint...');
    const supportEmailResponse = await axios.post(`${BASE_URL}/api/email/support`, {
      email: 'support@example.com',
      subject: 'Support Request Test',
      message: 'I need help with my account.',
      priority: 'medium',
      category: 'account',
      userId: 'test-user-123'
    });
    console.log('✅ Support email sent:', supportEmailResponse.data);

    // Test 4: Feedback email
    console.log('\n4. Testing feedback endpoint...');
    const feedbackEmailResponse = await axios.post(`${BASE_URL}/api/email/feedback`, {
      email: 'feedback@example.com',
      subject: 'Feedback Test',
      message: 'Great service! Keep up the good work.',
      rating: '5',
      category: 'general',
      userId: 'test-user-123'
    });
    console.log('✅ Feedback email sent:', feedbackEmailResponse.data);

    // Test 5: Custom email
    console.log('\n5. Testing custom email endpoint...');
    const customEmailResponse = await axios.post(`${BASE_URL}/api/email/custom`, {
      subject: 'Custom Email Test',
      message: 'This is a custom email with special formatting.',
      fromEmail: 'custom@example.com',
      fromName: 'Custom User',
      type: 'custom',
      template: 'special',
      metadata: {
        customField: 'custom value',
        priority: 'high'
      }
    });
    console.log('✅ Custom email sent:', customEmailResponse.data);

    console.log('\n🎉 All email tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Test email configuration (requires auth)
async function testEmailConfiguration() {
  console.log('\n🔧 Testing email configuration...');
  
  try {
    // Note: This requires authentication, so it might fail without proper auth
    const configResponse = await axios.get(`${BASE_URL}/api/email/test`);
    console.log('✅ Email configuration test:', configResponse.data);
  } catch (error) {
    console.log('⚠️ Email configuration test failed (expected if not authenticated):', error.response?.data?.message || error.message);
  }
}

// Run tests
if (require.main === module) {
  testEmailEndpoints()
    .then(() => testEmailConfiguration())
    .catch(console.error);
}

module.exports = { testEmailEndpoints, testEmailConfiguration };

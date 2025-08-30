const axios = require('axios');

async function testGoogleLogin() {
  console.log('🔐 Testing Google Login...');
  
  const testData = {
    google_token: '130959143379-la4ii2uo14epkcsh51h6p0fap4alrgh7.apps.googleusercontent.com',
    email: 'test@gmail.com',
    name: 'Test User',
    picture: 'https://test.com/pic.jpg',
    google_id: 'test_123'
  };

  try {
    const response = await axios.post('http://127.0.0.1:3000/auth/google-login', testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    console.log('✅ Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Error Response:');
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

testGoogleLogin();

const axios = require('axios');

async function testGoogleDebugEndpoint() {
  console.log('🐛 Testing Google Debug Endpoint...');
  
  const testData = {
    email: `debug${Date.now()}@test.com`,
    name: 'Debug Test User',
    picture: 'https://test.com/debug.jpg',
    google_id: `debug_${Date.now()}`
  };

  try {
    const response = await axios.post('http://127.0.0.1:3000/debug/google-user-creation', testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('✅ Debug Endpoint Success:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('❌ Debug Endpoint Error:');
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

testGoogleDebugEndpoint();

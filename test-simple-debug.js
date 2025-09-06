const fetch = require('node-fetch');

async function testSimpleDebug() {
  try {
    console.log('🧪 Testing simple debug...');
    
    // Test the debug endpoint
    const response = await fetch('https://backlify-v2.onrender.com/debug-user-info', {
      method: 'GET',
      headers: {
        'XAuthUserId': 'arifbabayev1',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (data.success && data.debug) {
      console.log('\n📈 Debug info:');
      console.log(`- User ID: ${data.debug.userId}`);
      console.log(`- User Plan: ${data.debug.userPlan}`);
      console.log(`- Projects: ${data.debug.usage.projectsCount}`);
      console.log(`- Requests: ${data.debug.usage.requestsCount}`);
      console.log(`- Log count: ${data.debug.logCount || 'undefined'}`);
      console.log(`- All log count: ${data.debug.allLogCount || 'undefined'}`);
    } else {
      console.log('❌ Debug endpoint failed:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleDebug();

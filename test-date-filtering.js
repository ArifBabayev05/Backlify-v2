const fetch = require('node-fetch');

async function testDateFiltering() {
  try {
    console.log('🧪 Testing date filtering...');
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    console.log('Current date info:');
    console.log(`- Now: ${now.toISOString()}`);
    console.log(`- Month start: ${monthStart.toISOString()}`);
    console.log(`- Current month: ${now.getMonth() + 1}`);
    console.log(`- Current year: ${now.getFullYear()}`);
    
    // Test the debug endpoint with more detailed logging
    const response = await fetch('https://backlify-v2.onrender.com/debug-user-info', {
      method: 'GET',
      headers: {
        'XAuthUserId': 'arifbabayev1',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.debug) {
      console.log('\n📊 Debug endpoint response:');
      console.log(`- Log count: ${data.debug.logCount}`);
      console.log(`- All log count: ${data.debug.allLogCount}`);
      console.log(`- Projects: ${data.debug.usage.projectsCount}`);
      console.log(`- Requests: ${data.debug.usage.requestsCount}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDateFiltering();

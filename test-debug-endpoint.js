const fetch = require('node-fetch');

async function testDebugEndpoint() {
  try {
    console.log('🧪 Testing debug endpoint...');
    
    const response = await fetch('https://backlify-v2.onrender.com/debug-user-info', {
      method: 'GET',
      headers: {
        'XAuthUserId': 'arifbabayev1',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Debug endpoint response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.debug) {
      const { usage, isOverLimit } = data.debug;
      console.log('\n📈 Usage Summary:');
      console.log(`- Projects: ${usage.projectsCount}/${usage.maxProjects}`);
      console.log(`- Requests: ${usage.requestsCount}/${usage.maxRequests}`);
      console.log(`- Plan: ${usage.planName}`);
      console.log(`- Over Limit: ${isOverLimit ? 'YES' : 'NO'}`);
      
      if (usage.projectsCount > 0 || usage.requestsCount > 0) {
        console.log('✅ SUCCESS: Usage counts are now showing correctly!');
      } else {
        console.log('❌ ISSUE: Usage counts are still showing as 0');
      }
    } else {
      console.log('❌ ERROR: Debug endpoint failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDebugEndpoint();

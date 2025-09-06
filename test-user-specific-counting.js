const fetch = require('node-fetch');

async function testUserSpecificCounting() {
  try {
    console.log('🧪 Testing user-specific counting...');
    
    // Test with the new user
    const response = await fetch('https://backlify-v2.onrender.com/debug-user-info', {
      method: 'GET',
      headers: {
        'XAuthUserId': 'ArifTest',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Debug endpoint response for ArifTest:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.debug) {
      const { usage, isOverLimit } = data.debug;
      console.log('\n📈 Usage Summary for ArifTest:');
      console.log(`- Projects: ${usage.projectsCount}/${usage.maxProjects}`);
      console.log(`- Requests: ${usage.requestsCount}/${usage.maxRequests}`);
      console.log(`- Plan: ${usage.planName}`);
      console.log(`- Over Limit: ${isOverLimit ? 'YES' : 'NO'}`);
      console.log(`- Log count: ${data.debug.logCount || 'undefined'}`);
      console.log(`- All log count: ${data.debug.allLogCount || 'undefined'}`);
      
      if (usage.projectsCount === 0) {
        console.log('✅ SUCCESS: New user now shows 0 projects!');
      } else {
        console.log(`❌ ISSUE: New user still shows ${usage.projectsCount} projects`);
      }
    } else {
      console.log('❌ ERROR: Debug endpoint failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUserSpecificCounting();

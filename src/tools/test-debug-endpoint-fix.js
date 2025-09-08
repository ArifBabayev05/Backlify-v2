const fetch = require('node-fetch');

async function testDebugEndpointFix() {
  console.log('🧪 Testing debug endpoint fix...');
  
  try {
    // Test the debug endpoint with query parameter
    const response = await fetch('https://backlify-v2.onrender.com/debug-user-info?XAuthUserId=asda', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.debug) {
      console.log('\n📈 Debug info:');
      console.log(`- User ID: ${data.debug.userId}`);
      console.log(`- User Plan: ${data.debug.userPlan}`);
      console.log(`- Projects: ${data.debug.usage.projectsCount}`);
      console.log(`- Requests: ${data.debug.usage.requestsCount}`);
      
      if (data.debug.userId === 'asda' && data.debug.userPlan === 'pro') {
        console.log('🎉 SUCCESS: Debug endpoint is working correctly!');
        return true;
      } else {
        console.log('❌ FAILED: Debug endpoint not working correctly');
        console.log(`Expected: userId=asda, userPlan=pro`);
        console.log(`Actual: userId=${data.debug.userId}, userPlan=${data.debug.userPlan}`);
        return false;
      }
    } else {
      console.log('❌ Debug endpoint failed:', data);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testDebugEndpointFix()
    .then((success) => {
      if (success) {
        console.log('\n✅ Debug endpoint fix test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Debug endpoint fix test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testDebugEndpointFix };

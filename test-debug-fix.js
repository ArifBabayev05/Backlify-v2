const fetch = require('node-fetch');

async function testDebugFix() {
  console.log('🧪 Testing debug-user-info fix...');
  
  try {
    const response = await fetch('http://localhost:3000/debug-user-info?XAuthUserId=Admin');
    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Projects count:', data.debug?.usage?.projectsCount);
    console.log('📊 Requests count:', data.debug?.usage?.requestsCount);
    
    if (data.debug?.usage?.projectsCount === 6) {
      console.log('🎉 SUCCESS: Debug endpoint now shows correct project count (6) instead of 18!');
      return true;
    } else {
      console.log('❌ FAILED: Debug endpoint still shows incorrect project count');
      console.log('Expected: 6, Actual:', data.debug?.usage?.projectsCount);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testDebugFix();
}

module.exports = { testDebugFix };

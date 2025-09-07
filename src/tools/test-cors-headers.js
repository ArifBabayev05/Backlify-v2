const fetch = require('node-fetch');

async function testCorsHeaders() {
  console.log('🧪 Testing CORS headers with x-user-plan...');
  
  try {
    // Test OPTIONS preflight with x-user-plan header
    const response = await fetch('http://localhost:3000/api/user/subscription', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,x-user-id,x-user-plan,xauthuserid'
      }
    });
    
    console.log('📊 OPTIONS response status:', response.status);
    console.log('📊 OPTIONS response headers:');
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('access-control')) {
        console.log(`   ${key}: ${value}`);
      }
    }
    
    const responseText = await response.text();
    console.log('📊 OPTIONS response body:', responseText);
    
    // Check if x-user-plan is in allowed headers
    const allowedHeaders = response.headers.get('access-control-allow-headers');
    if (allowedHeaders && allowedHeaders.includes('x-user-plan')) {
      console.log('✅ x-user-plan header is allowed');
    } else {
      console.log('❌ x-user-plan header is NOT allowed');
      console.log('Allowed headers:', allowedHeaders);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test production CORS
async function testProductionCors() {
  console.log('\n🌐 Testing production CORS with x-user-plan...');
  
  try {
    const response = await fetch('https://backlify-v2.onrender.com/api/user/subscription', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,x-user-id,x-user-plan,xauthuserid'
      }
    });
    
    console.log('📊 Production OPTIONS response status:', response.status);
    console.log('📊 Production OPTIONS response headers:');
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('access-control')) {
        console.log(`   ${key}: ${value}`);
      }
    }
    
    const allowedHeaders = response.headers.get('access-control-allow-headers');
    if (allowedHeaders && allowedHeaders.includes('x-user-plan')) {
      console.log('✅ Production: x-user-plan header is allowed');
    } else {
      console.log('❌ Production: x-user-plan header is NOT allowed');
      console.log('Production allowed headers:', allowedHeaders);
    }
    
  } catch (error) {
    console.error('❌ Production test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testCorsHeaders();
  await testProductionCors();
}

if (require.main === module) {
  runTests()
    .then(() => {
      console.log('\n🎉 CORS header tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCorsHeaders, testProductionCors };

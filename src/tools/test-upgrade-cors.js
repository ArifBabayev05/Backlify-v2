const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testUpgradeCors() {
  console.log('🧪 Testing upgrade endpoint CORS...');
  
  try {
    // Test the upgrade endpoint locally
    const testData = {
      plan: 'pro'
    };
    
    const response = await fetch('http://localhost:3000/api/user/subscription/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzZGEiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU3MjczODU0LCJleHAiOjE3NTcyNzc0NTR9.HKgMa6XrFTeQL-0HUqXCpfCo6PW3JgsScoY-r_yAyTo',
        'x-user-id': 'asda',
        'x-user-plan': 'basic',
        'xauthuserid': 'asda',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:');
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('access-control')) {
        console.log(`   ${key}: ${value}`);
      }
    }
    
    const responseText = await response.text();
    console.log('📊 Response body:', responseText);
    
    if (response.status === 200) {
      console.log('✅ Upgrade endpoint works locally');
    } else {
      console.log('❌ Upgrade endpoint failed locally');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test production endpoint
async function testProductionUpgradeCors() {
  console.log('\n🌐 Testing production upgrade endpoint...');
  
  try {
    const testData = {
      plan: 'pro'
    };
    
    const response = await fetch('https://backlify-v2.onrender.com/api/user/subscription/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzZGEiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU3MjczODU0LCJleHAiOjE3NTcyNzc0NTR9.HKgMa6XrFTeQL-0HUqXCpfCo6PW3JgsScoY-r_yAyTo',
        'x-user-id': 'asda',
        'x-user-plan': 'basic',
        'xauthuserid': 'asda',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📊 Production response status:', response.status);
    console.log('📊 Production response headers:');
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('access-control')) {
        console.log(`   ${key}: ${value}`);
      }
    }
    
    const responseText = await response.text();
    console.log('📊 Production response body:', responseText);
    
    if (response.status === 200) {
      console.log('✅ Production upgrade endpoint works');
    } else {
      console.log('❌ Production upgrade endpoint failed');
    }
    
  } catch (error) {
    console.error('❌ Production test failed:', error.message);
  }
}

// Test OPTIONS preflight
async function testOptionsPreflight() {
  console.log('\n🔄 Testing OPTIONS preflight...');
  
  try {
    const response = await fetch('https://backlify-v2.onrender.com/api/user/subscription/upgrade', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,x-user-id,x-user-plan,xauthuserid'
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
    
  } catch (error) {
    console.error('❌ OPTIONS test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  await testUpgradeCors();
  await testProductionUpgradeCors();
  await testOptionsPreflight();
}

if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n🎉 All CORS tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testUpgradeCors, testProductionUpgradeCors, testOptionsPreflight };

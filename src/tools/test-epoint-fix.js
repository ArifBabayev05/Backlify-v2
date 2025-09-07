const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testEpointFix() {
  console.log('🧪 Testing Epoint payment request fix...');
  
  try {
    // Test the payment request endpoint
    const testData = {
      amount: 0.01,
      order_id: 'SUB_1757276250266_asda',
      description: 'Pro Plan - Monthly Subscription',
      currency: 'AZN',
      language: 'az',
      user_id: 'asda'
    };
    
    const response = await fetch('https://backlify-v2.onrender.com/api/epoint/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzZGEiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU3Mjc1NzExLCJleHAiOjE3NTcyNzkzMTF9.Rb0aCMo3D-EcPWWGYym1aYu3mnwRujL_ay2MQYLOq3Y',
        'x-user-id': 'asda',
        'xauthuserid': 'asda'
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
      console.log('✅ Epoint payment request works');
    } else {
      console.log('❌ Epoint payment request failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test local endpoint if available
async function testLocalEpoint() {
  console.log('\n🏠 Testing local Epoint endpoint...');
  
  try {
    const testData = {
      amount: 0.01,
      order_id: 'SUB_1757276250266_asda',
      description: 'Pro Plan - Monthly Subscription',
      currency: 'AZN',
      language: 'az',
      user_id: 'asda'
    };
    
    const response = await fetch('http://localhost:3000/api/epoint/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzZGEiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU3Mjc1NzExLCJleHAiOjE3NTcyNzkzMTF9.Rb0aCMo3D-EcPWWGYym1aYu3mnwRujL_ay2MQYLOq3Y',
        'x-user-id': 'asda',
        'xauthuserid': 'asda'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📊 Local response status:', response.status);
    const responseText = await response.text();
    console.log('📊 Local response body:', responseText);
    
  } catch (error) {
    console.log('ℹ️ Local server not running or not accessible');
  }
}

// Run tests
async function runTests() {
  await testEpointFix();
  await testLocalEpoint();
}

if (require.main === module) {
  runTests()
    .then(() => {
      console.log('\n🎉 Epoint fix tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testEpointFix, testLocalEpoint };

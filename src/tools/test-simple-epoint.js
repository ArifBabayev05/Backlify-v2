const fetch = require('node-fetch');

async function testEpointRequest() {
  console.log('🧪 Testing Epoint payment request...');
  
  try {
    const testData = {
      amount: 0.01,
      order_id: 'SUB_1757276805936_asda',
      description: 'Pro Plan - Monthly Subscription',
      currency: 'AZN',
      language: 'az',
      plan_id: 'pro',
      user_id: 'asda'
    };
    
    console.log('📤 Sending request with data:', testData);
    
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

if (require.main === module) {
  testEpointRequest()
    .then(() => {
      console.log('\n🎉 Epoint test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testEpointRequest };

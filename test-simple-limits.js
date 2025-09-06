/**
 * Simple Test Script for Usage Limits
 * Quick test to verify the implementation works
 */

const axios = require('axios');

const BASE_URL = 'https://backlify-v2.onrender.com';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkFkbWluIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc1NzExODAzMCwiZXhwIjoxNzU3MTIxNjMwfQ.t5RQVfoUufttwFx5kszSJUiaI0G-FYtVMUbmvAmDDxs';

async function testBasicPlanLimits() {
  console.log('🧪 Testing Basic Plan Limits...');
  
  try {
    // Test 1: Generate schema with basic plan
    console.log('\n1. Testing schema generation with basic plan...');
    const schemaResult = await axios.post(`${BASE_URL}/generate-schema`, {
      prompt: 'Create a users table with name and email',
      XAuthUserId: 'Admin'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'X-User-Id': 'Admin',
        'X-User-Plan': 'basic'
      }
    });
    
    console.log('✅ Schema generation successful');
    console.log('Response:', JSON.stringify(schemaResult.data, null, 2));
    
    // Test 2: Create API from schema with basic plan
    console.log('\n2. Testing API creation with basic plan...');
    const apiResult = await axios.post(`${BASE_URL}/create-api-from-schema`, {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', constraints: ['primary key', 'default uuid_generate_v4()'] },
            { name: 'name', type: 'varchar(255)', constraints: ['not null'] },
            { name: 'email', type: 'varchar(255)', constraints: ['not null', 'unique'] }
          ]
        }
      ],
      XAuthUserId: 'Admin'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'X-User-Id': 'Admin',
        'X-User-Plan': 'basic'
      }
    });
    
    console.log('✅ API creation successful');
    console.log('API ID:', apiResult.data.apiId);
    
    // Test 3: Make requests to the generated API
    if (apiResult.data.apiId) {
      console.log('\n3. Testing API requests with basic plan...');
      const apiId = apiResult.data.apiId;
      
      // Test GET request
      const getResult = await axios.get(`${BASE_URL}/api/${apiId}/users`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'X-User-Id': 'Admin',
          'X-User-Plan': 'basic'
        }
      });
      
      console.log('✅ API request successful');
      console.log('Response:', JSON.stringify(getResult.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

async function testEnterprisePlanLimits() {
  console.log('\n🧪 Testing Enterprise Plan Limits...');
  
  try {
    // Test schema generation with enterprise plan
    console.log('\n1. Testing schema generation with enterprise plan...');
    const schemaResult = await axios.post(`${BASE_URL}/generate-schema`, {
      prompt: 'Create a products table with name and price',
      XAuthUserId: 'Admin'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'X-User-Id': 'Admin',
        'X-User-Plan': 'enterprise'
      }
    });
    
    console.log('✅ Schema generation successful (enterprise plan)');
    console.log('Response:', JSON.stringify(schemaResult.data, null, 2));
    
  } catch (error) {
    console.error('❌ Enterprise test failed:', error.response?.data || error.message);
  }
}

async function testPaymentPlans() {
  console.log('\n🧪 Testing Payment Plans Endpoint...');
  
  try {
    const result = await axios.get(`${BASE_URL}/api/payment/plans`);
    console.log('✅ Payment plans endpoint working');
    console.log('Available plans:');
    result.data.data.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.id}): $${plan.price} - ${plan.features.join(', ')}`);
    });
  } catch (error) {
    console.error('❌ Payment plans test failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Simple Usage Limits Tests...');
  console.log('='.repeat(50));
  
  await testPaymentPlans();
  await testBasicPlanLimits();
  await testEnterprisePlanLimits();
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(console.error);

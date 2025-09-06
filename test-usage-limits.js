/**
 * Test Usage Limits Implementation
 * Tests the new usage limits based on X-User-Plan header
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'https://backlify-v2.onrender.com';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkFkbWluIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc1NzExODAzMCwiZXhwIjoxNzU3MTIxNjMwfQ.t5RQVfoUufttwFx5kszSJUiaI0G-FYtVMUbmvAmDDxs';

// Test data
const testPlans = ['basic', 'pro', 'enterprise'];
const testSchema = {
  prompt: 'Create a simple users table with name and email fields'
};

const testApiData = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', constraints: ['primary key', 'default uuid_generate_v4()'] },
        { name: 'name', type: 'varchar(255)', constraints: ['not null'] },
        { name: 'email', type: 'varchar(255)', constraints: ['not null', 'unique'] }
      ]
    }
  ]
};

// Helper function to make requests
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'X-User-Id': 'Admin',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status || 500 
    };
  }
}

// Test functions
async function testSchemaGenerationLimits() {
  console.log('\n🧪 Testing Schema Generation Limits...');
  
  for (const plan of testPlans) {
    console.log(`\n📋 Testing ${plan.toUpperCase()} plan for schema generation:`);
    
    // Test 1: First schema generation (should work)
    const result1 = await makeRequest('POST', '/generate-schema', {
      prompt: testSchema.prompt,
      XAuthUserId: 'Admin'
    }, { 'X-User-Plan': plan });
    
    console.log(`  First generation: ${result1.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!result1.success) {
      console.log(`    Error: ${JSON.stringify(result1.error)}`);
    }
    
    // Test 2: Second schema generation (should work for pro/enterprise, fail for basic after 2 projects)
    const result2 = await makeRequest('POST', '/generate-schema', {
      prompt: 'Create a products table with name and price fields',
      XAuthUserId: 'Admin'
    }, { 'X-User-Plan': plan });
    
    console.log(`  Second generation: ${result2.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!result2.success) {
      console.log(`    Error: ${JSON.stringify(result2.error)}`);
    }
    
    // Test 3: Third schema generation (should fail for basic, work for pro/enterprise)
    const result3 = await makeRequest('POST', '/generate-schema', {
      prompt: 'Create an orders table with user_id and total fields',
      XAuthUserId: 'Admin'
    }, { 'X-User-Plan': plan });
    
    console.log(`  Third generation: ${result3.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!result3.success) {
      console.log(`    Error: ${JSON.stringify(result3.error)}`);
    }
  }
}

async function testApiCreationLimits() {
  console.log('\n🧪 Testing API Creation Limits...');
  
  for (const plan of testPlans) {
    console.log(`\n🔧 Testing ${plan.toUpperCase()} plan for API creation:`);
    
    // Test 1: First API creation (should work)
    const result1 = await makeRequest('POST', '/create-api-from-schema', {
      ...testApiData,
      XAuthUserId: 'Admin'
    }, { 'X-User-Plan': plan });
    
    console.log(`  First API creation: ${result1.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!result1.success) {
      console.log(`    Error: ${JSON.stringify(result1.error)}`);
    }
    
    // Test 2: Second API creation (should work for pro/enterprise, fail for basic after 2 projects)
    const result2 = await makeRequest('POST', '/create-api-from-schema', {
      tables: [
        {
          name: 'products',
          columns: [
            { name: 'id', type: 'uuid', constraints: ['primary key', 'default uuid_generate_v4()'] },
            { name: 'name', type: 'varchar(255)', constraints: ['not null'] },
            { name: 'price', type: 'decimal(10,2)', constraints: ['not null'] }
          ]
        }
      ],
      XAuthUserId: 'Admin'
    }, { 'X-User-Plan': plan });
    
    console.log(`  Second API creation: ${result2.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!result2.success) {
      console.log(`    Error: ${JSON.stringify(result2.error)}`);
    }
  }
}

async function testApiRequestLimits() {
  console.log('\n🧪 Testing API Request Limits...');
  
  // First, create an API to test with
  const apiResult = await makeRequest('POST', '/create-api-from-schema', {
    ...testApiData,
    XAuthUserId: 'Admin'
  }, { 'X-User-Plan': 'basic' });
  
  if (!apiResult.success) {
    console.log('❌ Failed to create test API, skipping request limit tests');
    return;
  }
  
  const apiId = apiResult.data.apiId;
  console.log(`📡 Testing with API ID: ${apiId}`);
  
  for (const plan of testPlans) {
    console.log(`\n🌐 Testing ${plan.toUpperCase()} plan for API requests:`);
    
    // Test multiple requests to see if limits are enforced
    const requestCount = plan === 'basic' ? 5 : plan === 'pro' ? 15 : 25;
    
    for (let i = 1; i <= requestCount; i++) {
      const result = await makeRequest('GET', `/api/${apiId}/users`, null, { 'X-User-Plan': plan });
      
      if (i <= 3) {
        console.log(`  Request ${i}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      } else if (i === requestCount) {
        console.log(`  Request ${i}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (!result.success) {
          console.log(`    Error: ${JSON.stringify(result.error)}`);
        }
      }
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

async function testTokenExpiration() {
  console.log('\n🧪 Testing JWT Token Expiration...');
  
  // Test with current token
  const result = await makeRequest('GET', '/health', null, { 'X-User-Plan': 'basic' });
  console.log(`Health check with current token: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (result.success) {
    console.log('✅ Token is valid (30 minutes expiration)');
  } else {
    console.log('❌ Token might be expired or invalid');
  }
}

async function testPlanHeaderValidation() {
  console.log('\n🧪 Testing Plan Header Validation...');
  
  const invalidPlans = ['invalid', 'premium', '', null];
  
  for (const invalidPlan of invalidPlans) {
    const result = await makeRequest('POST', '/generate-schema', {
      prompt: testSchema.prompt,
      XAuthUserId: 'Admin'
    }, { 'X-User-Plan': invalidPlan });
    
    console.log(`Invalid plan "${invalidPlan}": ${result.success ? '✅ SUCCESS (defaulted to basic)' : '❌ FAILED'}`);
  }
}

async function testPaymentPlansEndpoint() {
  console.log('\n🧪 Testing Payment Plans Endpoint...');
  
  const result = await makeRequest('GET', '/api/payment/plans');
  
  if (result.success) {
    console.log('✅ Payment plans endpoint working');
    console.log('Available plans:');
    result.data.data.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.id}): $${plan.price} - ${plan.features.join(', ')}`);
    });
  } else {
    console.log('❌ Payment plans endpoint failed');
    console.log(`Error: ${JSON.stringify(result.error)}`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Usage Limits Tests...');
  console.log('=' * 50);
  
  try {
    await testPaymentPlansEndpoint();
    await testTokenExpiration();
    await testPlanHeaderValidation();
    await testSchemaGenerationLimits();
    await testApiCreationLimits();
    await testApiRequestLimits();
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testSchemaGenerationLimits,
  testApiCreationLimits,
  testApiRequestLimits,
  testTokenExpiration,
  testPlanHeaderValidation,
  testPaymentPlansEndpoint
};

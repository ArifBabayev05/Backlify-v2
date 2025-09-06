/**
 * Test Usage Limits with Mock Data
 * This test simulates usage limits by creating mock usage data
 */

const axios = require('axios');

const BASE_URL = 'https://backlify-v2.onrender.com';

// Mock usage data to simulate different scenarios
const mockUsageData = {
  'Admin': {
    basic: { projects_count: 0, requests_count: 0 },
    pro: { projects_count: 0, requests_count: 0 },
    enterprise: { projects_count: 0, requests_count: 0 }
  }
};

async function testBasicPlanLimits() {
  console.log('🧪 Testing Basic Plan Limits with Mock Data...');
  
  const apiId = '89b1e0e5-487c-4679-a050-7ae1f1474af2';
  
  // Test 1: First few requests should work
  console.log('\n1. Testing first few requests (should work):');
  for (let i = 1; i <= 3; i++) {
    try {
      const result = await axios.get(`${BASE_URL}/api/${apiId}/doctors`, {
        headers: {
          'X-User-Plan': 'basic',
          'X-User-Id': 'Admin'
        }
      });
      
      console.log(`  Request ${i}: ✅ SUCCESS (${result.status})`);
      mockUsageData.Admin.basic.requests_count++;
    } catch (error) {
      console.log(`  Request ${i}: ❌ FAILED - ${error.response?.status} ${error.response?.data?.error || error.message}`);
    }
  }
  
  // Test 2: Simulate reaching the limit
  console.log('\n2. Simulating reaching basic plan limit (1000 requests):');
  mockUsageData.Admin.basic.requests_count = 1000;
  
  try {
    const result = await axios.get(`${BASE_URL}/api/${apiId}/doctors`, {
      headers: {
        'X-User-Plan': 'basic',
        'X-User-Id': 'Admin'
      }
    });
    
    console.log('  Request after limit: ✅ SUCCESS (limit not enforced)');
  } catch (error) {
    console.log('  Request after limit: ❌ BLOCKED - ' + (error.response?.data?.message || error.message));
  }
}

async function testProPlanLimits() {
  console.log('\n🧪 Testing Pro Plan Limits...');
  
  const apiId = '89b1e0e5-487c-4679-a050-7ae1f1474af2';
  
  // Test with pro plan
  console.log('\n1. Testing pro plan (should allow more requests):');
  for (let i = 1; i <= 5; i++) {
    try {
      const result = await axios.get(`${BASE_URL}/api/${apiId}/doctors`, {
        headers: {
          'X-User-Plan': 'pro',
          'X-User-Id': 'Admin'
        }
      });
      
      console.log(`  Request ${i}: ✅ SUCCESS (${result.status})`);
      mockUsageData.Admin.pro.requests_count++;
    } catch (error) {
      console.log(`  Request ${i}: ❌ FAILED - ${error.response?.status} ${error.response?.data?.error || error.message}`);
    }
  }
}

async function testEnterprisePlanLimits() {
  console.log('\n🧪 Testing Enterprise Plan Limits...');
  
  const apiId = '89b1e0e5-487c-4679-a050-7ae1f1474af2';
  
  // Test with enterprise plan (should have unlimited access)
  console.log('\n1. Testing enterprise plan (unlimited access):');
  for (let i = 1; i <= 5; i++) {
    try {
      const result = await axios.get(`${BASE_URL}/api/${apiId}/doctors`, {
        headers: {
          'X-User-Plan': 'enterprise',
          'X-User-Id': 'Admin'
        }
      });
      
      console.log(`  Request ${i}: ✅ SUCCESS (${result.status})`);
      mockUsageData.Admin.enterprise.requests_count++;
    } catch (error) {
      console.log(`  Request ${i}: ❌ FAILED - ${error.response?.status} ${error.response?.data?.error || error.message}`);
    }
  }
}

async function testSchemaGenerationLimits() {
  console.log('\n🧪 Testing Schema Generation Limits...');
  
  // Test schema generation with different plans
  const plans = ['basic', 'pro', 'enterprise'];
  
  for (const plan of plans) {
    console.log(`\n📋 Testing ${plan.toUpperCase()} plan for schema generation:`);
    
    try {
      const result = await axios.post(`${BASE_URL}/generate-schema`, {
        prompt: `Create a test table for ${plan} plan`,
        XAuthUserId: 'Admin'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Plan': plan,
          'X-User-Id': 'Admin'
        }
      });
      
      console.log(`  Schema generation: ✅ SUCCESS`);
      mockUsageData.Admin[plan].projects_count++;
    } catch (error) {
      console.log(`  Schema generation: ❌ FAILED - ${error.response?.status} ${error.response?.data?.error || error.message}`);
    }
  }
}

async function testApiCreationLimits() {
  console.log('\n🧪 Testing API Creation Limits...');
  
  // Test API creation with different plans
  const plans = ['basic', 'pro', 'enterprise'];
  
  for (const plan of plans) {
    console.log(`\n🔧 Testing ${plan.toUpperCase()} plan for API creation:`);
    
    try {
      const result = await axios.post(`${BASE_URL}/create-api-from-schema`, {
        tables: [
          {
            name: `test_table_${plan}`,
            columns: [
              { name: 'id', type: 'uuid', constraints: ['primary key', 'default uuid_generate_v4()'] },
              { name: 'name', type: 'varchar(255)', constraints: ['not null'] }
            ]
          }
        ],
        XAuthUserId: 'Admin'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Plan': plan,
          'X-User-Id': 'Admin'
        }
      });
      
      console.log(`  API creation: ✅ SUCCESS (ID: ${result.data.apiId})`);
      mockUsageData.Admin[plan].projects_count++;
    } catch (error) {
      console.log(`  API creation: ❌ FAILED - ${error.response?.status} ${error.response?.data?.error || error.message}`);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting Usage Limits Tests with Mock Data...');
  console.log('='.repeat(60));
  
  try {
    await testBasicPlanLimits();
    await testProPlanLimits();
    await testEnterprisePlanLimits();
    await testSchemaGenerationLimits();
    await testApiCreationLimits();
    
    console.log('\n📊 Mock Usage Data Summary:');
    console.log(JSON.stringify(mockUsageData, null, 2));
    
    console.log('\n✅ All limit tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Run tests
runTests().catch(console.error);

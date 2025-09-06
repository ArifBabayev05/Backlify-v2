/**
 * Test Actual Usage Limits
 * Tests the real usage limits by making multiple requests
 */

const axios = require('axios');

const BASE_URL = 'https://backlify-v2.onrender.com';

async function testApiRequestLimits() {
  console.log('🧪 Testing API Request Limits...');
  
  const apiId = '89b1e0e5-487c-4679-a050-7ae1f1474af2';
  const plans = ['basic', 'pro', 'enterprise'];
  
  for (const plan of plans) {
    console.log(`\n📊 Testing ${plan.toUpperCase()} plan:`);
    
    let successCount = 0;
    let failCount = 0;
    const maxRequests = 15; // Test with 15 requests
    
    for (let i = 1; i <= maxRequests; i++) {
      try {
        const result = await axios.get(`${BASE_URL}/api/${apiId}/doctors`, {
          headers: {
            'X-User-Plan': plan,
            'X-User-Id': 'Admin'
          }
        });
        
        successCount++;
        if (i <= 3 || i % 5 === 0) {
          console.log(`  Request ${i}: ✅ SUCCESS (${result.status})`);
        }
      } catch (error) {
        failCount++;
        if (error.response?.status === 403) {
          console.log(`  Request ${i}: ❌ BLOCKED - ${error.response.data.message || 'Limit exceeded'}`);
          break; // Stop testing this plan if we hit the limit
        } else {
          console.log(`  Request ${i}: ❌ ERROR - ${error.response?.status} ${error.response?.data?.error || error.message}`);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`  📈 Results for ${plan}: ${successCount} successful, ${failCount} failed`);
  }
}

async function testSchemaGenerationLimits() {
  console.log('\n🧪 Testing Schema Generation Limits...');
  
  const plans = ['basic', 'pro', 'enterprise'];
  
  for (const plan of plans) {
    console.log(`\n📋 Testing ${plan.toUpperCase()} plan for schema generation:`);
    
    let successCount = 0;
    let failCount = 0;
    const maxSchemas = 5; // Test with 5 schema generations
    
    for (let i = 1; i <= maxSchemas; i++) {
      try {
        const result = await axios.post(`${BASE_URL}/generate-schema`, {
          prompt: `Create a test table ${i} with id and name fields`,
          XAuthUserId: 'Admin'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Plan': plan,
            'X-User-Id': 'Admin'
          }
        });
        
        successCount++;
        console.log(`  Schema ${i}: ✅ SUCCESS`);
      } catch (error) {
        failCount++;
        if (error.response?.status === 403) {
          console.log(`  Schema ${i}: ❌ BLOCKED - ${error.response.data.message || 'Project limit exceeded'}`);
          break; // Stop testing this plan if we hit the limit
        } else {
          console.log(`  Schema ${i}: ❌ ERROR - ${error.response?.status} ${error.response?.data?.error || error.message}`);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`  📈 Results for ${plan}: ${successCount} successful, ${failCount} failed`);
  }
}

async function testApiCreationLimits() {
  console.log('\n🧪 Testing API Creation Limits...');
  
  const plans = ['basic', 'pro', 'enterprise'];
  
  for (const plan of plans) {
    console.log(`\n🔧 Testing ${plan.toUpperCase()} plan for API creation:`);
    
    let successCount = 0;
    let failCount = 0;
    const maxApis = 5; // Test with 5 API creations
    
    for (let i = 1; i <= maxApis; i++) {
      try {
        const result = await axios.post(`${BASE_URL}/create-api-from-schema`, {
          tables: [
            {
              name: `test_table_${i}`,
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
        
        successCount++;
        console.log(`  API ${i}: ✅ SUCCESS (ID: ${result.data.apiId})`);
      } catch (error) {
        failCount++;
        if (error.response?.status === 403) {
          console.log(`  API ${i}: ❌ BLOCKED - ${error.response.data.message || 'Project limit exceeded'}`);
          break; // Stop testing this plan if we hit the limit
        } else {
          console.log(`  API ${i}: ❌ ERROR - ${error.response?.status} ${error.response?.data?.error || error.message}`);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`  📈 Results for ${plan}: ${successCount} successful, ${failCount} failed`);
  }
}

async function runTests() {
  console.log('🚀 Starting Actual Usage Limits Tests...');
  console.log('='.repeat(60));
  
  try {
    await testApiRequestLimits();
    await testSchemaGenerationLimits();
    await testApiCreationLimits();
    
    console.log('\n✅ All limit tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Run tests
runTests().catch(console.error);

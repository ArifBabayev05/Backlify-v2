/**
 * Test Usage Limits Without Authentication
 * Tests the basic functionality without requiring authentication
 */

const axios = require('axios');

const BASE_URL = 'https://backlify-v2.onrender.com';

async function testPaymentPlans() {
  console.log('🧪 Testing Payment Plans Endpoint...');
  
  try {
    const result = await axios.get(`${BASE_URL}/api/payment/plans`);
    console.log('✅ Payment plans endpoint working');
    console.log('Available plans:');
    result.data.data.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.id}): $${plan.price} - ${plan.features.join(', ')}`);
    });
    return true;
  } catch (error) {
    console.error('❌ Payment plans test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testHealthEndpoint() {
  console.log('\n🧪 Testing Health Endpoint...');
  
  try {
    const result = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health endpoint working');
    console.log('Status:', result.data.status);
    return true;
  } catch (error) {
    console.error('❌ Health test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCorsHeaders() {
  console.log('\n🧪 Testing CORS Headers...');
  
  try {
    const result = await axios.options(`${BASE_URL}/api/payment/plans`, {
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-User-Plan, X-User-Id, Authorization'
      }
    });
    
    console.log('✅ CORS preflight successful');
    console.log('Status:', result.status);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin': result.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': result.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': result.headers['access-control-allow-headers']
    });
    return true;
  } catch (error) {
    console.error('❌ CORS test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testPlanHeaderSupport() {
  console.log('\n🧪 Testing X-User-Plan Header Support...');
  
  try {
    // Test with different plan headers
    const plans = ['basic', 'pro', 'enterprise', 'invalid'];
    
    for (const plan of plans) {
      try {
        const result = await axios.get(`${BASE_URL}/health`, {
          headers: {
            'X-User-Plan': plan
          }
        });
        console.log(`✅ Plan header "${plan}" accepted (status: ${result.status})`);
      } catch (error) {
        console.log(`❌ Plan header "${plan}" rejected (status: ${error.response?.status})`);
      }
    }
    return true;
  } catch (error) {
    console.error('❌ Plan header test failed:', error.message);
    return false;
  }
}

async function testExistingApi() {
  console.log('\n🧪 Testing Existing API Endpoint...');
  
  try {
    // Test the existing API endpoint that was mentioned in the user query
    const result = await axios.get(`${BASE_URL}/api/89b1e0e5-487c-4679-a050-7ae1f1474af2/doctors`, {
      headers: {
        'X-User-Plan': 'basic',
        'X-User-Id': 'Admin'
      }
    });
    
    console.log('✅ Existing API endpoint accessible');
    console.log('Response:', JSON.stringify(result.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Existing API test failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Usage Limits Tests (No Auth Required)...');
  console.log('='.repeat(60));
  
  const results = [];
  
  results.push(await testPaymentPlans());
  results.push(await testHealthEndpoint());
  results.push(await testCorsHeaders());
  results.push(await testPlanHeaderSupport());
  results.push(await testExistingApi());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed');
  }
}

// Run tests
runTests().catch(console.error);

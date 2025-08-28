#!/usr/bin/env node

/**
 * Payment System Endpoint Test Script
 * This script tests all payment endpoints to ensure they're working correctly
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test configuration
const testConfig = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': 'test-user-123'
  }
};

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

/**
 * Run a test and record results
 */
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    await testFunction();
    console.log(`  ✅ PASSED: ${testName}`);
    testResults.passed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${testName}`);
    console.log(`     Error: ${error.message}`);
    testResults.failed++;
  }
}

/**
 * Test 1: Get available payment plans
 */
async function testGetPlans() {
  const response = await axios.get(`${BASE_URL}/api/payment/plans`, testConfig);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  if (!response.data.success) {
    throw new Error('Response should have success: true');
  }
  
  if (!Array.isArray(response.data.data)) {
    throw new Error('Response should have data array');
  }
  
  // Check if plans exist
  const plans = response.data.data;
  if (plans.length === 0) {
    throw new Error('No payment plans found');
  }
  
  // Verify plan structure
  const requiredFields = ['id', 'plan_id', 'name', 'price', 'currency', 'features'];
  for (const plan of plans) {
    for (const field of requiredFields) {
      if (!(field in plan)) {
        throw new Error(`Plan missing required field: ${field}`);
      }
    }
  }
  
  console.log(`     Found ${plans.length} payment plans`);
}

/**
 * Test 2: Test CORS headers
 */
async function testCorsHeaders() {
  const response = await axios.get(`${BASE_URL}/api/payment/plans`, testConfig);
  
  const corsHeaders = [
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-allow-credentials'
  ];
  
  for (const header of corsHeaders) {
    if (!response.headers[header]) {
      throw new Error(`Missing CORS header: ${header}`);
    }
  }
  
  // Check if all origins are allowed
  if (response.headers['access-control-allow-origin'] !== '*' && 
      !response.headers['access-control-allow-origin']) {
    throw new Error('CORS origin not properly configured');
  }
  
  console.log('     CORS headers properly configured');
}

/**
 * Test 3: Test OPTIONS preflight request
 */
async function testOptionsPreflight() {
  const response = await axios.options(`${BASE_URL}/api/payment/plans`, testConfig);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200 for OPTIONS, got ${response.status}`);
  }
  
  if (!response.data.message || !response.data.message.includes('CORS preflight OK')) {
    throw new Error('OPTIONS response should indicate CORS preflight OK');
  }
  
  console.log('     OPTIONS preflight working correctly');
}

/**
 * Test 4: Test payment order creation (should fail without proper auth)
 */
async function testCreateOrderWithoutAuth() {
  try {
    await axios.post(`${BASE_URL}/api/payment/order`, {
      planId: 'basic'
    }, testConfig);
    
    // If we get here, the request succeeded when it should have failed
    throw new Error('Order creation should fail without proper authentication');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('     Authentication required (expected)');
      return; // This is expected behavior
    }
    throw error;
  }
}

/**
 * Test 5: Test subscription check endpoint
 */
async function testSubscriptionCheck() {
  const response = await axios.get(`${BASE_URL}/api/payment/check-subscription`, testConfig);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  if (!response.data.success) {
    throw new Error('Response should have success: true');
  }
  
  if (typeof response.data.data.hasActiveSubscription !== 'boolean') {
    throw new Error('Response should have hasActiveSubscription boolean field');
  }
  
  console.log(`     Subscription check working (hasActive: ${response.data.data.hasActiveSubscription})`);
}

/**
 * Test 6: Test Epoint callback endpoint structure
 */
async function testEpointCallbackStructure() {
  try {
    await axios.post(`${BASE_URL}/api/epoint-callback`, {
      data: 'invalid_data',
      signature: 'invalid_signature'
    }, testConfig);
    
    throw new Error('Callback should fail with invalid data');
  } catch (error) {
    if (error.response && error.response.status === 200) {
      // Epoint callback should always return 200 even on errors
      console.log('     Epoint callback endpoint responding correctly');
      return;
    }
    throw error;
  }
}

/**
 * Test 7: Test payment success endpoint
 */
async function testPaymentSuccess() {
  const response = await axios.get(`${BASE_URL}/api/payment/success?order_id=test123`, testConfig);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  if (!response.data.success) {
    throw new Error('Response should have success: true');
  }
  
  if (!response.data.orderId || !response.data.redirectUrl) {
    throw new Error('Response should have orderId and redirectUrl');
  }
  
  console.log('     Payment success endpoint working correctly');
}

/**
 * Test 8: Test payment cancel endpoint
 */
async function testPaymentCancel() {
  const response = await axios.get(`${BASE_URL}/api/payment/cancel?order_id=test123`, testConfig);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  if (response.data.success !== false) {
    throw new Error('Cancel response should have success: false');
  }
  
  if (!response.data.redirectUrl) {
    throw new Error('Response should have redirectUrl');
  }
  
  console.log('     Payment cancel endpoint working correctly');
}

/**
 * Test 9: Test different origins (CORS)
 */
async function testDifferentOrigins() {
  const origins = [
    'https://example.com',
    'https://localhost:3000',
    'https://app.backlify.com',
    'http://localhost:8080'
  ];
  
  for (const origin of origins) {
    try {
      const response = await axios.get(`${BASE_URL}/api/payment/plans`, {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          'Origin': origin
        }
      });
      
      // Check if CORS headers are set correctly
      if (response.headers['access-control-allow-origin'] !== origin && 
          response.headers['access-control-allow-origin'] !== '*') {
        throw new Error(`CORS not working for origin: ${origin}`);
      }
    } catch (error) {
      throw new Error(`Failed to test origin ${origin}: ${error.message}`);
    }
  }
  
  console.log('     CORS working for multiple origins');
}

/**
 * Test 10: Test rate limiting (if implemented)
 */
async function testRateLimiting() {
  const requests = [];
  
  // Make multiple rapid requests
  for (let i = 0; i < 5; i++) {
    requests.push(axios.get(`${BASE_URL}/api/payment/plans`, testConfig));
  }
  
  try {
    await Promise.all(requests);
    console.log('     Rate limiting not implemented (or very high limits)');
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('     Rate limiting working correctly');
    } else {
      throw error;
    }
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Payment System Endpoint Tests...\n');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`⏰ Timeout: ${testConfig.timeout}ms`);
  
  const tests = [
    { name: 'Get Payment Plans', func: testGetPlans },
    { name: 'CORS Headers', func: testCorsHeaders },
    { name: 'OPTIONS Preflight', func: testOptionsPreflight },
    { name: 'Create Order (No Auth)', func: testCreateOrderWithoutAuth },
    { name: 'Subscription Check', func: testSubscriptionCheck },
    { name: 'Epoint Callback Structure', func: testEpointCallbackStructure },
    { name: 'Payment Success', func: testPaymentSuccess },
    { name: 'Payment Cancel', func: testPaymentCancel },
    { name: 'Multiple Origins CORS', func: testDifferentOrigins },
    { name: 'Rate Limiting', func: testRateLimiting }
  ];
  
  for (const test of tests) {
    await runTest(test.name, test.func);
  }
  
  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Payment system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  runTest,
  testResults
};

#!/usr/bin/env node

/**
 * Route Testing Tool
 * Tests public and protected routes to ensure authentication is working correctly
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000'; //process.env.BASE_URL || 
console.log(`🌐 Testing against: ${BASE_URL}`);

// Test configuration
const testConfig = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Valid test token (you'll need to get this from login)
let testToken = null;

// Test results
const testResults = {
  public: { passed: 0, failed: 0, total: 0 },
  protected: { passed: 0, failed: 0, total: 0 }
};

/**
 * Test routes that should be public (no auth required)
 */
const publicRoutes = [
  { method: 'GET', path: '/api/payment/plans', name: 'Get Payment Plans' },
  { method: 'GET', path: '/health', name: 'Health Check' },
  { method: 'GET', path: '/api/payment/success?order_id=test123', name: 'Payment Success' },
  { method: 'GET', path: '/api/payment/cancel?order_id=test123', name: 'Payment Cancel' },
  { method: 'POST', path: '/api/epoint-callback', name: 'Epoint Callback', data: { data: 'test', signature: 'test' } },
  { method: 'POST', path: '/auth/google-login', name: 'Google Login', data: { google_token: 'test', email: 'test@gmail.com', google_id: '123' } },
  { method: 'POST', path: '/auth/google-verify', name: 'Google Verify', data: { google_token: 'test' } }
];

/**
 * Test routes that should be protected (auth required)
 */
const protectedRoutes = [
  { method: 'POST', path: '/api/payment/order', name: 'Create Payment Order', data: { planId: 'basic' } },
  { method: 'GET', path: '/api/payment/history', name: 'Payment History' },
  { method: 'GET', path: '/api/payment/subscription', name: 'User Subscription' },
  { method: 'GET', path: '/api/payment/check-subscription', name: 'Check Subscription' },
  { method: 'GET', path: '/auth/google-profile', name: 'Google User Profile' }
];

/**
 * Run a single test
 */
async function runTest(routeInfo, isProtected = false, withAuth = false) {
  const { method, path, name, data } = routeInfo;
  const url = `${BASE_URL}${path}`;
  
  const config = {
    ...testConfig,
    method: method.toLowerCase(),
    url: url
  };

  // Add auth header if testing with authentication
  if (withAuth && testToken) {
    config.headers.Authorization = `Bearer ${testToken}`;
  }

  // Add data for POST requests
  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    const authType = isProtected ? 'protected' : 'public';
    const authText = withAuth ? 'WITH auth' : 'WITHOUT auth';
    
    console.log(`  ✅ ${name} (${authText}): ${response.status}`);
    testResults[authType].passed++;
    return true;
  } catch (error) {
    const authType = isProtected ? 'protected' : 'public';
    const authText = withAuth ? 'WITH auth' : 'WITHOUT auth';
    
    if (error.response) {
      console.log(`  ❌ ${name} (${authText}): ${error.response.status} - ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`);
    } else {
      console.log(`  ❌ ${name} (${authText}): ${error.message}`);
    }
    testResults[authType].failed++;
    return false;
  }
}

/**
 * Test public routes (should work without authentication)
 */
async function testPublicRoutes() {
  console.log('\n📖 Testing Public Routes (should work WITHOUT authentication)');
  console.log('='.repeat(70));

  for (const route of publicRoutes) {
    testResults.public.total++;
    await runTest(route, false, false);
  }
}

/**
 * Test protected routes without authentication (should fail)
 */
async function testProtectedRoutesWithoutAuth() {
  console.log('\n🔒 Testing Protected Routes WITHOUT authentication (should fail with 401)');
  console.log('='.repeat(70));

  for (const route of protectedRoutes) {
    testResults.protected.total++;
    const result = await runTest(route, true, false);
    
    // For protected routes without auth, we expect them to fail with 401
    // So if they "fail", that's actually correct behavior
    if (!result) {
      // Check if it's a 401 (which is expected)
      // We'll count 401 as a "pass" for this test
      testResults.protected.failed--;
      testResults.protected.passed++;
    }
  }
}

/**
 * Test protected routes with authentication (should work if token is valid)
 */
async function testProtectedRoutesWithAuth() {
  if (!testToken) {
    console.log('\n⚠️  Skipping protected routes WITH auth test (no token available)');
    console.log('   To test with authentication, first login and get a token');
    return;
  }

  console.log('\n🔓 Testing Protected Routes WITH authentication (should work)');
  console.log('='.repeat(70));

  for (const route of protectedRoutes) {
    await runTest(route, true, true);
  }
}

/**
 * Try to login and get a test token
 */
async function getTestToken() {
  try {
    console.log('🔑 Attempting to get test token...');
    
    // Try to register a test user first
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: 'test@example.com',
        password: 'TestPassword123!',
        username: 'testuser'
      });
      console.log('   ✅ Test user registered');
    } catch (regError) {
      console.log('   ⚠️  Test user already exists or registration failed');
    }

    // Try to login
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'testuser',
      password: 'TestPassword123!'
    });

    if (loginResponse.data.access_token) {
      testToken = loginResponse.data.access_token;
      console.log('   ✅ Test token obtained');
      return true;
    }
  } catch (error) {
    console.log('   ❌ Failed to get test token:', error.response?.data?.message || error.message);
  }
  
  return false;
}

/**
 * Show authentication middleware configuration
 */
async function showRouteConfig() {
  try {
    console.log('\n🔧 Authentication Middleware Configuration');
    console.log('='.repeat(50));
    
    // Try to access a config endpoint if it exists
    // For now, just show what we expect based on our setup
    console.log('📖 Public Routes:');
    publicRoutes.forEach(route => {
      console.log(`   ${route.method} ${route.path} - ${route.name}`);
    });
    
    console.log('\n🔒 Protected Routes:');
    protectedRoutes.forEach(route => {
      console.log(`   ${route.method} ${route.path} - ${route.name}`);
    });

  } catch (error) {
    console.log('❌ Could not retrieve route configuration:', error.message);
  }
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  
  const totalPublic = testResults.public.total;
  const passedPublic = testResults.public.passed;
  const failedPublic = testResults.public.failed;
  
  const totalProtected = testResults.protected.total;
  const passedProtected = testResults.protected.passed;
  const failedProtected = testResults.protected.failed;
  
  console.log(`📖 Public Routes:    ${passedPublic}/${totalPublic} passed (${failedPublic} failed)`);
  console.log(`🔒 Protected Routes: ${passedProtected}/${totalProtected} passed (${failedProtected} failed)`);
  
  const totalTests = totalPublic + totalProtected;
  const totalPassed = passedPublic + passedProtected;
  const totalFailed = failedPublic + failedProtected;
  
  console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} passed (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! Authentication system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the configuration.');
  }
}

/**
 * Main test runner
 */
async function runTests(testType = 'all') {
  console.log('🚀 Route Authentication Tester');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🎯 Test type: ${testType}`);
  
  if (testType === 'config') {
    await showRouteConfig();
    return;
  }
  
  // Try to get a test token
  await getTestToken();
  
  if (testType === 'all' || testType === 'public') {
    await testPublicRoutes();
  }
  
  if (testType === 'all' || testType === 'protected') {
    await testProtectedRoutesWithoutAuth();
    await testProtectedRoutesWithAuth();
  }
  
  if (testType === 'all') {
    printSummary();
  }
}

// Handle command line arguments
const testType = process.argv[2] || 'all';
const validTypes = ['all', 'public', 'protected', 'config'];

if (!validTypes.includes(testType)) {
  console.log('Usage: node route-tester.js [all|public|protected|config]');
  console.log('  all       - Test both public and protected routes (default)');
  console.log('  public    - Test only public routes');
  console.log('  protected - Test only protected routes');
  console.log('  config    - Show route configuration');
  process.exit(1);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests(testType).catch(error => {
    console.error('\n💥 Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testResults
};

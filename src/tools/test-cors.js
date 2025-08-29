#!/usr/bin/env node

/**
 * CORS Test Tool
 * Tests CORS functionality with different origins and methods
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Different test origins to simulate various frontend URLs
const testOrigins = [
  'https://app.example.com',
  'https://dashboard.mysite.com',
  'https://localhost:3000',
  'https://127.0.0.1:3000',
  'http://localhost:8080',
  'https://my-frontend.vercel.app',
  'https://react-app.netlify.app',
  'https://vue-app.github.io'
];

// Test endpoints
const testEndpoints = [
  { method: 'GET', path: '/api/payment/plans', name: 'Payment Plans (Public)' },
  { method: 'GET', path: '/health', name: 'Health Check (Public)' },
  { method: 'POST', path: '/api/epoint-callback', name: 'Epoint Callback (Public)', data: { test: true } },
  { method: 'OPTIONS', path: '/api/payment/plans', name: 'Preflight Request' }
];

/**
 * Test CORS for a specific origin and endpoint
 */
async function testCorsForOrigin(origin, endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  
  const config = {
    method: endpoint.method.toLowerCase(),
    url: url,
    headers: {
      'Origin': origin,
      'Content-Type': 'application/json',
      'Access-Control-Request-Method': endpoint.method,
      'Access-Control-Request-Headers': 'Content-Type, Authorization, X-User-Id'
    },
    timeout: 10000
  };

  if (endpoint.data) {
    config.data = endpoint.data;
  }

  try {
    const response = await axios(config);
    
    // Check CORS headers in response
    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
      'access-control-allow-headers': response.headers['access-control-allow-headers'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
      'access-control-max-age': response.headers['access-control-max-age']
    };

    const originAllowed = corsHeaders['access-control-allow-origin'] === origin || 
                         corsHeaders['access-control-allow-origin'] === '*';

    console.log(`  ✅ ${endpoint.name} | ${origin}`);
    console.log(`     Status: ${response.status}`);
    console.log(`     Origin Allowed: ${originAllowed ? '✅' : '❌'}`);
    console.log(`     CORS Origin: ${corsHeaders['access-control-allow-origin'] || 'NOT SET'}`);
    console.log(`     Methods: ${corsHeaders['access-control-allow-methods'] || 'NOT SET'}`);
    console.log(`     Credentials: ${corsHeaders['access-control-allow-credentials'] || 'NOT SET'}`);
    
    return { success: true, originAllowed, corsHeaders };
    
  } catch (error) {
    if (error.response) {
      console.log(`  ❌ ${endpoint.name} | ${origin}`);
      console.log(`     Status: ${error.response.status}`);
      console.log(`     Error: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`);
      
      // Check if CORS headers are present even in error responses
      const corsOrigin = error.response.headers['access-control-allow-origin'];
      console.log(`     CORS in Error: ${corsOrigin ? '✅' : '❌'}`);
      
      return { success: false, error: error.response.status, corsInError: !!corsOrigin };
    } else {
      console.log(`  ❌ ${endpoint.name} | ${origin}`);
      console.log(`     Network Error: ${error.message}`);
      return { success: false, error: 'network' };
    }
  }
}

/**
 * Test specific CORS scenario
 */
async function testSpecificScenario() {
  console.log('\n🎯 Testing Specific CORS Scenario');
  console.log('='.repeat(50));
  
  // Test preflight request
  try {
    const preflightResponse = await axios.options(`${BASE_URL}/api/payment/plans`, {
      headers: {
        'Origin': 'https://test-frontend.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    
    console.log('✅ Preflight Request Successful');
    console.log(`   Status: ${preflightResponse.status}`);
    console.log(`   CORS Origin: ${preflightResponse.headers['access-control-allow-origin']}`);
    console.log(`   Allowed Methods: ${preflightResponse.headers['access-control-allow-methods']}`);
    console.log(`   Allowed Headers: ${preflightResponse.headers['access-control-allow-headers']}`);
    
    // Test actual request after preflight
    const actualResponse = await axios.get(`${BASE_URL}/api/payment/plans`, {
      headers: {
        'Origin': 'https://test-frontend.com',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Actual Request After Preflight Successful');
    console.log(`   Status: ${actualResponse.status}`);
    console.log(`   CORS Origin: ${actualResponse.headers['access-control-allow-origin']}`);
    console.log(`   Response Data: ${JSON.stringify(actualResponse.data).substring(0, 100)}...`);
    
  } catch (error) {
    console.log('❌ CORS Test Failed');
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
    }
  }
}

/**
 * Main test runner
 */
async function runCorsTests() {
  console.log('🌐 CORS Comprehensive Test');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🎯 Testing ${testOrigins.length} origins with ${testEndpoints.length} endpoints`);
  
  let totalTests = 0;
  let passedTests = 0;
  let corsIssues = 0;

  for (const endpoint of testEndpoints) {
    console.log(`\n📋 Testing: ${endpoint.name}`);
    console.log('-'.repeat(40));
    
    for (const origin of testOrigins) {
      totalTests++;
      const result = await testCorsForOrigin(origin, endpoint);
      
      if (result.success && result.originAllowed) {
        passedTests++;
      } else if (result.success && !result.originAllowed) {
        corsIssues++;
      }
    }
  }

  // Test specific scenarios
  await testSpecificScenario();

  // Summary
  console.log('\n📊 CORS Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`CORS Issues: ${corsIssues} ⚠️`);
  console.log(`Failed: ${totalTests - passedTests - corsIssues} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (corsIssues === 0 && passedTests === totalTests) {
    console.log('\n🎉 Perfect! All CORS tests passed!');
    console.log('   Your API is accessible from ANY origin without CORS errors!');
  } else if (corsIssues > 0) {
    console.log('\n⚠️  Some CORS configuration issues detected.');
    console.log('   Check the CORS Origin header responses above.');
  } else {
    console.log('\n❌ Some tests failed. Check the error details above.');
  }
}

// Handle command line usage
if (require.main === module) {
  runCorsTests().catch(error => {
    console.error('\n💥 CORS test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runCorsTests };

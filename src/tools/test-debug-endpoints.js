#!/usr/bin/env node

/**
 * Debug Endpoints Test Script
 * Tests the debug endpoints to identify Google auth issues
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000'; // Hardcoded for local testing

/**
 * Test database status endpoint
 */
async function testDatabaseStatus() {
  console.log('🔍 Testing Database Status...');
  
  try {
    const response = await axios.get(`${BASE_URL}/debug/database-status`, {
      timeout: 10000
    });

    console.log('✅ Database Status Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Database Status Failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

/**
 * Test Google user creation
 */
async function testGoogleUserCreation() {
  console.log('\n👤 Testing Google User Creation...');
  
  const testData = {
    email: `test${Date.now()}@debug.com`,
    name: 'Debug Test User',
    picture: 'https://example.com/pic.jpg',
    google_id: `debug_${Date.now()}`
  };

  try {
    const response = await axios.post(`${BASE_URL}/debug/google-user-creation`, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('✅ Google User Creation Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Google User Creation Failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

/**
 * Test Google full flow
 */
async function testGoogleFullFlow() {
  console.log('\n🔄 Testing Google Full Flow...');
  
  const testData = {
    google_token: 'debug_token_test',
    email: `fullflow${Date.now()}@debug.com`,
    name: 'Full Flow Test User',
    picture: 'https://example.com/fullflow.jpg',
    google_id: `fullflow_${Date.now()}`
  };

  try {
    const response = await axios.post(`${BASE_URL}/debug/google-full-flow`, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('✅ Google Full Flow Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Google Full Flow Failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

/**
 * Test real Google login endpoint
 */
async function testRealGoogleLogin() {
  console.log('\n🔐 Testing Real Google Login Endpoint...');
  
  const testData = {
    google_token: 'invalid_token_for_testing',
    email: 'realtest@gmail.com',
    name: 'Real Test User',
    picture: 'https://example.com/real.jpg',
    google_id: 'real_test_123'
  };

  try {
    const response = await axios.post(`${BASE_URL}/auth/google-login`, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('❌ Unexpected success with invalid token');
    return false;
  } catch (error) {
    if (error.response) {
      console.log(`✅ Expected failure - Status: ${error.response.status}`);
      console.log('   Response:', JSON.stringify(error.response.data, null, 2));
      
      // Check if error is from token verification (expected) or database (problem)
      if (error.response.data.details && error.response.data.details.includes('verify')) {
        console.log('✅ Error is from token verification (this is expected)');
        return true;
      } else if (error.response.data.details && error.response.data.details.includes('create user account')) {
        console.log('❌ Error is from user creation (this is the problem!)');
        return false;
      } else {
        console.log('⚠️  Unexpected error type');
        return false;
      }
    } else {
      console.log(`❌ Network error: ${error.message}`);
      return false;
    }
  }
}

/**
 * Main test runner
 */
async function runDebugTests() {
  console.log('🐛 Google Auth Debug Test Suite');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log('='.repeat(60));

  const tests = [
    { name: 'Database Status', func: testDatabaseStatus },
    { name: 'Google User Creation', func: testGoogleUserCreation },
    { name: 'Google Full Flow', func: testGoogleFullFlow },
    { name: 'Real Google Login', func: testRealGoogleLogin }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    const result = await test.func();
    if (result) passed++;
  }

  console.log('\n📊 Debug Test Results');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${total - passed} ❌`);

  if (passed === total) {
    console.log('\n🎉 All debug tests passed! Google auth should be working.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the detailed output above.');
  }

  return passed === total;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runDebugTests().catch(error => {
    console.error('\n💥 Debug test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runDebugTests };

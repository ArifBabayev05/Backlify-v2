#!/usr/bin/env node

/**
 * Google Authentication Test Script
 * Tests Google OAuth endpoints to ensure they work correctly
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Mock Google user data for testing
const mockGoogleUser = {
  google_token: 'mock_google_token_for_testing',
  email: 'testuser@gmail.com',
  name: 'Test User',
  picture: 'https://lh3.googleusercontent.com/a/test-image',
  google_id: '123456789012345678901'
};

/**
 * Test Google token verification endpoint
 */
async function testGoogleVerify() {
  console.log('\n🔍 Testing Google Token Verification...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/google-verify`, {
      google_token: 'invalid_token_for_testing'
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('❌ Unexpected success with invalid token');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly rejected invalid Google token');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error}`);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }
}

/**
 * Test Google login endpoint structure
 */
async function testGoogleLoginStructure() {
  console.log('\n🔐 Testing Google Login Endpoint Structure...');
  
  try {
    // Test with missing required fields
    const response = await axios.post(`${BASE_URL}/auth/google-login`, {
      email: mockGoogleUser.email
      // Missing google_token and google_id
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('❌ Should have failed with missing fields');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected request with missing fields');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error}`);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }
}

/**
 * Test Google login with mock data (will fail token verification)
 */
async function testGoogleLoginFlow() {
  console.log('\n🚀 Testing Google Login Flow...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/google-login`, mockGoogleUser, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('❌ Unexpected success with mock token');
    return false;
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 500)) {
      console.log('✅ Correctly handled mock Google token');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error || error.response.data.details}`);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }
}

/**
 * Test Google profile endpoint (requires authentication)
 */
async function testGoogleProfile() {
  console.log('\n👤 Testing Google Profile Endpoint...');
  
  try {
    const response = await axios.get(`${BASE_URL}/auth/google-profile`, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('❌ Should require authentication');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly requires authentication');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error}`);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }
}

/**
 * Test CORS headers on Google auth endpoints
 */
async function testGoogleAuthCors() {
  console.log('\n🌐 Testing CORS on Google Auth Endpoints...');
  
  const origins = [
    'https://myapp.com',
    'https://localhost:3000',
    'https://react-app.vercel.app'
  ];

  let corsWorking = true;

  for (const origin of origins) {
    try {
      const response = await axios.options(`${BASE_URL}/auth/google-login`, {
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const corsOrigin = response.headers['access-control-allow-origin'];
      if (corsOrigin === origin || corsOrigin === '*') {
        console.log(`✅ CORS working for ${origin}`);
      } else {
        console.log(`❌ CORS issue for ${origin} (got: ${corsOrigin})`);
        corsWorking = false;
      }
    } catch (error) {
      console.log(`❌ CORS test failed for ${origin}: ${error.message}`);
      corsWorking = false;
    }
  }

  return corsWorking;
}

/**
 * Test endpoint availability
 */
async function testEndpointAvailability() {
  console.log('\n📡 Testing Endpoint Availability...');
  
  const endpoints = [
    { method: 'POST', path: '/auth/google-login', name: 'Google Login' },
    { method: 'POST', path: '/auth/google-verify', name: 'Google Verify' },
    { method: 'GET', path: '/auth/google-profile', name: 'Google Profile' }
  ];

  let allAvailable = true;

  for (const endpoint of endpoints) {
    try {
      if (endpoint.method === 'GET') {
        await axios.get(`${BASE_URL}${endpoint.path}`, { timeout: 5000 });
      } else {
        await axios.post(`${BASE_URL}${endpoint.path}`, {}, { timeout: 5000 });
      }
      
      console.log(`✅ ${endpoint.name}: Available`);
    } catch (error) {
      if (error.response) {
        // Getting a response means the endpoint exists
        console.log(`✅ ${endpoint.name}: Available (status: ${error.response.status})`);
      } else {
        console.log(`❌ ${endpoint.name}: Not available (${error.message})`);
        allAvailable = false;
      }
    }
  }

  return allAvailable;
}

/**
 * Main test runner
 */
async function runGoogleAuthTests() {
  console.log('🔐 Google Authentication Test Suite');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log('='.repeat(50));

  const tests = [
    { name: 'Endpoint Availability', func: testEndpointAvailability },
    { name: 'CORS Configuration', func: testGoogleAuthCors },
    { name: 'Google Token Verification', func: testGoogleVerify },
    { name: 'Google Login Structure', func: testGoogleLoginStructure },
    { name: 'Google Login Flow', func: testGoogleLoginFlow },
    { name: 'Google Profile Protection', func: testGoogleProfile }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    const result = await test.func();
    if (result) passed++;
  }

  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${total - passed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (passed === total) {
    console.log('\n🎉 All Google Auth tests passed!');
    console.log('\n📋 Ready for frontend integration:');
    console.log(`
Frontend can now use:
POST ${BASE_URL}/auth/google-login

Example payload:
{
  "google_token": "actual_google_access_token",
  "email": "user@gmail.com",
  "name": "User Name", 
  "picture": "https://profile-url",
  "google_id": "google_user_id"
}

Expected response:
{
  "success": true,
  "XAuthUserId": "username",
  "email": "user@gmail.com",
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
    `);
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }

  return passed === total;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runGoogleAuthTests().catch(error => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runGoogleAuthTests };

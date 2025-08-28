#!/usr/bin/env node

/**
 * Test Public Payment Endpoints
 * This script tests that public endpoints are accessible without authentication
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'https://backlify-v2.onrender.com';

// Test configuration for public endpoints
const testConfig = {
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
};

async function testPublicEndpoints() {
  console.log('🧪 Testing Public Payment Endpoints...\n');
  console.log(`📍 Testing against: ${BASE_URL}\n`);

  const endpoints = [
    {
      name: 'Health Check',
      url: '/api/payment/health',
      method: 'GET',
      expectedStatus: 200
    },
    {
      name: 'Payment Plans',
      url: '/api/payment/plans',
      method: 'GET',
      expectedStatus: 200
    },
    {
      name: 'Payment Success',
      url: '/api/payment/success?order_id=test123',
      method: 'GET',
      expectedStatus: 200
    },
    {
      name: 'Payment Cancel',
      url: '/api/payment/cancel?order_id=test123',
      method: 'GET',
      expectedStatus: 200
    },
    {
      name: 'Epoint Callback (Direct)',
      url: '/api/epoint-callback',
      method: 'POST',
      expectedStatus: 400, // Should fail due to missing data/signature but return 400, not 401
      data: { test: 'data' }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.method} ${endpoint.url}`);
      
      let response;
      if (endpoint.method === 'GET') {
        response = await axios.get(`${BASE_URL}${endpoint.url}`, testConfig);
      } else if (endpoint.method === 'POST') {
        response = await axios.post(`${BASE_URL}${endpoint.url}`, endpoint.data || {}, testConfig);
      }

      // Check if we got a response (even if it's an error response, it means the endpoint is accessible)
      if (response) {
        console.log(`   ✅ Status: ${response.status}`);
        
        // Check CORS headers
        const corsHeaders = [
          'access-control-allow-origin',
          'access-control-allow-methods',
          'access-control-allow-headers'
        ];
        
        let corsOk = true;
        for (const header of corsHeaders) {
          if (!response.headers[header]) {
            corsOk = false;
            break;
          }
        }
        
        if (corsOk) {
          console.log(`   ✅ CORS headers: OK`);
        } else {
          console.log(`   ⚠️  CORS headers: Missing some headers`);
        }
        
        // Check if response contains expected data structure
        if (response.data && typeof response.data === 'object') {
          console.log(`   ✅ Response structure: OK`);
          if (response.data.success !== undefined) {
            console.log(`   ✅ Success field: ${response.data.success}`);
          }
        }
        
        passed++;
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      // Check if it's an authentication error (401) vs other errors
      if (error.response) {
        console.log(`   📊 Response Status: ${error.response.status}`);
        
        if (error.response.status === 401) {
          console.log(`   ❌ AUTHENTICATION REQUIRED - This endpoint should be public!`);
        } else if (error.response.status === 400) {
          console.log(`   ✅ 400 Bad Request - Expected for invalid data (endpoint is accessible)`);
          passed++;
        } else if (error.response.status === 404) {
          console.log(`   ❌ 404 Not Found - Endpoint doesn't exist`);
        } else {
          console.log(`   ⚠️  Other error status: ${error.response.status}`);
        }
        
        // Check CORS headers even on error
        const corsHeaders = [
          'access-control-allow-origin',
          'access-control-allow-methods',
          'access-control-allow-headers'
        ];
        
        let corsOk = true;
        for (const header of corsHeaders) {
          if (!error.response.headers[header]) {
            corsOk = false;
            break;
          }
        }
        
        if (corsOk) {
          console.log(`   ✅ CORS headers: OK (even on error)`);
        } else {
          console.log(`   ⚠️  CORS headers: Missing some headers`);
        }
      }
      
      failed++;
    }
    
    console.log(''); // Empty line for readability
  }

  // Summary
  console.log('📊 Test Results Summary');
  console.log('========================');
  console.log(`Total Endpoints: ${endpoints.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / endpoints.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All public endpoints are accessible without authentication!');
  } else {
    console.log('\n⚠️  Some endpoints failed. Check the details above.');
  }

  // Test browser accessibility
  console.log('\n🌐 Browser Testing Instructions:');
  console.log('1. Open your browser and navigate to:');
  console.log(`   ${BASE_URL}/api/payment/plans`);
  console.log('2. You should see the payment plans JSON response');
  console.log('3. No authentication should be required');
  console.log('4. CORS should allow access from any origin');
}

// Run tests if this script is executed directly
if (require.main === module) {
  testPublicEndpoints().catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testPublicEndpoints };

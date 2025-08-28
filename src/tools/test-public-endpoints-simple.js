#!/usr/bin/env node

/**
 * Simple Test for Public Payment Endpoints
 * This script tests that public endpoints are accessible without authentication
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'https://backlify-v2.onrender.com';

async function testPublicEndpoints() {
  console.log('🧪 Testing Public Payment Endpoints...\n');
  console.log(`📍 Testing against: ${BASE_URL}\n`);

  const endpoints = [
    {
      name: 'Payment Plans',
      url: '/api/payment/plans',
      method: 'GET'
    },
    {
      name: 'Payment Health',
      url: '/api/payment/health',
      method: 'GET'
    },
    {
      name: 'Main Health',
      url: '/health',
      method: 'GET'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.method} ${endpoint.url}`);
      
      const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      
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
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      if (error.response) {
        console.log(`   📊 Response Status: ${error.response.status}`);
        console.log(`   📊 Response Data: ${JSON.stringify(error.response.data).substring(0, 100)}...`);
        
        if (error.response.status === 401) {
          console.log(`   ❌ AUTHENTICATION REQUIRED - This endpoint should be public!`);
        } else if (error.response.status === 404) {
          console.log(`   ❌ 404 Not Found - Endpoint doesn't exist`);
        } else {
          console.log(`   ⚠️  Other error status: ${error.response.status}`);
        }
      }
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('🌐 Browser Testing Instructions:');
  console.log('1. Open your browser and navigate to:');
  console.log(`   ${BASE_URL}/api/payment/plans`);
  console.log('2. You should see the payment plans JSON response');
  console.log('3. No authentication should be required');
}

// Run tests if this script is executed directly
if (require.main === module) {
  testPublicEndpoints().catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testPublicEndpoints };

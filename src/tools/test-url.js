#!/usr/bin/env node

/**
 * Simple URL Tester
 * Tests a specific URL to see if it works without authentication
 */

const axios = require('axios');

const url = process.argv[2] || 'https://backlify-v2.onrender.com/api/payment/plans';

console.log(`🌐 Testing URL: ${url}`);

async function testUrl() {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Error! Status: ${error.response.status}`);
      console.log(`📄 Error Response:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`❌ Network Error:`, error.message);
    }
  }
}

testUrl();

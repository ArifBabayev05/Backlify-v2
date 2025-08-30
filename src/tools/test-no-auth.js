#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3000';
const API_ID = '469705ed-a30c-4c3d-b081-8b8b7fac794c';

async function testNoAuth() {
  try {
    console.log('🧪 Testing API endpoint without authentication...');
    console.log(`📍 Testing: ${BASE_URL}/api/${API_ID}/doctors`);
    
    const response = await axios.get(`${BASE_URL}/api/${API_ID}/doctors`, {
      params: {
        page: 1,
        limit: 10,
        order: 'asc'
      },
      headers: {
        'accept': '*/*'
      }
    });
    
    console.log('✅ SUCCESS: API endpoint worked without authentication!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📝 Response:`, response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ FAILED: API endpoint still requires authentication');
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📝 Response:`, error.response.data);
    } else {
      console.log('❌ NETWORK ERROR:', error.message);
    }
  }
}

// Test with skip-auth header
async function testSkipAuth() {
  try {
    console.log('\n🧪 Testing API endpoint with X-Skip-Auth header...');
    console.log(`📍 Testing: ${BASE_URL}/api/${API_ID}/doctors`);
    
    const response = await axios.get(`${BASE_URL}/api/${API_ID}/doctors`, {
      params: {
        page: 1,
        limit: 10,
        order: 'asc'
      },
      headers: {
        'accept': '*/*',
        'X-Skip-Auth': 'true'
      }
    });
    
    console.log('✅ SUCCESS: API endpoint worked with X-Skip-Auth header!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📝 Response:`, response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ FAILED: API endpoint failed even with X-Skip-Auth');
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📝 Response:`, error.response.data);
    } else {
      console.log('❌ NETWORK ERROR:', error.message);
    }
  }
}

async function main() {
  console.log('🚀 API Authentication Test');
  console.log('==========================');
  
  await testNoAuth();
  await testSkipAuth();
  
  console.log('\n📋 Summary:');
  console.log('If both tests fail, the server might not be running.');
  console.log('If first test fails but second succeeds, authentication is still enforced.');
  console.log('If both tests succeed, authentication has been successfully disabled.');
}

main().catch(console.error);

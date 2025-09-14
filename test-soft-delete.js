/**
 * Test script for API soft delete functionality
 * This script demonstrates how to use the new soft delete features
 */

const axios = require('axios');

// Configuration - update these values as needed
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-123';
const TEST_API_ID = 'your-api-id-here'; // Replace with actual API ID

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-User-Id': TEST_USER_ID // This should match your auth implementation
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error making ${method} request to ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

async function testSoftDelete() {
  console.log('🧪 Testing API Soft Delete Functionality\n');
  
  try {
    // 1. Get all APIs for the user
    console.log('1. Getting all APIs for user...');
    const allApis = await makeRequest('GET', '/my-apis');
    console.log('✅ All APIs:', allApis);
    console.log('');
    
    // 2. Soft delete an API (replace with actual API ID)
    if (TEST_API_ID !== 'your-api-id-here') {
      console.log('2. Soft deleting API...');
      const deleteResult = await makeRequest('DELETE', `/api/${TEST_API_ID}`);
      console.log('✅ Delete result:', deleteResult);
      console.log('');
      
      // 3. Get APIs again (should not include deleted API)
      console.log('3. Getting APIs after deletion...');
      const apisAfterDelete = await makeRequest('GET', '/my-apis');
      console.log('✅ APIs after deletion:', apisAfterDelete);
      console.log('');
      
      // 4. Get deleted APIs
      console.log('4. Getting deleted APIs...');
      const deletedApis = await makeRequest('GET', '/my-apis/deleted');
      console.log('✅ Deleted APIs:', deletedApis);
      console.log('');
      
      // 5. Restore the API
      console.log('5. Restoring API...');
      const restoreResult = await makeRequest('POST', `/api/${TEST_API_ID}/restore`);
      console.log('✅ Restore result:', restoreResult);
      console.log('');
      
      // 6. Get APIs again (should include restored API)
      console.log('6. Getting APIs after restoration...');
      const apisAfterRestore = await makeRequest('GET', '/my-apis');
      console.log('✅ APIs after restoration:', apisAfterRestore);
    } else {
      console.log('⚠️  Please update TEST_API_ID with an actual API ID to test deletion');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Example usage of the new endpoints
console.log('📋 Available Soft Delete Endpoints:');
console.log('');
console.log('1. DELETE /api/:apiId - Soft delete an API');
console.log('   Example: DELETE /api/123e4567-e89b-12d3-a456-426614174000');
console.log('');
console.log('2. POST /api/:apiId/restore - Restore a soft-deleted API');
console.log('   Example: POST /api/123e4567-e89b-12d3-a456-426614174000/restore');
console.log('');
console.log('3. GET /my-apis/deleted - Get all soft-deleted APIs for a user');
console.log('   Example: GET /my-apis/deleted');
console.log('');
console.log('4. GET /my-apis - Get all active APIs (excludes soft-deleted)');
console.log('   Example: GET /my-apis');
console.log('');

// Run the test if this file is executed directly
if (require.main === module) {
  testSoftDelete();
}

module.exports = {
  testSoftDelete,
  makeRequest
};

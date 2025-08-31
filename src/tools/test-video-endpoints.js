#!/usr/bin/env node

/**
 * Test script for video upload endpoints
 * This script tests all video-related API endpoints
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/video`;

// Test video file path (create a small test video or use existing one)
const TEST_VIDEO_PATH = path.join(__dirname, '../../test-video.mp4');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function recordTest(success, testName) {
  testResults.total++;
  if (success) {
    testResults.passed++;
    logSuccess(`${testName} - PASSED`);
  } else {
    testResults.failed++;
    logError(`${testName} - FAILED`);
  }
}

// Helper function to create a test video file if it doesn't exist
function createTestVideo() {
  if (fs.existsSync(TEST_VIDEO_PATH)) {
    logInfo(`Test video already exists at: ${TEST_VIDEO_PATH}`);
    return;
  }

  logWarning(`Test video not found at: ${TEST_VIDEO_PATH}`);
  logInfo('Creating a minimal test video file...');
  
  // Create a minimal MP4 file (just headers, not playable but valid for testing)
  const minimalMp4 = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32,
    0x00, 0x00, 0x00, 0x00, 0x6D, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6F, 0x6D,
    0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65
  ]);
  
  try {
    fs.writeFileSync(TEST_VIDEO_PATH, minimalMp4);
    logSuccess(`Created test video file: ${TEST_VIDEO_PATH}`);
  } catch (error) {
    logError(`Failed to create test video: ${error.message}`);
    process.exit(1);
  }
}

// Test functions
async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    const success = response.status === 200 && response.data.status === 'ok';
    recordTest(success, 'Health Check');
    return success;
  } catch (error) {
    recordTest(false, 'Health Check');
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testVideoStats() {
  try {
    const response = await axios.get(`${API_ENDPOINT}/stats`);
    const success = response.status === 200 && response.data.success;
    recordTest(success, 'Get Video Stats');
    if (success) {
      logInfo(`Current video stats: ${JSON.stringify(response.data.data, null, 2)}`);
    }
    return success;
  } catch (error) {
    recordTest(false, 'Get Video Stats');
    logError(`Get video stats failed: ${error.message}`);
    return false;
  }
}

async function testVideoList() {
  try {
    const response = await axios.get(`${API_ENDPOINT}/list`);
    const success = response.status === 200 && response.data.success;
    recordTest(success, 'Get Video List');
    if (success) {
      logInfo(`Found ${response.data.data.videos.length} videos`);
    }
    return success;
  } catch (error) {
    recordTest(false, 'Get Video List');
    logError(`Get video list failed: ${error.message}`);
    return false;
  }
}

async function testVideoUpload() {
  try {
    // Check if test video exists
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      logError(`Test video not found: ${TEST_VIDEO_PATH}`);
      recordTest(false, 'Video Upload');
      return false;
    }

    // Create form data
    const form = new FormData();
    form.append('video', fs.createReadStream(TEST_VIDEO_PATH), {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });

    const response = await axios.post(`${API_ENDPOINT}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Content-Length': form.getLengthSync()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const success = response.status === 201 && response.data.success;
    recordTest(success, 'Video Upload');
    
    if (success) {
      logInfo(`Video uploaded successfully. ID: ${response.data.data.videoId}`);
      // Store the video ID for subsequent tests
      global.uploadedVideoId = response.data.data.videoId;
    }
    
    return success;
  } catch (error) {
    recordTest(false, 'Video Upload');
    logError(`Video upload failed: ${error.message}`);
    if (error.response) {
      logError(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

async function testVideoInfo() {
  if (!global.uploadedVideoId) {
    logWarning('Skipping video info test - no video uploaded');
    recordTest(false, 'Get Video Info');
    return false;
  }

  try {
    const response = await axios.get(`${API_ENDPOINT}/${global.uploadedVideoId}/info`);
    const success = response.status === 200 && response.data.success;
    recordTest(success, 'Get Video Info');
    
    if (success) {
      logInfo(`Video info: ${JSON.stringify(response.data.data, null, 2)}`);
    }
    
    return success;
  } catch (error) {
    recordTest(false, 'Get Video Info');
    logError(`Get video info failed: ${error.message}`);
    return false;
  }
}

async function testVideoStream() {
  if (!global.uploadedVideoId) {
    logWarning('Skipping video stream test - no video uploaded');
    recordTest(false, 'Video Stream');
    return false;
  }

  try {
    const response = await axios.get(`${API_ENDPOINT}/${global.uploadedVideoId}`, {
      responseType: 'arraybuffer',
      validateStatus: () => true // Don't throw on non-2xx status
    });
    
    const success = response.status === 200 && response.data.length > 0;
    recordTest(success, 'Video Stream');
    
    if (success) {
      logInfo(`Video streamed successfully. Size: ${response.data.length} bytes`);
    } else {
      logError(`Video stream failed. Status: ${response.status}, Size: ${response.data.length}`);
    }
    
    return success;
  } catch (error) {
    recordTest(false, 'Video Stream');
    logError(`Video stream failed: ${error.message}`);
    return false;
  }
}

async function testVideoDelete() {
  if (!global.uploadedVideoId) {
    logWarning('Skipping video delete test - no video uploaded');
    recordTest(false, 'Video Delete');
    return false;
  }

  try {
    const response = await axios.delete(`${API_ENDPOINT}/${global.uploadedVideoId}`);
    const success = response.status === 200 && response.data.success;
    recordTest(success, 'Video Delete');
    
    if (success) {
      logInfo('Video deleted successfully');
      global.uploadedVideoId = null;
    }
    
    return success;
  } catch (error) {
    recordTest(false, 'Video Delete');
    logError(`Video delete failed: ${error.message}`);
    return false;
  }
}

async function testInvalidVideoId() {
  try {
    const response = await axios.get(`${API_ENDPOINT}/999999/info`, {
      validateStatus: () => true
    });
    
    // Should return 404 for non-existent video
    const success = response.status === 404;
    recordTest(success, 'Invalid Video ID Handling');
    
    if (success) {
      logInfo('Correctly handled invalid video ID');
    } else {
      logWarning(`Expected 404, got ${response.status}`);
    }
    
    return success;
  } catch (error) {
    recordTest(false, 'Invalid Video ID Handling');
    logError(`Invalid video ID test failed: ${error.message}`);
    return false;
  }
}

async function testFileTypeValidation() {
  try {
    // Create a test text file
    const testTextPath = path.join(__dirname, '../../test-file.txt');
    fs.writeFileSync(testTextPath, 'This is a test file, not a video');
    
    const form = new FormData();
    form.append('video', fs.createReadStream(testTextPath), {
      filename: 'test-file.txt',
      contentType: 'text/plain'
    });

    const response = await axios.post(`${API_ENDPOINT}/upload`, form, {
      headers: form.getHeaders(),
      validateStatus: () => true
    });
    
    // Should return 400 for invalid file type
    const success = response.status === 400;
    recordTest(success, 'File Type Validation');
    
    if (success) {
      logInfo('Correctly rejected invalid file type');
    } else {
      logWarning(`Expected 400, got ${response.status}`);
    }
    
    // Clean up test file
    fs.unlinkSync(testTextPath);
    
    return success;
  } catch (error) {
    recordTest(false, 'File Type Validation');
    logError(`File type validation test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('🚀 Starting Video API Endpoint Tests', 'bright');
  log(`📍 Testing against: ${BASE_URL}`, 'cyan');
  log('─'.repeat(50), 'blue');
  
  // Create test video if needed
  createTestVideo();
  
  // Run tests in sequence
  await testHealthCheck();
  await testVideoStats();
  await testVideoList();
  await testVideoUpload();
  await testVideoInfo();
  await testVideoStream();
  await testVideoDelete();
  await testInvalidVideoId();
  await testFileTypeValidation();
  
  // Print results
  log('─'.repeat(50), 'blue');
  log('📊 Test Results Summary:', 'bright');
  log(`Total Tests: ${testResults.total}`, 'cyan');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  
  if (testResults.failed === 0) {
    log('🎉 All tests passed! Video API is working correctly.', 'green');
  } else {
    log('⚠️  Some tests failed. Please check the errors above.', 'yellow');
  }
  
  // Clean up test video if it was created
  if (fs.existsSync(TEST_VIDEO_PATH)) {
    try {
      fs.unlinkSync(TEST_VIDEO_PATH);
      logInfo('Cleaned up test video file');
    } catch (error) {
      logWarning(`Failed to clean up test video: ${error.message}`);
    }
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log('Video API Test Script', 'bright');
  log('Usage: node test-video-endpoints.js [options]', 'cyan');
  log('Options:', 'cyan');
  log('  --base-url <url>  Set the base URL for testing (default: http://localhost:3000)', 'cyan');
  log('  --help, -h        Show this help message', 'cyan');
  process.exit(0);
}

// Parse command line arguments
const baseUrlIndex = process.argv.indexOf('--base-url');
if (baseUrlIndex !== -1 && process.argv[baseUrlIndex + 1]) {
  process.env.API_BASE_URL = process.argv[baseUrlIndex + 1];
  log(`Using custom base URL: ${process.env.API_BASE_URL}`, 'yellow');
}

// Run tests
runTests().catch(error => {
  logError(`Test runner failed: ${error.message}`);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Test script for video streaming functionality
 * This script tests video upload and streaming to identify issues
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/video`;

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

async function testVideoEndpoints() {
  log('\n🎥 Testing Video Upload and Streaming Endpoints', 'bright');
  log('=' .repeat(50), 'blue');

  try {
    // 1. Test video stats first
    log('\n1️⃣ Testing video stats endpoint...', 'cyan');
    try {
      const statsResponse = await axios.get(`${API_ENDPOINT}/stats`);
      log(`✅ Stats endpoint working: ${statsResponse.data.data.totalVideos} videos`, 'green');
      console.log('Stats data:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      log(`❌ Stats endpoint failed: ${error.message}`, 'red');
    }

    // 2. Test video list
    log('\n2️⃣ Testing video list endpoint...', 'cyan');
    try {
      const listResponse = await axios.get(`${API_ENDPOINT}/list?limit=5`);
      log(`✅ List endpoint working: ${listResponse.data.data.videos.length} videos found`, 'green');
      
      if (listResponse.data.data.videos.length > 0) {
        const firstVideo = listResponse.data.data.videos[0];
        log(`📹 First video: ID=${firstVideo.id}, Name=${firstVideo.original_name}`, 'yellow');
        
        // 3. Test video info
        log('\n3️⃣ Testing video info endpoint...', 'cyan');
        try {
          const infoResponse = await axios.get(`${API_ENDPOINT}/${firstVideo.id}/info`);
          log(`✅ Info endpoint working for video ${firstVideo.id}`, 'green');
          console.log('Video info:', JSON.stringify(infoResponse.data, null, 2));
          
          // 4. Test video streaming
          log('\n4️⃣ Testing video streaming endpoint...', 'cyan');
          try {
            const streamResponse = await axios.get(`${API_ENDPOINT}/${firstVideo.id}`, {
              responseType: 'arraybuffer',
              headers: {
                'Range': 'bytes=0-1023' // Request first 1KB
              }
            });
            
            log(`✅ Streaming endpoint working for video ${firstVideo.id}`, 'green');
            log(`📊 Response status: ${streamResponse.status}`, 'yellow');
            log(`📦 Response size: ${streamResponse.data.byteLength} bytes`, 'yellow');
            log(`🔧 Content-Type: ${streamResponse.headers['content-type']}`, 'yellow');
            log(`📏 Content-Length: ${streamResponse.headers['content-length']}`, 'yellow');
            log(`🎯 Accept-Ranges: ${streamResponse.headers['accept-ranges']}`, 'yellow');
            
            // Check if we got video data
            if (streamResponse.data.byteLength > 0) {
              log(`✅ Video data received successfully!`, 'green');
              
              // Save a small sample for inspection
              const samplePath = path.join(__dirname, '../../video-sample.bin');
              fs.writeFileSync(samplePath, streamResponse.data);
              log(`💾 Sample saved to: ${samplePath}`, 'yellow');
            } else {
              log(`⚠️ No video data received`, 'yellow');
            }
            
          } catch (streamError) {
            log(`❌ Streaming failed: ${streamError.message}`, 'red');
            if (streamError.response) {
              log(`📊 Status: ${streamError.response.status}`, 'red');
              log(`📝 Response: ${streamError.response.data}`, 'red');
            }
          }
          
        } catch (infoError) {
          log(`❌ Info endpoint failed: ${infoError.message}`, 'red');
        }
      } else {
        log('⚠️ No videos found. You need to upload a video first!', 'yellow');
        log('💡 Use the upload endpoint to add a video before testing streaming.', 'yellow');
      }
      
    } catch (listError) {
      log(`❌ List endpoint failed: ${listError.message}`, 'red');
    }

    // 5. Test with a simple video file if available
    log('\n5️⃣ Testing video upload (if test file exists)...', 'cyan');
    const testVideoPath = path.join(__dirname, '../../test-video.mp4');
    
    if (fs.existsSync(testVideoPath)) {
      try {
        const formData = new FormData();
        formData.append('video', fs.createReadStream(testVideoPath));
        
        const uploadResponse = await axios.post(`${API_ENDPOINT}/upload`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
        
        log(`✅ Video upload successful!`, 'green');
        log(`📹 Video ID: ${uploadResponse.data.data.videoId}`, 'yellow');
        log(`📝 Filename: ${uploadResponse.data.data.filename}`, 'yellow');
        
        // Test streaming the newly uploaded video
        const newVideoId = uploadResponse.data.data.videoId;
        log(`\n6️⃣ Testing streaming for newly uploaded video ${newVideoId}...`, 'cyan');
        
        const newStreamResponse = await axios.get(`${API_ENDPOINT}/${newVideoId}`, {
          responseType: 'arraybuffer',
          headers: {
            'Range': 'bytes=0-1023'
          }
        });
        
        log(`✅ New video streaming working!`, 'green');
        log(`📊 Response size: ${newStreamResponse.data.byteLength} bytes`, 'yellow');
        
      } catch (uploadError) {
        log(`❌ Video upload failed: ${uploadError.message}`, 'red');
        if (uploadError.response) {
          log(`📊 Status: ${uploadError.response.status}`, 'red');
          log(`📝 Response: ${uploadError.response.data}`, 'red');
        }
      }
    } else {
      log('⚠️ No test video file found at test-video.mp4', 'yellow');
      log('💡 Create a small test video file to test upload functionality.', 'yellow');
    }

  } catch (error) {
    log(`❌ Test failed with error: ${error.message}`, 'red');
  }

  log('\n🏁 Video endpoint testing completed!', 'bright');
}

// Run the test
if (require.main === module) {
  testVideoEndpoints().catch(console.error);
}

module.exports = { testVideoEndpoints };

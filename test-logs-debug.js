const fetch = require('node-fetch');

async function testLogsDebug() {
  try {
    console.log('🧪 Testing logs debug...');
    
    // Test the admin logs endpoint to see what's actually in the logs
    const response = await fetch('https://backlify-v2.onrender.com/admin/logs?XAuthUserId=arifbabayev1&timeRange=last30days', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Logs response:');
    console.log(`Total logs: ${data.total}`);
    
    if (data.logs && data.logs.length > 0) {
      console.log('\n📈 Recent logs:');
      data.logs.slice(0, 5).forEach((log, index) => {
        console.log(`${index + 1}. ${log.endpoint} - ${log.method} - Status: ${log.status_code} - API Request: ${log.is_api_request}`);
      });
      
      // Count projects and requests
      const projectLogs = data.logs.filter(log => 
        log.endpoint === '/create-api-from-schema' && log.status_code === 200
      );
      
      const requestLogs = data.logs.filter(log => 
        log.is_api_request === true
      );
      
      console.log(`\n📊 Counts from logs:`);
      console.log(`- Project creations: ${projectLogs.length}`);
      console.log(`- API requests: ${requestLogs.length}`);
      
      if (projectLogs.length > 0) {
        console.log('\n📋 Project creation logs:');
        projectLogs.forEach((log, index) => {
          console.log(`${index + 1}. ${log.timestamp} - Status: ${log.status_code}`);
        });
      }
      
    } else {
      console.log('❌ No logs found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLogsDebug();

const fetch = require('node-fetch');

async function testDetailedLogs() {
  try {
    console.log('🧪 Testing detailed logs for ArifTest...');
    
    // Test the admin logs endpoint to see what's actually in the logs for ArifTest
    const response = await fetch('https://backlify-v2.onrender.com/admin/logs?XAuthUserId=ArifTest&timeRange=last30days', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Logs response for ArifTest:');
    console.log(`Total logs: ${data.total}`);
    
    if (data.logs && data.logs.length > 0) {
      console.log('\n📈 Recent logs for ArifTest:');
      data.logs.slice(0, 10).forEach((log, index) => {
        console.log(`${index + 1}. ${log.endpoint} - ${log.method} - Status: ${log.status_code} - API Request: ${log.is_api_request} - User: ${log.XAuthUserId}`);
      });
      
      // Count projects and requests specifically for ArifTest
      const projectLogs = data.logs.filter(log => 
        log.endpoint === '/create-api-from-schema' && log.status_code === 200 && log.XAuthUserId === 'ArifTest'
      );
      
      const requestLogs = data.logs.filter(log => 
        log.is_api_request === true && log.XAuthUserId === 'ArifTest'
      );
      
      console.log(`\n📊 Counts from logs for ArifTest:`);
      console.log(`- Project creations: ${projectLogs.length}`);
      console.log(`- API requests: ${requestLogs.length}`);
      
      if (projectLogs.length > 0) {
        console.log('\n📋 Project creation logs for ArifTest:');
        projectLogs.forEach((log, index) => {
          console.log(`${index + 1}. ${log.timestamp} - Status: ${log.status_code} - User: ${log.XAuthUserId}`);
        });
      }
      
      // Check if there are any logs with different XAuthUserId values
      const uniqueUsers = [...new Set(data.logs.map(log => log.XAuthUserId))];
      console.log(`\n👥 Unique users in logs: ${uniqueUsers.join(', ')}`);
      
    } else {
      console.log('❌ No logs found for ArifTest');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDetailedLogs();

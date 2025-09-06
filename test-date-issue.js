const fetch = require('node-fetch');

async function testDateIssue() {
  try {
    console.log('🧪 Testing date issue...');
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    console.log('Current date info:');
    console.log(`- Now: ${now.toISOString()}`);
    console.log(`- 30 days ago: ${thirtyDaysAgo.toISOString()}`);
    console.log(`- Current month: ${now.getMonth() + 1}`);
    console.log(`- Current year: ${now.getFullYear()}`);
    
    // Test with a broader date range to catch the September logs
    const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
    const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
    
    console.log(`- One year ago: ${oneYearAgo.toISOString()}`);
    console.log(`- One year from now: ${oneYearFromNow.toISOString()}`);
    
    // Test the admin logs endpoint with a broader range
    const response = await fetch('https://backlify-v2.onrender.com/admin/logs?XAuthUserId=arifbabayev1&timeRange=last30days', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.logs && data.logs.length > 0) {
      console.log('\n📊 Sample log timestamps:');
      data.logs.slice(0, 3).forEach((log, index) => {
        console.log(`${index + 1}. ${log.timestamp} - ${log.endpoint}`);
      });
      
      // Check if any logs are in the future
      const futureLogs = data.logs.filter(log => new Date(log.timestamp) > now);
      console.log(`\n📅 Future logs found: ${futureLogs.length}`);
      
      if (futureLogs.length > 0) {
        console.log('Future log examples:');
        futureLogs.slice(0, 3).forEach((log, index) => {
          console.log(`${index + 1}. ${log.timestamp} - ${log.endpoint}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDateIssue();

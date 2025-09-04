const ApiUsageService = require('../services/apiUsageService');
require('dotenv').config();

async function resetMonthlyApiUsage() {
  try {
    console.log('Starting monthly API usage reset...');
    
    const apiUsageService = new ApiUsageService();
    const success = await apiUsageService.resetMonthlyApiUsage();
    
    if (success) {
      console.log('✅ Monthly API usage reset completed successfully!');
      console.log('All APIs\' request and project counts have been reset to 0 for the new month.');
    } else {
      console.log('❌ Failed to reset monthly API usage');
    }
  } catch (error) {
    console.error('❌ Error resetting monthly API usage:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  resetMonthlyApiUsage()
    .then(() => {
      console.log('\n🎉 Script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetMonthlyApiUsage };

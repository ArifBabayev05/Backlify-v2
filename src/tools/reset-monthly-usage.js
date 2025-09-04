const UsageService = require('../services/usageService');
require('dotenv').config();

async function resetMonthlyUsage() {
  try {
    console.log('Starting monthly usage reset...');
    
    const usageService = new UsageService();
    const success = await usageService.resetMonthlyUsage();
    
    if (success) {
      console.log('✅ Monthly usage reset completed successfully!');
      console.log('All users\' request and project counts have been reset to 0 for the new month.');
    } else {
      console.log('❌ Failed to reset monthly usage');
    }
  } catch (error) {
    console.error('❌ Error resetting monthly usage:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  resetMonthlyUsage()
    .then(() => {
      console.log('\n🎉 Script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetMonthlyUsage };

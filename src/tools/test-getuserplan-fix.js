const { createClient } = require('@supabase/supabase-js');
const ApiUsageService = require('../src/services/apiUsageService');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testGetUserPlanFix() {
  console.log('🧪 Testing getUserPlan fix...');
  
  try {
    const apiUsageService = new ApiUsageService();
    
    // Test with the actual user
    const username = 'asda';
    
    console.log('🔍 Testing getUserPlan for username:', username);
    const userPlan = await apiUsageService.getUserPlan(username);
    
    console.log('✅ getUserPlan result:', userPlan);
    
    // Expected result should be 'pro' based on the subscription data
    if (userPlan === 'pro') {
      console.log('🎉 SUCCESS: User plan is correctly identified as "pro"!');
      return true;
    } else {
      console.log('❌ FAILED: User plan should be "pro" but got:', userPlan);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testGetUserPlanFix()
    .then((success) => {
      if (success) {
        console.log('\n✅ getUserPlan fix test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ getUserPlan fix test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testGetUserPlanFix };

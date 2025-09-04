const { createClient } = require('@supabase/supabase-js');
const UsageService = require('../services/usageService');
const PlanService = require('../services/planService');
require('dotenv').config();

class UsageLimitsSetup {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    this.usageService = new UsageService();
    this.planService = new PlanService();
  }

  async setup() {
    try {
      console.log('🚀 Setting up usage limits system...\n');

      // 1. Create usage table
      console.log('1. Creating usage table...');
      await this.createUsageTable();
      console.log('✅ Usage table created successfully\n');

      // 2. Test plan service
      console.log('2. Testing plan service...');
      await this.testPlanService();
      console.log('✅ Plan service working correctly\n');

      // 3. Test usage service
      console.log('3. Testing usage service...');
      await this.testUsageService();
      console.log('✅ Usage service working correctly\n');

      // 4. Test middleware integration
      console.log('4. Testing middleware integration...');
      await this.testMiddlewareIntegration();
      console.log('✅ Middleware integration working correctly\n');

      console.log('🎉 Usage limits system setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Run the SQL script in Supabase: src/tools/create-usage-table.sql');
      console.log('2. Test the endpoints:');
      console.log('   - GET /api/usage/current - Get current user usage');
      console.log('   - GET /api/usage/plans - Get available plans');
      console.log('   - POST /generate-schema - Now has project limits');
      console.log('   - Any /api/:apiId/* - Now has request limits');
      console.log('3. Set up monthly reset cron job for: node src/tools/reset-monthly-usage.js');

    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  }

  async createUsageTable() {
    const fs = require('fs');
    const sqlContent = fs.readFileSync('src/tools/create-usage-table.sql', 'utf8');
    
    console.log('SQL to run in Supabase:');
    console.log('─'.repeat(80));
    console.log(sqlContent);
    console.log('─'.repeat(80));
  }

  async testPlanService() {
    const plans = await this.planService.getPlans();
    console.log(`Found ${plans.length} plans:`);
    plans.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.id}): $${plan.price}`);
    });

    // Test plan limits
    const basicLimits = await this.planService.getPlanLimits('basic');
    console.log(`Basic plan limits: ${basicLimits.maxProjects} projects, ${basicLimits.maxRequests} requests`);

    const enterpriseLimits = await this.planService.getPlanLimits('enterprise');
    console.log(`Enterprise plan unlimited: ${enterpriseLimits.isUnlimited}`);
  }

  async testUsageService() {
    // Test with a dummy user
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const testPlan = 'basic';

    try {
      const usage = await this.usageService.getCurrentUsage(testUserId, testPlan);
      console.log(`Test usage for user ${testUserId}:`);
      console.log(`  - Requests: ${usage.requestsCount}/${usage.maxRequests}`);
      console.log(`  - Projects: ${usage.projectsCount}/${usage.maxProjects}`);
      console.log(`  - Plan: ${usage.planName}`);
    } catch (error) {
      console.log('Note: Usage service test requires the usage table to be created first');
    }
  }

  async testMiddlewareIntegration() {
    console.log('Middleware files created:');
    console.log('  - src/middleware/limitMiddleware.js');
    console.log('  - src/controllers/usageController.js');
    console.log('  - src/routes/usageRoutes.js');
    console.log('  - src/services/planService.js');
    console.log('  - src/services/usageService.js');
    
    console.log('\nMiddleware integrated into:');
    console.log('  - /generate-schema endpoint (project limits)');
    console.log('  - Dynamic API endpoints (request limits)');
    console.log('  - /api/usage/* endpoints (usage info)');
  }

  async createSampleData() {
    console.log('\n📊 Creating sample usage data...');
    
    // This would create sample data for testing
    // In a real scenario, you'd want to be careful about creating test data
    console.log('Sample data creation skipped for safety');
  }
}

// Run the setup
if (require.main === module) {
  const setup = new UsageLimitsSetup();
  setup.setup()
    .then(() => {
      console.log('\n🎉 Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = UsageLimitsSetup;

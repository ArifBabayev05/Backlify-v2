#!/usr/bin/env node

/**
 * Insert Default Payment Plans Script
 * This script inserts default payment plans into the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function insertPaymentPlans() {
  console.log('🚀 Inserting default payment plans...\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    console.log('📡 Connecting to database...');

    const sql = `
      INSERT INTO payment_plans (plan_id, name, price, currency, features, is_active) VALUES
      ('basic', 'Basic Plan', 0.00, 'USD', '["Basic API access", "1000 requests/month", "Email support"]', TRUE),
      ('pro', 'Pro Plan', 9.99, 'USD', '["Pro API access", "10000 requests/month", "Priority support", "Custom true"]', TRUE),
      ('enterprise', 'Enterprise Plan', 29.99, 'USD', '["Enterprise API access", "Unlimited requests", "24/7 support", "Custom true"]', TRUE)
      ON CONFLICT (plan_id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        features = EXCLUDED.features,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `;

    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Error inserting payment plans:', error);
      return;
    }

    console.log('✅ Payment plans inserted successfully!');
    console.log('Response data:', data);

    // Verify the plans were inserted
    console.log('\n🔍 Verifying inserted plans...');
    const { data: plans, error: fetchError } = await supabase
      .from('payment_plans')
      .select('plan_id, name, price, currency, features')
      .order('price', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching plans:', fetchError);
      return;
    }

    console.log('📋 Available payment plans:');
    plans.forEach(plan => {
      console.log(`  - ${plan.plan_id}: ${plan.name} (${plan.price} ${plan.currency})`);
      console.log(`    Features: ${plan.features.join(', ')}`);
    });

    console.log('\n🎉 Payment plans setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  insertPaymentPlans();
}

module.exports = { insertPaymentPlans };

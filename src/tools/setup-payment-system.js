#!/usr/bin/env node

/**
 * Payment System Setup Script
 * This script initializes all necessary database tables for the payment system
 */

const { createClient } = require('@supabase/supabase-js');
const { createPaymentTables } = require('../utils/setup/paymentTables');
require('dotenv').config();

async function setupPaymentSystem() {
  console.log('🚀 Starting Payment System Setup...\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    console.log('📡 Connecting to database...');
    
    // Test connection
    const { data, error } = await supabase
      .from('payment_plans')
      .select('count')
      .limit(1);

    if (error && error.code === '42P01') {
      // Table doesn't exist, create it
      console.log('📋 Creating payment system tables...');
      
      // Execute the table creation SQL
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createPaymentTables
      });

      if (createError) {
        console.error('❌ Error creating tables:', createError);
        
        // Fallback: try direct SQL execution
        console.log('🔄 Trying alternative table creation method...');
        
        // Create tables one by one
        await createTablesIndividually(supabase);
      } else {
        console.log('✅ Tables created successfully!');
      }
    } else if (error) {
      console.error('❌ Database connection error:', error);
      return;
    } else {
      console.log('✅ Payment system tables already exist!');
    }

    // Verify tables exist
    console.log('\n🔍 Verifying table structure...');
    await verifyTables(supabase);

    console.log('\n🎉 Payment System Setup Complete!');
    console.log('\n📋 Available endpoints:');
    console.log('  GET  /api/payment/plans');
    console.log('  POST /api/payment/order');
    console.log('  GET  /api/payment/history');
    console.log('  GET  /api/payment/subscription');
    console.log('  GET  /api/payment/check-subscription');
    console.log('  POST /api/epoint-callback');
    console.log('  GET  /api/payment/success');
    console.log('  GET  /api/payment/cancel');
    
    console.log('\n🔧 Environment variables needed:');
    console.log('  EPOINT_PRIVATE_KEY');
    console.log('  EPOINT_MERCHANT_ID');
    console.log('  EPOINT_API_URL');
    console.log('  BASE_URL');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function createTablesIndividually(supabase) {
  console.log('📋 Creating tables individually...');
  
  const tables = [
    {
      name: 'payment_plans',
      sql: `
        CREATE TABLE IF NOT EXISTS payment_plans (
          id SERIAL PRIMARY KEY,
          plan_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          features JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'payment_orders',
      sql: `
        CREATE TABLE IF NOT EXISTS payment_orders (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          plan_id VARCHAR(50) NOT NULL,
          api_id VARCHAR(100),
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          status VARCHAR(20) DEFAULT 'pending',
          payment_transaction_id VARCHAR(100),
          payment_details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'user_subscriptions',
      sql: `
        CREATE TABLE IF NOT EXISTS user_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          plan_id VARCHAR(50) NOT NULL,
          api_id VARCHAR(100),
          status VARCHAR(20) DEFAULT 'active',
          start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'payment_transactions',
      sql: `
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES payment_orders(id),
          transaction_id VARCHAR(100) UNIQUE NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'AZN',
          status VARCHAR(20) NOT NULL,
          payment_method VARCHAR(50),
          gateway_response JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }
  ];

  for (const table of tables) {
    try {
      console.log(`  Creating ${table.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      
      if (error) {
        console.log(`    ⚠️  Warning: Could not create ${table.name}:`, error.message);
      } else {
        console.log(`    ✅ ${table.name} created successfully`);
      }
    } catch (err) {
      console.log(`    ⚠️  Warning: Could not create ${table.name}:`, err.message);
    }
  }

  // Insert default plans
  console.log('📝 Inserting default payment plans...');
  await insertDefaultPlans(supabase);
}

async function insertDefaultPlans(supabase) {
  const plans = [
    {
      plan_id: 'basic',
      name: 'Basic Plan',
      price: 9.99,
      currency: 'AZN',
      features: ['Basic API access', '1000 requests/month', 'Email support']
    },
    {
      plan_id: 'pro',
      name: 'Pro Plan',
      price: 19.99,
      currency: 'AZN',
      features: ['Pro API access', '10000 requests/month', 'Priority support', 'Custom domains']
    },
    {
      plan_id: 'enterprise',
      name: 'Enterprise Plan',
      price: 49.99,
      currency: 'AZN',
      features: ['Enterprise API access', 'Unlimited requests', '24/7 support', 'Custom integrations', 'SLA guarantee']
    }
  ];

  for (const plan of plans) {
    try {
      const { error } = await supabase
        .from('payment_plans')
        .upsert(plan, { onConflict: 'plan_id' });

      if (error) {
        console.log(`    ⚠️  Warning: Could not insert ${plan.plan_id}:`, error.message);
      } else {
        console.log(`    ✅ ${plan.plan_id} plan inserted/updated`);
      }
    } catch (err) {
      console.log(`    ⚠️  Warning: Could not insert ${plan.plan_id}:`, err.message);
    }
  }
}

async function verifyTables(supabase) {
  const tables = ['payment_plans', 'payment_orders', 'user_subscriptions', 'payment_transactions'];
  
  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`  ❌ ${tableName}: ${error.message}`);
      } else {
        console.log(`  ✅ ${tableName}: Table accessible`);
      }
    } catch (err) {
      console.log(`  ❌ ${tableName}: ${err.message}`);
    }
  }

  // Check if default plans exist
  try {
    const { data, error } = await supabase
      .from('payment_plans')
      .select('plan_id, name, price')
      .order('price');

    if (error) {
      console.log('  ❌ Could not verify payment plans');
    } else {
      console.log('  ✅ Payment plans verified:');
      data.forEach(plan => {
        console.log(`    - ${plan.plan_id}: ${plan.name} (${plan.price} ${plan.currency})`);
      });
    }
  } catch (err) {
    console.log('  ❌ Could not verify payment plans:', err.message);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupPaymentSystem();
}

module.exports = { setupPaymentSystem };

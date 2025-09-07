const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testSubscriptionSimple() {
  console.log('🧪 Testing subscription flow (Simple)...');
  
  try {
    // Test 1: Check payment plans
    console.log('\n1️⃣ Testing payment plans...');
    
    const { data: plans, error: plansError } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('is_active', true);
    
    if (plansError) {
      console.error('❌ Error fetching payment plans:', plansError);
      return false;
    }
    
    console.log(`✅ Found ${plans.length} active payment plans:`);
    plans.forEach(plan => {
      console.log(`   - ${plan.plan_id}: ${plan.name} (${plan.price} ${plan.currency})`);
    });
    
    // Test 2: Test payment order creation with RLS bypass
    console.log('\n2️⃣ Testing payment order creation...');
    
    const testUserId = '00000000-0000-0000-0000-000000000001';
    const testOrderId = `TEST_${Date.now()}_${testUserId}`;
    
    // Use direct SQL to bypass RLS
    const { data: order, error: orderError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          INSERT INTO payment_orders (
            order_id, user_id, plan_id, amount, currency, 
            description, status, payment_method
          ) VALUES (
            '${testOrderId}', 
            '${testUserId}', 
            'pro', 
            0.01, 
            'AZN', 
            'Test subscription upgrade', 
            'pending', 
            'epoint'
          ) RETURNING *;
        `
      });
    
    if (orderError) {
      console.error('❌ Error creating payment order:', orderError);
      return false;
    }
    
    console.log('✅ Payment order created successfully');
    
    // Test 3: Test subscription creation
    console.log('\n3️⃣ Testing subscription creation...');
    
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    
    const { data: subscription, error: subError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          INSERT INTO user_subscriptions (
            user_id, plan_id, status, start_date, 
            expiration_date, payment_order_id
          ) VALUES (
            '${testUserId}', 
            'pro', 
            'active', 
            NOW(), 
            '${expirationDate.toISOString()}', 
            ${order[0].id}
          ) RETURNING *;
        `
      });
    
    if (subError) {
      console.error('❌ Error creating subscription:', subError);
      return false;
    }
    
    console.log('✅ Subscription created successfully');
    
    // Test 4: Test foreign key relationship
    console.log('\n4️⃣ Testing foreign key relationship...');
    
    const { data: subWithOrder, error: fkError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            us.*,
            po.order_id,
            po.amount,
            po.status as order_status
          FROM user_subscriptions us
          INNER JOIN payment_orders po ON us.payment_order_id = po.id
          WHERE us.id = ${subscription[0].id};
        `
      });
    
    if (fkError) {
      console.error('❌ Error testing foreign key relationship:', fkError);
      return false;
    }
    
    console.log('✅ Foreign key relationship works');
    console.log('   - Subscription ID:', subWithOrder[0].id);
    console.log('   - Order ID:', subWithOrder[0].order_id);
    console.log('   - Order Amount:', subWithOrder[0].amount);
    
    // Test 5: Cleanup
    console.log('\n5️⃣ Cleaning up test data...');
    
    await supabase.rpc('execute_sql', {
      sql_query: `DELETE FROM user_subscriptions WHERE id = ${subscription[0].id};`
    });
    
    await supabase.rpc('execute_sql', {
      sql_query: `DELETE FROM payment_orders WHERE id = ${order[0].id};`
    });
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! Subscription flow is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testSubscriptionSimple()
    .then((success) => {
      if (success) {
        console.log('\n✅ All subscription flow tests passed!');
        process.exit(0);
      } else {
        console.log('\n❌ Some tests failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSubscriptionSimple };

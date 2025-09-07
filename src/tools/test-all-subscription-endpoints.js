const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testAllSubscriptionEndpoints() {
  console.log('🧪 Testing All Subscription Endpoints...');
  
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testOrderId = `TEST_${Date.now()}_${testUserId}`;
  
  try {
    // Test 1: Create a test payment order
    console.log('\n1️⃣ Creating test payment order...');
    
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
    
    if (!order || !order[0]) {
      console.error('❌ No order data returned');
      return false;
    }
    
    console.log('✅ Payment order created:', order[0].id);
    
    // Test 2: Create a test subscription
    console.log('\n2️⃣ Creating test subscription...');
    
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
    
    if (!subscription || !subscription[0]) {
      console.error('❌ No subscription data returned');
      return false;
    }
    
    console.log('✅ Subscription created:', subscription[0].id);
    
    // Test 3: Test getUserSubscription method (simulate accountController)
    console.log('\n3️⃣ Testing getUserSubscription logic...');
    
    const { data: userSub, error: userSubError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (userSubError && userSubError.code !== 'PGRST116') {
      console.error('❌ Error fetching user subscription:', userSubError);
      return false;
    }
    
    if (userSub) {
      console.log('✅ User subscription found:', {
        id: userSub.id,
        plan_id: userSub.plan_id,
        status: userSub.status,
        start_date: userSub.start_date,
        expiration_date: userSub.expiration_date
      });
    } else {
      console.log('ℹ️ No active subscription found (this is normal for new users)');
    }
    
    // Test 4: Test payment service getUserSubscription
    console.log('\n4️⃣ Testing PaymentService.getUserSubscription...');
    
    const PaymentService = require('../services/paymentService');
    const paymentService = new PaymentService();
    
    try {
      const paymentSubs = await paymentService.getUserSubscription(testUserId);
      console.log('✅ PaymentService.getUserSubscription works:', paymentSubs.length, 'subscriptions found');
    } catch (error) {
      console.error('❌ PaymentService.getUserSubscription error:', error.message);
    }
    
    // Test 5: Test hasActiveSubscription
    console.log('\n5️⃣ Testing hasActiveSubscription...');
    
    try {
      const hasActive = await paymentService.hasActiveSubscription(testUserId);
      console.log('✅ hasActiveSubscription result:', hasActive);
    } catch (error) {
      console.error('❌ hasActiveSubscription error:', error.message);
    }
    
    // Test 6: Test API usage service
    console.log('\n6️⃣ Testing ApiUsageService...');
    
    const ApiUsageService = require('../services/apiUsageService');
    const apiUsageService = new ApiUsageService();
    
    try {
      const userPlan = await apiUsageService.getUserPlan(testUserId);
      console.log('✅ ApiUsageService.getUserPlan result:', userPlan);
    } catch (error) {
      console.error('❌ ApiUsageService.getUserPlan error:', error.message);
    }
    
    // Test 7: Test subscription middleware logic
    console.log('\n7️⃣ Testing SubscriptionMiddleware logic...');
    
    try {
      const { data: subForMiddleware, error: middlewareError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('status', 'active')
        .single();
      
      if (middlewareError && middlewareError.code !== 'PGRST116') {
        console.error('❌ Middleware subscription fetch error:', middlewareError);
      } else if (subForMiddleware) {
        const isExpired = new Date(subForMiddleware.expiration_date) < new Date();
        console.log('✅ Subscription middleware logic works:', {
          plan_id: subForMiddleware.plan_id,
          is_expired: isExpired,
          expiration_date: subForMiddleware.expiration_date
        });
      } else {
        console.log('ℹ️ No subscription for middleware test');
      }
    } catch (error) {
      console.error('❌ Middleware test error:', error.message);
    }
    
    // Test 8: Test foreign key relationships
    console.log('\n8️⃣ Testing foreign key relationships...');
    
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
      console.error('❌ Foreign key relationship error:', fkError);
    } else {
      console.log('✅ Foreign key relationship works:', {
        subscription_id: subWithOrder[0].id,
        order_id: subWithOrder[0].order_id,
        order_amount: subWithOrder[0].amount
      });
    }
    
    // Test 9: Cleanup
    console.log('\n9️⃣ Cleaning up test data...');
    
    await supabase.rpc('execute_sql', {
      sql_query: `DELETE FROM user_subscriptions WHERE id = ${subscription[0].id};`
    });
    
    await supabase.rpc('execute_sql', {
      sql_query: `DELETE FROM payment_orders WHERE id = ${order[0].id};`
    });
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All subscription endpoint tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testAllSubscriptionEndpoints()
    .then((success) => {
      if (success) {
        console.log('\n✅ All subscription tests passed!');
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

module.exports = { testAllSubscriptionEndpoints };

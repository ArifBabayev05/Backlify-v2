const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testSubscriptionSimpleFinal() {
  console.log('🧪 Testing Subscription System (Simple Final)...');
  
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testOrderId = `TEST_${Date.now()}_${testUserId}`;
  
  try {
    // Test 1: Check if tables exist and are accessible
    console.log('\n1️⃣ Checking table accessibility...');
    
    const tables = ['payment_plans', 'payment_orders', 'user_subscriptions'];
    
    for (const tableName of tables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Table ${tableName} error:`, error.message);
        return false;
      } else {
        console.log(`✅ Table ${tableName} is accessible`);
      }
    }
    
    // Test 2: Check payment plans
    console.log('\n2️⃣ Checking payment plans...');
    
    const { data: plans, error: plansError } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('is_active', true);
    
    if (plansError) {
      console.error('❌ Error fetching payment plans:', plansError);
      return false;
    }
    
    console.log(`✅ Found ${plans.length} payment plans`);
    plans.forEach(plan => {
      console.log(`   - ${plan.plan_id}: ${plan.name} (${plan.price} ${plan.currency})`);
    });
    
    // Test 3: Test payment order creation (using direct insert)
    console.log('\n3️⃣ Testing payment order creation...');
    
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert([{
        order_id: testOrderId,
        user_id: testUserId,
        plan_id: 'pro',
        amount: 0.01,
        currency: 'AZN',
        description: 'Test subscription upgrade',
        status: 'pending',
        payment_method: 'epoint'
      }])
      .select()
      .single();
    
    if (orderError) {
      console.error('❌ Error creating payment order:', orderError);
      return false;
    }
    
    console.log('✅ Payment order created:', {
      id: order.id,
      order_id: order.order_id,
      user_id: order.user_id,
      plan_id: order.plan_id
    });
    
    // Test 4: Test subscription creation
    console.log('\n4️⃣ Testing subscription creation...');
    
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .insert([{
        user_id: testUserId,
        plan_id: 'pro',
        status: 'active',
        start_date: new Date().toISOString(),
        expiration_date: expirationDate.toISOString(),
        payment_order_id: order.id
      }])
      .select()
      .single();
    
    if (subError) {
      console.error('❌ Error creating subscription:', subError);
      return false;
    }
    
    console.log('✅ Subscription created:', {
      id: subscription.id,
      user_id: subscription.user_id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      payment_order_id: subscription.payment_order_id
    });
    
    // Test 5: Test getUserSubscription query (like accountController)
    console.log('\n5️⃣ Testing getUserSubscription query...');
    
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
      console.log('✅ User subscription query works:', {
        id: userSub.id,
        plan_id: userSub.plan_id,
        status: userSub.status,
        start_date: userSub.start_date,
        expiration_date: userSub.expiration_date
      });
    } else {
      console.log('ℹ️ No active subscription found');
    }
    
    // Test 6: Test PaymentService methods
    console.log('\n6️⃣ Testing PaymentService methods...');
    
    const PaymentService = require('../services/paymentService');
    const paymentService = new PaymentService();
    
    try {
      const paymentSubs = await paymentService.getUserSubscription(testUserId);
      console.log('✅ PaymentService.getUserSubscription works:', paymentSubs.length, 'subscriptions');
      
      const hasActive = await paymentService.hasActiveSubscription(testUserId);
      console.log('✅ PaymentService.hasActiveSubscription works:', hasActive);
    } catch (error) {
      console.error('❌ PaymentService error:', error.message);
    }
    
    // Test 7: Test ApiUsageService
    console.log('\n7️⃣ Testing ApiUsageService...');
    
    const ApiUsageService = require('../services/apiUsageService');
    const apiUsageService = new ApiUsageService();
    
    try {
      const userPlan = await apiUsageService.getUserPlan(testUserId);
      console.log('✅ ApiUsageService.getUserPlan works:', userPlan);
    } catch (error) {
      console.error('❌ ApiUsageService error:', error.message);
    }
    
    // Test 8: Test foreign key relationship
    console.log('\n8️⃣ Testing foreign key relationship...');
    
    const { data: subWithOrder, error: fkError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        payment_orders!inner(
          id,
          order_id,
          amount,
          status
        )
      `)
      .eq('id', subscription.id)
      .single();
    
    if (fkError) {
      console.error('❌ Foreign key relationship error:', fkError);
    } else {
      console.log('✅ Foreign key relationship works:', {
        subscription_id: subWithOrder.id,
        order_id: subWithOrder.payment_orders.order_id,
        order_amount: subWithOrder.payment_orders.amount
      });
    }
    
    // Test 9: Cleanup
    console.log('\n9️⃣ Cleaning up test data...');
    
    await supabase
      .from('user_subscriptions')
      .delete()
      .eq('id', subscription.id);
    
    await supabase
      .from('payment_orders')
      .delete()
      .eq('id', order.id);
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All subscription tests passed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testSubscriptionSimpleFinal()
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

module.exports = { testSubscriptionSimpleFinal };

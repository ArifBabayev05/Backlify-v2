const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testAllPaymentFixes() {
  console.log('🧪 Testing all payment fixes...');
  
  try {
    // Test 1: Create a test order
    console.log('\n1️⃣ Creating test order...');
    const testOrderId = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert([{
        order_id: testOrderId,
        user_id: 'asda',
        plan_id: 'pro',
        amount: 0.01,
        currency: 'AZN',
        description: 'Test order for payment fixes',
        status: 'pending',
        payment_method: 'epoint'
      }])
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating test order:', orderError);
      return false;
    }
    
    console.log(`✅ Test order created: ${testOrderId}`);
    console.log(`   - Database ID: ${order.id}`);
    console.log(`   - Order ID: ${order.order_id}`);
    console.log(`   - Status: ${order.status}`);

    // Test 2: Update order status using order_id (this was the bug)
    console.log('\n2️⃣ Testing order status update using order_id...');
    
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        payment_transaction_id: 'test_transaction_123',
        payment_details: { test: true },
        updated_at: new Date().toISOString()
      })
      .eq('order_id', testOrderId); // This should work now

    if (updateError) {
      console.error('❌ Error updating order status:', updateError);
      return false;
    }
    
    console.log('✅ Order status updated successfully using order_id');

    // Test 3: Verify the update worked
    console.log('\n3️⃣ Verifying order status update...');
    
    const { data: updatedOrder, error: verifyError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', testOrderId)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return false;
    }
    
    console.log('📊 Updated order:');
    console.log(`   - Status: ${updatedOrder.status}`);
    console.log(`   - Payment Transaction ID: ${updatedOrder.payment_transaction_id}`);
    console.log(`   - Updated At: ${updatedOrder.updated_at}`);

    // Test 4: Test plan activation
    console.log('\n4️⃣ Testing plan activation...');
    
    // Get user UUID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'asda')
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return false;
    }

    const actualUserId = user.id;
    console.log(`📋 User UUID: ${actualUserId}`);

    // Calculate expiration date (1 year from now)
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    // Create subscription
    const subscriptionData = {
      user_id: actualUserId,
      plan_id: 'pro',
      status: 'active',
      start_date: new Date().toISOString(),
      expiration_date: expirationDate.toISOString(),
      payment_order_id: order.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .insert([subscriptionData])
      .select()
      .single();

    if (subscriptionError) {
      console.error('❌ Error creating subscription:', subscriptionError);
      return false;
    }
    
    console.log('✅ Subscription created successfully');
    console.log(`   - Plan: ${subscription.plan_id}`);
    console.log(`   - Status: ${subscription.status}`);

    // Test 5: Test subscription endpoint logic
    console.log('\n5️⃣ Testing subscription endpoint logic...');
    
    const { data: userSub, error: userSubError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', actualUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (userSubError) {
      console.error('❌ Error fetching user subscription:', userSubError);
      return false;
    }
    
    console.log('✅ Subscription endpoint logic works:');
    console.log(`   - Plan: ${userSub.plan_id}`);
    console.log(`   - Status: ${userSub.status}`);
    console.log(`   - Start: ${userSub.start_date}`);
    console.log(`   - End: ${userSub.expiration_date}`);

    // Cleanup: Delete test order
    console.log('\n6️⃣ Cleaning up test data...');
    
    const { error: deleteError } = await supabase
      .from('payment_orders')
      .delete()
      .eq('order_id', testOrderId);
    
    if (deleteError) {
      console.log('⚠️ Warning: Could not delete test order:', deleteError.message);
    } else {
      console.log('✅ Test order cleaned up');
    }

    console.log('\n🎉 All payment fixes test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testAllPaymentFixes()
    .then((success) => {
      if (success) {
        console.log('\n✅ All payment fixes test passed!');
        process.exit(0);
      } else {
        console.log('\n❌ All payment fixes test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testAllPaymentFixes };

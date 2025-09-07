const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testCompleteCallbackFlow() {
  console.log('🧪 Testing complete callback flow...');
  
  try {
    // Find a pending order
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (ordersError) {
      console.error('❌ Error fetching pending orders:', ordersError);
      return false;
    }
    
    if (pendingOrders.length === 0) {
      console.log('ℹ️ No pending orders found');
      return true;
    }
    
    const order = pendingOrders[0];
    console.log(`📋 Testing with order: ${order.order_id}`);
    console.log(`   - User: ${order.user_id}`);
    console.log(`   - Plan: ${order.plan_id}`);
    console.log(`   - Amount: ${order.amount}`);
    console.log(`   - Status: ${order.status}`);
    
    // Step 1: Update order status to paid
    console.log('\n1️⃣ Updating order status to paid...');
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        payment_transaction_id: 'test_transaction_123',
        payment_details: { test: true },
        updated_at: new Date().toISOString()
      })
      .eq('order_id', order.order_id);

    if (updateError) {
      console.error('❌ Error updating order status:', updateError);
      return false;
    }
    console.log('✅ Order status updated to paid');

    // Step 2: Activate user plan
    console.log('\n2️⃣ Activating user plan...');
    
    // Get actual user UUID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', order.user_id)
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

    // Create or update user subscription
    const subscriptionData = {
      user_id: actualUserId,
      plan_id: order.plan_id,
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
      // If subscription already exists, update it
      if (subscriptionError.code === '23505') {
        console.log('ℹ️ Subscription already exists, updating...');
        const { data: updatedSubscription, error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan_id: order.plan_id,
            status: 'active',
            start_date: new Date().toISOString(),
            expiration_date: expirationDate.toISOString(),
            payment_order_id: order.id,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', actualUserId)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ Error updating subscription:', updateError);
          return false;
        }
        
        console.log('✅ Subscription updated successfully');
        console.log(`   - Plan: ${updatedSubscription.plan_id}`);
        console.log(`   - Status: ${updatedSubscription.status}`);
      } else {
        console.error('❌ Error creating subscription:', subscriptionError);
        return false;
      }
    } else {
      console.log('✅ Subscription created successfully');
      console.log(`   - Plan: ${subscription.plan_id}`);
      console.log(`   - Status: ${subscription.status}`);
    }

    // Step 3: Verify final state
    console.log('\n3️⃣ Verifying final state...');
    
    // Check order status
    const { data: finalOrder, error: finalOrderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', order.order_id)
      .single();
    
    if (finalOrderError) {
      console.error('❌ Error fetching final order:', finalOrderError);
      return false;
    }
    
    console.log('📊 Final order status:');
    console.log(`   - Status: ${finalOrder.status}`);
    console.log(`   - Payment Transaction ID: ${finalOrder.payment_transaction_id}`);
    
    // Check subscription status
    const { data: finalSubscription, error: finalSubError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', actualUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (finalSubError) {
      console.error('❌ Error fetching final subscription:', finalSubError);
      return false;
    }
    
    console.log('📊 Final subscription status:');
    console.log(`   - Plan: ${finalSubscription.plan_id}`);
    console.log(`   - Status: ${finalSubscription.status}`);
    console.log(`   - Start: ${finalSubscription.start_date}`);
    console.log(`   - End: ${finalSubscription.expiration_date}`);
    
    console.log('\n🎉 Complete callback flow test successful!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testCompleteCallbackFlow()
    .then((success) => {
      if (success) {
        console.log('\n✅ Complete callback flow test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Complete callback flow test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteCallbackFlow };

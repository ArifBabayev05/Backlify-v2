const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testCallbackActivation() {
  console.log('🧪 Testing callback plan activation...');
  
  try {
    // First, let's check if there are any pending orders
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (ordersError) {
      console.error('❌ Error fetching pending orders:', ordersError);
      return false;
    }
    
    console.log(`📊 Found ${pendingOrders.length} pending orders`);
    
    if (pendingOrders.length > 0) {
      const order = pendingOrders[0];
      console.log('📋 Sample pending order:');
      console.log(`   - Order ID: ${order.order_id}`);
      console.log(`   - User ID: ${order.user_id}`);
      console.log(`   - Plan ID: ${order.plan_id}`);
      console.log(`   - Status: ${order.status}`);
      console.log(`   - Amount: ${order.amount}`);
    }
    
    // Test the activateUserPlan method
    if (pendingOrders.length > 0) {
      const testOrderId = pendingOrders[0].order_id;
      console.log(`\n🔄 Testing plan activation for order: ${testOrderId}`);
      
      // Simulate the activation process
      const order = pendingOrders[0];
      
      if (!order.user_id || !order.plan_id) {
        console.error('❌ Order missing user_id or plan_id');
        return false;
      }
      
      // Get actual user UUID from users table
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
      console.log(`📋 Found user UUID: ${actualUserId} for username: ${order.user_id}`);
      
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
      
      console.log('📤 Subscription data:', subscriptionData);
      
      // Try to insert new subscription
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
          console.log('📋 Updated subscription:', updatedSubscription);
        } else {
          console.error('❌ Error creating subscription:', subscriptionError);
          return false;
        }
      } else {
        console.log('✅ Subscription created successfully');
        console.log('📋 New subscription:', subscription);
      }
      
      // Update order status to paid
      const { error: updateOrderError } = await supabase
        .from('payment_orders')
        .update({ 
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (updateOrderError) {
        console.error('❌ Error updating order status:', updateOrderError);
        return false;
      }
      
      console.log('✅ Order status updated to paid');
      
      // Check final subscription status
      const { data: finalSubscription, error: finalError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', actualUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (finalError) {
        console.error('❌ Error fetching final subscription:', finalError);
        return false;
      }
      
      console.log('🎉 Final subscription status:');
      console.log(`   - Plan: ${finalSubscription.plan_id}`);
      console.log(`   - Status: ${finalSubscription.status}`);
      console.log(`   - Start: ${finalSubscription.start_date}`);
      console.log(`   - End: ${finalSubscription.expiration_date}`);
      
    } else {
      console.log('ℹ️ No pending orders found to test with');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testCallbackActivation()
    .then((success) => {
      if (success) {
        console.log('\n✅ Callback activation test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Callback activation test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCallbackActivation };

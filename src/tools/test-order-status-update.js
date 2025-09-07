const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testOrderStatusUpdate() {
  console.log('🧪 Testing order status update...');
  
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
    console.log(`   - Status: ${order.status}`);
    console.log(`   - Amount: ${order.amount}`);
    console.log(`   - Plan: ${order.plan_id}`);
    
    // Test updating order status using order_id
    const updateData = {
      status: 'paid',
      payment_transaction_id: 'test_transaction_123',
      payment_details: { test: true },
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('payment_orders')
      .update(updateData)
      .eq('order_id', order.order_id); // Use order_id instead of id

    if (updateError) {
      console.error('❌ Error updating order status:', updateError);
      return false;
    }

    console.log('✅ Order status updated successfully');
    
    // Verify the update
    const { data: updatedOrder, error: verifyError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', order.order_id)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return false;
    }
    
    console.log('📊 Updated order:');
    console.log(`   - Status: ${updatedOrder.status}`);
    console.log(`   - Payment Transaction ID: ${updatedOrder.payment_transaction_id}`);
    console.log(`   - Updated At: ${updatedOrder.updated_at}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testOrderStatusUpdate()
    .then((success) => {
      if (success) {
        console.log('\n✅ Order status update test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Order status update test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testOrderStatusUpdate };

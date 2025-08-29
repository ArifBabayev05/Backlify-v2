#!/usr/bin/env node

/**
 * Route Configuration Checker
 * Checks if routes are properly configured without making HTTP requests
 */

// Mock request and response objects for testing middleware
const mockReq = (method, path, headers = {}) => ({
  method,
  path,
  url: path,
  headers,
  params: {},
  query: {},
  body: {}
});

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null
  };
  
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  res.header = (name, value) => { res.headers[name] = value; return res; };
  res.end = () => res;
  
  return res;
};

console.log('🔧 Route Configuration Checker');
console.log('='.repeat(50));

// Test authentication middleware
try {
  const { authMiddleware } = require('../middleware/authMiddleware');
  
  console.log('✅ Authentication middleware loaded successfully');
  
  const config = authMiddleware.getRouteConfiguration();
  console.log('\n📋 Route Configuration:');
  console.log(`📖 Public routes: ${config.totalPublic}`);
  console.log(`🔒 Protected routes: ${config.totalProtected}`);
  
  console.log('\n📖 Public Routes:');
  config.publicRoutes.forEach(route => {
    console.log(`   ${route}`);
  });
  
  console.log('\n🔒 Protected Routes:');
  config.protectedRoutes.forEach(route => {
    console.log(`   ${route}`);
  });
  
  // Test specific routes
  console.log('\n🧪 Testing Route Classification:');
  
  const testRoutes = [
    { method: 'GET', path: '/api/payment/plans' },
    { method: 'POST', path: '/api/payment/order' },
    { method: 'GET', path: '/health' },
    { method: 'POST', path: '/api/epoint-callback' }
  ];
  
  testRoutes.forEach(route => {
    const isPublic = authMiddleware.isPublicRoute(route.method, route.path);
    const status = isPublic ? '📖 PUBLIC' : '🔒 PROTECTED';
    console.log(`   ${route.method} ${route.path} → ${status}`);
  });
  
} catch (error) {
  console.error('❌ Error loading authentication middleware:', error.message);
}

// Test payment service
try {
  console.log('\n💳 Testing Payment Service:');
  const PaymentService = require('../services/paymentService');
  const paymentService = new PaymentService();
  
  const plans = paymentService.getAvailablePlans();
  console.log(`✅ Payment service loaded, ${plans.length} plans available`);
  
  plans.forEach(plan => {
    console.log(`   - ${plan.id}: ${plan.name} (${plan.price} ${plan.currency})`);
  });
  
} catch (error) {
  console.error('❌ Error loading payment service:', error.message);
}

// Test payment controller
try {
  console.log('\n🎮 Testing Payment Controller:');
  const PaymentController = require('../controllers/paymentController');
  const controller = new PaymentController();
  
  console.log('✅ Payment controller loaded successfully');
  
  // Test the getPlans method directly
  const req = mockReq('GET', '/api/payment/plans');
  const res = mockRes();
  
  controller.getPlans(req, res).then(() => {
    console.log(`✅ getPlans method works, returned: ${JSON.stringify(res.data)}`);
  }).catch(error => {
    console.error('❌ getPlans method failed:', error.message);
  });
  
} catch (error) {
  console.error('❌ Error loading payment controller:', error.message);
}

console.log('\n🎯 Route Configuration Check Complete');

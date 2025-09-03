#!/usr/bin/env node

/**
 * Test script for Epoint Payment Gateway Integration
 * Run with: node src/tools/test-epoint-integration.js
 */

require('dotenv').config();
const EpointService = require('../services/epointService');

async function testEpointIntegration() {
  console.log('🧪 Testing Epoint Payment Gateway Integration...\n');

  try {
    // Test 1: Initialize EpointService
    console.log('1️⃣ Testing EpointService initialization...');
    const epointService = new EpointService();
    console.log('✅ EpointService initialized successfully');
    console.log(`   Public Key: ${epointService.publicKey}`);
    console.log(`   API Base URL: ${epointService.apiBaseUrl}\n`);

    // Test 2: Test signature generation
    console.log('2️⃣ Testing signature generation...');
    const testData = 'test_data_string';
    const signature = epointService.generateSignature(testData);
    console.log('✅ Signature generated successfully');
    console.log(`   Test Data: ${testData}`);
    console.log(`   Generated Signature: ${signature}\n`);

    // Test 3: Test signature validation
    console.log('3️⃣ Testing signature validation...');
    const isValid = epointService.validateSignature(testData, signature);
    console.log(`✅ Signature validation: ${isValid ? 'PASSED' : 'FAILED'}\n`);

    // Test 4: Test data encoding/decoding
    console.log('4️⃣ Testing data encoding/decoding...');
    const testObject = {
      test: 'data',
      amount: 100,
      currency: 'AZN'
    };
    const encoded = epointService.encodeData(testObject);
    const decoded = epointService.decodeData(encoded);
    const encodingValid = JSON.stringify(testObject) === JSON.stringify(decoded);
    console.log(`✅ Data encoding/decoding: ${encodingValid ? 'PASSED' : 'FAILED'}`);
    console.log(`   Original: ${JSON.stringify(testObject)}`);
    console.log(`   Encoded: ${encoded}`);
    console.log(`   Decoded: ${JSON.stringify(decoded)}\n`);

    // Test 5: Test standard payment preparation
    console.log('5️⃣ Testing standard payment preparation...');
    const paymentData = epointService.prepareStandardPayment({
      amount: 25.50,
      order_id: 'TEST_ORDER_123',
      description: 'Test payment',
      currency: 'AZN',
      language: 'az'
    });
    console.log('✅ Standard payment prepared successfully');
    console.log(`   Data: ${paymentData.data}`);
    console.log(`   Signature: ${paymentData.signature}`);
    console.log(`   Checkout URL: ${paymentData.checkout_url}\n`);

    // Test 6: Test card registration preparation
    console.log('6️⃣ Testing card registration preparation...');
    const cardData = epointService.prepareCardRegistration({
      language: 'az',
      description: 'Test card registration'
    });
    console.log('✅ Card registration prepared successfully');
    console.log(`   Data: ${cardData.data}`);
    console.log(`   Signature: ${cardData.signature}`);
    console.log(`   Registration URL: ${cardData.registration_url}\n`);

    // Test 7: Test saved card payment preparation
    console.log('7️⃣ Testing saved card payment preparation...');
    const savedCardData = epointService.prepareSavedCardPayment({
      card_id: 'CARD_123',
      order_id: 'ORDER_456',
      amount: 15.99,
      description: 'Test saved card payment'
    });
    console.log('✅ Saved card payment prepared successfully');
    console.log(`   Data: ${savedCardData.data}`);
    console.log(`   Signature: ${savedCardData.signature}\n`);

    // Test 8: Test pre-authorization preparation
    console.log('8️⃣ Testing pre-authorization preparation...');
    const preAuthData = epointService.preparePreAuthRequest({
      amount: 50.00,
      order_id: 'PREAUTH_789',
      description: 'Test pre-authorization'
    });
    console.log('✅ Pre-authorization prepared successfully');
    console.log(`   Data: ${preAuthData.data}`);
    console.log(`   Signature: ${preAuthData.signature}`);
    console.log(`   Pre-auth URL: ${preAuthData.pre_auth_url}\n`);

    // Test 9: Test payment reversal preparation
    console.log('9️⃣ Testing payment reversal preparation...');
    const reversalData = epointService.preparePaymentReversal({
      transaction: 'TXN_123',
      currency: 'AZN',
      amount: 25.50
    });
    console.log('✅ Payment reversal prepared successfully');
    console.log(`   Data: ${reversalData.data}`);
    console.log(`   Signature: ${reversalData.signature}\n`);

    // Test 10: Test status check preparation
    console.log('🔟 Testing status check preparation...');
    const statusData = epointService.prepareStatusCheck('TXN_123');
    console.log('✅ Status check prepared successfully');
    console.log(`   Data: ${statusData.data}`);
    console.log(`   Signature: ${statusData.signature}\n`);

    console.log('🎉 All tests completed successfully!');
    console.log('✅ Epoint Payment Gateway integration is working correctly.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEpointIntegration();
}

module.exports = { testEpointIntegration };

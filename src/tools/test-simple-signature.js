const crypto = require('crypto');
require('dotenv').config();

async function testSimpleSignature() {
  console.log('🧪 Testing simple signature validation...');
  
  try {
    const privateKey = process.env.EPOINT_PRIVATE_KEY;
    
    if (!privateKey) {
      console.error('❌ EPOINT_PRIVATE_KEY not found in environment');
      return false;
    }
    
    console.log('📋 Private key found:', privateKey.substring(0, 10) + '...');
    
    // Create test data
    const testData = 'test_data_string';
    console.log('📤 Test data:', testData);
    
    // Generate signature using the same algorithm as EpointService
    const signatureString = privateKey + testData + privateKey;
    const hash = crypto.createHash('sha1').update(signatureString).digest();
    const signature = hash.toString('base64');
    
    console.log('📤 Generated signature:', signature);
    
    // Test validation
    const expectedSignature = signature;
    const isValid = expectedSignature === signature;
    
    console.log('✅ Signature validation result:', isValid);
    
    if (isValid) {
      console.log('✅ Signature generation and validation working correctly');
    } else {
      console.error('❌ Signature validation failed');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testSimpleSignature()
    .then((success) => {
      if (success) {
        console.log('\n✅ Simple signature test completed!');
        process.exit(0);
      } else {
        console.log('\n❌ Simple signature test failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSimpleSignature };

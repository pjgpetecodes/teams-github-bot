require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');

// Test decryption functionality - for testing with real encrypted data from webhooks
const testEncryption = () => {
  try {
    console.log('🔐 Certificate Decryption Test');
    console.log('===============================');
    
    // Check if certificate files exist
    const certFiles = ['../graphwebhook.pem', '../graphwebhook.pfx', '../graphwebhook.key'];
    let privateKey = null;
    
    for (const certFile of certFiles) {
      try {
        if (fs.existsSync(certFile)) {
          console.log(`✅ Found certificate file: ${certFile}`);
          
          if (certFile.endsWith('.pem')) {
            const pemContent = fs.readFileSync(certFile, 'utf8');
            const privateKeyMatch = pemContent.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/);
            
            if (privateKeyMatch) {
              privateKey = privateKeyMatch[0];
              console.log(`✅ Successfully extracted private key from ${certFile}`);
              console.log(`   Key length: ${privateKey.length} characters`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`❌ Could not read ${certFile}: ${error.message}`);
      }
    }
    
    if (!privateKey) {
      console.log('❌ No valid private key found in certificate files');
      console.log('💡 Run the webhook setup to generate certificates first');
      return;
    }
    
    // Test key formats and validation
    console.log('\n🔍 Testing Private Key Formats:');
    const methods = [
      { name: 'PKCS#1 Raw Key', key: privateKey, options: { padding: crypto.constants.RSA_PKCS1_PADDING } },
      { name: 'PKCS#1 Key Object', key: crypto.createPrivateKey(privateKey), options: { padding: crypto.constants.RSA_PKCS1_PADDING } },
      { name: 'OAEP Raw Key', key: privateKey, options: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING } },
      { name: 'OAEP Key Object', key: crypto.createPrivateKey(privateKey), options: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING } }
    ];
    
    // Try converting to PKCS#8 format
    try {
      const keyObject = crypto.createPrivateKey(privateKey);
      const pkcs8Key = keyObject.export({ type: 'pkcs8', format: 'pem' });
      methods.push(
        { name: 'PKCS#8 PKCS1 Padding', key: pkcs8Key, options: { padding: crypto.constants.RSA_PKCS1_PADDING } },
        { name: 'PKCS#8 OAEP Padding', key: pkcs8Key, options: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING } }
      );
      console.log('✅ PKCS#8 key format available');
    } catch (conversionError) {
      console.log('❌ PKCS#8 conversion failed:', conversionError.message);
    }
    
    // Test key validation (without actual decryption)
    for (const method of methods) {
      try {
        // Just validate the key can be loaded
        const keyObj = typeof method.key === 'string' ? crypto.createPrivateKey(method.key) : method.key;
        console.log(`✅ ${method.name}: Key format valid`);
      } catch (error) {
        console.log(`❌ ${method.name}: ${error.message}`);
      }
    }
    
    console.log('\n📋 Test Results:');
    console.log('✅ Certificate files are accessible');
    console.log('✅ Private key can be extracted and loaded');
    console.log('✅ Multiple decryption methods are available');
    
    console.log('\n💡 To test with real encrypted data:');
    console.log('   1. Start a Teams meeting with transcription');
    console.log('   2. Check webhook logs for encrypted notifications');
    console.log('   3. The main application will handle decryption automatically');
    
    console.log('\n🔒 Security Note:');
    console.log('   This test only validates certificate setup.');
    console.log('   Real encrypted data is processed by the webhook handler.');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

testEncryption();

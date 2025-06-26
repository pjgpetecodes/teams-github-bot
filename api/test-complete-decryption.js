// Test the complete decryption process with sample/real data
// 
// USAGE INSTRUCTIONS:
// 1. Ensure your .env file has GRAPH_CERT_PATH pointing to your certificate
// 2. To test with real data, add TEST_ENCRYPTED_NOTIFICATION to your .env file
//    containing the complete encryptedContent JSON from a webhook notification
// 3. Run: node test-complete-decryption.js
//
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');

// Load the decryption function from index.js
const path = require('path');

// Sample notification data - replace with actual encrypted content for testing
// This should be populated from environment variables or real webhook notifications
const sampleNotification = process.env.TEST_ENCRYPTED_NOTIFICATION ? 
  JSON.parse(process.env.TEST_ENCRYPTED_NOTIFICATION) : {
  "encryptedContent": {
    "data": "[ENCRYPTED_DATA_FROM_WEBHOOK]",
    "dataSignature": "[DATA_SIGNATURE_FROM_WEBHOOK]", 
    "dataKey": "[ENCRYPTED_KEY_FROM_WEBHOOK]",
    "encryptionCertificateId": process.env.GRAPH_CERT_ID || "graphwebhook-cert-1",
    "encryptionCertificateThumbprint": "[CERT_THUMBPRINT_FROM_WEBHOOK]"
  }
};

function testDecryption() {
  try {
    console.log('🧪 Testing complete decryption process...');
    
    // Check if we have real encrypted data to test with
    if (sampleNotification.encryptedContent.data.includes('[ENCRYPTED_DATA_FROM_WEBHOOK]')) {
      console.log('⚠️  No real encrypted data provided for testing');
      console.log('💡 To test with real data, add TEST_ENCRYPTED_NOTIFICATION to your .env file');
      console.log('📝 Example: TEST_ENCRYPTED_NOTIFICATION=\'{"encryptedContent":{"data":"...","dataKey":"...","dataSignature":"...","encryptionCertificateId":"...","encryptionCertificateThumbprint":"..."}}\'');
      console.log('🔗 Get this data from actual webhook notifications');
      return null;
    }
    
    // Load private key from environment variable or default path
    const certPath = process.env.GRAPH_CERT_PATH || '../graphwebhook.pem';
    console.log('📁 Loading certificate from:', certPath);
    
    const pemContent = fs.readFileSync(certPath, 'utf8');
    const privateKeyMatch = pemContent.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/);
    
    if (!privateKeyMatch) {
      throw new Error('Private key not found');
    }
    
    const privateKey = privateKeyMatch[0];
    const encryptedContent = sampleNotification.encryptedContent;
    
    // Step 1: Decrypt the symmetric key
    const encryptedSymmetricKey = Buffer.from(encryptedContent.dataKey, 'base64');
    console.log('Encrypted symmetric key length:', encryptedSymmetricKey.length);
    
    const symmetricKey = crypto.privateDecrypt({
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    }, encryptedSymmetricKey);
    
    console.log('✅ Symmetric key decrypted successfully, length:', symmetricKey.length);
    console.log('Symmetric key (hex):', symmetricKey.toString('hex'));
    
    // Step 2: Decrypt the data using the symmetric key
    const encryptedData = Buffer.from(encryptedContent.data, 'base64');
    console.log('Encrypted data length:', encryptedData.length);
    
    // The encrypted data format is: IV (16 bytes) + encrypted content
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);
    
    console.log('IV length:', iv.length);
    console.log('Encrypted content length:', encrypted.length);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', symmetricKey, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);    console.log('✅ Data decrypted successfully, length:', decrypted.length);
    
    // Print the entire decrypted content to understand the structure
    const decryptedStr = decrypted.toString('utf8');
    console.log('Full decrypted content:');
    console.log('---START---');
    console.log(decryptedStr);
    console.log('---END---');
    
    // Look for any JSON-like structure
    let jsonContent = null;
    
    // Try to find a complete JSON object
    let braceCount = 0;
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = 0; i < decryptedStr.length; i++) {
      const char = decryptedStr[i];
      if (char === '{') {
        if (braceCount === 0) {
          jsonStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonContent = decryptedStr.substring(jsonStart, jsonEnd);
      console.log('Found JSON content:', jsonContent);
      
      try {
        const result = JSON.parse(jsonContent);
        console.log('✅ JSON parsed successfully');
        console.log('Decrypted content keys:', Object.keys(result));
        return result;
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError.message);
      }
    } else {
      console.error('❌ No complete JSON object found');
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

testDecryption();

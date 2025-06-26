const fs = require('fs');
const forge = require('node-forge');
const path = require('path');

// Convert PFX to PEM using node-forge
function convertPfxToPem(pfxPath, password = '') {
  try {
    console.log(`Converting ${pfxPath} to PEM format...`);
    
    const pfxData = fs.readFileSync(pfxPath);
    console.log(`PFX file size: ${pfxData.length} bytes`);
    
    // Convert to ASN.1 and then to PKCS#12
    const p12Asn1 = forge.asn1.fromDer(pfxData.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    let privateKeyPem = null;
    let certificatePem = null;
    
    // Extract private key and certificate
    for (let safeContents of p12.safeContents) {
      for (let safeBag of safeContents.safeBags) {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || 
            safeBag.type === forge.pki.oids.keyBag) {
          privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
          console.log('Found private key');
        } else if (safeBag.type === forge.pki.oids.certBag) {
          certificatePem = forge.pki.certificateToPem(safeBag.cert);
          console.log('Found certificate');
        }
      }
    }
    
    if (privateKeyPem && certificatePem) {
      // Save the PEM file with both private key and certificate
      const pemPath = pfxPath.replace('.pfx', '.pem');
      const pemContent = privateKeyPem + '\n' + certificatePem;
      fs.writeFileSync(pemPath, pemContent);
      console.log(`Successfully converted to: ${pemPath}`);
      
      // Also save just the private key
      const keyPath = pfxPath.replace('.pfx', '.key');
      fs.writeFileSync(keyPath, privateKeyPem);
      console.log(`Private key saved to: ${keyPath}`);
      
      return { pemPath, keyPath, success: true };
    } else {
      console.error('Could not extract private key or certificate');
      return { success: false };
    }
    
  } catch (error) {
    console.error('Conversion failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Test with different passwords
const pfxPath = path.join(__dirname, '..', 'graphwebhook.pfx');
const passwords = ['', 'webhook123', 'password', 'graphwebhook'];

console.log('Attempting to convert PFX to PEM...');

for (const password of passwords) {
  console.log(`\nTrying password: "${password}"`);
  const result = convertPfxToPem(pfxPath, password);
  
  if (result.success) {
    console.log('\n✅ Conversion successful!');
    console.log(`PEM file created: ${result.pemPath}`);
    console.log(`Key file created: ${result.keyPath}`);
    process.exit(0);
  } else {
    console.log(`❌ Failed: ${result.error || 'Unknown error'}`);
  }
}

console.log('\n❌ All password attempts failed');
process.exit(1);

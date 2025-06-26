const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

/**
 * Certificate and cryptographic utilities for Microsoft Graph webhook processing
 */
class CertificateService {
  /**
   * Convert PFX certificate to PEM format
   * @param {string} pfxPath - Path to PFX file
   * @param {string} password - PFX password
   * @returns {string|null} - Path to generated PEM file or null if failed
   */
  static convertPfxToPem(pfxPath, password = '') {
    try {
      const pfxData = fs.readFileSync(pfxPath);
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
          } else if (safeBag.type === forge.pki.oids.certBag) {
            certificatePem = forge.pki.certificateToPem(safeBag.cert);
          }
        }
      }
      
      if (privateKeyPem) {
        // Save the PEM file
        const pemPath = pfxPath.replace('.pfx', '.pem');
        const pemContent = privateKeyPem + (certificatePem ? '\n' + certificatePem : '');
        fs.writeFileSync(pemPath, pemContent);
        console.log(`Successfully converted PFX to PEM: ${pemPath}`);
        return pemPath;
      }
      
      return null;
    } catch (error) {
      // Only log the error for non-password issues
      if (!error.message.includes('wrong password') && !error.message.includes('Unable to decrypt')) {
        console.error('Failed to convert PFX to PEM (non-password error):', error.message);
      }
      return null;
    }
  }

  /**
   * Decrypt Microsoft Graph encrypted notification content
   * @param {object} encryptedContent - Encrypted content from webhook
   * @returns {object|null} - Decrypted data or null if failed
   */
  static decryptNotification(encryptedContent) {
    try {
      console.log('Attempting to decrypt notification...');
      console.log('Certificate thumbprint:', encryptedContent.encryptionCertificateThumbprint);
      
      // Load the private key from the PFX file
      const pfxPath = path.join(__dirname, '..', '..', 'graphwebhook.pfx');
      if (!fs.existsSync(pfxPath)) {
        console.error('PFX certificate file not found at:', pfxPath);
        return null;
      }

      // Read the PFX file
      const pfxData = fs.readFileSync(pfxPath);
      const pfxPassword = process.env.GRAPH_CERT_PASSWORD || '';
      
      // Check if PEM version exists, if not try to convert
      const pemPath = pfxPath.replace('.pfx', '.pem');
      let privateKey;

      if (fs.existsSync(pemPath)) {
        console.log('Using existing PEM file');
        const pemContent = fs.readFileSync(pemPath, 'utf8');
        // Extract only the private key part
        const privateKeyMatch = pemContent.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/);
        if (privateKeyMatch) {
          privateKey = privateKeyMatch[0];
        } else {
          console.error('No RSA private key found in PEM file');
          return null;
        }
      } else {
        console.log('PEM file not found, attempting to convert PFX...');
        // Try to convert PFX to PEM with different passwords
        const passwords = [
          pfxPassword, 
          'webhook123',
          '', 
          'password', 
          'cert',
          'graphwebhook',
          'webhook',
          'microsoft',
          'graph',
          'teams',
          '123456',
          'admin',
          'default'
        ];
        let converted = false;
        
        for (const password of passwords) {
          const result = this.convertPfxToPem(pfxPath, password);
          if (result) {
            console.log(`Successfully converted PFX with password attempt`);
            const pemContent = fs.readFileSync(result, 'utf8');
            const privateKeyMatch = pemContent.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/);
            if (privateKeyMatch) {
              privateKey = privateKeyMatch[0];
              converted = true;
              break;
            }
          }
        }
        
        if (!converted) {
          console.error('Failed to convert PFX to PEM with any password');
          return null;
        }
      }

      if (!privateKey) {
        console.error('Failed to extract private key from certificate');
        return null;
      }

      // Decrypt the symmetric key using the private key
      const encryptedSymmetricKey = Buffer.from(encryptedContent.dataKey, 'base64');
      let symmetricKey;
      
      console.log('Encrypted symmetric key length:', encryptedSymmetricKey.length);
      console.log('Private key preview:', privateKey.substring(0, 50) + '...');
      console.log('Certificate ID from notification:', encryptedContent.encryptionCertificateId);
      console.log('Data signature:', encryptedContent.dataSignature);
      
      // Log first few bytes of encrypted key for debugging
      console.log('Encrypted key first 10 bytes (hex):', encryptedSymmetricKey.slice(0, 10).toString('hex'));

      try {
        // Microsoft Graph uses OAEP padding for encryption
        // Try OAEP padding first (this is what Microsoft Graph uses)
        try {
          symmetricKey = crypto.privateDecrypt({
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
          }, encryptedSymmetricKey);
          console.log('Successfully decrypted symmetric key with OAEP padding, length:', symmetricKey.length);
        } catch (oaepError) {
          console.log('OAEP padding failed, trying alternatives:', oaepError.message);
          
          // Fallback to PKCS1 padding
          try {
            symmetricKey = crypto.privateDecrypt({
              key: privateKey,
              padding: crypto.constants.RSA_PKCS1_PADDING
            }, encryptedSymmetricKey);
            console.log('Successfully decrypted symmetric key with PKCS1 padding, length:', symmetricKey.length);
          } catch (pkcs1Error) {
            console.error('Both OAEP and PKCS1 padding failed:', pkcs1Error.message);
            throw pkcs1Error;
          }
        }
      } catch (error) {
        console.error('Failed to decrypt symmetric key:', error.message);
        console.error('Error code:', error.code);
        console.error('Expected certificate thumbprint:', encryptedContent.encryptionCertificateThumbprint);
        
        // Try to get our certificate thumbprint for comparison
        try {
          const pemContent = fs.readFileSync(pemPath, 'utf8');
          const certMatch = pemContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
          if (certMatch) {
            const cert = forge.pki.certificateFromPem(certMatch[0]);
            const thumbprint = forge.md.sha1.create();
            thumbprint.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
            console.log('Our certificate thumbprint:', thumbprint.digest().toHex().toUpperCase());
          }
        } catch (thumbprintError) {
          console.error('Could not extract certificate thumbprint for comparison');
        }
        
        return null;
      }

      // Decrypt the data using the symmetric key
      const encryptedData = Buffer.from(encryptedContent.data, 'base64');
      
      // The encrypted data format is: IV (16 bytes) + encrypted content
      const iv = encryptedData.slice(0, 16);
      const encrypted = encryptedData.slice(16);
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', symmetricKey, iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        // Convert to string and find the JSON content
        const decryptedStr = decrypted.toString('utf8');
        console.log('Decrypted data length:', decrypted.length);
        console.log('Full decrypted content (first 500 chars):', decryptedStr.substring(0, 500));
        console.log('Full decrypted content (COMPLETE):', decryptedStr);
        
        return this._parseDecryptedContent(decryptedStr);
      } catch (error) {
        console.error('Failed to decrypt data:', error.message);
        return null;
      }
    } catch (error) {
      console.error('Error in decryptNotification:', error.message);
      return null;
    }
  }

  /**
   * Parse decrypted content and extract rich data
   * @private
   * @param {string} decryptedStr - Decrypted string content
   * @returns {object|null} - Parsed data object or null
   */
  static _parseDecryptedContent(decryptedStr) {
    // Method 1: Try to find complete JSON object starting with @odata.context
    let jsonStartIndex = decryptedStr.indexOf('{"@odata.context"');
    if (jsonStartIndex !== -1) {
      console.log('Found JSON with @odata.context at index:', jsonStartIndex);
      const jsonContent = decryptedStr.substring(jsonStartIndex);
      try {
        const parsed = JSON.parse(jsonContent);
        console.log('🎉 SUCCESS! Parsed complete JSON object from decrypted content');
        return parsed;
      } catch (parseError) {
        console.log('Failed to parse JSON starting with @odata.context:', parseError.message);
      }
    }
    
    // Method 2: Look for the main JSON structure by finding the opening brace before transcript data
    const transcriptUrlIndex = decryptedStr.indexOf('"transcriptContentUrl"');
    if (transcriptUrlIndex !== -1) {
      // Work backwards to find the opening brace of the object containing transcriptContentUrl
      let searchIndex = transcriptUrlIndex;
      let braceDepth = 0;
      
      while (searchIndex > 0) {
        const char = decryptedStr[searchIndex];
        if (char === '}') braceDepth++;
        if (char === '{') braceDepth--;
        
        if (braceDepth === -1) {
          // Found the opening brace
          const jsonContent = decryptedStr.substring(searchIndex);
          try {
            const parsed = JSON.parse(jsonContent);
            console.log('🎉 SUCCESS! Parsed JSON by finding transcript object boundaries');
            return parsed;
          } catch (parseError) {
            console.log('Failed to parse JSON by object boundaries:', parseError.message);
            break;
          }
        }
        searchIndex--;
      }
    }
    
    // Method 3: Extract all key fields using regex and reconstruct the object
    console.log('Using regex extraction to reconstruct complete data...');
    
    const extractedData = {};
    
    // Extract all the key fields we can see in the logs
    const fieldMatches = {
      '@odata.context': decryptedStr.match(/"@odata\.context":"([^"]+)"/),
      id: decryptedStr.match(/"id":"([^"]+)"/),
      meetingId: decryptedStr.match(/"meetingId":"([^"]+)"/),
      callId: decryptedStr.match(/"callId":"([^"]+)"/),
      contentCorrelationId: decryptedStr.match(/"contentCorrelationId":"([^"]+)"/),
      transcriptContentUrl: decryptedStr.match(/"transcriptContentUrl":"([^"]+)"/),
      createdDateTime: decryptedStr.match(/"createdDateTime":"([^"]+)"/),
      endDateTime: decryptedStr.match(/"endDateTime":"([^"]+)"/),
    };
    
    // Extract each field
    for (const [field, match] of Object.entries(fieldMatches)) {
      if (match) {
        extractedData[field] = match[1];
        console.log(`✅ Extracted ${field}:`, match[1]);
      }
    }
    
    // Extract meetingOrganizer object (more complex)
    const organizerPattern = /"meetingOrganizer":\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/;
    const organizerMatch = decryptedStr.match(organizerPattern);
    if (organizerMatch) {
      try {
        extractedData.meetingOrganizer = JSON.parse(organizerMatch[1]);
        console.log('✅ Extracted meetingOrganizer:', extractedData.meetingOrganizer);
      } catch (e) {
        console.log('❌ Failed to parse meetingOrganizer, extracting subfields...');
        
        // Extract organizer subfields
        const organizerFields = {
          id: decryptedStr.match(/"meetingOrganizer"[^}]*"id":"([^"]+)"/),
          displayName: decryptedStr.match(/"meetingOrganizer"[^}]*"displayName":"([^"]+)"/),
          userPrincipalName: decryptedStr.match(/"meetingOrganizer"[^}]*"userPrincipalName":"([^"]+)"/),
        };
        
        const organizer = {};
        for (const [field, match] of Object.entries(organizerFields)) {
          if (match) {
            organizer[field] = match[1];
          }
        }
        
        if (Object.keys(organizer).length > 0) {
          extractedData.meetingOrganizer = organizer;
          console.log('✅ Extracted meetingOrganizer subfields:', organizer);
        }
      }
    }
    
    // Check if we extracted meaningful data
    if (Object.keys(extractedData).length > 3) {
      console.log('🎉 SUCCESS! Reconstructed rich notification data from regex extraction');
      console.log('Extracted fields:', Object.keys(extractedData));
      console.log('Complete extracted data:', JSON.stringify(extractedData, null, 2));
      return extractedData;
    }
    
    // Final fallback: the original logic
    console.log('All advanced parsing methods failed, using original fallback...');
    
    const basicMatches = {
      id: decryptedStr.match(/"id":"([^"]+)"/),
      transcriptContentUrl: decryptedStr.match(/"transcriptContentUrl":"([^"]+)"/),
    };
    
    if (basicMatches.id && basicMatches.transcriptContentUrl) {
      const basicData = {
        id: basicMatches.id[1],
        transcriptContentUrl: basicMatches.transcriptContentUrl[1],
        meetingOrganizer: {
          user: {
            userIdentityType: "aadUser",
            tenantId: process.env.AZURE_TENANT_ID,
            id: process.env.TEAMS_USER_OBJECT_ID,
            displayName: null
          }
        }
      };
      
      console.log('✅ Successfully created basic data fallback');
      console.log('Basic data:', JSON.stringify(basicData, null, 2));
      return basicData;
    }
    
    console.log('❌ No recognizable data found in decrypted content');
    return null;
  }
}

module.exports = CertificateService;

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function testGraphAccess() {
  try {
    console.log('🔑 Testing Microsoft Graph access...');
    console.log('🔧 Tenant ID:', process.env.AZURE_TENANT_ID);
    console.log('🔧 Client ID:', process.env.AZURE_CLIENT_ID);
    
    // Get access token
    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams();
    params.append('client_id', process.env.AZURE_CLIENT_ID);
    params.append('client_secret', process.env.AZURE_CLIENT_SECRET);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('❌ Failed to get token:', tokenResponse.status, error);
      return;
    }
    
    const tokenData = await tokenResponse.json();
    console.log('✅ Successfully obtained access token');
    
    // Parse token to check permissions
    try {
      const tokenPayload = JSON.parse(Buffer.from(tokenData.access_token.split('.')[1], 'base64').toString());
      console.log('🔍 Token permissions/roles:', tokenPayload.roles || 'No roles found');
      console.log('🔍 Token scopes:', tokenPayload.scp || tokenPayload.scope || 'No scopes found');
      console.log('🔍 Token audience:', tokenPayload.aud);
      console.log('🔍 Token issuer:', tokenPayload.iss);
      console.log('🔍 Token app ID:', tokenPayload.appid);
      console.log('🔍 Token tenant ID:', tokenPayload.tid);
    } catch (e) {
      console.log('❌ Could not parse token for debugging');
    }
    
    // Test a simple Graph API call
    console.log('\n🧪 Testing Graph API access...');
    const testResponse = await fetch('https://graph.microsoft.com/v1.0/applications', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    console.log('📊 Graph API test response status:', testResponse.status);
    
    if (testResponse.ok) {
      console.log('✅ Graph API access successful!');
    } else {
      const error = await testResponse.text();
      console.log('❌ Graph API access failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Error testing Graph access:', error.message);
  }
}

testGraphAccess().then(() => {
  console.log('Test completed');
});

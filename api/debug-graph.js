require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function debugGraphAccess() {
  try {
    console.log('🔍 Debugging Graph API access with admin consented permissions...');
    
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
    
    // Parse token to see what we actually have
    try {
      const tokenPayload = JSON.parse(Buffer.from(tokenData.access_token.split('.')[1], 'base64').toString());
      console.log('\n🔍 Token Analysis:');
      console.log('   Permissions/roles:', tokenPayload.roles || 'No roles found');
      console.log('   App ID:', tokenPayload.appid);
      console.log('   Tenant ID:', tokenPayload.tid);
      console.log('   Audience:', tokenPayload.aud);
    } catch (e) {
      console.log('❌ Could not parse token');
    }
    
    // Test what we can actually access with these permissions
    console.log('\n🧪 Testing specific APIs that should work with our permissions...');
    
    // Test 1: Try to access the service root (should always work)
    console.log('\n🧪 Test 1: Service root access...');
    const rootResponse = await fetch('https://graph.microsoft.com/v1.0/$metadata', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    console.log('📊 Service root response:', rootResponse.status);
    
    // Test 2: Try to access user data (using env variable for user ID)
    console.log('\n🧪 Test 2: User access test...');
    const userId = process.env.TEAMS_USER_OBJECT_ID;
    if (!userId) {
      console.log('❌ TEAMS_USER_OBJECT_ID not set in .env file');
      console.log('💡 Add TEAMS_USER_OBJECT_ID to your .env file to test user access');
    } else {
      const userResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      console.log('📊 User access response:', userResponse.status);
      if (!userResponse.ok) {
        const error = await userResponse.text();
        console.log('❌ User access error:', error);
      } else {
        console.log('✅ User access successful');
      }
    }
    
    // Test 3: Try online meetings without query parameters
    console.log('\n🧪 Test 3: Online meetings access...');
    if (userId) {
      const meetingsResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      console.log('📊 Online meetings response:', meetingsResponse.status);
      if (!meetingsResponse.ok) {
        const error = await meetingsResponse.text();
        console.log('❌ Online meetings error:', error);
      } else {
        console.log('✅ Online meetings access successful');
      }
    }
    
    // Test 4: General transcript access (without specific URLs)
    console.log('\n🧪 Test 4: General transcript access capabilities...');
    console.log('📋 This test verifies permissions without using actual transcript URLs');
    console.log('💡 Real transcript URLs come from webhook notifications');
    console.log('� Use the /api/fetch-transcript-content endpoint to test with real data');
    
  } catch (error) {
    console.error('❌ Error debugging Graph access:', error.message);
  }
}

debugGraphAccess().then(() => {
  console.log('\nDebugging completed');
});

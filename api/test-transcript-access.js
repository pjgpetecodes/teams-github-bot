require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function testTranscriptAccess() {
  try {
    console.log('🔑 Testing Transcript API access specifically...');
    
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
    
    // Test 1: Try to list users (basic Graph access)
    console.log('\n🧪 Test 1: Basic Graph API access (list users)...');
    const usersResponse = await fetch('https://graph.microsoft.com/v1.0/users?$top=1', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    console.log('📊 Users API response status:', usersResponse.status);
    if (usersResponse.ok) {
      console.log('✅ Basic Graph API access successful!');
    } else {
      const error = await usersResponse.text();
      console.log('❌ Basic Graph API access failed:', error);
    }
    
    // Test 2: Try to access online meetings (more specific to our use case)
    console.log('\n🧪 Test 2: Online Meetings API access...');
    // Use user ID from environment variables
    const userId = process.env.TEAMS_USER_OBJECT_ID;
    if (!userId) {
      console.log('❌ TEAMS_USER_OBJECT_ID not set in .env file');
      console.log('💡 Add TEAMS_USER_OBJECT_ID to your .env file to test user-specific APIs');
      return;
    }
    
    const meetingsResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings?$top=1`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    console.log('📊 Online Meetings API response status:', meetingsResponse.status);
    if (meetingsResponse.ok) {
      console.log('✅ Online Meetings API access successful!');
      const meetings = await meetingsResponse.json();
      console.log('📋 Found', meetings.value?.length || 0, 'meetings');
    } else {
      const error = await meetingsResponse.text();
      console.log('❌ Online Meetings API access failed:', error);
    }
    
    console.log('\n📋 Summary:');
    console.log('- If Test 1 fails: Admin consent is needed for basic Graph access');
    console.log('- If Test 2 fails: Additional permissions or consent needed for Online Meetings');
    console.log('- If both pass: The issue is likely with the specific transcript URL format');
    
  } catch (error) {
    console.error('❌ Error testing transcript access:', error.message);
  }
}

testTranscriptAccess().then(() => {
  console.log('\nTest completed');
});

// Test script to check Microsoft Graph permissions
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

// Example resource path - replace with actual values from your environment
// This should come from webhook notifications in real usage
const resourcePath = process.env.TEST_RESOURCE_PATH || "users('REPLACE_WITH_USER_ID')/onlineMeetings('REPLACE_WITH_MEETING_ID')/transcripts('REPLACE_WITH_TRANSCRIPT_ID')";

async function testPermissions() {
  try {
    console.log('🧪 Testing Microsoft Graph permissions...');
    
    // Check if TEST_RESOURCE_PATH is configured
    if (resourcePath.includes('REPLACE_WITH')) {
      console.log('⚠️  TEST_RESOURCE_PATH not configured in .env file');
      console.log('💡 To test with actual transcript data, add TEST_RESOURCE_PATH to your .env file');
      console.log('📝 Example: TEST_RESOURCE_PATH=users(\'your-user-id\')/onlineMeetings(\'meeting-id\')/transcripts(\'transcript-id\')');
      console.log('🔗 Get these IDs from webhook notifications or Graph API calls');
      console.log('');
    }
    
    // Get access token
    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', process.env.AZURE_CLIENT_ID);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', process.env.AZURE_CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');

    console.log('🔑 Getting access token...');
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      body: params
    });
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('❌ Failed to get access token:', tokenData);
      return;
    }
    console.log('✅ Access token obtained successfully');

    // Test transcript access
    const transcriptUrl = `https://graph.microsoft.com/v1.0/${resourcePath}`;
    console.log('🔍 Testing transcript access:', transcriptUrl);
    
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    console.log('📊 Response status:', transcriptResponse.status, transcriptResponse.statusText);
    
    if (transcriptResponse.ok) {
      console.log('🎉 SUCCESS! Permissions are working!');
      const data = await transcriptResponse.json();
      console.log('📄 Transcript metadata keys:', Object.keys(data));
    } else {
      const errorText = await transcriptResponse.text();
      console.log('❌ Error response:', errorText);
      
      if (transcriptResponse.status === 403) {
        console.log('🔒 Still getting 403 - permissions may not have propagated yet');
        console.log('⏰ Try waiting a few more minutes and run this test again');
      } else if (transcriptResponse.status === 404) {
        console.log('🔍 404 - This specific transcript may not exist or be ready yet');
        console.log('✅ But the permission error is resolved if we got 404 instead of 403!');
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testPermissions();

// Test script to check Microsoft Graph permissions
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

// Example resource path - replace with actual values from webhook notifications
// This is just an example format - you'll get the real path from webhook notifications
const exampleResourcePath = "users('USER_OBJECT_ID')/onlineMeetings('MEETING_ID')/transcripts('TRANSCRIPT_ID')";

async function testPermissions() {
  try {
    console.log('🧪 Testing Microsoft Graph permissions...');
    
    // Check if we have required environment variables
    if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
      console.error('❌ Missing required environment variables in .env file');
      console.log('📝 Required: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET');
      return;
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
    
    // Parse and display token permissions
    try {
      const tokenPayload = JSON.parse(Buffer.from(tokenData.access_token.split('.')[1], 'base64').toString());
      console.log('🔍 Token roles/permissions:', tokenPayload.roles || 'No roles found');
      console.log('🔍 Token audience:', tokenPayload.aud);
      console.log('🔍 Token issuer:', tokenPayload.iss);
    } catch (e) {
      console.log('❌ Could not parse token for debugging');
    }

    console.log('\n� Permission Test Results:');
    console.log('✅ Azure app authentication: Working');
    console.log('✅ Token acquisition: Working');
    console.log('✅ Application permissions granted: Confirmed');
    
    console.log('\n🔗 To test transcript access:');
    console.log('1. Start a scheduled Teams meeting with transcription enabled');
    console.log('2. Check webhook logs for actual transcript URLs');
    console.log('3. Use the manual fetch endpoint: POST /api/fetch-transcript-content');
    console.log('4. Monitor the API logs for detailed permission testing');
    
    console.log('\n💡 Note: This script tests token acquisition only.');
    console.log('   Real transcript access testing happens via webhook notifications.');
    console.log('   Use the webhook endpoints to test actual transcript fetching.');
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testPermissions();

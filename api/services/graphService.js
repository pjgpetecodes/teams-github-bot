const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

/**
 * Service for interacting with Microsoft Graph API
 */
class GraphService {
  /**
   * Get access token for Microsoft Graph API
   * @returns {Promise<string|null>} Access token or null if failed
   */
  static async getAccessToken() {
    try {
      console.log('🔑 Getting access token for Microsoft Graph...');
      
      const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams();
      params.append('client_id', process.env.AZURE_CLIENT_ID);
      params.append('client_secret', process.env.AZURE_CLIENT_SECRET);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('grant_type', 'client_credentials');
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.ok) {
        const tokenData = await response.json();
        console.log('✅ Successfully obtained access token');
        
        // Debug: Check what scopes are included in the token
        try {
          const tokenPayload = JSON.parse(Buffer.from(tokenData.access_token.split('.')[1], 'base64').toString());
          console.log('🔍 Token scopes:', tokenPayload.scp || tokenPayload.scope || 'No scopes found');
          console.log('🔍 Token roles/permissions:', tokenPayload.roles || 'No roles found');
          console.log('🔍 Token audience:', tokenPayload.aud);
          console.log('🔍 Token issuer:', tokenPayload.iss);
        } catch (e) {
          console.log('❌ Could not parse token for debugging');
        }
        
        return tokenData.access_token;
      } else {
        const errorText = await response.text();
        console.log('❌ Failed to get access token:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting access token:', error.message);
      return null;
    }
  }

  /**
   * Get AI-generated meeting insights using Meeting AI Insights API
   * @param {string} userId - User ID of the meeting organizer
   * @param {string} onlineMeetingId - Online meeting ID
   * @param {string} accessToken - Access token for authentication
   * @returns {Promise<object|null>} AI insights or null if failed
   */
  static async getMeetingAIInsights(userId, onlineMeetingId, accessToken) {
    try {
      console.log('🤖 Fetching AI-generated meeting insights...');
      console.log('User ID:', userId);
      console.log('Meeting ID:', onlineMeetingId);
      
      // First, list all AI insights for the meeting
      const listUrl = `https://graph.microsoft.com/beta/copilot/users/${userId}/onlineMeetings/${onlineMeetingId}/aiInsights`;
      
      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('AI Insights list response status:', listResponse.status);
      
      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.log('❌ Failed to fetch AI insights list:', listResponse.status, errorText);
        
        if (listResponse.status === 403) {
          console.log('🚫 403 Forbidden - This might indicate:');
          console.log('   1. User does not have Microsoft 365 Copilot license');
          console.log('   2. Missing required delegated permissions');
          console.log('   3. Meeting was not transcribed or recorded');
          console.log('   4. AI insights are not yet available (can take up to 4 hours)');
        }
        
        return null;
      }
      
      const insightsList = await listResponse.json();
      console.log('AI Insights list:', JSON.stringify(insightsList, null, 2));
      
      if (!insightsList.value || insightsList.value.length === 0) {
        console.log('❌ No AI insights available for this meeting');
        return null;
      }
      
      // Get the most recent insight (usually the last one)
      const latestInsight = insightsList.value[insightsList.value.length - 1];
      console.log('Using AI insight ID:', latestInsight.id);
      
      // Fetch detailed insights for the specific insight ID
      const detailUrl = `https://graph.microsoft.com/beta/copilot/users/${userId}/onlineMeetings/${onlineMeetingId}/aiInsights/${latestInsight.id}`;
      
      const detailResponse = await fetch(detailUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('AI Insights detail response status:', detailResponse.status);
      
      if (detailResponse.ok) {
        const detailedInsights = await detailResponse.json();
        console.log('✅ Successfully fetched AI-generated meeting insights!');
        console.log('Meeting notes count:', detailedInsights.meetingNotes?.length || 0);
        console.log('Action items count:', detailedInsights.actionItems?.length || 0);
        console.log('Mention events count:', detailedInsights.viewpoint?.mentionEvents?.length || 0);
        
        return detailedInsights;
      } else {
        const errorText = await detailResponse.text();
        console.log('❌ Failed to fetch detailed AI insights:', detailResponse.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching AI insights:', error.message);
      return null;
    }
  }

  /**
   * Get online meeting ID from join URL
   * @param {string} joinWebUrl - Teams meeting join URL
   * @param {string} accessToken - Access token for authentication
   * @returns {Promise<string|null>} Online meeting ID or null if failed
   */
  static async getOnlineMeetingIdFromJoinUrl(joinWebUrl, accessToken) {
    try {
      console.log('🔍 Getting online meeting ID from join URL...');
      
      const url = `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=joinWebUrl eq '${encodeURIComponent(joinWebUrl)}'`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.value && data.value.length > 0) {
          const meetingId = data.value[0].id;
          console.log('✅ Found online meeting ID:', meetingId);
          return meetingId;
        } else {
          console.log('❌ No meeting found with the provided join URL');
          return null;
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Failed to get meeting ID:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting meeting ID from join URL:', error);
      return null;
    }
  }

  /**
   * Fetch transcript content from Microsoft Graph
   * @param {string} transcriptContentUrl - URL to fetch transcript content from
   * @param {string} accessToken - Access token for authentication
   * @returns {Promise<string|null>} Transcript content or null if failed
   */
  static async fetchTranscriptContent(transcriptContentUrl, accessToken) {
    try {
      console.log('🔍 Attempting to fetch transcript content from:', transcriptContentUrl);
      
      // IMPORTANT: The transcriptContentUrl from the webhook already includes "/content" 
      // but we need to make sure we're calling the right endpoint for actual content
      let contentUrl = transcriptContentUrl;
      if (!contentUrl.endsWith('/content')) {
        contentUrl += '/content';
        console.log('📝 Added /content suffix to URL for actual transcript text');
      }
      
      // FIX: Handle Microsoft Graph transcript access properly
      // Microsoft Graph requires the exact user-specific URL format even with application permissions
      if (contentUrl.startsWith('users/')) {
        console.log('🔄 Using the original user-specific URL format as required by Microsoft Graph');
        // The contentUrl should already be in the correct format from the webhook
        // Just ensure it has the /content suffix
        if (!contentUrl.endsWith('/content')) {
          contentUrl += '/content';
          console.log('📝 Added /content suffix to URL');
        }
      }
      
      const graphUrl = `https://graph.microsoft.com/v1.0/${contentUrl}`;
      console.log('Full Graph API URL for content:', graphUrl);
      
      const response = await fetch(graphUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/vtt'  // Microsoft Graph returns transcript content in VTT format
        }
      });
      
      console.log('Transcript fetch response status:', response.status);
      
      if (response.ok) {
        const content = await response.text();
        console.log('✅ Successfully fetched transcript content, length:', content.length);
        console.log('Content preview (first 200 chars):', content.substring(0, 200));
        
        // Check if content is in VTT format and convert to plain text if needed
        if (content.trim().startsWith('WEBVTT')) {
          console.log('📄 Detected VTT format, converting to plain text...');
          const TranscriptProcessor = require('./transcriptProcessor');
          const plainText = TranscriptProcessor.convertVttToPlainText(content);
          console.log('✅ VTT converted to plain text, length:', plainText.length);
          console.log('Plain text preview (first 200 chars):', plainText.substring(0, 200));
          return plainText;
        }
        
        return content;
      } else {
        const errorText = await response.text();
        console.log('❌ Failed to fetch transcript content:', response.status, errorText);
        
        // If this is a 403 error, it might be because the app needs permission to access this specific user's data
        if (response.status === 403) {
          console.log('🚫 403 Forbidden - This might indicate:');
          console.log('   1. Missing OnlineMeetingTranscript.Read.All permission');
          console.log('   2. App needs permission to access this specific user\'s data');
          console.log('   3. Need to configure Resource-Specific Consent (RSC) in Teams app manifest');
          console.log('   4. Or the transcript might not be available for application access');
          console.log('');
          console.log('🔧 SOLUTIONS TO TRY:');
          console.log('   A. Grant admin consent for OnlineMeetingTranscript.Read.All in Azure Portal');
          console.log('   B. Add RSC permissions to Teams app manifest:');
          console.log('      "authorization": {');
          console.log('        "permissions": {');
          console.log('          "resourceSpecific": [');
          console.log('            {');
          console.log('              "name": "OnlineMeetingTranscript.Read.Chat",');
          console.log('              "type": "Application"');
          console.log('            }');
          console.log('          ]');
          console.log('        }');
          console.log('      }');
          console.log('   C. Use Microsoft Graph change notifications for transcripts');
          console.log('   D. Try fetching using meeting organizer\'s context');
          console.log('');
          console.log('📋 For now, we\'ll continue with metadata and generate summary from available data');
        }
        
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching transcript content:', error.message);
      return null;
    }
  }
}

module.exports = GraphService;

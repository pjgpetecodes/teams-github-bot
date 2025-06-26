const express = require('express');
const CertificateService = require('../services/certificateService');
const GraphService = require('../services/graphService');
const TranscriptProcessor = require('../services/transcriptProcessor');
const GitHubService = require('../services/githubService');
const summaryManager = require('../services/summaryManager');

const router = express.Router();

/**
 * Webhook endpoint for Microsoft Graph notifications and validation
 */
router.post('/webhook', async (req, res) => {
  console.log('Webhook called:', JSON.stringify(req.body, null, 2));
  
  // Microsoft Graph validation
  if (req.query && req.query.validationToken) {
    console.log('Validation token received:', req.query.validationToken);
    return res.status(200).send(req.query.validationToken);
  }

  const notification = req.body.value?.[0];
  if (notification) {
    console.log('Processing notification for resource:', notification.resource);
    
    // Check if this is an encrypted content notification
    if (notification.encryptedContent) {
      console.log('Encrypted content detected, attempting to decrypt...');
      const decryptedContent = CertificateService.decryptNotification(notification.encryptedContent);
      if (decryptedContent) {
        console.log('Successfully decrypted content:', JSON.stringify(decryptedContent, null, 2));
        
        // Process transcript data to generate summary
        const summary = TranscriptProcessor.processTranscript(decryptedContent);
        if (summary) {
          summaryManager.setLatestSummary(summary);
          console.log('📄 Summary generated from decrypted content');
          
          // Attempt to fetch actual transcript content asynchronously
          _fetchTranscriptContentAsync(decryptedContent, summary);
        }
      } else {
        console.error('Failed to decrypt notification content');
      }
    } else if (notification.resourceData) {
      // Handle non-encrypted notifications (legacy or different subscription types)
      console.log('Processing non-encrypted resource data');
      const summary = TranscriptProcessor.processTranscript(notification.resourceData);
      if (summary) {
        summaryManager.setLatestSummary(summary);
      }
    } else {
      console.log('No processable content found in notification');
    }
  }
  
  res.sendStatus(202);
});

/**
 * Get current status and latest events
 */
router.get('/status', (req, res) => {
  res.json({
    ...summaryManager.getStatus(),
    environment: summaryManager.getEnvironmentStatus()
  });
});

/**
 * Get the latest summary with enhanced display
 */
router.get('/summary', (req, res) => {
  const latestSummary = summaryManager.getLatestSummary();
  if (latestSummary) {
    res.json(latestSummary);
  } else {
    res.status(404).json({ error: 'No summary available yet.' });
  }
});

/**
 * Get the latest summary formatted for display
 */
router.get('/summary/display', (req, res) => {
  const latestSummary = summaryManager.getLatestSummary();
  if (!latestSummary) {
    return res.status(404).json({ error: 'No summary available yet.' });
  }
  
  // Format for better display
  const displaySummary = {
    title: latestSummary.title,
    hasAIInsights: latestSummary.hasAIInsights || false,
    hasActualContent: latestSummary.hasActualContent || false,
    isAutoCreated: latestSummary.autoCreated || false,
    githubIssue: latestSummary.githubIssue,
    meetingDetails: latestSummary.meetingDetails,
    timestamp: latestSummary.timestamp,
    
    // Parse the body for better structure if it contains AI insights
    content: latestSummary.hasAIInsights && latestSummary.aiInsights ? {
      meetingNotes: latestSummary.aiInsights.meetingNotes || [],
      actionItems: latestSummary.aiInsights.actionItems || [],
      mentionEvents: latestSummary.aiInsights.viewpoint?.mentionEvents || [],
      summary: latestSummary.body
    } : {
      summary: latestSummary.body,
      transcript: latestSummary.hasActualContent ? 
        latestSummary.originalTranscript?.substring(0, 500) + '...' : 
        'No transcript content available'
    }
  };
  
  res.json(displaySummary);
});

/**
 * Get summary history
 */
router.get('/summaries', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const history = summaryManager.getSummaryHistory(limit);
  res.json({
    count: history.length,
    summaries: history
  });
});

/**
 * Create a GitHub issue from the latest summary
 */
router.post('/create-issue', async (req, res) => {
  try {
    const latestSummary = summaryManager.getLatestSummary();
    if (!latestSummary) {
      return res.status(400).json({ error: 'No summary to create issue from.' });
    }

    console.log('📝 Manual GitHub issue creation requested');
    console.log('📋 Summary Details:');
    console.log('  - Title:', latestSummary.title);
    console.log('  - Has AI Insights:', latestSummary.hasAIInsights ? 'Yes' : 'No');
    console.log('  - Body Length:', latestSummary.body?.length || 0, 'characters');
    console.log('  - AI Content Preview:', latestSummary.body?.substring(0, 150) + '...');

    const githubToken = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO; // Format: OWNER/REPO
    
    if (!githubToken || !repo) {
      return res.status(500).json({ error: 'GitHub credentials not set.' });
    }

    const result = await GitHubService.createIssue(latestSummary, githubToken, repo);
    res.json(result);
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test endpoint to simulate receiving actual transcript content
 */
router.post('/simulate-transcript', (req, res) => {
  console.log('🧪 Simulating actual transcript content...');
  
  // Simulate what a real transcript might look like
  const simulatedTranscript = {
    content: `John Doe: Good morning everyone, let's start our weekly standup meeting.
Jane Smith: Good morning! I'll go first. This week I completed the user authentication feature and started working on the dashboard UI.
John Doe: Great progress Jane. Any blockers?
Jane Smith: Not at the moment, but I might need some help with the chart integration next week.
Mike Johnson: I finished the database migration and optimized the query performance. The API response time improved by 40%.
John Doe: Excellent work Mike. Sarah, how about you?
Sarah Wilson: I completed the testing framework setup and wrote automated tests for the authentication module. Found a few edge cases that need fixing.
John Doe: Thanks everyone. Let's prioritize fixing those edge cases that Sarah found. Meeting adjourned.`,
    metadata: {
      meetingOrganizer: {
        displayName: 'John Doe'
      },
      createdDateTime: new Date().toISOString(),
      duration: 'PT15M'
    },
    originalFormat: 'simulated'
  };
  
  const summary = TranscriptProcessor.processTranscriptEnhanced(simulatedTranscript);
  if (summary) {
    summaryManager.setLatestSummary(summary);
    console.log('📄 Simulated transcript summary generated successfully');
    res.json({ 
      success: true, 
      message: 'Simulated transcript processed successfully',
      summary 
    });
  } else {
    res.status(500).json({ error: 'Failed to process simulated transcript' });
  }
});

/**
 * Manual endpoint to try fetching AI insights for a meeting
 */
router.post('/fetch-ai-insights', async (req, res) => {
  console.log('🤖 Manual AI insights fetch requested...');
  
  const { userId, onlineMeetingId, joinWebUrl } = req.body;
  
  if (!userId && !joinWebUrl) {
    return res.status(400).json({ 
      error: 'Either userId and onlineMeetingId, or joinWebUrl must be provided.' 
    });
  }
  
  try {
    const accessToken = await GraphService.getAccessToken();
    if (!accessToken) {
      return res.status(500).json({ 
        error: 'Failed to get access token. Check Azure app credentials.' 
      });
    }
    
    let meetingId = onlineMeetingId;
    
    // If joinWebUrl is provided, get the meeting ID first
    if (joinWebUrl && !meetingId) {
      meetingId = await GraphService.getOnlineMeetingIdFromJoinUrl(joinWebUrl, accessToken);
      if (!meetingId) {
        return res.status(404).json({
          error: 'Could not find meeting with the provided join URL.'
        });
      }
    }
    
    if (!userId || !meetingId) {
      return res.status(400).json({
        error: 'Missing required parameters: userId and meetingId/joinWebUrl'
      });
    }
    
    const aiInsights = await GraphService.getMeetingAIInsights(userId, meetingId, accessToken);
    
    if (aiInsights) {
      console.log('🎉 Successfully fetched AI insights manually!');
      
      // Create a summary from AI insights
      const aiSummary = TranscriptProcessor.processAIInsights(aiInsights, {
        meetingOrganizer: { user: { displayName: 'Manual Request' } },
        createdDateTime: aiInsights.createdDateTime,
        endDateTime: aiInsights.endDateTime,
        meetingId: meetingId
      });
      
      if (aiSummary) {
        summaryManager.setLatestSummary(aiSummary);
        
        // Automatically create GitHub issue
        await _createGitHubIssueAsync(aiSummary);
      }
      
      res.json({
        success: true,
        message: 'AI insights fetched and summary updated',
        aiInsights: aiInsights,
        summary: aiSummary
      });
    } else {
      res.status(404).json({
        error: 'AI insights not available for this meeting.',
        suggestions: [
          'Ensure the meeting was transcribed or recorded',
          'Wait up to 4 hours after meeting end for insights to become available',
          'Verify the user has Microsoft 365 Copilot license',
          'Check that the meeting was a private scheduled meeting'
        ]
      });
    }
  } catch (error) {
    console.error('Error in manual AI insights fetch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual endpoint to try fetching transcript content
 */
router.post('/fetch-transcript-content', async (req, res) => {
  console.log('🔍 Manual transcript content fetch requested...');
  
  const latestSummary = summaryManager.getLatestSummary();
  if (!latestSummary || !latestSummary.transcriptUrl) {
    return res.status(400).json({ 
      error: 'No transcript URL available. Need a recent meeting notification first.' 
    });
  }
  
  try {
    const accessToken = await GraphService.getAccessToken();
    if (!accessToken) {
      return res.status(500).json({ 
        error: 'Failed to get access token. Check Azure app credentials.' 
      });
    }
    
    const transcriptContent = await GraphService.fetchTranscriptContent(latestSummary.transcriptUrl, accessToken);
    
    if (transcriptContent) {
      // Update the latest summary with actual content
      summaryManager.updateLatestSummary({
        hasActualContent: true,
        originalTranscript: transcriptContent,
        title: latestSummary.title.replace('Available', 'with Content'),
        body: latestSummary.body + `\n\n🎤 **Actual Transcript Content:**\n${transcriptContent.substring(0, 1000)}${transcriptContent.length > 1000 ? '\n\n...(content truncated)' : ''}`
      });
      
      console.log('✅ Successfully fetched and updated summary with transcript content');
      
      res.json({
        success: true,
        message: 'Transcript content fetched and summary updated',
        contentLength: transcriptContent.length,
        preview: transcriptContent.substring(0, 200)
      });
    } else {
      res.status(403).json({
        error: 'Failed to fetch transcript content. Likely missing permissions.',
        transcriptUrl: latestSummary.transcriptUrl,
        suggestion: 'Add OnlineMeetingTranscript.Read.All permission to your Azure app'
      });
    }
  } catch (error) {
    console.error('Error in manual transcript fetch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get AI insights setup guidance
 */
router.get('/ai-insights-guide', (req, res) => {
  res.json({
    title: "Meeting AI Insights API Setup Guide",
    description: "This guide helps you set up and use Microsoft 365 Copilot Meeting AI Insights API",
    requirements: [
      "Microsoft 365 Copilot license for the user",
      "Meeting must be transcribed or recorded",
      "Meeting must be a private scheduled meeting",
      "AI insights available up to 4 hours after meeting ends",
      "Delegated permissions required (not application permissions)"
    ],
    permissions: [
      "OnlineMeetings.Read",
      "OnlineMeetings.ReadWrite", 
      "User.Read"
    ],
    endpoints: {
      listInsights: "/copilot/users/{userId}/onlineMeetings/{onlineMeetingId}/aiInsights",
      getInsight: "/copilot/users/{userId}/onlineMeetings/{onlineMeetingId}/aiInsights/{aiInsightId}",
      getMeeting: "/me/onlineMeetings?$filter=joinWebUrl eq '{joinWebUrl}'"
    },
    usage: {
      automatic: "AI insights are automatically fetched when webhook notifications are received",
      manual: "Use POST /api/fetch-ai-insights with userId and onlineMeetingId or joinWebUrl",
      display: "Use GET /api/summary/display for formatted AI insights display"
    },
    troubleshooting: [
      {
        issue: "403 Forbidden",
        solutions: [
          "Ensure user has Microsoft 365 Copilot license",
          "Check that delegated permissions are granted",
          "Verify user has access to the meeting transcript"
        ]
      },
      {
        issue: "No insights available",
        solutions: [
          "Wait up to 4 hours after meeting ends",
          "Ensure meeting was transcribed or recorded",
          "Verify meeting was a private scheduled meeting",
          "Check that meeting actually had conversation content"
        ]
      }
    ]
  });
});

/**
 * Get permission setup guidance
 */
router.get('/permissions-guide', (req, res) => {
  res.json({
    currentIssue: "403 Forbidden - Missing transcript access permissions",
    solutions: [
      {
        option: "Add Application Permissions (Recommended)",
        steps: [
          "1. Go to Azure Portal (portal.azure.com)",
          "2. Navigate to Azure Active Directory > App registrations",
          "3. Find your app registration (likely named something with 'teams' or 'webhook')",
          "4. Go to 'API permissions' section",
          "5. Click 'Add a permission'",
          "6. Select 'Microsoft Graph'",
          "7. Choose 'Application permissions'",
          "8. Search for and add: 'OnlineMeetingTranscript.Read.All'",
          "9. Click 'Grant admin consent for [your organization]'",
          "10. Wait a few minutes for changes to propagate"
        ],
        notes: "This requires Azure admin privileges"
      },
      {
        option: "Resource-Specific Consent (RSC)",
        steps: [
          "1. Update your Teams app manifest.json",
          "2. Add RSC permissions in the webApplicationInfo section",
          "3. Include transcript access permissions",
          "4. Redeploy/update your Teams app",
          "5. Have meeting organizers consent to the permissions"
        ],
        notes: "More complex but doesn't require admin consent"
      },
      {
        option: "Wait for Content Notifications",
        steps: [
          "1. Sometimes Microsoft Graph sends actual transcript content in subsequent notifications",
          "2. Your webhook is already set up to handle both metadata and content notifications",
          "3. The retry system will continue attempting to fetch content",
          "4. Monitor logs for any notifications containing actual transcript text"
        ],
        notes: "No configuration required, but content availability varies"
      }
    ],
    testingOptions: [
      "Use POST /api/simulate-transcript to test with sample transcript data",
      "Monitor GET /api/status to see retry attempts and current state",
      "Check if future notifications contain actual transcript content"
    ]
  });
});

/**
 * Clear all summaries (for testing)
 */
router.delete('/summaries', (req, res) => {
  summaryManager.clearSummaries();
  res.json({ message: 'All summaries cleared' });
});

/**
 * Async function to fetch transcript content and AI insights after processing notification
 * @private
 */
async function _fetchTranscriptContentAsync(decryptedContent, summary) {
  try {
    console.log('📥 Attempting to fetch actual transcript content and AI insights async...');
    
    const accessToken = await GraphService.getAccessToken();
    if (!accessToken) {
      console.log('❌ Could not get access token async - check Azure app credentials');
      return;
    }

    let updatedSummary = null;
    let shouldCreateIssue = false;

    // Try to fetch AI insights first (this is the preferred method)
    if (decryptedContent.meetingId && decryptedContent.meetingOrganizer?.user?.id) {
      console.log('🤖 Attempting to fetch AI insights...');
      
      const userId = decryptedContent.meetingOrganizer.user.id;
      const meetingId = decryptedContent.meetingId;
      
      const aiInsights = await GraphService.getMeetingAIInsights(userId, meetingId, accessToken);
      
      if (aiInsights) {
        console.log('🎉 SUCCESS! Fetched AI insights!');
        
        // Process AI insights into a rich summary
        updatedSummary = TranscriptProcessor.processAIInsights(aiInsights, decryptedContent);
        shouldCreateIssue = true;
        
        if (updatedSummary) {
          summaryManager.setLatestSummary(updatedSummary);
          console.log('✅ Summary updated with AI insights!');
        }
      } else {
        console.log('⚠️ AI insights not available, trying transcript content...');
      }
    }

    // Fallback: Try to fetch transcript content if AI insights failed
    if (!updatedSummary && decryptedContent.transcriptContentUrl) {
      const transcriptContent = await GraphService.fetchTranscriptContent(
        decryptedContent.transcriptContentUrl, 
        accessToken
      );
      
      if (transcriptContent) {
        console.log('🎉 SUCCESS! Fetched actual transcript content async! Length:', transcriptContent.length);
        
        // Update the summary with actual content only
        updatedSummary = {
          title: `Meeting Notes - ${new Date().toLocaleDateString()}`,
          body: transcriptContent,
          originalTranscript: transcriptContent,
          isMetadata: false,
          isRichData: true,
          hasActualContent: true,
          transcriptUrl: decryptedContent.transcriptContentUrl,
          contentFetched: true
        };
        
        summaryManager.setLatestSummary(updatedSummary);
        shouldCreateIssue = true;
        console.log('✅ Summary successfully updated with actual transcript content async!');
      }
    }

    // Automatically create GitHub issue if we have meaningful content
    if (shouldCreateIssue && updatedSummary) {
      await _createGitHubIssueAsync(updatedSummary);
    }

  } catch (error) {
    console.error('❌ Error in async transcript/insights fetching:', error);
  }
}

/**
 * Async function to automatically create GitHub issue
 * @private
 */
async function _createGitHubIssueAsync(summary) {
  try {
    console.log('📝 Automatically creating GitHub issue...');
    console.log('📋 Summary Details:');
    console.log('  - Title:', summary.title);
    console.log('  - Has AI Insights:', summary.hasAIInsights ? 'Yes' : 'No');
    console.log('  - Body Length:', summary.body?.length || 0, 'characters');
    console.log('  - AI Content Preview:', summary.body?.substring(0, 150) + '...');
    
    const githubToken = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    
    if (!githubToken || !repo) {
      console.log('⚠️ GitHub credentials not configured - skipping automatic issue creation');
      console.log('   Set GITHUB_TOKEN and GITHUB_REPO environment variables to enable this feature');
      return;
    }

    const result = await GitHubService.createIssue(summary, githubToken, repo);
    
    if (result.success) {
      console.log('🎉 Successfully created GitHub issue automatically!');
      console.log('📎 Issue URL:', result.issueUrl);
      console.log('🔢 Issue Number:', result.issueNumber);
      
      // Update the summary to include the GitHub issue information
      summaryManager.updateLatestSummary({
        githubIssue: {
          url: result.issueUrl,
          number: result.issueNumber,
          createdAt: new Date().toISOString()
        },
        autoCreated: true
      });
    } else {
      console.log('❌ Failed to create GitHub issue automatically');
    }
  } catch (error) {
    console.error('❌ Error creating GitHub issue automatically:', error);
  }
}

module.exports = router;

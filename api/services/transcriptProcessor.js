/**
 * Service for processing transcript content and generating summaries
 */
class TranscriptProcessor {
  /**
   * Convert VTT (WebVTT) format to plain text
   * @param {string} vttContent - VTT formatted content
   * @returns {string} Plain text transcript
   */
  static convertVttToPlainText(vttContent) {
    try {
      console.log('Converting VTT content to plain text...');
      
      // Split by lines and filter out VTT metadata
      const lines = vttContent.split('\n');
      const textLines = [];
      let currentSpeaker = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip VTT header and empty lines
        if (line === 'WEBVTT' || line === '' || line.includes('-->')) {
          continue;
        }
        
        // Skip timestamp lines (format: 00:00:01.000 --> 00:00:05.000)
        if (line.match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}$/)) {
          continue;
        }
        
        // Check if line contains speaker information (format: <v Speaker Name>)
        const speakerMatch = line.match(/^<v\s+([^>]+)>/);
        if (speakerMatch) {
          currentSpeaker = speakerMatch[1];
          const text = line.replace(/^<v\s+[^>]+>/, '').trim();
          if (text) {
            textLines.push(`${currentSpeaker}: ${text}`);
          }
        } else if (line && !line.startsWith('<') && !line.match(/^\d+$/)) {
          // Regular text line
          if (currentSpeaker) {
            textLines.push(`${currentSpeaker}: ${line}`);
          } else {
            textLines.push(line);
          }
        }
      }
      
      const plainText = textLines.join('\n');
      console.log('VTT conversion completed, plain text length:', plainText.length);
      return plainText;
      
    } catch (error) {
      console.error('Error converting VTT to plain text:', error);
      return vttContent; // Return original if conversion fails
    }
  }

  /**
   * Process AI insights from Microsoft Graph Meeting AI Insights API
   * @param {object} aiInsights - AI insights from Graph API
   * @param {object} meetingMetadata - Meeting metadata from webhook
   * @returns {object} Processed summary object
   */
  static processAIInsights(aiInsights, meetingMetadata) {
    try {
      console.log('🤖 Processing AI-generated meeting insights...');
      
      // Console log the AI summary content for debugging/monitoring
      console.log('📝 AI Meeting Summary Available:');
      if (aiInsights.meetingNotes && aiInsights.meetingNotes.length > 0) {
        console.log('  📋 Meeting Notes Found:', aiInsights.meetingNotes.length, 'items');
        aiInsights.meetingNotes.forEach((note, index) => {
          console.log(`    ${index + 1}. ${note.title}: ${note.text.substring(0, 100)}...`);
        });
      }
      
      if (aiInsights.actionItems && aiInsights.actionItems.length > 0) {
        console.log('  ✅ Action Items Found:', aiInsights.actionItems.length, 'items');
        aiInsights.actionItems.forEach((item, index) => {
          console.log(`    ${index + 1}. ${item.title}: ${item.text.substring(0, 100)}...`);
        });
      }
      
      if (aiInsights.viewpoint?.mentionEvents && aiInsights.viewpoint.mentionEvents.length > 0) {
        console.log('  👥 Key Mentions Found:', aiInsights.viewpoint.mentionEvents.length, 'items');
      }
      
      console.log('🎯 Creating clean GitHub issue summary (without metadata)...');
      
      const meetingOrganizer = meetingMetadata?.meetingOrganizer;
      const organizerName = meetingOrganizer?.user?.displayName || 
                           meetingOrganizer?.displayName || 
                           'Unknown Organizer';
      
      const createdTime = new Date(meetingMetadata?.createdDateTime || aiInsights.createdDateTime).toLocaleString();
      const endTime = new Date(meetingMetadata?.endDateTime || aiInsights.endDateTime).toLocaleString();
      
      // Calculate meeting duration
      const startDate = new Date(meetingMetadata?.createdDateTime || aiInsights.createdDateTime);
      const endDate = new Date(meetingMetadata?.endDateTime || aiInsights.endDateTime);
      const duration = Math.round((endDate - startDate) / 1000 / 60);
      
      // Process meeting notes
      let meetingNotesText = '';
      if (aiInsights.meetingNotes && aiInsights.meetingNotes.length > 0) {
        meetingNotesText = '## 📝 Meeting Notes\n\n';
        aiInsights.meetingNotes.forEach((note, index) => {
          meetingNotesText += `### ${index + 1}. ${note.title}\n`;
          meetingNotesText += `${note.text}\n\n`;
          
          if (note.subpoints && note.subpoints.length > 0) {
            note.subpoints.forEach(subpoint => {
              meetingNotesText += `- **${subpoint.title}**: ${subpoint.text}\n`;
            });
            meetingNotesText += '\n';
          }
        });
      }
      
      // Process action items
      let actionItemsText = '';
      if (aiInsights.actionItems && aiInsights.actionItems.length > 0) {
        actionItemsText = '## ✅ Action Items\n\n';
        aiInsights.actionItems.forEach((item, index) => {
          actionItemsText += `### ${index + 1}. ${item.title}\n`;
          actionItemsText += `**Description**: ${item.text}\n`;
          if (item.ownerDisplayName) {
            actionItemsText += `**Assigned to**: ${item.ownerDisplayName}\n`;
          }
          actionItemsText += '\n';
        });
      }
      
      // Process mention events
      let mentionsText = '';
      if (aiInsights.viewpoint?.mentionEvents && aiInsights.viewpoint.mentionEvents.length > 0) {
        mentionsText = '## 👥 Key Mentions\n\n';
        aiInsights.viewpoint.mentionEvents.forEach((mention, index) => {
          const speaker = mention.speaker?.user?.displayName || 'Unknown Speaker';
          const eventTime = new Date(mention.eventDateTime).toLocaleString();
          mentionsText += `### ${index + 1}. Mentioned at ${eventTime}\n`;
          mentionsText += `**Speaker**: ${speaker}\n`;
          mentionsText += `**Quote**: "${mention.transcriptUtterance}"\n\n`;
        });
      }
      
      // Create clean summary with only AI-generated content
      const title = `Meeting Summary - ${startDate.toLocaleDateString()} (${duration}min)`;
      
      // Build clean summary body with only AI content
      let cleanBody = '';
      
      // Add meeting notes if available
      if (meetingNotesText) {
        cleanBody += meetingNotesText;
      }
      
      // Add action items if available
      if (actionItemsText) {
        cleanBody += actionItemsText;
      }
      
      // Add mentions if available
      if (mentionsText) {
        cleanBody += mentionsText;
      }
      
      // If no AI content is available, provide a basic summary
      if (!cleanBody.trim()) {
        cleanBody = `## Meeting Summary\n\nMeeting completed on ${startDate.toLocaleDateString()} with a duration of ${duration} minutes.\n\n*AI-generated content will be available once processed by Microsoft 365 Copilot.*`;
      }
      
      // Clean final body without metadata
      const body = cleanBody.trim();
      
      // Log the clean summary that will be used for GitHub issue
      console.log('📋 Clean Summary Generated for GitHub Issue:');
      console.log('  Title:', title);
      console.log('  Body Preview:', body.substring(0, 200) + '...');
      console.log('  Summary Length:', body.length, 'characters');
      console.log('✅ Clean summary ready (no metadata, only AI content)');
      
      return {
        title: title,
        body: body,
        originalTranscript: JSON.stringify(aiInsights, null, 2),
        isMetadata: false,
        isRichData: true,
        hasActualContent: true,
        hasAIInsights: true,
        aiInsights: aiInsights,
        meetingDetails: {
          organizer: organizerName,
          startTime: meetingMetadata?.createdDateTime,
          endTime: meetingMetadata?.endDateTime,
          duration: duration,
          meetingId: meetingMetadata?.meetingId,
          callId: meetingMetadata?.callId || aiInsights.callId,
          aiInsightId: aiInsights.id,
          contentCorrelationId: aiInsights.contentCorrelationId
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error processing AI insights:', error);
      return null;
    }
  }

  /**
   * Simple text summarization function - creates clean, professional summaries
   * @param {string} text - Text to summarize
   * @returns {string} Clean summary with key points extracted from transcript
   */
  static summarizeText(text) {
    try {
      // Extract key information from the transcript
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const wordCount = text.split(' ').length;
      
      // Look for action items, decisions, or important statements
      const actionWords = ['action', 'todo', 'follow up', 'next step', 'assign', 'responsible', 'deadline', 'complete', 'finish'];
      const decisionWords = ['decide', 'agreed', 'conclusion', 'final', 'approve', 'confirm', 'resolution'];
      
      let keyPoints = [];
      let actionItems = [];
      
      sentences.forEach(sentence => {
        const lowerSentence = sentence.toLowerCase();
        
        // Check for action items
        if (actionWords.some(word => lowerSentence.includes(word))) {
          actionItems.push(sentence.trim());
        } 
        // Check for decisions or key points
        else if (decisionWords.some(word => lowerSentence.includes(word)) || sentence.length > 50) {
          keyPoints.push(sentence.trim());
        }
      });
      
      // Build clean summary
      let summary = '';
      
      if (keyPoints.length > 0) {
        summary += '**Key Discussion Points:**\n';
        keyPoints.slice(0, 3).forEach((point, index) => {
          summary += `${index + 1}. ${point}\n`;
        });
        summary += '\n';
      }
      
      if (actionItems.length > 0) {
        summary += '**Action Items:**\n';
        actionItems.slice(0, 3).forEach((item, index) => {
          summary += `${index + 1}. ${item}\n`;
        });
        summary += '\n';
      }
      
      // If no specific content found, create a basic summary
      if (!summary.trim()) {
        const mainContent = sentences.slice(0, 2).join('. ').trim();
        summary = `**Meeting Overview:**\n${mainContent || 'Meeting discussion covered various topics.'}\n\n`;
        summary += `**Meeting Statistics:**\n- Duration: Short meeting\n- Content: ${wordCount} words of discussion\n\n`;
      }
      
      return summary.trim();
      
    } catch (error) {
      console.error('Error in summarizeText:', error);
      return `**Meeting Summary:**\nMeeting completed with transcript content available.`;
    }
  }

  /**
   * Process transcript data and extract meaningful content
   * @param {object} transcriptData - Raw transcript data from webhook
   * @returns {object|null} Processed summary object or null
   */
  static processTranscript(transcriptData) {
    try {
      // IMPORTANT: Microsoft Graph webhook notifications for transcripts typically contain 
      // METADATA ONLY, not the actual conversation content. The actual transcript text
      // must be fetched separately using the transcriptContentUrl provided in the metadata.
      console.log('Processing transcript data:', JSON.stringify(transcriptData, null, 2));
      
      // Check for different possible transcript data structures
      let fullTranscript = '';
      let participantSummary = '';
      
      // NEW: Handle the rich notification data from Microsoft Graph
      if (transcriptData && transcriptData.transcriptContentUrl) {
        console.log('🎯 Found rich transcript notification data!');
        
        const meetingOrganizer = transcriptData.meetingOrganizer;
        const organizerName = meetingOrganizer?.user?.displayName || 'Unknown Organizer';
        const createdTime = new Date(transcriptData.createdDateTime).toLocaleString();
        const endTime = new Date(transcriptData.endDateTime).toLocaleString();
        
        console.log('📋 This notification contains transcript METADATA only - the actual conversation text must be fetched separately');
        console.log('🔗 Transcript content URL found:', transcriptData.transcriptContentUrl);
        console.log('📖 According to Microsoft Graph docs, we need OnlineMeetingTranscript.Read.All permission');
        
        // Return clean transcript summary (without verbose metadata)
        return {
          title: `Meeting Transcript - ${new Date().toLocaleDateString()}`,
          body: `## 📝 Meeting Summary\n\n` +
                `**Meeting completed with transcript available**\n\n` +
                `⏳ **AI Insights Status**: Attempting to fetch AI-generated summary from Microsoft 365 Copilot...\n\n` +
                `🔗 **Next Steps**: This summary will be automatically updated with AI insights if available.\n\n` +
                `*AI insights require Microsoft 365 Copilot license and may take up to 4 hours to become available after the meeting.*`,
          originalTranscript: `Rich notification data: ${JSON.stringify(transcriptData, null, 2)}`,
          isMetadata: false,
          isRichData: true,
          transcriptUrl: transcriptData.transcriptContentUrl
        };
      }
      
      // Handle Microsoft Graph call transcript structure
      if (transcriptData && transcriptData.content) {
        // This is a transcript content string - Microsoft Graph format
        fullTranscript = transcriptData.content;
      } else if (transcriptData && transcriptData.transcripts) {
        // Handle array of transcript segments
        if (Array.isArray(transcriptData.transcripts)) {
          transcriptData.transcripts.forEach(transcript => {
            if (transcript.content) {
              fullTranscript += transcript.content + '\n';
            }
          });
        }
      } else if (transcriptData && typeof transcriptData === 'string') {
        // Handle direct string content
        fullTranscript = transcriptData;
      } else if (transcriptData && transcriptData.callRecords) {
        // Handle call records structure
        transcriptData.callRecords.forEach(record => {
          if (record.content) {
            fullTranscript += record.content + '\n';
          }
        });
      } else if (transcriptData && transcriptData.user) {
        // Handle metadata notification - this is info about transcript creation, not content
        console.log('Received transcript metadata notification for user:', transcriptData.user.id);
        
        const userName = transcriptData.user.displayName || 'Unknown User';
        
        return {
          title: `Meeting Summary - ${new Date().toLocaleDateString()}`,
          body: `## 📝 Meeting Summary\n\n` +
                `Meeting transcript notification received for user: ${userName}\n\n` +
                `⏳ **Processing Status**: Attempting to fetch meeting content and AI insights...\n\n` +
                `*This summary will be updated automatically once meeting content is processed.*`,
          originalTranscript: 'Metadata notification - no transcript content',
          isMetadata: true
        };
      }

      if (!fullTranscript.trim()) {
        console.log('No transcript content found in data structure');
        return null;
      }

      console.log('📝 Processing transcript content for clean summary...');
      console.log('📋 Transcript found:', fullTranscript.length, 'characters');
      console.log('📋 Content preview:', fullTranscript.substring(0, 100) + '...');

      // Extract participant information if available
      if (transcriptData.organizer) {
        participantSummary += `Organizer: ${transcriptData.organizer.displayName || 'Unknown'}\n`;
      }
      if (transcriptData.participants && Array.isArray(transcriptData.participants)) {
        participantSummary += `Participants: ${transcriptData.participants.map(p => p.displayName || 'Unknown').join(', ')}\n`;
      }

      // Simple summarization (replace with AI service like Azure OpenAI)
      const summary = this.summarizeText(fullTranscript);
      
      console.log('📝 Creating clean transcript summary (no full transcript content)...');
      console.log('📋 Transcript length:', fullTranscript.length, 'characters');
      console.log('📋 Summary preview:', summary.substring(0, 100) + '...');
      
      return {
        title: `Meeting Summary - ${new Date().toLocaleDateString()}`,
        body: `## 📝 Meeting Summary\n\n${participantSummary ? participantSummary + '\n' : ''}${summary}\n\n` +
              `*Summary generated from meeting transcript. AI insights may be available separately if Microsoft 365 Copilot is enabled.*`,
        originalTranscript: fullTranscript,
        isMetadata: false,
        hasActualContent: true,
        hasAIInsights: false
      };
    } catch (error) {
      console.error('Error processing transcript:', error);
      return null;
    }
  }

  /**
   * Enhanced transcript processing with metadata support
   * @param {object} transcriptData - Transcript data with enhanced structure
   * @returns {object|null} Processed summary or null
   */
  static processTranscriptEnhanced(transcriptData) {
    try {
      console.log('Processing enhanced transcript data...');
      
      // Check if this is fetched content with our enhanced structure
      if (transcriptData && transcriptData.content && transcriptData.metadata) {
        console.log('Processing fetched transcript content with metadata');
        
        const fullTranscript = transcriptData.content;
        const metadata = transcriptData.metadata;
        
        // Extract participant info from metadata if available
        let participantSummary = '';
        if (metadata.meetingOrganizer) {
          participantSummary += `Organizer: ${metadata.meetingOrganizer.displayName || 'Unknown'}\n`;
        }
        
        // Enhanced summarization for actual transcript content
        const summary = this.summarizeText(fullTranscript);
        
        console.log('📝 Creating clean enhanced transcript summary...');
        console.log('📋 Transcript length:', fullTranscript.length, 'characters');
        console.log('📋 Summary preview:', summary.substring(0, 100) + '...');
        
        return {
          title: `Meeting Summary - ${new Date().toLocaleDateString()}`,
          body: `## 📝 Meeting Summary\n\n${participantSummary ? participantSummary + '\n' : ''}${summary}\n\n` +
                `*Summary generated from fetched meeting transcript. AI insights may be available separately if Microsoft 365 Copilot is enabled.*`,
          originalTranscript: fullTranscript,
          isMetadata: false,
          hasActualContent: true,
          hasAIInsights: false,
          source: 'fetched',
          format: transcriptData.originalFormat || 'unknown'
        };
      }
      
      // Fall back to original processing
      return this.processTranscript(transcriptData);
      
    } catch (error) {
      console.error('Error in enhanced transcript processing:', error);
      return this.processTranscript(transcriptData); // Fallback to original
    }
  }

  /**
   * Create a simple summary with just transcript content
   * @param {object} transcriptData - Transcript metadata
   * @returns {object} Simple summary object with transcript only
   */
  static createFallbackSummary(transcriptData) {
    console.log('📝 Creating simple summary with transcript content only...');
    
    const createdTime = new Date(transcriptData.createdDateTime);
    
    // Extract actual transcript content if available
    let transcriptContent = '';
    if (transcriptData.transcriptContent) {
      transcriptContent = transcriptData.transcriptContent;
    } else if (transcriptData.content) {
      transcriptContent = transcriptData.content;
    } else {
      transcriptContent = 'Transcript content not available in this notification.';
    }
    
    return {
      title: `Meeting Notes - ${createdTime.toLocaleDateString()}`,
      body: transcriptContent,
      isMetadata: false,
      isRichData: true,
      hasActualContent: transcriptContent !== 'Transcript content not available in this notification.',
      meetingDetails: {
        startTime: transcriptData.createdDateTime,
        endTime: transcriptData.endDateTime,
        meetingId: transcriptData.meetingId,
        callId: transcriptData.callId,
        transcriptId: transcriptData.id
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate simple summary with transcript content only
   * @param {object} transcriptData - Transcript data
   * @returns {object|null} Simple summary or null
   */
  static generateEnhancedMetadataSummary(transcriptData) {
    try {
      console.log('🎯 Generating simple summary with transcript content only...');
      
      const createdDate = new Date(transcriptData.createdDateTime);
      
      // Extract actual transcript content if available
      let transcriptContent = '';
      if (transcriptData.transcriptContent) {
        transcriptContent = transcriptData.transcriptContent;
      } else if (transcriptData.content) {
        transcriptContent = transcriptData.content;
      } else {
        transcriptContent = 'Transcript content not available in this notification.';
      }
      
      const title = `Meeting Notes - ${createdDate.toLocaleDateString()}`;
      
      console.log('✅ Simple summary generated successfully');
      
      return {
        title: title,
        body: transcriptContent,
        originalTranscript: JSON.stringify(transcriptData, null, 2),
        isMetadata: false,
        isRichData: true,
        hasActualContent: transcriptContent !== 'Transcript content not available in this notification.',
        transcriptUrl: transcriptData.transcriptContentUrl,
        metadata: {
          meetingDate: createdDate.toISOString(),
          endDate: new Date(transcriptData.endDateTime).toISOString(),
          meetingId: transcriptData.meetingId,
          callId: transcriptData.callId
        }
      };
      
    } catch (error) {
      console.error('❌ Error generating simple summary:', error);
      return null;
    }
  }
}

module.exports = TranscriptProcessor;

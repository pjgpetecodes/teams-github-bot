const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

/**
 * Service for GitHub API interactions
 */
class GitHubService {
  /**
   * Create a GitHub issue
   * @param {object} summary - Summary object with title and body
   * @param {string} githubToken - GitHub access token
   * @param {string} repo - Repository in format OWNER/REPO
   * @returns {Promise<object>} Response object with success status
   */
  static async createIssue(summary, githubToken, repo) {
    try {
      console.log('📝 Creating GitHub issue...');
      console.log('🎯 GitHub Issue Content:');
      console.log('  - Title:', summary.title);
      console.log('  - Body Length:', summary.body?.length || 0, 'characters');
      console.log('  - Body Preview:', summary.body?.substring(0, 200) + '...');
      
      if (!summary) {
        throw new Error('No summary to create issue from');
      }
      
      if (!githubToken || !repo) {
        throw new Error('GitHub credentials not set');
      }

      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: summary.title,
          body: summary.body,
          labels: ['meeting-transcript', 'auto-generated']
          // Note: assignees removed - add a valid GitHub username here if needed
          // assignees: ['your-github-username']
        })
      });

      if (response.ok) {
        const issueData = await response.json();
        console.log('✅ Successfully created GitHub issue:', issueData.html_url);
        return { 
          success: true, 
          issueUrl: issueData.html_url,
          issueNumber: issueData.number 
        };
      } else {
        const error = await response.json();
        console.error('❌ Failed to create GitHub issue:', error);
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(error)}`);
      }
    } catch (error) {
      console.error('❌ Error creating GitHub issue:', error.message);
      throw error;
    }
  }

  /**
   * Create a GitHub issue from meeting transcript data
   * @param {object} meetingData - Meeting data with transcript and details
   * @param {string} githubToken - GitHub access token
   * @param {string} repo - Repository in format OWNER/REPO
   * @returns {Promise<object>} Response object with success status
   */
  static async createIssueFromMeeting(meetingData, githubToken, repo) {
    try {
      const formattedSummary = this.formatMeetingTranscript(meetingData);
      return await this.createIssue(formattedSummary, githubToken, repo);
    } catch (error) {
      console.error('❌ Error creating GitHub issue from meeting data:', error.message);
      throw error;
    }
  }

  /**
   * Validate GitHub credentials
   * @param {string} githubToken - GitHub access token
   * @param {string} repo - Repository in format OWNER/REPO
   * @returns {Promise<boolean>} True if credentials are valid
   */
  static async validateCredentials(githubToken, repo) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating GitHub credentials:', error);
      return false;
    }
  }

  /**
   * Format meeting transcript data for GitHub issue
   * @param {object} meetingData - Meeting data with transcript and details
   * @returns {object} Formatted summary object with title and body
   */
  static formatMeetingTranscript(meetingData) {
    const {
      created,
      transcriptContent,
      summary
    } = meetingData;

    const meetingDate = created ? new Date(created).toLocaleDateString() : 'Unknown Date';
    const title = `Meeting Notes - ${meetingDate}`;
    
    let body = '';
    
    // Add summary if available
    if (summary) {
      body += `${summary}\n\n`;
    }
    
    // Add transcript content only
    if (transcriptContent) {
      body += transcriptContent;
    }

    return { title, body };
  }
}

module.exports = GitHubService;

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
        })
      });

      if (response.ok) {
        const issueData = await response.json();
        console.log('✅ Successfully created GitHub issue:', issueData.html_url);
        
        // Try to assign the issue to Copilot using GraphQL API
        try {
          await this.assignIssueToCopilot(repo, issueData.number, githubToken);
        } catch (assignError) {
          console.warn('⚠️ Could not assign issue to Copilot (may not be available in this repo):', assignError.message);
        }
        
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

  /**
   * Assign an issue to GitHub Copilot using GraphQL API
   * @param {string} repo - Repository in format OWNER/REPO
   * @param {number} issueNumber - GitHub issue number
   * @param {string} githubToken - GitHub access token
   * @returns {Promise<boolean>} True if assignment was successful
   */
  static async assignIssueToCopilot(repo, issueNumber, githubToken) {
    try {
      console.log('🤖 Attempting to assign issue to GitHub Copilot...');
      
      const [owner, repoName] = repo.split('/');
      
      // Step 1: Check if Copilot coding agent is available in the repository
      const suggestedActorsQuery = `
        query {
          repository(owner: "${owner}", name: "${repoName}") {
            suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
              nodes {
                login
                __typename
                ... on Bot {
                  id
                }
                ... on User {
                  id
                }
              }
            }
          }
        }
      `;
      
      const actorsResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: suggestedActorsQuery })
      });
      
      const actorsData = await actorsResponse.json();
      
      if (actorsData.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(actorsData.errors)}`);
      }
      
      // Find Copilot in the suggested actors
      const copilotActor = actorsData.data.repository.suggestedActors.nodes.find(
        node => node.login === 'copilot-swe-agent'
      );
      
      if (!copilotActor) {
        throw new Error('Copilot coding agent is not available in this repository');
      }
      
      console.log('✅ Copilot coding agent found in repository');
      
      // Step 2: Get the GraphQL global ID of the issue
      const issueQuery = `
        query {
          repository(owner: "${owner}", name: "${repoName}") {
            issue(number: ${issueNumber}) {
              id
              title
            }
          }
        }
      `;
      
      const issueResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: issueQuery })
      });
      
      const issueData = await issueResponse.json();
      
      if (issueData.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(issueData.errors)}`);
      }
      
      const issueId = issueData.data.repository.issue.id;
      const copilotId = copilotActor.id;
      
      // Step 3: Assign the issue to Copilot using the mutation
      const assignMutation = `
        mutation {
          replaceActorsForAssignable(input: {assignableId: "${issueId}", actorIds: ["${copilotId}"]}) {
            assignable {
              ... on Issue {
                id
                title
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
              }
            }
          }
        }
      `;
      
      const assignResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: assignMutation })
      });
      
      const assignData = await assignResponse.json();
      
      if (assignData.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(assignData.errors)}`);
      }
      
      console.log('🎉 Successfully assigned issue to GitHub Copilot!');
      console.log('🤖 Copilot will now start working on this issue automatically');
      
      return true;
      
    } catch (error) {
      console.error('❌ Error assigning issue to Copilot:', error.message);
      throw error;
    }
  }
}

module.exports = GitHubService;

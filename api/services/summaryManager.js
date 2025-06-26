/**
 * Service for managing summaries in memory (could be extended to use a database)
 */
class SummaryManager {
  constructor() {
    this.latestSummary = null;
    this.summaryHistory = [];
    this.maxHistorySize = 50; // Keep last 50 summaries
  }

  /**
   * Set the latest summary
   * @param {object} summary - Summary object
   */
  setLatestSummary(summary) {
    this.latestSummary = summary;
    
    // Add to history with timestamp
    this.summaryHistory.unshift({
      ...summary,
      timestamp: new Date().toISOString()
    });

    // Trim history if it gets too long
    if (this.summaryHistory.length > this.maxHistorySize) {
      this.summaryHistory = this.summaryHistory.slice(0, this.maxHistorySize);
    }
    
    console.log('📄 Summary updated and added to history');
  }

  /**
   * Get the latest summary
   * @returns {object|null} Latest summary or null
   */
  getLatestSummary() {
    return this.latestSummary;
  }

  /**
   * Check if there is a latest summary
   * @returns {boolean} True if summary exists
   */
  hasLatestSummary() {
    return !!this.latestSummary;
  }

  /**
   * Get summary history
   * @param {number} limit - Number of summaries to return (default: 10)
   * @returns {Array} Array of summaries
   */
  getSummaryHistory(limit = 10) {
    return this.summaryHistory.slice(0, limit);
  }

  /**
   * Update latest summary with additional content
   * @param {object} updates - Object with properties to update
   */
  updateLatestSummary(updates) {
    if (this.latestSummary) {
      this.latestSummary = {
        ...this.latestSummary,
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      console.log('📝 Latest summary updated with new content');
    } else {
      console.warn('⚠️ No latest summary to update');
    }
  }

  /**
   * Clear all summaries
   */
  clearSummaries() {
    this.latestSummary = null;
    this.summaryHistory = [];
    console.log('🗑️ All summaries cleared');
  }

  /**
   * Get status information
   * @returns {object} Status object
   */
  getStatus() {
    return {
      hasLatestSummary: this.hasLatestSummary(),
      latestSummary: this.latestSummary ? {
        title: this.latestSummary.title,
        isMetadata: this.latestSummary.isMetadata,
        hasContent: this.latestSummary.originalTranscript && 
                   this.latestSummary.originalTranscript !== 'Metadata notification - no transcript content',
        isRichData: this.latestSummary.isRichData || false,
        hasActualContent: this.latestSummary.hasActualContent || false,
        hasAIInsights: this.latestSummary.hasAIInsights || false,
        transcriptUrl: this.latestSummary.transcriptUrl,
        timestamp: this.latestSummary.timestamp || this.latestSummary.lastUpdated,
        githubIssue: this.latestSummary.githubIssue,
        autoCreated: this.latestSummary.autoCreated || false
      } : null,
      historyCount: this.summaryHistory.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get environment status
   * @returns {object} Environment configuration status
   */
  getEnvironmentStatus() {
    return {
      hasAzureTenantId: !!process.env.AZURE_TENANT_ID,
      hasAzureClientId: !!process.env.AZURE_CLIENT_ID,
      hasAzureClientSecret: !!process.env.AZURE_CLIENT_SECRET,
      hasGithubToken: !!process.env.GITHUB_TOKEN,
      hasGithubRepo: !!process.env.GITHUB_REPO,
      hasGraphCertPassword: !!process.env.GRAPH_CERT_PASSWORD
    };
  }
}

// Create singleton instance
const summaryManager = new SummaryManager();

module.exports = summaryManager;

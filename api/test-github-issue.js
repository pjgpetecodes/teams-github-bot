const GitHubService = require('./services/githubService');

// Your actual meeting data
const meetingData = {
  created: '26/06/2025, 23:52:58',
  transcriptContent: 'Peter Gallagher: I would like to make the background black.\nPeter Gallagher: And the outline is white.',
  summary: 'Meeting discussed UI design preferences for background and outline colors'
};

// Test the formatting
console.log('🧪 Testing GitHub issue formatting...\n');

const formattedIssue = GitHubService.formatMeetingTranscript(meetingData);

console.log('📋 Generated Issue:');
console.log('Title:', formattedIssue.title);
console.log('\nBody:');
console.log(formattedIssue.body);

console.log('\n' + '='.repeat(50));
console.log('This is what would be created as a GitHub issue');
console.log('='.repeat(50));

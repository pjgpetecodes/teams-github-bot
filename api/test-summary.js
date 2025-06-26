// Test the improved transcript processing
const TranscriptProcessor = require('./services/transcriptProcessor');

// Test data based on the user's example
const testTranscriptContent = "Peter Gallagher: I'd like to change the background colour of the application to just off blue and make all of the lines red.";

console.log('🧪 Testing improved transcript summarization...\n');

// Test the summarization function
const summary = TranscriptProcessor.summarizeText(testTranscriptContent);
console.log('📝 Generated Summary:');
console.log(summary);
console.log('\n' + '='.repeat(50) + '\n');

// Test the full transcript processing
const testData = {
  content: testTranscriptContent,
  meetingOrganizer: {
    user: {
      displayName: 'Peter Gallagher'
    }
  }
};

const result = TranscriptProcessor.processTranscript(testData);
if (result) {
  console.log('🎯 Full Processing Result:');
  console.log('Title:', result.title);
  console.log('\nBody:');
  console.log(result.body);
  console.log('\nLength:', result.body.length, 'characters');
} else {
  console.log('❌ No result from transcript processing');
}

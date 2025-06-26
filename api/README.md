# Teams GitHub Bot API - Modular Architecture

This project has been refactored into a clean, modular architecture that separates concerns and makes the codebase more maintainable.

## 📁 Project Structure

```
api/
├── index.js                    # Main application entry point
├── routes/
│   └── api.js                 # All API endpoints and route handlers
├── services/
│   ├── certificateService.js  # Certificate and cryptographic utilities
│   ├── graphService.js        # Microsoft Graph API interactions
│   ├── transcriptProcessor.js # Transcript processing and summarization
│   ├── githubService.js       # GitHub API interactions
│   └── summaryManager.js      # In-memory summary storage and management
└── index_backup.js           # Backup of original monolithic file
```

## 🚀 Key Features

### 1. **Automatic Workflow**
- Receives Microsoft Graph webhook notifications
- Automatically decrypts encrypted content
- Fetches AI-generated meeting insights (Microsoft 365 Copilot)
- Creates GitHub issues automatically
- Fallback to transcript content if AI insights unavailable

### 2. **AI-Powered Meeting Insights**
- Integration with Microsoft 365 Copilot Meeting AI Insights API
- Automatic extraction of:
  - Meeting notes with structured summaries
  - Action items with assigned owners
  - Key mentions and quotes from participants
- Rich formatting for GitHub issues

### 3. **Modular Services**

#### CertificateService
- PFX to PEM conversion
- Microsoft Graph webhook decryption
- Certificate management utilities

#### GraphService
- Microsoft Graph authentication
- Meeting AI Insights API integration
- Transcript content fetching
- Online meeting ID resolution

#### TranscriptProcessor
- VTT to plain text conversion
- AI insights processing and formatting
- Traditional transcript summarization
- Rich summary generation

#### GitHubService
- Automatic issue creation
- Credential validation
- GitHub API interactions

#### SummaryManager
- In-memory summary storage
- History tracking
- Status management
- Environment configuration tracking

## 📡 API Endpoints

### Core Endpoints
- `GET /` - API information
- `GET /health` - Health check
- `POST /api/webhook` - Microsoft Graph webhook receiver
- `GET /api/status` - Current status and environment info

### Summary Endpoints
- `GET /api/summary` - Get latest summary (raw)
- `GET /api/summary/display` - Get formatted summary for display
- `GET /api/summaries` - Get summary history

### Manual Operations
- `POST /api/fetch-ai-insights` - Manually fetch AI insights
- `POST /api/fetch-transcript-content` - Manually fetch transcript content
- `POST /api/simulate-transcript` - Test with simulated data
- `POST /api/create-issue` - Manually create GitHub issue

### Guidance Endpoints
- `GET /api/permissions-guide` - Permission setup guidance
- `GET /api/ai-insights-guide` - AI insights setup guide

## 🔧 Configuration

### Required Environment Variables
```bash
# Azure/Microsoft Graph
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# GitHub Integration
GITHUB_TOKEN=your-github-token
GITHUB_REPO=owner/repository-name

# Certificate (optional)
GRAPH_CERT_PASSWORD=your-certificate-password
```

### Prerequisites for AI Insights
1. **Microsoft 365 Copilot License** - Required for the signed-in user
2. **Meeting Requirements**:
   - Private scheduled meetings only
   - Must be transcribed or recorded
   - AI insights available up to 4 hours after meeting ends
3. **Permissions** (Delegated only):
   - `OnlineMeetings.Read`
   - `OnlineMeetings.ReadWrite`
   - `User.Read`

## 🎯 Usage Examples

### Automatic Processing
1. Teams meeting ends with transcription enabled
2. Microsoft Graph sends webhook notification
3. System automatically:
   - Decrypts notification
   - Fetches AI insights from Copilot
   - Creates formatted summary
   - Creates GitHub issue
   - Stores in summary history

### Manual AI Insights Fetch
```bash
POST /api/fetch-ai-insights
{
  "userId": "user-object-id",
  "onlineMeetingId": "meeting-id"
}
```

Or using join URL:
```bash
POST /api/fetch-ai-insights
{
  "joinWebUrl": "https://teams.microsoft.com/l/meetup-join/..."
}
```

### Display Summary
```bash
GET /api/summary/display
```

Returns structured data with:
- Meeting details
- AI-generated notes
- Action items with owners
- Key mentions and quotes
- GitHub issue information

## 🔄 Migration from Original File

The original monolithic `index.js` (1186+ lines) has been split into:
- **index.js** (47 lines) - Clean entry point
- **5 service modules** - Focused, single-responsibility modules
- **1 route module** - All API endpoints organized

### Benefits
- **Maintainability**: Easier to find and modify specific functionality
- **Testability**: Individual modules can be unit tested
- **Reusability**: Services can be imported and used independently
- **Readability**: Clear separation of concerns
- **Scalability**: Easy to add new features without bloating main file

## 🛠️ Development

### Starting the Server
```bash
cd api
npm install
node index.js
```

Or use VS Code tasks:
- "Start API Server" task

### Testing
- Use `POST /api/simulate-transcript` for testing without real meetings
- Check `GET /api/status` for system health
- Monitor logs for detailed processing information

## 🔍 Troubleshooting

### Common Issues
1. **AI Insights 403 Forbidden**
   - Ensure user has Copilot license
   - Check delegated permissions
   - Verify meeting access

2. **No AI Insights Available**
   - Wait up to 4 hours after meeting
   - Ensure meeting was transcribed
   - Verify private scheduled meeting

3. **GitHub Issue Creation Fails**
   - Check GITHUB_TOKEN and GITHUB_REPO
   - Verify repository permissions
   - Check rate limits

### Monitoring
- All operations log detailed information
- Use `/api/status` for system health
- Check `/api/summaries` for processing history

## 🚀 Future Enhancements

- Database storage for summaries
- User authentication and multi-tenant support
- Custom AI summary prompts
- Integration with more project management tools
- Real-time notifications via WebSockets
- Batch processing for multiple meetings

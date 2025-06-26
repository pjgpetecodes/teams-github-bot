# Teams GitHub Bot

A Microsoft Teams app that automatically receives meeting transcript notifications, processes them, and creates GitHub issues with meeting summaries and action items.

## 🎯 Features

- **Real-time Transcript Processing**: Receives encrypted webhook notifications from Microsoft Graph when meeting transcripts are created
- **Rich Meeting Summaries**: Extracts meeting metadata including organizer, duration, participants, and timestamps
- **GitHub Integration**: Automatically creates GitHub issues with formatted meeting summaries
- **Secure Webhook Handling**: Properly decrypts Microsoft Graph encrypted notifications
- **Application Access Policy**: Uses Teams admin policies to access meeting data with app-only authentication

## 🏗️ Architecture

```
Microsoft Teams Meeting (with transcription) 
    ↓
Microsoft Graph Webhook Notification (encrypted)
    ↓
Node.js/Express API (decrypts & processes)
    ↓
GitHub Issues API (creates formatted issues)
```

## 📋 Prerequisites

- **Microsoft Teams Admin Access**: Required to create Application Access Policies
- **Azure Admin Access**: Required to create app registrations and grant permissions
- **GitHub Account**: With repository access to create issues
- **ngrok Account**: For webhook tunneling (free tier works)
- **Node.js**: Version 14+ installed
- **PowerShell**: For running Teams policy setup scripts

## 🚀 Setup Instructions

### Step 1: Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd teams-github-bot

# Install API dependencies
cd api
npm install

# Install UI dependencies (if using the frontend)
cd ../ui
npm install
cd ..
```

### Step 2: Create Azure App Registration

1. **Go to Azure Portal**: [portal.azure.com](https://portal.azure.com)
2. **Navigate to**: Azure Active Directory → App registrations
3. **Click**: "New registration"
4. **Configure**:
   - **Name**: `Teams GitHub Bot` (or your preferred name)
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: Leave blank for now
5. **Click**: "Register"

#### 2.1: Note Your App Registration Details
After creation, copy these values (you'll need them for `.env`):
- **Application (client) ID**: Found on the Overview page
- **Directory (tenant) ID**: Found on the Overview page

#### 2.2: Create Client Secret
1. **Go to**: "Certificates & secrets" in your app registration
2. **Click**: "New client secret"
3. **Description**: `Teams GitHub Bot Secret`
4. **Expires**: Choose your preferred duration
5. **Click**: "Add"
6. **Copy the secret value immediately** (you won't see it again)

#### 2.3: Configure API Permissions
1. **Go to**: "API permissions" in your app registration
2. **Click**: "Add a permission"
3. **Select**: "Microsoft Graph"
4. **Choose**: "Application permissions"
5. **Add these permissions**:
   - `Chat.Read.All`
   - `ChatMessage.Read.All` 
   - `OnlineMeetingAiInsight.Read.All`
   - `OnlineMeetingTranscript.Read.All`
   - `User.Read.All`
6. **Click**: "Grant admin consent for [your organization]"
7. **Confirm**: All permissions show "Granted" status

### Step 3: Create GitHub Personal Access Token

1. **Go to GitHub**: [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Click**: "Generate new token" → "Generate new token (classic)"
3. **Configure**:
   - **Note**: `Teams GitHub Bot`
   - **Expiration**: Choose your preferred duration
   - **Scopes**: Select `repo` (full repository access)
4. **Click**: "Generate token"
5. **Copy the token immediately** (you won't see it again)

### Step 4: Get Your User Object ID

1. **Go to Azure Portal**: [portal.azure.com](https://portal.azure.com)
2. **Navigate to**: Azure Active Directory → Users
3. **Find your user** (the one who will organize test meetings)
4. **Click on your user**
5. **Copy the Object ID** from the user's profile page

### Step 5: Create Environment Configuration

1. **Copy the example file**:
   ```bash
   cd api
   cp .env.example .env
   ```

2. **Edit `.env`** with your actual values:
   ```env
   # GitHub Configuration
   GITHUB_TOKEN=your_github_personal_access_token_here
   GITHUB_REPO=owner/repository-name
   PORT=4000

   # Microsoft Graph Subscription Secrets
   AZURE_TENANT_ID=your-azure-tenant-id-guid
   AZURE_CLIENT_ID=your-azure-app-registration-client-id
   AZURE_CLIENT_SECRET=your-azure-app-registration-client-secret
   GRAPH_NOTIFICATION_URL=https://your-ngrok-url.ngrok-free.app/api/webhook
   GRAPH_CERT_PATH=../graphwebhook.cer
   GRAPH_CERT_ID=graphwebhook-cert-1
   GRAPH_CLIENT_STATE=secretClientState
   GRAPH_CERT_PASSWORD=

   # Microsoft Teams Application Access Policy Configuration
   TEAMS_USER_OBJECT_ID=meeting-organizer-user-object-id
   TEAMS_POLICY_NAME=TeamsGitHubBotPolicy
   ```

#### 5.1: Where to Find Each Value:

| Field | Where to Find |
|-------|---------------|
| `GITHUB_TOKEN` | GitHub Settings → Developer settings → Personal access tokens |
| `GITHUB_REPO` | Your GitHub repository in format `owner/repo-name` |
| `AZURE_TENANT_ID` | Azure Portal → Azure AD → App registration → Overview |
| `AZURE_CLIENT_ID` | Azure Portal → Azure AD → App registration → Overview |
| `AZURE_CLIENT_SECRET` | Azure Portal → Azure AD → App registration → Certificates & secrets |
| `TEAMS_USER_OBJECT_ID` | Azure Portal → Azure AD → Users → [Your User] → Object ID |
| `GRAPH_NOTIFICATION_URL` | Will be set automatically by the setup script |

### Step 6: Setup Teams Application Access Policy

⚠️ **IMPORTANT**: This step requires **Teams Admin privileges**.

1. **Run the PowerShell script** via VS Code task:
   - Press `Ctrl+Shift+P`
   - Type "Tasks: Run Task"
   - Select "🔐 Setup Teams Application Access Policy"

   **OR** run manually:
   ```powershell
   cd api
   powershell -ExecutionPolicy Bypass -File setup-application-access-policy.ps1
   ```

2. **Sign in with Teams Admin account** when prompted
3. **Wait for completion** - the script will:
   - Install Microsoft Teams PowerShell module
   - Create the Application Access Policy
   - Assign it to your user account

4. **⏰ CRITICAL: Wait 30 minutes** for the policy to propagate through Microsoft's systems

### Step 7: Setup Webhooks (After 30-minute wait)

1. **Run the webhook setup** via VS Code task:
   - Press `Ctrl+Shift+P`
   - Type "Tasks: Run Task"
   - Select "🚀 Auto Setup Webhook"

   **OR** run manually:
   ```bash
   node setup-webhook.js
   ```

2. **The script will automatically**:
   - Start the API server on port 4000
   - Start ngrok tunnel
   - Update your `.env` with the ngrok URL
   - Create SSL certificates for webhook encryption
   - Register Microsoft Graph subscriptions
   - Clean up any existing subscriptions first

## 🧪 Testing the Setup

### Check ngrok Status
1. **View ngrok dashboard**: [http://localhost:4040](http://localhost:4040)
2. **Monitor requests**: You'll see webhook calls in the ngrok interface
3. **Check tunnel status**: Ensure the tunnel is active and forwarding to localhost:4000

### Test with a Real Teams Meeting

⚠️ **Important**: Must be a **scheduled meeting**, not a channel meeting!

1. **Schedule a Teams Meeting**:
   - Use Outlook or Teams calendar
   - Must be a proper meeting invitation, not an ad-hoc channel call
   - Ensure you're the meeting organizer

2. **Start the Meeting**:
   - Join the scheduled meeting
   - **Enable transcription**: Click "More actions" (…) → "Start recording and transcription" → "Start transcription"
   - Speak for at least 30 seconds to generate content
   - Say something like: "This is a test meeting for the GitHub bot integration"

3. **End the Meeting**:
   - Click "End meeting" 
   - Transcription will be processed automatically

4. **Monitor the Webhook**:
   - Check ngrok dashboard at [http://localhost:4040](http://localhost:4040)
   - Look for POST requests to `/api/webhook`
   - Check API server logs for processing messages

5. **Check Results**:
   - **API Status**: GET `http://localhost:4000/api/status`
   - **Summary**: GET `http://localhost:4000/api/summary`
   - **GitHub Issues**: Check your repository for the automatically created issue

## 🔧 Available VS Code Tasks

Press `Ctrl+Shift+P` → "Tasks: Run Task" → Select:

- **🚀 Auto Setup Webhook**: Complete webhook setup (run after 30-min policy wait)
- **🔐 Setup Teams Application Access Policy**: Setup Teams admin policy (run first)
- **Start API Server**: Run the Express server manually
- **Start UI Dev Server**: Run the React frontend
- **Start ngrok**: Start ngrok tunnel manually
- **Create Graph Subscription**: Create subscriptions manually
- **Get Graph Subscriptions**: List current subscriptions

## 🔍 Troubleshooting

### Common Issues

#### 1. 403 Forbidden Errors
- **Cause**: Application Access Policy not propagated yet
- **Solution**: Wait the full 30 minutes after policy creation

#### 2. Webhook Not Receiving Calls
- **Check**: ngrok tunnel is active at [http://localhost:4040](http://localhost:4040)
- **Check**: API server is running on port 4000
- **Check**: Meeting is scheduled (not channel call)
- **Check**: Transcription was enabled during the meeting

#### 3. Certificate/Decryption Errors  
- **Run**: The auto setup webhook task to regenerate certificates
- **Check**: Certificate files exist in root directory

#### 4. GitHub Issue Creation Fails
- **Check**: `GITHUB_TOKEN` has `repo` scope
- **Check**: `GITHUB_REPO` format is `owner/repository-name`
- **Check**: Repository exists and token has write access

### Debug Endpoints

- **API Status**: `GET http://localhost:4000/api/status`
- **Latest Summary**: `GET http://localhost:4000/api/summary`
- **Manual Transcript Fetch**: `POST http://localhost:4000/api/fetch-transcript-content`
- **Permissions Guide**: `GET http://localhost:4000/api/permissions-guide`
- **Simulate Transcript**: `POST http://localhost:4000/api/simulate-transcript`

### Logs to Monitor

1. **API Server Console**: Real-time webhook processing
2. **ngrok Dashboard**: [http://localhost:4040](http://localhost:4040) for request monitoring
3. **VS Code Terminal**: Task execution output

## 📚 Additional Resources

- [Microsoft Graph Webhooks Documentation](https://docs.microsoft.com/en-us/graph/webhooks)
- [Teams Application Access Policies](https://docs.microsoft.com/en-us/microsoftteams/teams-app-permission-policies)
- [Azure App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with a real Teams meeting
5. Submit a pull request

## 📄 License

[Add your license information here]

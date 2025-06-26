# Teams App Manifest Setup

The `manifest.json` file contains sensitive information and environment-specific URLs that should not be committed to version control.

## Setup Instructions

1. Copy the example manifest:
   ```bash
   cp manifest.example.json manifest.json
   ```

2. Update the following values in `manifest.json`:

   - **App ID** (`id`): Replace `00000000-0000-0000-0000-000000000000` with your Teams app ID from the Teams Developer Portal
   - **Azure AD App ID** (`webApplicationInfo.id`): Replace with your Azure AD application ID
   - **ngrok URL** (`staticTabs[0].contentUrl` and `validDomains`): Replace `your-ngrok-url.ngrok-free.app` with your actual ngrok domain
   - **Developer Info**: Update the `developer` section with your information

## Important Notes

- The `manifest.json` file is gitignored to prevent accidental commit of sensitive information
- Always use the example file as a template for new environments
- The ngrok URL will change each time you restart ngrok, so you'll need to update it accordingly

## Getting Your IDs

### Teams App ID
1. Go to [Teams Developer Portal](https://dev.teams.microsoft.com/)
2. Find your app and copy the App ID

### Azure AD App ID
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations
3. Find your app and copy the Application (client) ID

### ngrok URL
1. Start ngrok: `ngrok http 4000`
2. Copy the https URL (without the protocol) from the ngrok output

# PowerShell script to create Application Access Policy for Microsoft Teams
# This allows your app to access meeting transcripts with app-only authentication
# Reads configuration from .env file

param(
    [string]$EnvFile = ".env"
)

# Function to read .env file and load environment variables
function Load-EnvFile {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Host ".env file not found at: $Path" -ForegroundColor Red
        Write-Host "Make sure you're running this script from the api folder" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Loading configuration from: $Path" -ForegroundColor Cyan
    
    Get-Content $Path | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$") {
            $name = $matches[1]
            $value = $matches[2]
            
            # Remove quotes if present
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            
            # Set environment variable for this session
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            
            # Display loaded variables (hide sensitive ones)
            if ($name -like "*SECRET*" -or $name -like "*TOKEN*" -or $name -like "*PASSWORD*") {
                Write-Host "  $name = [HIDDEN]" -ForegroundColor Green
            } else {
                Write-Host "  $name = $value" -ForegroundColor Green
            }
        }
    }
}

# Load environment variables from .env file
Load-EnvFile -Path $EnvFile

# Get configuration from environment variables
$AppId = $env:AZURE_CLIENT_ID
$UserObjectId = $env:TEAMS_USER_OBJECT_ID
$PolicyName = $env:TEAMS_POLICY_NAME

# Validate required environment variables
if (-not $AppId) {
    Write-Host "AZURE_CLIENT_ID not found in .env file" -ForegroundColor Red
    exit 1
}
if (-not $UserObjectId) {
    Write-Host "EAMS_USER_OBJECT_ID not found in .env file" -ForegroundColor Red
    exit 1
}
if (-not $PolicyName) {
    Write-Host "TEAMS_POLICY_NAME not found in .env file" -ForegroundColor Red
    exit 1
}

Write-Host "`nSetting up Application Access Policy for Teams transcript access..." -ForegroundColor Green
Write-Host "App ID: $AppId" -ForegroundColor Yellow
Write-Host "User ID: $UserObjectId" -ForegroundColor Yellow
Write-Host "Policy Name: $PolicyName" -ForegroundColor Yellow

# Install Microsoft Teams PowerShell module if not already installed
Write-Host "`nInstalling/Updating Microsoft Teams PowerShell module..." -ForegroundColor Cyan
try {
    # Check if module is already installed
    $installedModule = Get-Module -ListAvailable -Name MicrosoftTeams
    if ($installedModule) {
        Write-Host "Microsoft Teams module already installed (version: $($installedModule[0].Version))" -ForegroundColor Green
    } else {
        Install-Module -Name MicrosoftTeams -Force -AllowClobber -Scope CurrentUser
        Write-Host "Microsoft Teams module installed successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed to install Microsoft Teams module: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
    exit 1
}

# Connect to Microsoft Teams
Write-Host "`nConnecting to Microsoft Teams..." -ForegroundColor Cyan
Write-Host "  You will be prompted to sign in with a Teams admin account" -ForegroundColor Yellow
try {
    Connect-MicrosoftTeams
    Write-Host "Connected to Microsoft Teams successfully" -ForegroundColor Green
    
    # Display connection info
    $context = Get-CsTenant
    if ($context) {
        Write-Host "Connected to tenant: $($context.DisplayName)" -ForegroundColor Cyan
        Write-Host "Tenant ID: $($context.TenantId)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Failed to connect to Microsoft Teams: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Create the Application Access Policy
Write-Host "`nCreating Application Access Policy..." -ForegroundColor Cyan
try {
    # Check if policy already exists
    $existingPolicy = Get-CsApplicationAccessPolicy -Identity $PolicyName -ErrorAction SilentlyContinue
    
    if ($existingPolicy) {
        Write-Host "Policy '$PolicyName' already exists" -ForegroundColor Yellow
        Write-Host "Updating existing policy..." -ForegroundColor Cyan
        Set-CsApplicationAccessPolicy -Identity $PolicyName -AppIds $AppId
        Write-Host "Application Access Policy '$PolicyName' updated successfully" -ForegroundColor Green
    } else {
        New-CsApplicationAccessPolicy -Identity $PolicyName -AppIds $AppId
        Write-Host "Application Access Policy '$PolicyName' created successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed to create or update policy: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to manually create the policy in Teams Admin Center" -ForegroundColor Yellow
    Write-Host "Teams Admin Center: https://admin.teams.microsoft.com/policies/app-access" -ForegroundColor Blue
}

# Grant the policy to the user
Write-Host "`nGranting policy to user..." -ForegroundColor Cyan
try {
    Grant-CsApplicationAccessPolicy -PolicyName $PolicyName -Identity $UserObjectId
    Write-Host "Policy granted to user successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to grant policy to user: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to manually assign the policy in Teams Admin Center" -ForegroundColor Yellow
    Write-Host "User Management: https://admin.teams.microsoft.com/users" -ForegroundColor Blue
}

# Verify the policy assignment
Write-Host "`nVerifying policy assignment..." -ForegroundColor Cyan
try {
    $userPolicy = Get-CsUserPolicyAssignment -Identity $UserObjectId -PolicyType ApplicationAccessPolicy
    if ($userPolicy -and $userPolicy.PolicyName -eq $PolicyName) {
        Write-Host "Policy assignment verified successfully" -ForegroundColor Green
    } else {
        Write-Host " Policy assignment could not be verified" -ForegroundColor Yellow
    }
} catch {
    Write-Host " Could not verify policy assignment (this is normal and not a problem)" -ForegroundColor Gray
}

# Display completion information
Write-Host "`nApplication Access Policy setup completed!" -ForegroundColor Green
Write-Host "`nImportant Notes:" -ForegroundColor Yellow
Write-Host "  • It may take up to 30 minutes for the policy to take effect" -ForegroundColor White
Write-Host "  • The policy allows your app to access meeting data for the specified user" -ForegroundColor White
Write-Host "  • After 30 minutes, try your webhook again with a new Teams meeting" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "  1. Wait 30 minutes for policy propagation" -ForegroundColor White
Write-Host "  2. Start a new Teams meeting with the same organizer" -ForegroundColor White
Write-Host "  3. Check your webhook logs for successful transcript fetching" -ForegroundColor White
Write-Host "  4. Look for 'Successfully fetched transcript content' in logs" -ForegroundColor White

Write-Host "`nPolicy Details Created:" -ForegroundColor Magenta
Write-Host "  Policy Name: $PolicyName" -ForegroundColor White
Write-Host "  App ID: $AppId" -ForegroundColor White
Write-Host "  User ID: $UserObjectId" -ForegroundColor White

Write-Host "`nUseful Links:" -ForegroundColor Blue
Write-Host "  • Teams Admin Center: https://admin.teams.microsoft.com/" -ForegroundColor White
Write-Host "  • Application Access Policies: https://admin.teams.microsoft.com/policies/app-access" -ForegroundColor White
Write-Host "  • User Policy Assignments: https://admin.teams.microsoft.com/users" -ForegroundColor White

# Display testing information
Write-Host "`nTesting Your Setup:" -ForegroundColor Magenta
Write-Host "  • Test manual transcript fetch: POST http://localhost:4000/api/fetch-transcript-content" -ForegroundColor White
Write-Host "  • Check webhook status: GET http://localhost:4000/api/status" -ForegroundColor White
Write-Host "  • View permissions guide: GET http://localhost:4000/api/permissions-guide" -ForegroundColor White

# Disconnect from Teams
Write-Host "`nDisconnecting from Microsoft Teams..." -ForegroundColor Cyan
try {
    Disconnect-MicrosoftTeams
    Write-Host "Disconnected successfully" -ForegroundColor Green
} catch {
    Write-Host " Disconnect failed (not critical): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nSetup complete! Wait 30 minutes and test with a new meeting." -ForegroundColor Green
Write-Host "Configuration loaded from: $EnvFile" -ForegroundColor Gray

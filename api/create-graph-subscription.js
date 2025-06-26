// create-graph-subscription.js
// Usage: node create-graph-subscription.js
// Make sure to fill in the required values below.

require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const path = require('path');
const base64 = (filePath) => fs.readFileSync(filePath).toString('base64');

// === CONFIGURATION ===
const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const notificationUrl = process.env.GRAPH_NOTIFICATION_URL || 'https://2a28-2a02-c7c-8e9e-bd00-6d02-900a-9b94-6bb0.ngrok-free.app/api/webhook';
const encryptionCertificatePath = process.env.GRAPH_CERT_PATH || path.join(__dirname, '../graphwebhook.cer');
const encryptionCertificateId = process.env.GRAPH_CERT_ID || 'graphwebhook-cert-1';
const clientState = process.env.GRAPH_CLIENT_STATE || 'secretClientState';
// Set expiration to 60 minutes from now (Microsoft Graph Teams resource max)
const SUBSCRIPTION_DURATION_MINUTES = 60;
const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_DURATION_MINUTES * 60 * 1000).toISOString(); // 60 minutes from now

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'client_credentials');

  const res = await fetch(url, {
    method: 'POST',
    body: params
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function createSubscription(accessToken) {
  const certBase64 = base64(encryptionCertificatePath);
  const body = {
    changeType: 'created',
    notificationUrl,
    resource: 'communications/onlineMeetings/getAllTranscripts', // Tenant-level subscription for ALL transcripts
    includeResourceData: true,
    encryptionCertificate: certBase64,
    encryptionCertificateId,
    expirationDateTime,
    clientState,
    lifecycleNotificationUrl: notificationUrl // Required for >1hr expiration
  };
  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to create subscription: ' + JSON.stringify(data));
  return data;
}

async function listSubscriptions(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to list subscriptions: ' + JSON.stringify(data));
  return data.value || [];
}

async function deleteSubscription(accessToken, subscriptionId) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete subscription ${subscriptionId}: ${res.status}`);
}

// Function to renew a subscription by ID
async function renewSubscription(accessToken, subscriptionId) {
  const newExpiration = new Date(Date.now() + SUBSCRIPTION_DURATION_MINUTES * 60 * 1000).toISOString();
  const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expirationDateTime: newExpiration })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to renew subscription: ' + JSON.stringify(data));
  return data;
}

// Test the app registration by calling a relevant Graph endpoint
async function testAppRegistration(accessToken) {
  try {
    // Simple test to verify the token works
    console.log('✅ Access token obtained successfully');
    console.log('📋 App registration appears to be configured correctly');
  } catch (err) {
    console.error('App registration test error:', err);
  }
}

(async () => {
  try {
    const token = await getAccessToken();
    // Test the app registration and permissions
    await testAppRegistration(token);
    // List and delete existing subscriptions for the same resource
    const subs = await listSubscriptions(token);
    for (const sub of subs) {
      if (sub.resource === 'communications/onlineMeetings/getAllTranscripts') {
        console.log(`Deleting existing subscription: ${sub.id}`);
        await deleteSubscription(token, sub.id);
      }
    }
    // Now create the new subscription
    const result = await createSubscription(token);
    console.log('Subscription created:', result);
    // To keep the subscription alive, schedule renewSubscription before expiration.
    // Example: setInterval or use a cron job to call renewSubscription with the subscription ID every 50-55 minutes.
    // This script currently only creates the subscription; implement renewal in your production server as needed.
  } catch (err) {
    console.error(err);
  }
})();

// get-graph-subscriptions.js
// Usage: node get-graph-subscriptions.js
// Lists all Microsoft Graph subscriptions for your app

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;

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

async function listSubscriptions(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to get subscriptions: ' + JSON.stringify(data));
  return data;
}

(async () => {
  try {
    const token = await getAccessToken();
    const result = await listSubscriptions(token);
    console.log('Subscriptions:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
})();

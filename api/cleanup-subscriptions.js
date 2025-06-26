require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', process.env.AZURE_CLIENT_ID);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', process.env.AZURE_CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');

  const res = await fetch(url, {
    method: 'POST',
    body: params
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function listAndDeleteSubscriptions() {
  try {
    const accessToken = await getAccessToken();
    console.log('Fetching existing subscriptions...');
    
    // Get all subscriptions
    const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error('Failed to list subscriptions: ' + JSON.stringify(data));
    
    const subscriptions = data.value || [];
    console.log(`Found ${subscriptions.length} subscription(s):`);
    
    for (const subscription of subscriptions) {
      console.log(`\nSubscription ID: ${subscription.id}`);
      console.log(`Resource: ${subscription.resource}`);
      console.log(`Change Type: ${subscription.changeType}`);
      console.log(`Notification URL: ${subscription.notificationUrl}`);
      console.log(`Expiration: ${subscription.expirationDateTime}`);
      console.log(`Client State: ${subscription.clientState}`);
      
      if (subscription.encryptionCertificateId) {
        console.log(`Certificate ID: ${subscription.encryptionCertificateId}`);
      }
      
      // Delete the subscription
      console.log(`Deleting subscription ${subscription.id}...`);
      try {
        const deleteRes = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscription.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (deleteRes.ok || deleteRes.status === 404) {
          console.log('✅ Subscription deleted successfully');
        } else {
          console.error('❌ Failed to delete subscription:', deleteRes.status, deleteRes.statusText);
        }
      } catch (deleteError) {
        console.error('❌ Failed to delete subscription:', deleteError.message);
      }
    }
    
    if (subscriptions.length === 0) {
      console.log('No subscriptions found.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listAndDeleteSubscriptions();

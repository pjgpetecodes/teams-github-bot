const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

// Test RSC permissions and transcript access
async function testRSCPermissions() {
    try {
        console.log('🔍 Testing RSC permissions and transcript access...\n');

        // Test 1: Check webhook status
        console.log('1. Testing webhook status...');
        const statusResponse = await fetch('http://localhost:4000/api/status');
        const statusData = await statusResponse.json();
        console.log('✅ Webhook status:', statusData);

        // Test 2: Check permissions guidance
        console.log('\n2. Checking permissions guidance...');
        const permissionsResponse = await fetch('http://localhost:4000/api/permissions-guide');
        const permissionsData = await permissionsResponse.json();
        console.log('✅ Permissions info:', permissionsData);

        // Test 3: Simulate transcript processing
        console.log('\n3. Testing transcript simulation...');
        const simulateResponse = await fetch('http://localhost:4000/api/simulate-transcript', {
            method: 'POST'
        });
        const simulateData = await simulateResponse.json();
        console.log('✅ Simulation result:', simulateData);

        // Test 4: Check Graph subscriptions
        console.log('\n4. Checking Graph subscriptions...');
        const { spawn } = require('child_process');
        const checkSubs = spawn('node', ['api/get-graph-subscriptions.js'], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        checkSubs.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅ All tests completed successfully!');
                console.log('\n📋 Next Steps:');
                console.log('1. Ensure Azure app registration has RSC configuration');
                console.log('2. Install updated Teams app package (teams-github-bot-v1.0.4.zip)');
                console.log('3. Grant RSC permissions during installation');
                console.log('4. Run a Teams meeting with transcription enabled');
                console.log('5. Check webhook logs for actual transcript notifications');
            } else {
                console.log('\n❌ Subscription check failed');
            }
        });

    } catch (error) {
        console.error('❌ Error testing RSC permissions:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the API server is running:');
            console.log('   npm run dev (in the api directory)');
        }
    }
}

// Run the test
testRSCPermissions();

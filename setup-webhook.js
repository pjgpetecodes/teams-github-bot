const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

class WebhookSetup {
  constructor() {
    this.ngrokProcess = null;
    this.apiProcess = null;
    this.ngrokUrl = null;
    this.envPath = path.join(__dirname, 'api', '.env');
  }

  async setupWebhook() {
    try {
      console.log('🚀 Starting automated webhook setup...\n');
      
      // Step 1: Start API server
      console.log('1️⃣ Starting API server...');
      await this.startApiServer();
      
      // Step 2: Start ngrok
      console.log('2️⃣ Starting ngrok...');
      await this.startNgrok();
      
      // Step 3: Get ngrok URL
      console.log('3️⃣ Getting ngrok URL...');
      await this.getNgrokUrl();
      
      // Step 4: Update .env file
      console.log('4️⃣ Updating .env file...');
      await this.updateEnvFile();
      
      // Step 5: Clean up old subscriptions
      console.log('5️⃣ Cleaning up old subscriptions...');
      await this.cleanupSubscriptions();
      
      // Step 6: Create new subscription
      console.log('6️⃣ Creating new Graph subscription...');
      await this.createSubscription();
      
      console.log('\n✅ Webhook setup complete!');
      console.log(`📡 Ngrok URL: ${this.ngrokUrl}`);
      console.log(`🔗 Webhook endpoint: ${this.ngrokUrl}/api/webhook`);
      console.log('\n🎯 You can now start Teams meetings and receive transcript notifications!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  async startNgrok() {
    return new Promise((resolve, reject) => {
      // Kill any existing ngrok processes first
      console.log('   🧹 Killing any existing ngrok processes...');
      exec('taskkill /F /IM ngrok.exe 2>nul || echo "No existing ngrok processes"', (error, stdout, stderr) => {
        if (stdout && stdout.trim() !== 'No existing ngrok processes') {
          console.log('   🧹 Cleanup output:', stdout.trim());
        }
        
        console.log('   🚀 Starting ngrok process on port 4000...');
        
        // Start ngrok in the background
        this.ngrokProcess = spawn('ngrok', ['http', '4000'], {
          stdio: 'pipe',
          detached: false
        });

        console.log(`   🔧 Ngrok process PID: ${this.ngrokProcess.pid}`);
        
        let ngrokReady = false;
        let startupOutput = '';
        
        this.ngrokProcess.stdout.on('data', (data) => {
          const output = data.toString();
          startupOutput += output;
          
          // Check for signs that ngrok is ready
          if (output.includes('started tunnel') || output.includes('Tunnel established')) {
            ngrokReady = true;
          }
          
          // Log each line of output separately for better readability
          const lines = output.trim().split('\n').filter(line => line.trim());
          lines.forEach(line => {
            console.log('   📡 Ngrok stdout:', line.trim());
          });
        });

        this.ngrokProcess.stderr.on('data', (data) => {
          const error = data.toString();
          
          // Log each line of stderr separately for better readability
          const lines = error.trim().split('\n').filter(line => line.trim());
          lines.forEach(line => {
            console.log('   📡 Ngrok stderr:', line.trim());
          });
          
          if (error.includes('ERROR') || error.includes('failed')) {
            reject(new Error(`Ngrok error: ${error}`));
          }
        });

        this.ngrokProcess.on('error', (error) => {
          console.log('   ❌ Ngrok process error:', error.message);
          reject(new Error(`Failed to start ngrok: ${error.message}`));
        });

        this.ngrokProcess.on('exit', (code, signal) => {
          console.log(`   📤 Ngrok process exited with code ${code} and signal ${signal}`);
          if (code !== 0 && code !== null) {
            reject(new Error(`Ngrok exited with code ${code}`));
          }
        });

        this.ngrokProcess.on('close', (code) => {
          console.log(`   🔒 Ngrok process closed with code ${code}`);
        });

        // Wait for ngrok to be ready with timeout
        const checkReady = (attempts = 0) => {
          if (ngrokReady || attempts >= 20) {
            console.log('   ✅ Ngrok startup complete');
            resolve();
          } else if (attempts >= 15) {
            console.log('   ⏳ Still waiting for ngrok to fully start...');
            setTimeout(() => checkReady(attempts + 1), 1000);
          } else {
            setTimeout(() => checkReady(attempts + 1), 500);
          }
        };
        
        // Start checking after a brief initial delay
        setTimeout(() => checkReady(), 1000);
      });
    });
  }

  async getNgrokUrl() {
    const maxRetries = 10;
    const retryDelay = 2000; // 2 seconds between retries
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔄 Attempt ${attempt}/${maxRetries} to get ngrok URL...`);
        
        const url = await this.fetchNgrokUrl();
        if (url) {
          this.ngrokUrl = url;
          console.log(`   ✅ Found ngrok URL: ${this.ngrokUrl}`);
          return;
        }
      } catch (error) {
        console.log(`   ⚠️ Attempt ${attempt} failed: ${error.message}`);
      }
      
      if (attempt < maxRetries) {
        console.log(`   ⏳ Waiting ${retryDelay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error('Failed to get ngrok URL after multiple attempts. Make sure ngrok is installed and can start properly.');
  }
  
  async fetchNgrokUrl() {
    return new Promise((resolve, reject) => {
      const http = require('http');
      
      // Force IPv4 by using 127.0.0.1 instead of localhost
      const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const tunnelData = JSON.parse(data);
            const tunnel = tunnelData.tunnels?.find(t => t.config?.addr === 'http://localhost:4000');
            
            if (tunnel) {
              resolve(tunnel.public_url);
            } else {
              reject(new Error('No tunnel found for port 4000'));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse ngrok response: ${parseError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Failed to connect to ngrok API: ${error.message}`));
      });
      
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('Timeout connecting to ngrok API'));
      });
    });
  }

  async updateEnvFile() {
    try {
      let envContent = fs.readFileSync(this.envPath, 'utf8');
      
      // Update the GRAPH_NOTIFICATION_URL
      const webhookUrl = `${this.ngrokUrl}/api/webhook`;
      const urlRegex = /^GRAPH_NOTIFICATION_URL=.*$/m;
      
      if (urlRegex.test(envContent)) {
        envContent = envContent.replace(urlRegex, `GRAPH_NOTIFICATION_URL=${webhookUrl}`);
      } else {
        envContent += `\nGRAPH_NOTIFICATION_URL=${webhookUrl}`;
      }
      
      fs.writeFileSync(this.envPath, envContent);
      console.log(`   ✅ Updated .env file with webhook URL: ${webhookUrl}`);
      
    } catch (error) {
      throw new Error(`Failed to update .env file: ${error.message}`);
    }
  }

  async cleanupSubscriptions() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const result = await execAsync('node cleanup-subscriptions.js', {
        cwd: path.join(__dirname, 'api')
      });
      
      console.log('   ✅ Old subscriptions cleaned up');
      if (result.stdout) {
        console.log('   📋', result.stdout.trim());
      }
    } catch (error) {
      console.log('   ⚠️ Cleanup warning:', error.message);
      // Continue anyway
    }
  }

  async createSubscription() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const result = await execAsync('node create-graph-subscription.js', {
        cwd: path.join(__dirname, 'api')
      });
      
      console.log('   ✅ New Graph subscription created');
      if (result.stdout) {
        console.log('   📋', result.stdout.trim());
      }
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up processes...');
    
    if (this.ngrokProcess) {
      console.log('   🔧 Terminating ngrok PID:', this.ngrokProcess.pid);
      this.ngrokProcess.kill();
    }
    
    if (this.apiProcess) {
      console.log('   🔧 Terminating API server PID:', this.apiProcess.pid);
      this.apiProcess.kill();
    }
    
    // Wait a moment for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force kill if still running
    try {
      if (this.ngrokProcess) {
        exec(`taskkill /F /PID ${this.ngrokProcess.pid} 2>nul`, (error, stdout, stderr) => {
          if (stdout) console.log('   🧹 Ngrok force cleanup output:', stdout.trim());
        });
      }
      
      if (this.apiProcess) {
        exec(`taskkill /F /PID ${this.apiProcess.pid} 2>nul`, (error, stdout, stderr) => {
          if (stdout) console.log('   🧹 API force cleanup output:', stdout.trim());
        });
      }
    } catch (e) {
      // Ignore errors during force cleanup
    }
    
    console.log('   ✅ Process cleanup completed');
  }

  async startApiServer() {
    return new Promise((resolve, reject) => {
      console.log('   🔧 Starting API server on port 4000...');
      
      // Start the API server
      this.apiProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, 'api'),
        stdio: 'pipe',
        detached: false,
        shell: true
      });

      console.log(`   🔧 API process PID: ${this.apiProcess.pid}`);
      
      let apiReady = false;
      let startupOutput = '';
      
      this.apiProcess.stdout.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        
        // Check for signs that the API is ready
        if (output.includes('Server is running') || 
            output.includes('listening on') || 
            output.includes('port 4000') ||
            output.includes('started on')) {
          apiReady = true;
        }
        
        // Log each line of output separately for better readability
        const lines = output.trim().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          console.log('   🖥️  API stdout:', line.trim());
        });
      });

      this.apiProcess.stderr.on('data', (data) => {
        const error = data.toString();
        
        // Log each line of stderr separately for better readability
        const lines = error.trim().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          console.log('   🖥️  API stderr:', line.trim());
        });
        
        // Only reject on actual errors, not warnings
        if (error.includes('Error:') || error.includes('EADDRINUSE')) {
          reject(new Error(`API server error: ${error}`));
        }
      });

      this.apiProcess.on('error', (error) => {
        console.log('   ❌ API process error:', error.message);
        reject(new Error(`Failed to start API server: ${error.message}`));
      });

      this.apiProcess.on('exit', (code, signal) => {
        console.log(`   📤 API process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null && !apiReady) {
          reject(new Error(`API server exited with code ${code}`));
        }
      });

      this.apiProcess.on('close', (code) => {
        console.log(`   🔒 API process closed with code ${code}`);
      });

      // Wait for API to be ready with timeout
      const checkReady = (attempts = 0) => {
        if (apiReady) {
          console.log('   ✅ API server startup complete');
          resolve();
        } else if (attempts >= 30) {
          console.log('   ⏳ API server taking longer than expected...');
          // Try to check if port 4000 is actually responding
          this.checkApiHealth()
            .then(() => {
              console.log('   ✅ API server is responding (health check passed)');
              resolve();
            })
            .catch(() => {
              reject(new Error('API server failed to start within timeout period'));
            });
        } else if (attempts >= 20) {
          console.log('   ⏳ Still waiting for API server to fully start...');
          setTimeout(() => checkReady(attempts + 1), 1000);
        } else {
          setTimeout(() => checkReady(attempts + 1), 500);
        }
      };
      
      // Start checking after a brief initial delay
      setTimeout(() => checkReady(), 2000);
    });
  }

  async checkApiHealth() {
    return new Promise((resolve, reject) => {
      const http = require('http');
      
      const req = http.get('http://localhost:4000/health', (res) => {
        resolve();
      });
      
      req.on('error', (error) => {
        // Try a simple connection test
        const testReq = http.get('http://localhost:4000/', (res) => {
          resolve();
        });
        
        testReq.on('error', () => {
          reject(new Error('API server not responding'));
        });
        
        testReq.setTimeout(2000, () => {
          testReq.destroy();
          reject(new Error('API health check timeout'));
        });
      });
      
      req.setTimeout(2000, () => {
        req.destroy();
        reject(new Error('API health check timeout'));
      });
    });
  }

  // Handle process termination
  setupGracefulShutdown() {
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });
  }
}

// Check if ngrok is installed
function checkNgrokInstallation() {
  return new Promise((resolve) => {
    exec('ngrok version', (error) => {
      if (error) {
        console.error('❌ Ngrok is not installed or not in PATH');
        console.log('📦 Please install ngrok:');
        console.log('   - Download from: https://ngrok.com/download');
        console.log('   - Or install via package manager');
        process.exit(1);
      }
      resolve();
    });
  });
}

// Main execution
async function main() {
  await checkNgrokInstallation();
  
  const setup = new WebhookSetup();
  setup.setupGracefulShutdown();
  
  await setup.setupWebhook();
  
  // Keep the process running to maintain both API server and ngrok tunnel
  console.log('\n🔄 Keeping API server and ngrok tunnel alive... Press Ctrl+C to stop');
  
  // Keep alive
  setInterval(() => {
    // Just keep the process running
  }, 30000);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WebhookSetup;

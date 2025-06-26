require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Import our modular services and routes
const apiRoutes = require('./routes/api');

const app = express();
app.use(bodyParser.json());

// Serve static UI files from the ui/build or ui/public directory
app.use('/ui', express.static(path.join(__dirname, '..', 'ui', 'build')));
// Fallback to public directory if build doesn't exist
app.use('/ui', express.static(path.join(__dirname, '..', 'ui', 'public')));

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Teams GitHub Bot API',
    version: '2.0.0',
    endpoints: {
      ui: '/ui',
      api: '/api',
      health: '/health'
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Teams GitHub Bot API server running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   - UI: http://localhost:${PORT}/ui`);
  console.log(`   - API: http://localhost:${PORT}/api`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
});

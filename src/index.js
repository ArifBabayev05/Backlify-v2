const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const APIGeneratorController = require('./controllers/apiGeneratorController');
const apiPublisher = require('./services/apiPublisher');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create controller instance
const apiGeneratorController = new APIGeneratorController();

// Generate API endpoint
app.post('/generate-api', (req, res) => apiGeneratorController.generateAPI(req, res));

// Get SQL for an API
app.get('/api/:apiId/sql', (req, res) => apiGeneratorController.getSQL(req, res));

// Dynamic API routing
app.use('/api/:apiId', (req, res, next) => {
  const router = apiPublisher.getRouter(req.params.apiId);
  if (!router) {
    return res.status(404).json({ error: 'API not found' });
  }
  router(req, res, next);
});

// Add this route after your existing routes
app.get('/setup-script/:apiId', (req, res) => {
  const { apiId } = req.params;
  
  if (!apiGeneratorController.generatedApis.has(apiId)) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  const api = apiGeneratorController.generatedApis.get(apiId);
  
  // Set header for SQL file download
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="backlify-setup-${apiId}.sql"`);
  
  // Send the SQL
  res.send(api.sql);
});

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Backlify-v2',
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backlify-v2 server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});

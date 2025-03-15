const express = require('express');
const swaggerUi = require('swagger-ui-express');
const apiPublisher = require('./services/apiPublisher');

const app = express();

// For each API ID, set up the Swagger UI

// Set up Swagger UI for each API
app.get('/api/:apiId/swagger.json', (req, res) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Get the swagger spec by calling your existing method
  // This assumes your router has this method or similar
  const swaggerSpec = router._generateSwaggerSpec(); // Or however you get the spec
  res.json(swaggerSpec);
});

// Mount Swagger UI at the /docs path
app.use('/api/:apiId/docs', (req, res, next) => {
  const apiId = req.params.apiId;
  const router = apiPublisher.getRouter(apiId);
  
  if (!router) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Fetch the swagger spec from your endpoint
  const swaggerUrl = `/api/${apiId}/swagger.json`;
  
  // Set up Swagger UI options
  const options = {
    swaggerUrl: swaggerUrl,
    explorer: true
  };
  
  // Serve Swagger UI
  swaggerUi.setup(null, options)(req, res, next);
}, swaggerUi.serve);

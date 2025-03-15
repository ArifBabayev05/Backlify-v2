const swaggerUi = require('swagger-ui-express');
const apiGenerator = require('./services/apiGenerator');

// ... existing code ...

// Add this route to serve Swagger UI for each API
app.use('/api/:apiId/docs', (req, res, next) => {
  const apiId = req.params.apiId;
  const apiRouter = apiPublisher.getRouter(apiId);
  
  if (!apiRouter) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // Get the swagger spec for this API
  const swaggerSpec = apiGenerator._generateSwaggerSpec(
    apiGeneratorController.generatedApis.get(apiId).tables,
    apiGeneratorController.generatedApis.get(apiId).userId
  );
  
  // Serve Swagger UI with this spec
  const swaggerUiHandler = swaggerUi.setup(swaggerSpec);
  swaggerUi.serve(req, res, next);
}, swaggerUi.setup(null));

// ... rest of the existing app code ...
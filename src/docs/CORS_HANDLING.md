# CORS Handling in Backlify-v2

This document explains how Cross-Origin Resource Sharing (CORS) is handled in the Backlify-v2 application to prevent CORS errors when accessing the API from different origins.

## Implemented CORS Solutions

We've implemented a comprehensive approach to CORS handling:

1. **Global CORS Middleware** - Using the `cors` package with explicit configuration:
   ```javascript
   const corsOptions = {
     origin: '*',  // Allows requests from any origin
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id'],
     exposedHeaders: ['Content-Length', 'Content-Disposition'],
     credentials: true,
     maxAge: 86400  // 24 hours
   };
   
   app.use(cors(corsOptions));
   app.options('*', cors(corsOptions));  // Handle preflight requests
   ```

2. **Custom CORS Middleware** - Additional middleware to ensure headers are set for all responses:
   ```javascript
   // In src/middleware/corsMiddleware.js
   const ensureCorsHeaders = (req, res, next) => {
     res.header('Access-Control-Allow-Origin', '*');
     // Additional headers...
     next();
   };
   
   app.use(ensureCorsHeaders);
   ```

3. **Error Handling with CORS** - Ensuring CORS headers are set even in error responses:
   ```javascript
   app.use((err, req, res, next) => {
     // Set CORS headers for error responses
     res.header('Access-Control-Allow-Origin', '*');
     // Additional headers...
     
     res.status(500).json({ error: 'Something went wrong!' });
   });
   ```

4. **Dynamic Routes CORS Handling** - Applying CORS headers to dynamically generated API endpoints:
   ```javascript
   // In apiGenerator.js
   router.use((req, res, next) => {
     setCorsHeaders(res);
     next();
   });
   
   router.options('*', (req, res) => {
     setCorsHeaders(res);
     res.status(200).end();
   });
   ```

## Testing CORS Configuration

To verify the CORS configuration is working:

1. Access the API from a different origin (e.g., from a frontend app on a different domain)
2. Check that preflight OPTIONS requests are handled correctly
3. Verify that all response headers include the required CORS headers

## Common CORS Issues and Solutions

If you encounter CORS issues:

1. **Missing Headers** - Ensure all required CORS headers are set
2. **Preflight Handling** - Ensure OPTIONS requests are handled correctly
3. **Credentials** - If using cookies or auth headers, ensure `credentials: true` is set and `Access-Control-Allow-Credentials` is 'true'

## Production Considerations

In production, you may want to restrict the allowed origins for security:

```javascript
const corsOptions = {
  origin: ['https://your-frontend-app.com', 'https://admin.your-app.com'],
  // Additional options...
};
```

You can update this in `src/index.js` by modifying the corsOptions object. 
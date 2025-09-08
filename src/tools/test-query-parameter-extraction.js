const express = require('express');
const app = express();

// Simulate the middleware logic
app.use((req, res, next) => {
  let tokenUsername = null;
  
  // Try to extract from JWT token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Simulate JWT decode (simplified)
      if (token.includes('asda')) {
        tokenUsername = 'asda';
      }
    } catch (err) {
      console.log('Error extracting username from token:', err.message);
    }
  }
  
  // Then try from headers, body, or query parameters
  const XAuthUserId = tokenUsername || 
                req.query.XAuthUserId ||
                req.query.xauthuserid ||
                req.query['x-user-id'] ||
                req.headers['x-user-id'] || 
                req.headers['X-USER-ID'] || 
                req.headers['X-User-Id'] || 
                req.headers['x-user-id'.toLowerCase()] ||
                req.headers['xauthuserid'] ||
                req.headers['XAuthUserId'] ||
                req.header('x-user-id') ||
                req.header('xauthuserid') ||
                (req.body && req.body.XAuthUserId) ||
                'default';
  
  console.log('=== XAuthUserId EXTRACTION DEBUG ===');
  console.log('tokenUsername:', tokenUsername);
  console.log('req.query.XAuthUserId:', req.query.XAuthUserId);
  console.log('req.query.xauthuserid:', req.query.xauthuserid);
  console.log('req.query:', req.query);
  console.log('Using XAuthUserId:', XAuthUserId);
  
  // Set XAuthUserId on the request object
  req.XAuthUserId = XAuthUserId;
  
  next();
});

// Test endpoint
app.get('/test-query', (req, res) => {
  res.json({
    success: true,
    debug: {
      userId: req.XAuthUserId,
      query: req.query,
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'xauthuserid': req.headers['xauthuserid'],
        'XAuthUserId': req.headers['XAuthUserId']
      }
    }
  });
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test with: http://localhost:3001/test-query?XAuthUserId=asda');
});

module.exports = app;

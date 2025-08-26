/**
 * Additional CORS middleware to ensure headers are properly set
 * even in error cases or direct responses.
 */
const ensureCorsHeaders = (req, res, next) => {
  // Allow any origin
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle OPTIONS method
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

/**
 * Utility function to set CORS headers for any response
 * Can be used in dynamic routes or custom handlers
 */
const setCorsHeaders = (res, req = null) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
};

module.exports = {
  ensureCorsHeaders,
  setCorsHeaders
};
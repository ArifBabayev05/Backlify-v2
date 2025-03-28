/**
 * Additional CORS middleware to ensure headers are properly set
 * even in error cases or direct responses.
 */
const ensureCorsHeaders = (req, res, next) => {
  // Get origin from request
  const origin = req.headers.origin;
  
  // Set Access-Control-Allow-Origin to the specific origin if available
  // or fallback to * for development
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id, x-user-id, X-USER-ID, xauthuserid, XAuthUserId');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
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
  // Get origin from request if available
  const origin = req ? req.headers.origin : '*';
  
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id, x-user-id, X-USER-ID, xauthuserid, XAuthUserId');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  return res;
};

module.exports = {
  ensureCorsHeaders,
  setCorsHeaders
}; 
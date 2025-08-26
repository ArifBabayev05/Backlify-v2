/**
 * Additional CORS middleware to ensure headers are properly set
 * even in error cases or direct responses.
 */
const ensureCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  // If credentials are used, cannot use '*', must echo origin
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id, x-user-id, X-USER-ID, xauthuserid, XAuthUserId, x-skip-auth');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');

  // Handle OPTIONS method globally
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS preflight OK' });
  }
  next();
};

/**
 * Utility function to set CORS headers for any response
 * Can be used in dynamic routes or custom handlers
 */
const setCorsHeaders = (res, req = null) => {
  const origin = req && req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id, x-user-id, X-USER-ID, xauthuserid, XAuthUserId, x-skip-auth');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
};

module.exports = {
  ensureCorsHeaders,
  setCorsHeaders
};
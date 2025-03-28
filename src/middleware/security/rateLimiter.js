const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Rate limiter middleware using Redis-like storage with Supabase
 * Limits:
 * - General API requests: 100 requests per 15 minutes
 * - Sensitive endpoints (login/register): 10 requests per hour
 */
const rateLimiter = async (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userId = req.XAuthUserId || 'anonymous';
  const path = req.path;
  const method = req.method;
  
  try {
    console.log(`Checking IP: ${ip} against blacklist`);
    
    // First, clean up expired blacklist entries
    const currentTime = new Date().toISOString();
    
    // Clean up expired temporary blacklist entries with correct syntax
    await supabase
      .from('ip_blacklist')
      .delete()
      .not('expires_at', 'is', null) // Correct syntax for expires_at IS NOT NULL
      .lt('expires_at', currentTime);
    
    // Check if IP is in blacklist (either permanent or temporary)
    const { data: blacklistedIp, error: blacklistError } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', ip)
      .or('expires_at.is.null,expires_at.gt.' + currentTime)
      .maybeSingle();
    
    if (blacklistError) {
      console.error('Error checking IP blacklist:', blacklistError);
    }
    
    console.log('Blacklist check result:', blacklistedIp);
    
    // If IP is blacklisted, reject request
    if (blacklistedIp) {
      // Log security event
      await supabase.from('security_logs').insert([{
        ip,
        user_id: userId,
        method,
        path,
        headers: req.headers,
        type: 'BLACKLISTED_IP_ATTEMPT',
        detection: { 
          reason: blacklistedIp.reason,
          blacklist_type: blacklistedIp.expires_at ? 'temporary' : 'permanent',
          expires_at: blacklistedIp.expires_at
        },
        endpoint: req.originalUrl,
        details: `Blocked request from blacklisted IP: ${ip}`
      }]);
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address has been blacklisted',
        reason: blacklistedIp.reason || 'Security policy violation'
      });
    }
    
    // Determine if this is a sensitive endpoint
    const isSensitiveEndpoint = path.includes('/auth/login') || 
                               path.includes('/auth/register') || 
                               path.includes('/password/reset');
    
    // Set rate limit parameters based on endpoint sensitivity
    const windowMs = isSensitiveEndpoint ? 60 * 60 * 1000 : 15 * 60 * 1000; // 1 hour or 15 minutes
    const maxRequests = isSensitiveEndpoint ? 10 : 100; // 10 or 100 requests
    
    // Calculate window start time
    const windowStartTime = new Date(Date.now() - windowMs).toISOString();
    
    // Count recent requests - fixing the or syntax
    let query = supabase
      .from('api_logs')
      .select('*', { count: 'exact', head: true })
      .eq(isSensitiveEndpoint ? 'XAuthUserId' : 'ip', isSensitiveEndpoint ? userId : ip)
      .gte('timestamp', windowStartTime);
    
    // Add method or path filter
    query = query.or(`method.eq.${method},endpoint.ilike.%${path}%`);
    
    const { count, error } = await query;
    
    if (error) {
      console.error('Error checking rate limit:', error);
      return next(); // Proceed on error to avoid blocking legitimate traffic
    }
    
    // If limit exceeded
    if (count >= maxRequests) {
      // For sensitive endpoints, temporarily blacklist IP for repeated abuse
      if (isSensitiveEndpoint && count >= maxRequests * 2) {
        const expiryTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minute blacklist
        
        // Add to temporary blacklist
        await supabase.from('ip_blacklist').insert([{
          ip,
          reason: 'Rate limit exceeded on sensitive endpoint',
          expires_at: expiryTime.toISOString(),
          created_by: 'system'
        }]);
      }
      
      // Log security event
      await supabase.from('security_logs').insert([{
        ip,
        user_id: userId,
        method,
        path,
        headers: req.headers,
        type: 'RATE_LIMIT_EXCEEDED',
        detection: { 
          count, 
          limit: maxRequests,
          window: isSensitiveEndpoint ? '1 hour' : '15 minutes'
        },
        endpoint: req.originalUrl
      }]);
      
      // Return rate limit error
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${isSensitiveEndpoint ? '60 minutes' : '15 minutes'}.`
      });
    }
    
    // If all checks pass, proceed
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(); // Proceed on error to avoid blocking legitimate traffic
  }
};

module.exports = rateLimiter; 
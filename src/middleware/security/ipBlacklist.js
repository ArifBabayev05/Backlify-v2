const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * IP Blacklist middleware
 * Checks if the requester's IP is in the blacklist table
 * If found, blocks the request with 403 Forbidden
 */
const ipBlacklistMiddleware = async (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userId = req.XAuthUserId || 'anonymous';
  
  try {
    console.log(`[IP Blacklist] Checking IP: ${ip}`);
    
    // Check if IP is in blacklist (permanent or temporary that hasn't expired)
    const currentTime = new Date().toISOString();
    const { data: blacklistedIp, error } = await supabase
      .from('ip_blacklist')
      .select('*')
      .eq('ip', ip)
      .or(`expires_at.is.null,expires_at.gt.${currentTime}`)
      .maybeSingle();
    
    if (error) {
      console.error('[IP Blacklist] Error checking IP blacklist:', error);
      return next(); // Proceed on error to avoid blocking legitimate traffic
    }
    
    // If IP is blacklisted
    if (blacklistedIp) {
      console.log(`[IP Blacklist] Blocked blacklisted IP: ${ip} (Reason: ${blacklistedIp.reason})`);
      
      // Log security event
      await supabase.from('security_logs').insert([{
        ip,
        user_id: userId,
        method: req.method,
        path: req.path,
        headers: req.headers,
        type: 'BLACKLISTED_IP_BLOCKED',
        detection: { 
          reason: blacklistedIp.reason,
          blacklist_id: blacklistedIp.id,
          blacklist_type: blacklistedIp.expires_at ? 'temporary' : 'permanent',
          expires_at: blacklistedIp.expires_at
        },
        endpoint: req.originalUrl,
        details: `Blocked blacklisted IP: ${ip} (Reason: ${blacklistedIp.reason})`
      }]);
      
      // Return forbidden response
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address has been blacklisted',
        reason: blacklistedIp.reason || 'Security policy violation'
      });
    }
    
    // If IP is not blacklisted, proceed
    next();
  } catch (error) {
    console.error('[IP Blacklist] Middleware error:', error);
    next(); // Proceed on error to avoid blocking legitimate traffic
  }
};

/**
 * Periodically clean up expired blacklist entries
 */
const cleanupExpiredBlacklist = async () => {
  try {
    const currentTime = new Date().toISOString();
    
    // Delete expired temporary blacklist entries
    // Only delete entries where expires_at is not null and less than current time
    const { data, error } = await supabase
      .from('ip_blacklist')
      .delete()
      .not('expires_at', 'is', null) // Correct syntax for IS NOT NULL
      .lt('expires_at', currentTime)
      .select();
    
    if (error) {
      console.error('[IP Blacklist] Error cleaning up expired entries:', error);
    } else if (data && data.length > 0) {
      console.log(`[IP Blacklist] Cleaned up ${data.length} expired blacklist entries`);
    }
  } catch (error) {
    console.error('[IP Blacklist] Cleanup error:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredBlacklist, 60 * 60 * 1000);

// Run initial cleanup on startup
cleanupExpiredBlacklist();

module.exports = ipBlacklistMiddleware; 
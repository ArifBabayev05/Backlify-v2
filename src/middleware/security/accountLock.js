const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Account locking middleware
 * Manages account locking after multiple failed login attempts
 * Automatically unlocks accounts after specified time period
 */
const accountLockMiddleware = async (req, res, next) => {
  // Only apply this middleware to login requests
  if (!req.path.includes('/auth/login') || req.method !== 'POST') {
    return next();
  }
  
  const { username, email } = req.body;
  const userIdentifier = username || email;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  if (!userIdentifier) {
    return next();
  }
  
  try {
    // Check if the user account exists and if it's locked
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${userIdentifier},email.eq.${userIdentifier}`)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking account lock status:', error);
      return next();
    }
    
    // If user not found, proceed (authentication will fail normally)
    if (!user) {
      return next();
    }
    
    // Check if account is locked
    if (user.account_status === 'locked') {
      // Check if lock duration has expired (5 minutes)
      const lockTime = new Date(user.locked_at).getTime();
      const currentTime = new Date().getTime();
      const lockDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      // If lock time has passed, auto-unlock the account
      if (currentTime - lockTime >= lockDuration) {
        // Update user record to unlock
        await supabase
          .from('users')
          .update({
            account_status: 'active',
            login_attempts: 0,
            unlocked_at: new Date().toISOString(),
            unlocked_by: 'system-auto'
          })
          .eq('username', user.username);
        
        // Log the auto-unlock event
        await supabase.from('security_logs').insert([{
          ip,
          user_id: user.username,
          method: req.method,
          path: req.path,
          type: 'ACCOUNT_AUTO_UNLOCKED',
          detection: { 
            reason: 'Lock duration expired',
            locked_at: user.locked_at
          },
          endpoint: req.originalUrl,
          details: `Account auto-unlocked after 5-minute timeout: ${user.username}`
        }]);
        
        // Allow request to proceed
        return next();
      }
      
      // If still locked, reject login
      await supabase.from('security_logs').insert([{
        ip,
        user_id: user.username,
        method: req.method,
        path: req.path,
        type: 'LOCKED_ACCOUNT_ACCESS_ATTEMPT',
        endpoint: req.originalUrl,
        details: `Attempted login to locked account: ${user.username}`
      }]);
      
      return res.status(403).json({
        error: 'Account locked',
        message: 'Your account is temporarily locked due to multiple failed login attempts. Please try again later.'
      });
    }
    
    // If account is not locked, proceed with normal authentication
    next();
  } catch (error) {
    console.error('Account lock middleware error:', error);
    next(); // Proceed on error to avoid blocking legitimate traffic
  }
};

/**
 * Records login failures and locks accounts after 5 failed attempts
 * This function should be called by the login route handler on failed login
 */
const recordFailedLogin = async (username, req) => {
  if (!username) return;
  
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  try {
    // Get current user record
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (error || !user) {
      console.error('Error getting user for failed login record:', error);
      return;
    }
    
    // Increment failed login attempts
    const newAttempts = (user.login_attempts || 0) + 1;
    const updateData = {
      login_attempts: newAttempts,
      last_failed_login: new Date().toISOString()
    };
    
    // Lock account after 5 failed attempts
    if (newAttempts >= 5) {
      updateData.account_status = 'locked';
      updateData.locked_at = new Date().toISOString();
      updateData.lock_reason = 'Multiple failed login attempts';
    }
    
    // Update user record
    await supabase
      .from('users')
      .update(updateData)
      .eq('username', username);
    
    // Log security event
    await supabase.from('security_logs').insert([{
      ip,
      user_id: username,
      method: req.method,
      path: req.path,
      type: newAttempts >= 5 ? 'ACCOUNT_LOCKED' : 'FAILED_LOGIN',
      detection: { 
        attempts: newAttempts
      },
      endpoint: req.originalUrl,
      details: newAttempts >= 5 
        ? `Account locked after ${newAttempts} failed login attempts: ${username}`
        : `Failed login attempt ${newAttempts}/5: ${username}`
    }]);
  } catch (error) {
    console.error('Failed to record login failure:', error);
  }
};

/**
 * Resets login attempts counter on successful login
 * This function should be called by the login route handler on successful login
 */
const recordSuccessfulLogin = async (username, req) => {
  if (!username) return;
  
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  try {
    // Update user record
    await supabase
      .from('users')
      .update({
        login_attempts: 0,
        last_login: new Date().toISOString()
      })
      .eq('username', username);
    
    // Log security event
    await supabase.from('security_logs').insert([{
      ip,
      user_id: username,
      method: req.method,
      path: req.path,
      type: 'SUCCESSFUL_LOGIN',
      endpoint: req.originalUrl,
      details: `Successful login: ${username}`
    }]);
  } catch (error) {
    console.error('Failed to record successful login:', error);
  }
};

module.exports = {
  accountLockMiddleware,
  recordFailedLogin,
  recordSuccessfulLogin
}; 
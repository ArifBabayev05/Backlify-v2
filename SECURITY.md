# Backlify v2 Security Documentation

This document outlines the security features implemented in the Backlify v2 application.

## Security Features Overview

The following security features have been implemented:

### 1. Rate Limiting

- General API requests: Limited to 100 requests per 15 minutes
- Sensitive endpoints (login/register/password reset): Limited to 10 requests per hour
- Automatic temporary IP blacklisting after excessive abuse

### 2. IP Blacklist Management

- Automatic checking of IP addresses against blacklist database
- Temporary and permanent blacklisting support
- Automatic expiry of temporary blacklists

### 3. Input Validation & Sanitization

- SQL Injection protection
- XSS attack prevention
- Input validation for registration and sensitive endpoints
- Content sanitization

### 4. Account Security

- Account locking after 5 failed login attempts
- Automatic account unlocking after 5 minutes
- Failed login tracking and monitoring

### 5. Security Headers

- Content Security Policy (CSP) implementation
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options for clickjacking protection
- Various other security headers via Helmet

### 6. Authentication & Authorization

- JWT-based authentication with access and refresh tokens
- Secure token invalidation system for logout
- Token blacklisting via invalid_tokens database table
- Secure password storage using bcrypt
- Password policy enforcement
- Token expiration and refresh mechanism

### 7. Error Handling & Logging

- Centralized error handling
- Detailed security event logging
- Suspicious activity monitoring
- Global uncaught exception handling

### 8. SQL Injection Protection

- Query sanitization utility
- SQL query validation and safe parameter handling
- Dangerous SQL pattern detection

## Usage Guide

### Integrating Security Features

The security features are already integrated into the application through the main `security.js` file. The `applySecurityMiddleware()` function applies all security middleware in the correct order.

```javascript
// In app.js
const security = require('./security');
security.applySecurityMiddleware(app);
```

### Authentication

Authentication routes are automatically set up with the `setupAuthRoutes()` function:

```javascript
// In app.js
security.setupAuthRoutes(app);
```

This adds the following endpoints:
- `/auth/login` - For user login
- `/auth/refresh` - For refreshing access tokens
- `/auth/logout` - For secure token invalidation during logout
- `/auth/update-password` - For secure password updates

#### Token-Based Authentication

Backlify uses a dual-token approach for authentication:

1. **Access Token**: Short-lived token (1 hour default) used for API authorization
2. **Refresh Token**: Longer-lived token (7 days default) used to obtain new access tokens

When a user logs out, their refresh token is invalidated and added to the `invalid_tokens` table in the database. This ensures that:
- The user cannot continue to refresh their access token
- Proper security logging occurs when tokens are invalidated
- Token validation checks include verification that tokens haven't been invalidated

### Protecting Routes

To protect routes with authentication:

```javascript
const { authMiddleware } = require('./utils/security/auth');

// Apply to individual routes
app.get('/protected-route', authMiddleware, (req, res) => {
  // Only authenticated users can access this
});

// Or apply to all routes in a router
const router = express.Router();
router.use(authMiddleware);
```

### Password Policy

The password policy can be customized in `src/utils/security/passwordPolicy.js`:

```javascript
const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  // Other settings...
};
```

### Security Configuration

Main security settings can be adjusted in `src/config/security.js`:

```javascript
const securityConfig = {
  rateLimiting: {
    // Rate limiting settings
  },
  account: {
    // Account security settings
  },
  // Other security configurations
};
```

## Security Best Practices

1. **Keep dependencies updated**: Regularly update npm packages to avoid vulnerabilities
2. **Use HTTPS in production**: Always serve the application over HTTPS
3. **Environment variables**: Store sensitive information in environment variables
4. **Regular security audits**: Perform security audits on the codebase
5. **Monitor logs**: Regularly review security and error logs for suspicious activity

## Additional Resources

- [OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/nodejs/security-wg/blob/main/docs/security-checklist.md) 
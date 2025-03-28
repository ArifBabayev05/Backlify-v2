# Backlify Authentication Examples

This document provides examples of how to use JWT tokens with protected endpoints.

## Login and Get Tokens

First, you need to obtain access and refresh tokens by logging in:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username", 
    "password": "your_password"
  }'
```

Response:
```json
{
  "success": true,
  "username": "your_username",
  "email": "your_email@example.com",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Using the Access Token

Use the access token to make requests to protected endpoints by including it in the Authorization header:

```bash
curl -X POST http://localhost:3000/generate-schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "Create a database schema for a blog system"
  }'
```

## Refreshing the Access Token

When your access token expires, use the refresh token to get a new one:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

Response:
```json
{
  "accessToken": "NEW_ACCESS_TOKEN",
  "username": "your_username"
}
```

## Logout

To invalidate your refresh token when logging out:

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

This will invalidate the provided refresh token, preventing it from being used to generate new access tokens. Note that existing access tokens will still be valid until they expire, but they have a short lifespan (typically 1 hour).

## Testing Protected Endpoints

The following endpoints are protected and require a valid JWT token:

1. `/generate-schema` - Generates a database schema
2. `/modify-schema` - Modifies an existing schema
3. `/create-api-from-schema` - Creates an API from a schema

### Example: Generate Schema

```bash
curl -X POST http://localhost:3000/generate-schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "Create a database schema for a task management system"
  }'
```

### Example: Modify Schema

```bash
curl -X POST http://localhost:3000/modify-schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "Add a status field to the tasks table",
    "tables": [/* existing tables structure */]
  }'
```

### Example: Create API From Schema

```bash
curl -X POST http://localhost:3000/create-api-from-schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "tables": [/* your tables structure */]
  }'
```

## Testing with Invalid Token

To test the authentication failure scenario, use an invalid or expired token:

```bash
curl -X POST http://localhost:3000/generate-schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -d '{
    "prompt": "Create a database schema for a blog system"
  }'
```

Expected response:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

## Managing Protected Routes

The route protection is centralized in `src/utils/security/routeProtection.js`. To add or remove protected routes, you can modify the `protectedRoutes` array in this file or use the exported functions:

```javascript
const routeProtection = require('./utils/security/routeProtection');

// Add a new protected route
routeProtection.addProtectedRoute('/api/users', 'GET');

// Remove protection from a route
routeProtection.removeProtectedRoute('/generate-schema', 'POST');

// Get list of all protected routes
const routes = routeProtection.getProtectedRoutes();
``` 
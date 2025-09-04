# Usage Limits System

This document describes the comprehensive usage limits system implemented for Backlify-v2, which controls user access to features based on their subscription plan.

## Overview

The system tracks and enforces limits on:
- **Project Creation** (via `/generate-schema` endpoint)
- **API Requests** (via user-created API endpoints)
- **Monthly Usage Reset** (automatic at month start)

## Architecture

### Components

1. **Plan Service** (`src/services/planService.js`)
   - Fetches plan details from payment API
   - Parses limits from plan features
   - Handles fallback plans if API is unavailable

2. **Usage Service** (`src/services/usageService.js`)
   - Tracks user usage in database
   - Checks limits before allowing actions
   - Increments counters after successful actions

3. **Limit Middleware** (`src/middleware/limitMiddleware.js`)
   - Express middleware for different limit types
   - Handles project limits, request limits, and combined limits
   - Provides usage info without blocking

4. **Usage Controller** (`src/controllers/usageController.js`)
   - API endpoints for usage information
   - Admin functions for usage management

5. **Database Table** (`usage`)
   - Stores monthly usage data per user
   - Tracks requests and projects count
   - Automatic monthly reset

## Plan Structure

### Basic Plan
- **Projects**: 2 maximum
- **Requests**: 1,000/month
- **Features**: Email support

### Pro Plan
- **Projects**: 10 maximum
- **Requests**: 10,000/month
- **Features**: Priority support, Custom domains

### Enterprise Plan
- **Projects**: Unlimited
- **Requests**: Unlimited
- **Features**: 24/7 support, Custom integrations

## Database Schema

```sql
CREATE TABLE public.usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_plan character varying(50) NOT NULL,
  month_start date NOT NULL,
  requests_count integer DEFAULT 0,
  projects_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

## API Endpoints

### Usage Information
- `GET /api/usage/current` - Get current user's usage
- `GET /api/usage/plans` - Get all available plans
- `GET /api/usage/stats` - Get usage statistics (admin)
- `POST /api/usage/reset` - Reset monthly usage (admin)

### Protected Endpoints
- `POST /generate-schema` - Project limit check
- `GET/POST/PUT/DELETE /api/:apiId/*` - Request limit check

## Middleware Usage

### Project Limits
```javascript
app.post('/generate-schema', limitMiddleware.checkProjectLimit(), (req, res) => {
  // Endpoint logic
});
```

### Request Limits
```javascript
// Applied automatically to dynamic API routes
router.use(limitMiddleware.checkRequestLimit());
```

### Combined Limits
```javascript
app.post('/some-endpoint', limitMiddleware.checkBothLimits(), (req, res) => {
  // Endpoint logic
});
```

## Error Responses

### Project Limit Exceeded
```json
{
  "success": false,
  "message": "Project limit exceeded for your current plan (Basic Plan allows max 2 projects)."
}
```

### Request Limit Exceeded
```json
{
  "success": false,
  "message": "Monthly request limit exceeded for your current plan (1000 requests/month)."
}
```

## Setup Instructions

### 1. Create Database Table
Run the SQL script in Supabase:
```bash
# Copy and paste the content of src/tools/create-usage-table.sql
# into Supabase SQL Editor and execute
```

### 2. Test the System
```bash
node src/tools/setup-usage-limits.js
```

### 3. Verify Integration
```bash
# Test usage endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/usage/current

# Test plan endpoints
curl http://localhost:3000/api/usage/plans
```

## Monthly Reset

### Automatic Reset
The system includes a function to reset monthly usage counters:

```sql
-- Run this monthly (e.g., via cron job)
SELECT reset_monthly_usage();
```

### Manual Reset
```bash
node src/tools/reset-monthly-usage.js
```

### Cron Job Setup
```bash
# Add to crontab to run on 1st of every month at midnight
0 0 1 * * cd /path/to/backlify-v2 && node src/tools/reset-monthly-usage.js
```

## Usage Tracking

### Project Creation
- Triggered on `/generate-schema` endpoint
- Increments `projects_count` in usage table
- Checked before allowing schema generation

### API Requests
- Triggered on any user-created API endpoint
- Increments `requests_count` in usage table
- Checked before processing API calls

### Usage Info
- Available via `/api/usage/current` endpoint
- Shows current usage vs limits
- Includes percentage calculations

## Configuration

### Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase service role key
- `PAYMENT_API_URL` - URL for plan information (optional)

### Plan API Integration
The system fetches plan details from:
```
https://backlify-v2.onrender.com/api/payment/plans
```

If this API is unavailable, fallback plans are used.

## Monitoring

### Usage Statistics
- View usage stats via `/api/usage/stats` (admin only)
- Track usage patterns and limits
- Monitor system performance

### Logging
- All limit checks are logged
- Usage increments are tracked
- Error conditions are recorded

## Troubleshooting

### Common Issues

1. **Usage table not found**
   - Run the SQL script in Supabase
   - Check database permissions

2. **Plan API unavailable**
   - System uses fallback plans
   - Check network connectivity

3. **Middleware not working**
   - Verify middleware is properly imported
   - Check route order in Express app

4. **Usage not incrementing**
   - Check user authentication
   - Verify database write permissions

### Debug Mode
Enable detailed logging by setting:
```javascript
process.env.DEBUG_USAGE = 'true'
```

## Security Considerations

- Row Level Security (RLS) enabled on usage table
- Users can only access their own usage data
- Admin functions require proper authentication
- Usage data is isolated per user

## Performance

- Usage checks are cached for 5 minutes
- Database queries are optimized with indexes
- Middleware is lightweight and fast
- Minimal impact on API response times

## Future Enhancements

- Real-time usage notifications
- Usage analytics dashboard
- Custom limit overrides for enterprise
- Usage prediction algorithms
- Automated plan recommendations

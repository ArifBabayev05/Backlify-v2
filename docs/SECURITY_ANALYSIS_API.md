# Security Log Analysis API

This document describes the Security Log Analysis API endpoints that analyze Windows Security logs using AI and store structured results in the database.

## Overview

The Security Log Analysis API provides three main endpoints for processing Windows Security logs:

1. **POST /api/analysis** - Analyzes raw Windows Security log JSON(s) using AI
2. **GET /api/analysis** - Returns all historical analysis results with filtering
3. **GET /api/analysis/{id}** - Returns a specific analysis result by ID

All endpoints are **publicly accessible** (no authentication required) as requested.

## Database Schema

The analysis results are stored in the `SecurityLogAnalysis` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(255) | Unique identifier for the analysis |
| detected_user | VARCHAR(255) | Detected username from the analysis |
| machine_name | VARCHAR(255) | Detected host name from the analysis |
| time_from | TIMESTAMP | Earliest time of analyzed logs |
| time_to | TIMESTAMP | Latest time of analyzed logs |
| risk_score | INTEGER | Threat assessment score (0-100) |
| risk_likelihood | VARCHAR(10) | Categorical threat level (Low/Medium/High) |
| risk_justification | TEXT | Justification for the risk assessment |
| confidence | DECIMAL(3,2) | AI model confidence (0.0-1.0) |
| summary_bullets | JSONB | 2-4 short bullets describing behaviors |
| top_indicators | JSONB | Top 3 indicators influencing the risk |
| recommendations | JSONB | 3 prioritized Blue Team actions |
| behavior_breakdown | JSONB | Counts of events by category |
| chart_risk_history | JSONB | Risk score over time data |
| chart_event_dist | JSONB | Distribution by event type |
| alert_flags | JSONB | Boolean flags for dashboard badges |
| timestamp_created | TIMESTAMP | When this analysis was created |
| raw_input | JSONB | Original raw JSON logs used for analysis |

## API Endpoints

### 1. Analyze Logs

**POST** `/api/analysis`

Analyzes raw Windows Security log JSON(s) using AI and stores the structured result.

#### Request Body

```json
{
  "Id": 4625,
  "TimeCreated": "2025-01-27T10:03:03.9717533Z",
  "RecordId": 280795,
  "Message": "An account failed to log on..."
}
```

Or an array of log entries:

```json
[
  {
    "Id": 4625,
    "TimeCreated": "2025-01-27T10:03:03.9717533Z",
    "RecordId": 280795,
    "Message": "An account failed to log on..."
  },
  {
    "Id": 4625,
    "TimeCreated": "2025-01-27T12:53:41.4701566Z",
    "RecordId": 280796,
    "Message": "An account failed to log on..."
  }
]
```

#### Response

```json
{
  "success": true,
  "message": "Logs analyzed successfully",
  "data": {
    "id": "4625-280795",
    "detected_user": "Pikachu",
    "machine_name": "DESKTOP-9EHJI2B",
    "time_from": "2025-01-27T10:03:03.9717533Z",
    "time_to": "2025-01-27T12:53:41.4701566Z",
    "risk_score": 45,
    "risk_likelihood": "Medium",
    "risk_justification": "Multiple failed interactive logons increase risk...",
    "confidence": 0.78,
    "summary_bullets": [
      "Two failed interactive logon attempts for account 'Pikachu'",
      "Attempts originated from localhost with no external IP",
      "Repeated failures within hours indicate possible credential guessing"
    ],
    "top_indicators": [
      "Repeated failed logons for the same non-standard account",
      "Source address is localhost which may indicate automated attempts",
      "Caller process should be validated for legitimacy"
    ],
    "recommendations": [
      "Investigate the svchost.exe process hash on the host",
      "Audit local scheduled tasks and services for credential misuse",
      "Force a password reset for 'Pikachu' if found in AD"
    ],
    "behavior_breakdown": {
      "auth_events": 2,
      "process_events": 0,
      "network_events": 2,
      "usb_events": 0,
      "dns_queries": 0
    },
    "chart_risk_history": [
      {
        "timestamp": "2025-01-27T10:03:03.9717533Z",
        "score": 45
      },
      {
        "timestamp": "2025-01-27T12:53:41.4701566Z",
        "score": 45
      }
    ],
    "chart_event_dist": {
      "logon": 2,
      "process_creation": 0,
      "network": 0,
      "usb": 0,
      "dns": 0
    },
    "alert_flags": {
      "suspicious_process": true,
      "external_ip_detected": false,
      "multiple_failed_logins": true,
      "admin_privilege_used": false
    },
    "timestamp_created": "2025-01-27T15:30:00.000Z",
    "raw_input": [...]
  }
}
```

### 2. Get All Analyses

**GET** `/api/analysis`

Returns all historical analysis results with optional filtering and pagination.

#### Query Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| limit | integer | Maximum number of results (max 1000) | 100 |
| offset | integer | Offset for pagination | 0 |
| risk_level | string | Filter by risk likelihood (Low/Medium/High) | - |
| user | string | Filter by detected user (partial match) | - |
| machine | string | Filter by machine name (partial match) | - |
| from_date | string | Filter by creation date (ISO8601) | - |
| to_date | string | Filter by creation date (ISO8601) | - |
| sort_by | string | Sort field | timestamp_created |
| sort_order | string | Sort order (asc/desc) | desc |

#### Example Request

```
GET /api/analysis?risk_level=Medium&limit=50&offset=0&sort_by=risk_score&sort_order=desc
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "4625-280795",
      "detected_user": "Pikachu",
      "machine_name": "DESKTOP-9EHJI2B",
      "risk_score": 45,
      "risk_likelihood": "Medium",
      "timestamp_created": "2025-01-27T15:30:00.000Z",
      // ... other fields
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "filters": {
    "risk_level": "Medium"
  }
}
```

### 3. Get Specific Analysis

**GET** `/api/analysis/{id}`

Returns a specific analysis result by its unique ID.

#### Example Request

```
GET /api/analysis/4625-280795
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "4625-280795",
    "detected_user": "Pikachu",
    "machine_name": "DESKTOP-9EHJI2B",
    // ... complete analysis data
  }
}
```

## AI Analysis Process

The AI analysis follows these steps:

1. **Input Processing**: Raw Windows Security logs are formatted for AI analysis
2. **AI Analysis**: Logs are sent to Mistral AI with a specialized prompt for security log analysis
3. **Response Parsing**: AI response is cleaned and parsed as JSON
4. **Validation**: Analysis result is validated against the required schema
5. **Database Storage**: Structured result is stored in the SecurityLogAnalysis table

### AI Prompt

The AI uses a specialized system prompt that instructs it to:

- Analyze Windows Security log events for insider threat indicators
- Generate a risk score (0-100) and likelihood (Low/Medium/High)
- Provide detailed analysis including user detection, behavior breakdown, and recommendations
- Return results in a strict JSON format matching the database schema

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- **400 Bad Request**: Invalid input data or missing required fields
- **404 Not Found**: Analysis ID not found
- **500 Internal Server Error**: AI analysis failed or database error

Example error response:

```json
{
  "success": false,
  "error": "AI analysis failed",
  "details": "Invalid JSON response from AI"
}
```

## Testing

Use the provided test script to verify the endpoints:

```bash
node test-analysis-endpoints.js
```

This will test all three endpoints with sample Windows Security log data.

## CORS Support

All endpoints support CORS and can be accessed from web browsers. The API includes comprehensive CORS headers to allow cross-origin requests.

## Rate Limiting

The endpoints are subject to the application's global rate limiting policies. No specific rate limits are applied to the analysis endpoints beyond the general application limits.

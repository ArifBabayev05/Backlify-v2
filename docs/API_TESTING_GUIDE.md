# Security Log Analysis API - Testing Guide

This guide provides curl commands and examples for testing the Security Log Analysis API endpoints.

## Base URL
```
https://backlify-v2.onrender.com/api/analysis
```

## Test Data
The examples use real Windows Security log data with failed login attempts for user "Pikachu" on machine "DESKTOP-9EHJI2B".

---

## 1. Analyze Security Logs

**POST** `/api/analysis`

Analyzes raw Windows Security log JSON(s) using AI and stores the structured result.

### Single Log Entry

```bash
curl -X POST https://backlify-v2.onrender.com/api/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "TimeCreated": "2025-10-18T12:53:41.4701566Z",
    "LogName": "Security",
    "ProviderName": "Microsoft-Windows-Security-Auditing",
    "Id": 4625,
    "LevelDisplayName": "Information",
    "RecordId": 280795,
    "MachineName": "DESKTOP-9EHJI2B",
    "UserId": null,
    "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
    "ParsedFields": {}
  }'
```

### Multiple Log Entries (Array)

```bash
curl -X POST https://backlify-v2.onrender.com/api/analysis \
  -H "Content-Type: application/json" \
  -d '[
    {
      "TimeCreated": "2025-10-18T12:53:41.4701566Z",
      "LogName": "Security",
      "ProviderName": "Microsoft-Windows-Security-Auditing",
      "Id": 4625,
      "LevelDisplayName": "Information",
      "RecordId": 280795,
      "MachineName": "DESKTOP-9EHJI2B",
      "UserId": null,
      "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
      "ParsedFields": {}
    },
    {
      "TimeCreated": "2025-10-18T10:03:03.9717533Z",
      "LogName": "Security",
      "ProviderName": "Microsoft-Windows-Security-Auditing",
      "Id": 4625,
      "LevelDisplayName": "Information",
      "RecordId": 280543,
      "MachineName": "DESKTOP-9EHJI2B",
      "UserId": null,
      "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
      "ParsedFields": {}
    },
    {
      "TimeCreated": "2025-10-17T18:07:39.7028260Z",
      "LogName": "Security",
      "ProviderName": "Microsoft-Windows-Security-Auditing",
      "Id": 4625,
      "LevelDisplayName": "Information",
      "RecordId": 279614,
      "MachineName": "DESKTOP-9EHJI2B",
      "UserId": null,
      "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
      "ParsedFields": {}
    }
  ]'
```

### Expected Response
```json
{
  "success": true,
  "message": "Logs analyzed successfully",
  "data": {
    "id": "4625-280795",
    "detected_user": "Pikachu",
    "machine_name": "DESKTOP-9EHJI2B",
    "time_from": "2025-10-17T18:07:39.7028260Z",
    "time_to": "2025-10-18T12:53:41.4701566Z",
    "risk_score": 65,
    "risk_likelihood": "Medium",
    "risk_justification": "Multiple failed logon attempts for the same account indicate potential credential guessing or brute force attack.",
    "confidence": 0.85,
    "summary_bullets": [
      "Three failed interactive logon attempts for account 'Pikachu' from localhost",
      "All attempts originated from svchost.exe process with no external IP",
      "Repeated failures over multiple days indicate systematic credential guessing"
    ],
    "top_indicators": [
      "Repeated failed logons for the same non-standard account 'Pikachu'",
      "Source address is localhost (127.0.0.1) indicating local process attempts",
      "Caller process 'svchost.exe' initiated all requests and should be validated"
    ],
    "recommendations": [
      "Investigate the svchost.exe process hash and verify binary integrity",
      "Audit local scheduled tasks and services for credential misuse",
      "Force a password reset for 'Pikachu' if found in AD and monitor additional attempts"
    ],
    "behavior_breakdown": {
      "auth_events": 3,
      "process_events": 0,
      "network_events": 3,
      "usb_events": 0,
      "dns_queries": 0
    },
    "chart_risk_history": [
      {
        "timestamp": "2025-10-17T18:07:39.7028260Z",
        "score": 65
      },
      {
        "timestamp": "2025-10-18T10:03:03.9717533Z",
        "score": 65
      },
      {
        "timestamp": "2025-10-18T12:53:41.4701566Z",
        "score": 65
      }
    ],
    "chart_event_dist": {
      "logon": 3,
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

---

## 2. Get All Analysis Results

**GET** `/api/analysis`

Returns all historical analysis results with optional filtering and pagination.

### Basic Request
```bash
curl -X GET https://backlify-v2.onrender.com/api/analysis
```

### With Pagination
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?limit=10&offset=0"
```

### Filter by Risk Level
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?risk_level=Medium"
```

### Filter by User
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?user=Pikachu"
```

### Filter by Machine
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?machine=DESKTOP-9EHJI2B"
```

### Filter by Date Range
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?from_date=2025-01-01T00:00:00Z&to_date=2025-12-31T23:59:59Z"
```

### Sort by Risk Score (Descending)
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?sort_by=risk_score&sort_order=desc"
```

### Combined Filters
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?risk_level=High&user=Pikachu&limit=5&sort_by=timestamp_created&sort_order=desc"
```

### Expected Response
```json
{
  "success": true,
  "data": [
    {
      "id": "4625-280795",
      "detected_user": "Pikachu",
      "machine_name": "DESKTOP-9EHJI2B",
      "time_from": "2025-10-17T18:07:39.7028260Z",
      "time_to": "2025-10-18T12:53:41.4701566Z",
      "risk_score": 65,
      "risk_likelihood": "Medium",
      "risk_justification": "Multiple failed logon attempts...",
      "confidence": 0.85,
      "summary_bullets": [...],
      "top_indicators": [...],
      "recommendations": [...],
      "behavior_breakdown": {...},
      "chart_risk_history": [...],
      "chart_event_dist": {...},
      "alert_flags": {...},
      "timestamp_created": "2025-01-27T15:30:00.000Z",
      "raw_input": [...]
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  },
  "filters": {}
}
```

---

## 3. Send Threat Report Email

**POST** `/api/analysis/{id}/send-report`

Manually sends a threat report email to the admin for a specific analysis.

### Basic Request
```bash
curl -X POST https://backlify-v2.onrender.com/api/analysis/4625-280795/send-report
```

### Expected Response
```json
{
  "success": true,
  "message": "Threat report email sent successfully",
  "analysisId": "4625-280795"
}
```

### Error Response (Analysis Not Found)
```json
{
  "success": false,
  "error": "Analysis not found"
}
```

---

## 4. Get Specific Analysis by ID

**GET** `/api/analysis/{id}`

Returns a specific analysis result by its unique ID.

### Basic Request
```bash
curl -X GET https://backlify-v2.onrender.com/api/analysis/4625-280795
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "id": "4625-280795",
    "detected_user": "Pikachu",
    "machine_name": "DESKTOP-9EHJI2B",
    "time_from": "2025-10-17T18:07:39.7028260Z",
    "time_to": "2025-10-18T12:53:41.4701566Z",
    "risk_score": 65,
    "risk_likelihood": "Medium",
    "risk_justification": "Multiple failed logon attempts for the same account indicate potential credential guessing or brute force attack.",
    "confidence": 0.85,
    "summary_bullets": [
      "Three failed interactive logon attempts for account 'Pikachu' from localhost",
      "All attempts originated from svchost.exe process with no external IP",
      "Repeated failures over multiple days indicate systematic credential guessing"
    ],
    "top_indicators": [
      "Repeated failed logons for the same non-standard account 'Pikachu'",
      "Source address is localhost (127.0.0.1) indicating local process attempts",
      "Caller process 'svchost.exe' initiated all requests and should be validated"
    ],
    "recommendations": [
      "Investigate the svchost.exe process hash and verify binary integrity",
      "Audit local scheduled tasks and services for credential misuse",
      "Force a password reset for 'Pikachu' if found in AD and monitor additional attempts"
    ],
    "behavior_breakdown": {
      "auth_events": 3,
      "process_events": 0,
      "network_events": 3,
      "usb_events": 0,
      "dns_queries": 0
    },
    "chart_risk_history": [
      {
        "timestamp": "2025-10-17T18:07:39.7028260Z",
        "score": 65
      },
      {
        "timestamp": "2025-10-18T10:03:03.9717533Z",
        "score": 65
      },
      {
        "timestamp": "2025-10-18T12:53:41.4701566Z",
        "score": 65
      }
    ],
    "chart_event_dist": {
      "logon": 3,
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

---

## 5. AI Limits & Data Truncation

### Automatic Data Truncation
The system automatically truncates large datasets before sending to AI to avoid hitting Mistral's free version limits:

- **Max Characters**: 8,000 characters (configurable)
- **Max Log Entries**: 10 entries (configurable)
- **Max Message Length**: 2,000 characters per log entry (configurable)
- **Smart Truncation**: Removes less important fields when data is too large

### Truncation Process
1. **Limit Log Count**: Reduces to max 10 log entries
2. **Truncate Messages**: Shortens long messages to 2,000 chars
3. **Remove Fields**: Removes `ParsedFields` and other non-essential data
4. **Further Reduction**: If still too large, reduces log count proportionally

### Truncation Metadata
Each analysis includes truncation metadata:
```json
{
  "truncation_metadata": {
    "was_truncated": true,
    "original_log_count": 25,
    "final_log_count": 10,
    "original_chars": 15000,
    "final_chars": 7500,
    "truncation_reason": "AI_LIMIT_EXCEEDED"
  }
}
```

### Configuration Endpoints
- **GET** `/api/analysis/ai-limits` - Get current limits
- **PUT** `/api/analysis/ai-limits` - Update limits

### Example: Update AI Limits
```bash
curl -X PUT https://backlify-v2.onrender.com/api/analysis/ai-limits \
  -H "Content-Type: application/json" \
  -d '{
    "maxChars": 6000,
    "maxLogs": 8,
    "maxMessageLength": 1500
  }'
```

---

## 6. Threat Report Email Features

### Automatic Email Sending
The system automatically sends threat report emails to `arifrb@code.edu.az` when:
- **High Risk**: Any analysis with risk level "High" (score 67-100)
- **Medium Risk**: Any analysis with risk level "Medium" (score 34-66)  
- **Low Risk**: Any analysis with risk level "Low" but score ≥ 30

### Email Content Includes:
- 🚨 **Threat Level Alert** with color-coded severity
- 🔍 **Incident Details** (Analysis ID, User, Machine, Time Range)
- 📊 **Risk Assessment** with justification and confidence
- 📋 **Summary** of detected behaviors
- 🎯 **Top Threat Indicators** affecting the score
- 🛡️ **Recommended Actions** for security team
- 🚩 **Alert Flags** showing triggered security conditions
- 📈 **Event Breakdown** by category
- ⚠️ **Action Required** section with immediate steps

### Email Template Features:
- **Professional Design**: Clean, corporate-style layout
- **Color Coding**: Red for High, Orange for Medium, Green for Low threats
- **Mobile Responsive**: Works on all devices
- **Rich Content**: Tables, icons, and structured information
- **Action-Oriented**: Clear next steps for security team

---

## 6. Error Handling Examples

### Invalid Analysis ID
```bash
curl -X GET https://backlify-v2.onrender.com/api/analysis/invalid-id
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Analysis not found",
  "details": "The requested analysis could not be found"
}
```

### Invalid Risk Level Filter
```bash
curl -X GET "https://backlify-v2.onrender.com/api/analysis?risk_level=Invalid"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "total": 0,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  },
  "filters": {
    "risk_level": "Invalid"
  }
}
```

### Empty Request Body
```bash
curl -X POST https://backlify-v2.onrender.com/api/analysis \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "No data provided",
  "details": "Please provide Windows Security log JSON data"
}
```

---

## 7. Complete Test Workflow

### Step 1: Analyze Logs
```bash
# First, analyze some logs to create test data
curl -X POST https://backlify-v2.onrender.com/api/analysis \
  -H "Content-Type: application/json" \
  -d '[
    {
      "TimeCreated": "2025-10-18T12:53:41.4701566Z",
      "LogName": "Security",
      "ProviderName": "Microsoft-Windows-Security-Auditing",
      "Id": 4625,
      "LevelDisplayName": "Information",
      "RecordId": 280795,
      "MachineName": "DESKTOP-9EHJI2B",
      "UserId": null,
      "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
      "ParsedFields": {}
    }
  ]'
```

### Step 2: Get All Analyses
```bash
# Get all analysis results
curl -X GET https://backlify-v2.onrender.com/api/analysis
```

### Step 3: Get Specific Analysis
```bash
# Get specific analysis by ID (replace with actual ID from step 1)
curl -X GET https://backlify-v2.onrender.com/api/analysis/4625-280795
```

### Step 4: Test Filtering
```bash
# Filter by risk level
curl -X GET "https://backlify-v2.onrender.com/api/analysis?risk_level=Medium"

# Filter by user
curl -X GET "https://backlify-v2.onrender.com/api/analysis?user=Pikachu"

# Filter by machine
curl -X GET "https://backlify-v2.onrender.com/api/analysis?machine=DESKTOP-9EHJI2B"
```

### Step 5: Test AI Limits Configuration
```bash
# Get current AI limits
curl -X GET https://backlify-v2.onrender.com/api/analysis/ai-limits

# Update AI limits (optional)
curl -X PUT https://backlify-v2.onrender.com/api/analysis/ai-limits \
  -H "Content-Type: application/json" \
  -d '{
    "maxChars": 6000,
    "maxLogs": 8,
    "maxMessageLength": 1500
  }'
```

### Step 6: Test Email Configuration
```bash
# Test email configuration
curl -X POST https://backlify-v2.onrender.com/api/analysis/test-email
```

### Step 7: Test Threat Report Email
```bash
# Send threat report email for specific analysis
curl -X POST https://backlify-v2.onrender.com/api/analysis/4625-280795/send-report
```

---

## 8. Performance Testing

### Large Dataset Test
```bash
# Test with multiple log entries
curl -X POST https://backlify-v2.onrender.com/api/analysis \
  -H "Content-Type: application/json" \
  -d @large_log_dataset.json
```

### Pagination Test
```bash
# Test pagination with large result set
curl -X GET "https://backlify-v2.onrender.com/api/analysis?limit=5&offset=0"
curl -X GET "https://backlify-v2.onrender.com/api/analysis?limit=5&offset=5"
curl -X GET "https://backlify-v2.onrender.com/api/analysis?limit=5&offset=10"
```

---

## 9. Health Check

### API Health
```bash
curl -X GET https://backlify-v2.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "Backlify-v2",
  "timestamp": "2025-01-27T15:30:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "uptime": {
    "seconds": 3600,
    "formatted": "0d 1h 0m 0s"
  },
  "memory": {
    "rss": "50 MB",
    "heapTotal": "20 MB",
    "heapUsed": "15 MB"
  },
  "apis": {
    "count": 0
  }
}
```

---

## 10. Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure the server is running on port 3000
   - Check if the port is available

2. **CORS Errors**
   - All endpoints support CORS
   - No authentication required

3. **AI Analysis Fails**
   - Check Mistral API key configuration
   - Verify network connectivity

4. **Database Errors**
   - Ensure Supabase connection is configured
   - Check if SecurityLogAnalysis table exists

### Debug Commands

```bash
# Check server status
curl -X GET https://backlify-v2.onrender.com/health

# Test basic connectivity
curl -X GET https://backlify-v2.onrender.com/api/analysis

# Check specific endpoint
curl -X GET https://backlify-v2.onrender.com/api/analysis/4625-280795
```

---

## 11. Example Scripts

### Bash Test Script
```bash
#!/bin/bash

BASE_URL="https://backlify-v2.onrender.com/api/analysis"

echo "🧪 Testing Security Log Analysis API"
echo "=================================="

# Test 1: Analyze logs
echo "1. Testing log analysis..."
ANALYSIS_RESPONSE=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '[
    {
      "TimeCreated": "2025-10-18T12:53:41.4701566Z",
      "LogName": "Security",
      "ProviderName": "Microsoft-Windows-Security-Auditing",
      "Id": 4625,
      "LevelDisplayName": "Information",
      "RecordId": 280795,
      "MachineName": "DESKTOP-9EHJI2B",
      "UserId": null,
      "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
      "ParsedFields": {}
    }
  ]')

echo "Analysis Response: $ANALYSIS_RESPONSE"

# Extract analysis ID
ANALYSIS_ID=$(echo $ANALYSIS_RESPONSE | jq -r '.data.id')
echo "Analysis ID: $ANALYSIS_ID"

# Test 2: Get all analyses
echo "2. Testing get all analyses..."
curl -s -X GET $BASE_URL | jq '.'

# Test 3: Get specific analysis
echo "3. Testing get specific analysis..."
curl -s -X GET "$BASE_URL/$ANALYSIS_ID" | jq '.'

# Test 4: Test filtering
echo "4. Testing filtering..."
curl -s -X GET "$BASE_URL?risk_level=Medium" | jq '.'

echo "✅ All tests completed!"
```

### PowerShell Test Script
```powershell
$baseUrl = "https://backlify-v2.onrender.com/api/analysis"

Write-Host "🧪 Testing Security Log Analysis API" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# Test 1: Analyze logs
Write-Host "1. Testing log analysis..." -ForegroundColor Yellow
$logData = @'
[
    {
        "TimeCreated": "2025-10-18T12:53:41.4701566Z",
        "LogName": "Security",
        "ProviderName": "Microsoft-Windows-Security-Auditing",
        "Id": 4625,
        "LevelDisplayName": "Information",
        "RecordId": 280795,
        "MachineName": "DESKTOP-9EHJI2B",
        "UserId": null,
        "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: DESKTOP-9EHJI2B$ Account Domain: WORKGROUP Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Information: Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Caller Process ID: 0xb08 Caller Process Name: C:\\Windows\\System32\\svchost.exe Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: User32 Authentication Package: Negotiate Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases. The authentication information fields provide detailed information about this specific logon request. - Transited services indicate which intermediate services have participated in this logon request. - Package name indicates which sub-protocol was used among the NTLM protocols. - Key length indicates the length of the generated session key. This will be 0 if no session key was requested.",
        "ParsedFields": {}
    }
]
'@

$response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $logData -ContentType "application/json"
Write-Host "Analysis Response: $($response | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan

$analysisId = $response.data.id
Write-Host "Analysis ID: $analysisId" -ForegroundColor Green

# Test 2: Get all analyses
Write-Host "2. Testing get all analyses..." -ForegroundColor Yellow
$allAnalyses = Invoke-RestMethod -Uri $baseUrl -Method GET
Write-Host "All Analyses: $($allAnalyses | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan

# Test 3: Get specific analysis
Write-Host "3. Testing get specific analysis..." -ForegroundColor Yellow
$specificAnalysis = Invoke-RestMethod -Uri "$baseUrl/$analysisId" -Method GET
Write-Host "Specific Analysis: $($specificAnalysis | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan

# Test 4: Test filtering
Write-Host "4. Testing filtering..." -ForegroundColor Yellow
$filteredAnalyses = Invoke-RestMethod -Uri "$baseUrl?risk_level=Medium" -Method GET
Write-Host "Filtered Analyses: $($filteredAnalyses | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan

Write-Host "✅ All tests completed!" -ForegroundColor Green
```

---

This comprehensive testing guide provides all the curl commands and examples needed to test the Security Log Analysis API endpoints with your provided test data.

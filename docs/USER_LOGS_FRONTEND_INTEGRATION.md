# User Logs Frontend Integration Guide

## 📋 Overview

Bu sənəd user logları üçün frontend inteqrasiyasını izah edir. Mövcud `/admin/logs` endpoint-inin user versiyasıdır.

## 🔗 Available Endpoints

### 1. Get User Logs
**Endpoint:** `GET /api/user/logs`

**Description:** User-ın öz request loglarını əldə edir (admin/logs kimi, amma yalnız user-ın öz logları)

**Query Parameters:**
- `page` (optional): Səhifə nömrəsi (default: 1)
- `limit` (optional): Hər səhifədə log sayı (default: 50, max: 100)
- `endpoint` (optional): Endpoint filter (partial match)
- `method` (optional): HTTP method filter (GET, POST, PUT, DELETE)
- `status` (optional): HTTP status code filter
- `from_date` (optional): Başlanğıc tarix (ISO format)
- `to_date` (optional): Bitmə tarixi (ISO format)
- `min_time` (optional): Minimum response time (ms)
- `max_time` (optional): Maximum response time (ms)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 468,
        "timestamp": "2025-09-01T20:28:03.4+00:00",
        "endpoint": "/api/epoint/create-payment",
        "method": "POST",
        "status": 200,
        "responseTime": 403,
        "ip": "localhost:3000",
        "userAgent": "PostmanRuntime/7.45.0",
        "requestSize": 245,
        "responseSize": 565,
        "error": null,
        "apiId": "epoint",
        "isApiRequest": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1250,
      "totalPages": 25
    },
    "filters": {
      "endpoint": null,
      "method": null,
      "status": null,
      "from_date": null,
      "to_date": null,
      "min_time": null,
      "max_time": null
    }
  }
}
```

### 2. Get User Log Statistics
**Endpoint:** `GET /api/user/logs/stats`

**Description:** User-ın log statistikalarını əldə edir

**Query Parameters:**
- `days` (optional): Gün sayı (default: 7)
- `startDate` (optional): Başlanğıc tarix (ISO format)
- `endDate` (optional): Bitmə tarixi (ISO format)
- `timeRange` (optional): Predefined time range (today, yesterday, last7days, last30days, last90days)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRequests": 1250,
      "successfulRequests": 1200,
      "errorRequests": 50,
      "successRate": "96.0",
      "errorRate": "4.0",
      "avgResponseTime": 245
    },
    "topEndpoints": [
      {
        "endpoint": "/api/epoint/create-payment",
        "count": 456,
        "success": 445,
        "errors": 11,
        "avgResponseTime": 245
      }
    ],
    "dailyData": [
      {
        "date": "2025-09-01",
        "requests": 45,
        "success": 43,
        "errors": 2
      }
    ],
    "timeRange": {
      "start": "2025-08-25T00:00:00.000Z",
      "end": "2025-09-01T23:59:59.999Z",
      "days": 7
    }
  }
}
```

## 🔧 Frontend Implementation

### JavaScript/React Example

```javascript
class UserLogsService {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  // Get user logs with filters
  async getUserLogs(filters = {}) {
    const params = new URLSearchParams();
    
    // Add filters to query params
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(key, value);
      }
    });

    const response = await fetch(`${this.baseURL}/api/user/logs?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Get user log statistics
  async getUserLogStats(timeRange = 'last7days') {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);

    const response = await fetch(`${this.baseURL}/api/user/logs/stats?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  getToken() {
    // Get token from localStorage or your auth system
    return localStorage.getItem('access_token');
  }
}

// Usage examples
const logsService = new UserLogsService();

// Get recent logs
const recentLogs = await logsService.getUserLogs({
  page: 1,
  limit: 20
});

// Get logs with filters
const filteredLogs = await logsService.getUserLogs({
  page: 1,
  limit: 50,
  endpoint: '/api/epoint',
  method: 'POST',
  status: 200,
  from_date: '2025-09-01',
  to_date: '2025-09-03'
});

// Get statistics for last 30 days
const stats = await logsService.getUserLogStats('last30days');
```

### Vue.js Example

```javascript
// composables/useUserLogs.js
import { ref, computed } from 'vue'

export function useUserLogs() {
  const logs = ref([])
  const stats = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const fetchLogs = async (filters = {}) => {
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.append(key, value)
        }
      })

      const response = await fetch(`/api/user/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      logs.value = data.data.logs
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  const fetchStats = async (timeRange = 'last7days') => {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`/api/user/logs/stats?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      stats.value = data.data
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return {
    logs: computed(() => logs.value),
    stats: computed(() => stats.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchLogs,
    fetchStats
  }
}
```

## 🧪 Testing with cURL

### 1. Get User Logs

```bash
# Basic logs
curl -X GET "http://localhost:3000/api/user/logs" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# With filters
curl -X GET "http://localhost:3000/api/user/logs?page=1&limit=20&endpoint=/api/epoint&method=POST&status=200" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Date range
curl -X GET "http://localhost:3000/api/user/logs?from_date=2025-09-01&to_date=2025-09-03" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. Get User Log Statistics

```bash
# Last 7 days (default)
curl -X GET "http://localhost:3000/api/user/logs/stats" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Last 30 days
curl -X GET "http://localhost:3000/api/user/logs/stats?timeRange=last30days" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Custom date range
curl -X GET "http://localhost:3000/api/user/logs/stats?startDate=2025-09-01&endDate=2025-09-03" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📊 Frontend Dashboard Components

### Logs Table Component

```javascript
// LogsTable.jsx
import React, { useState, useEffect } from 'react';

const LogsTable = () => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    endpoint: '',
    method: '',
    status: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/logs?${new URLSearchParams(filters)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setLogs(data.data.logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="logs-table">
      <div className="filters">
        <input
          type="text"
          placeholder="Endpoint filter"
          value={filters.endpoint}
          onChange={(e) => setFilters({...filters, endpoint: e.target.value})}
        />
        <select
          value={filters.method}
          onChange={(e) => setFilters({...filters, method: e.target.value})}
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="number"
          placeholder="Status code"
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Endpoint</th>
            <th>Method</th>
            <th>Status</th>
            <th>Response Time</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.endpoint}</td>
              <td>{log.method}</td>
              <td className={log.status >= 400 ? 'error' : 'success'}>
                {log.status}
              </td>
              <td>{log.responseTime}ms</td>
              <td>{log.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LogsTable;
```

### Statistics Dashboard Component

```javascript
// LogStatsDashboard.jsx
import React, { useState, useEffect } from 'react';

const LogStatsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [timeRange, setTimeRange] = useState('last7days');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/logs/stats?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!stats) return <div>No data available</div>;

  return (
    <div className="stats-dashboard">
      <div className="time-range-selector">
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7days">Last 7 Days</option>
          <option value="last30days">Last 30 Days</option>
          <option value="last90days">Last 90 Days</option>
        </select>
      </div>

      <div className="summary-cards">
        <div className="card">
          <h3>Total Requests</h3>
          <p>{stats.summary.totalRequests}</p>
        </div>
        <div className="card">
          <h3>Success Rate</h3>
          <p>{stats.summary.successRate}%</p>
        </div>
        <div className="card">
          <h3>Error Rate</h3>
          <p>{stats.summary.errorRate}%</p>
        </div>
        <div className="card">
          <h3>Avg Response Time</h3>
          <p>{stats.summary.avgResponseTime}ms</p>
        </div>
      </div>

      <div className="top-endpoints">
        <h3>Top Endpoints</h3>
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Requests</th>
              <th>Success</th>
              <th>Errors</th>
              <th>Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {stats.topEndpoints.map((endpoint, index) => (
              <tr key={index}>
                <td>{endpoint.endpoint}</td>
                <td>{endpoint.count}</td>
                <td>{endpoint.success}</td>
                <td>{endpoint.errors}</td>
                <td>{endpoint.avgResponseTime}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogStatsDashboard;
```

## 🔑 Key Features

1. **User-Specific Logs**: Yalnız user-ın öz request logları göstərilir
2. **Advanced Filtering**: Endpoint, method, status, tarix aralığı və response time filterləri
3. **Pagination**: Böyük log siyahıları üçün səhifələmə
4. **Statistics**: Detallı statistikalar və trend analizi
5. **Real-time Data**: Mövcud `api_logs` table-dən real-time məlumatlar
6. **Admin Logs Compatible**: Admin logs ilə eyni struktur və filterlər

## ⚠️ Important Notes

- **Authentication Required**: Bütün endpoint-lər Bearer token tələb edir
- **User Isolation**: User yalnız öz loglarını görə bilər
- **Rate Limiting**: Endpoint-lər rate limiting-ə tabedir
- **Data Privacy**: Sensitive məlumatlar (passwords, tokens) loglarda göstərilmir

## 🚀 Getting Started

1. **Login** və token əldə edin
2. **Basic logs** əldə etmək üçün `/api/user/logs` endpoint-ini çağırın
3. **Statistics** əldə etmək üçün `/api/user/logs/stats` endpoint-ini çağırın
4. **Filters** əlavə edərək məlumatları daraltın
5. **Frontend components** yaradaraq dashboard hazırlayın

Bu endpoint-lər mövcud admin logs sistemi ilə tam uyğundur və eyni məlumat strukturunu istifadə edir.

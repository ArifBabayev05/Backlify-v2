# Account Settings Frontend Integration Guide

Bu sənəd Account Settings funksionallığı üçün backend API endpoint-lərinin frontend-də necə istifadə ediləcəyini təsvir edir.

## 📋 Məzmun

1. [Authentication](#authentication)
2. [User Profile Management](#user-profile-management)
3. [Subscription Management](#subscription-management)
4. [API Usage & Analytics](#api-usage--analytics)
5. [Request Logs](#request-logs)
6. [Notification Settings](#notification-settings)
7. [Error Handling](#error-handling)
8. [Frontend Implementation Examples](#frontend-implementation-examples)

---



---

## 🔐 Authentication

Bütün Account Settings endpoint-ləri authentication tələb edir. Mövcud auth strukturu istifadə edin:

### 1. Login (Token almaq üçün):

```javascript
// Login endpoint
const login = async (username, password) => {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Token-i localStorage-də saxla
      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('XAuthUserId', data.XAuthUserId);
      return data;
    } else {
      throw new Error(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

### 2. Google Login (Alternativ):

```javascript
// Google login endpoint
const googleLogin = async (googleToken, email, name, picture, googleId) => {
  try {
    const response = await fetch('/auth/google-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        google_token: googleToken,
        email: email,
        name: name,
        picture: picture,
        google_id: googleId
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Token-i localStorage-də saxla
      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('XAuthUserId', data.XAuthUserId);
      return data;
    } else {
      throw new Error(data.error || 'Google login failed');
    }
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
};
```

### 3. Request-lərdə Token istifadəsi:

```javascript
// Token-i localStorage-dən al
const token = localStorage.getItem('authToken');

// Request header-ında göndər
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

**⚠️ QEYD:** Mövcud sistemdə Bearer token avtomatik yoxlanılır, sadəcə `addProtectedRoute` qeydiyyatı kifayətdir. Frontend-də əvvəl payment endpoint-ləri üçün istifadə etdiyiniz eyni strukturu istifadə edin.

**⚠️ IMPORTANT:** Bütün endpoint-lər `/api/user/` prefix-i ilə başlayır!

### 4. Payment Endpoint-ləri ilə Eyni Struktur:

Account Settings endpoint-ləri payment endpoint-ləri ilə eyni authentication strukturu istifadə edir:

```javascript
// Payment endpoint-ləri üçün istifadə etdiyiniz kod:
const paymentData = await this.makeRequest('/api/payment/order', {
  method: 'POST',
  body: JSON.stringify(orderData)
});

// Account Settings endpoint-ləri üçün eyni kod:
const profileData = await this.makeRequest('/api/user/profile', {
  method: 'GET'
});

const updatedProfile = await this.makeRequest('/api/user/profile', {
  method: 'PUT',
  body: JSON.stringify(profileData)
});
```

---

## 👤 User Profile Management

### 1. Get User Profile

**Endpoint:** `GET /api/user/profile`

**Məqsəd:** İstifadəçinin profil məlumatlarını əldə etmək

**Request:**
```javascript
const getUserProfile = async () => {
  try {
    const response = await fetch('/api/user/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('User profile:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to fetch profile');
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "company": "Tech Company",
    "phone": "+994 50 123 45 67",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Update User Profile

**Endpoint:** `PUT /api/user/profile`

**Məqsəd:** İstifadəçinin profil məlumatlarını yeniləmək

**Request:**
```javascript
const updateUserProfile = async (profileData) => {
  try {
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        company: profileData.company,
        phone: profileData.phone
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Profile updated:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to update profile');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "company": "Tech Company",
  "phone": "+994 50 123 45 67"
}
```

### 3. Change Password

**Endpoint:** `PUT /api/user/change-password`

**Məqsəd:** İstifadəçinin şifrəsini dəyişmək

**Request:**
```javascript
const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await fetch('/api/user/change-password', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: currentPassword,
        newPassword: newPassword
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Password changed successfully');
      return true;
    } else {
      throw new Error(data.error || 'Failed to change password');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};
```

---

## 💳 Subscription Management

### 1. Get User Subscription

**Endpoint:** `GET /api/user/subscription`

**Məqsəd:** İstifadəçinin abunəlik məlumatlarını əldə etmək

**Request:**
```javascript
const getUserSubscription = async () => {
  try {
    const response = await fetch('/api/user/subscription', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Subscription:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to fetch subscription');
    }
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub_123",
    "plan": "pro",
    "planName": "Pro Plan",
    "status": "active",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "price": 0.01,
    "currency": "AZN",
    "features": {
      "apiCalls": 10000,
      "maxProjects": 5,
      "prioritySupport": true,
      "analytics": true,
      "customIntegrations": false
    },
    "autoRenew": true
  }
}
```

### 2. Upgrade Subscription

**Endpoint:** `POST /api/user/subscription/upgrade`

**Məqsəd:** Abunəliyi yüksəltmək

**Request:**
```javascript
const upgradeSubscription = async (plan) => {
  try {
    const response = await fetch('/api/user/subscription/upgrade', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan: plan // 'pro' or 'enterprise'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Upgrade initiated:', data.data);
      // Redirect to payment page
      window.location.href = data.data.redirectUrl;
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to upgrade subscription');
    }
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    throw error;
  }
};
```

---

## 📊 API Usage & Analytics

### 1. Get API Usage Statistics

**Endpoint:** `GET /api/user/usage`

**Məqsəd:** İstifadəçinin API istifadə statistikalarını əldə etmək

**Query Parameters:**
- `period`: `month` | `year` (default: `month`)
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

**Request:**
```javascript
const getApiUsage = async (period = 'month', startDate = null, endDate = null) => {
  try {
    let url = '/api/user/usage?';
    const params = new URLSearchParams();
    
    if (period) params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    url += params.toString();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('API Usage:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to fetch usage data');
    }
  } catch (error) {
    console.error('Error fetching usage:', error);
    throw error;
  }
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCalls": 2347,
    "limit": 10000,
    "remaining": 7653,
    "thisMonth": 2347,
    "lastMonth": 1892,
    "dailyUsage": [
      { "date": "2024-01-01", "calls": 45 },
      { "date": "2024-01-02", "calls": 67 },
      { "date": "2024-01-03", "calls": 89 }
    ],
    "topEndpoints": [
      {
        "endpoint": "/api/schema/generate",
        "calls": 456,
        "success": 98.2,
        "avgResponseTime": 245
      }
    ],
    "errorRate": 1.2,
    "avgResponseTime": 189
  }
}
```

---

## 📝 Request Logs

### 1. Get User Logs (Admin/Logs Style)

**Endpoint:** `GET /api/user/logs`

**Məqsəd:** User-ın öz request loglarını əldə etmək (admin/logs kimi, amma yalnız user-ın öz logları)

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

**Request:**
```javascript
const getRequestLogs = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined) {
        params.append(key, filters[key]);
      }
    });

    const url = `/api/user/logs?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Request logs:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to fetch logs');
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

// Usage examples:
// getRequestLogs({ page: 1, limit: 20 });
// getRequestLogs({ startDate: '2024-01-01', endDate: '2024-01-31' });
// getRequestLogs({ status: 500, endpoint: '/api/schema' });
```

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

**Məqsəd:** User-ın log statistikalarını əldə etmək

**Query Parameters:**
- `days` (optional): Gün sayı (default: 7)
- `startDate` (optional): Başlanğıc tarix (ISO format)
- `endDate` (optional): Bitmə tarixi (ISO format)
- `timeRange` (optional): Predefined time range (today, yesterday, last7days, last30days, last90days)

**Request:**
```javascript
const getUserLogStats = async (timeRange = 'last7days') => {
  try {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);

    const response = await fetch(`/api/user/logs/stats?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error fetching log stats:', error);
    throw error;
  }
};

// Usage examples:
const stats = await getUserLogStats('last30days');
const customStats = await getUserLogStats('custom', '2025-09-01', '2025-09-03');
```

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

---

## 🔔 Notification Settings

### 1. Get Notification Settings

**Endpoint:** `GET /api/user/notifications/settings`

**Məqsəd:** İstifadəçinin bildiriş tənzimləmələrini əldə etmək

**Request:**
```javascript
const getNotificationSettings = async () => {
  try {
    const response = await fetch('/api/user/notifications/settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Notification settings:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to fetch notification settings');
    }
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    throw error;
  }
};
```

### 2. Update Notification Settings

**Endpoint:** `PUT /api/user/notifications/settings`

**Məqsəd:** Bildiriş tənzimləmələrini yeniləmək

**Request:**
```javascript
const updateNotificationSettings = async (settings) => {
  try {
    const response = await fetch('/api/user/notifications/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        marketingEmails: settings.marketingEmails,
        twoFactorAuth: settings.twoFactorAuth,
        apiAccess: settings.apiAccess,
        securityAlerts: settings.securityAlerts,
        billingNotifications: settings.billingNotifications
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Settings updated:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to update settings');
    }
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};
```

**Request Body:**
```json
{
  "emailNotifications": true,
  "smsNotifications": false,
  "marketingEmails": false,
  "twoFactorAuth": false,
  "apiAccess": true,
  "securityAlerts": true,
  "billingNotifications": true
}
```

---

## ❌ Error Handling

Bütün endpoint-lər standart error response formatı istifadə edir:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "email": "Invalid email format"
    }
  }
}
```

### Common Error Codes:
- `FORBIDDEN`: İcazə yoxdur
- `VALIDATION_ERROR`: Input validation xətası
- `NOT_FOUND`: Resource tapılmadı
- `RATE_LIMIT_EXCEEDED`: Rate limit aşıldı
- `SUBSCRIPTION_EXPIRED`: Abunəlik bitib
- `QUOTA_EXCEEDED`: API limit aşıldı

### Frontend Error Handling:
```javascript
const handleApiError = (error, response) => {
  if (response?.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  } else if (response?.status === 403) {
    // Forbidden, show access denied message
    showNotification('Access denied', 'error');
  } else if (response?.status === 429) {
    // Rate limited, show retry message
    showNotification('Too many requests. Please try again later.', 'warning');
  } else {
    // Generic error
    showNotification(error.message || 'An error occurred', 'error');
  }
};
```

---

## 🎯 Frontend Implementation Examples

### React Hook Example:
```javascript
import { useState, useEffect } from 'react';

const useAccountSettings = () => {
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getUserProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const data = await getUserSubscription();
      setSubscription(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async (period = 'month') => {
    setLoading(true);
    try {
      const data = await getApiUsage(period);
      setUsage(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchSubscription();
    fetchUsage();
  }, []);

  return {
    profile,
    subscription,
    usage,
    loading,
    error,
    updateProfile: updateUserProfile,
    changePassword,
    upgradeSubscription,
    fetchUsage
  };
};
```

### Vue.js Composable Example:
```javascript
import { ref, onMounted } from 'vue';

export const useAccountSettings = () => {
  const profile = ref(null);
  const subscription = ref(null);
  const usage = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const fetchProfile = async () => {
    loading.value = true;
    try {
      const data = await getUserProfile();
      profile.value = data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const fetchSubscription = async () => {
    loading.value = true;
    try {
      const data = await getUserSubscription();
      subscription.value = data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    fetchProfile();
    fetchSubscription();
  });

  return {
    profile,
    subscription,
    usage,
    loading,
    error,
    fetchProfile,
    fetchSubscription
  };
};
```

### Dashboard Component Example:
```javascript
const AccountDashboard = () => {
  const {
    profile,
    subscription,
    usage,
    loading,
    error,
    updateProfile,
    changePassword,
    upgradeSubscription
  } = useAccountSettings();

  const handleProfileUpdate = async (formData) => {
    try {
      await updateProfile(formData);
      showNotification('Profile updated successfully', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handlePasswordChange = async (currentPassword, newPassword) => {
    try {
      await changePassword(currentPassword, newPassword);
      showNotification('Password changed successfully', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleSubscriptionUpgrade = async (plan) => {
    try {
      await upgradeSubscription(plan);
      // User will be redirected to payment page
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="account-dashboard">
      <ProfileSection 
        profile={profile} 
        onUpdate={handleProfileUpdate}
        onChangePassword={handlePasswordChange}
      />
      
      <SubscriptionSection 
        subscription={subscription}
        onUpgrade={handleSubscriptionUpgrade}
      />
      
      <UsageSection usage={usage} />
      
      <NotificationSettings />
    </div>
  );
};
```

---

## 📱 Rate Limiting

- **Profile endpoints**: 10 requests/minute
- **Usage endpoints**: 30 requests/minute  
- **Logs endpoints**: 20 requests/minute
- **Settings endpoints**: 5 requests/minute

Rate limit aşıldıqda `429 Too Many Requests` status code qaytarılır.

---

## 🔧 Testing

### 1. Əvvəlcə Login edin (Token alın):

```bash
# Login
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin","password":"your_password"}'

# Response:
# {
#   "success": true,
#   "username": "Admin",
#   "email": "admin@example.com",
#   "XAuthUserId": "Admin",
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

### 2. Token ilə Account Settings endpoint-lərini test edin:

```bash
# Get user profile
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Update profile
curl -X PUT "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com"}'

# Get subscription
curl -X GET "http://localhost:3000/api/user/subscription" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get usage statistics
curl -X GET "http://localhost:3000/api/user/usage?period=month" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get user logs (admin/logs style)
curl -X GET "http://localhost:3000/api/user/logs?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get user logs with filters
curl -X GET "http://localhost:3000/api/user/logs?endpoint=/api/epoint&method=POST&status=200" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get user log statistics
curl -X GET "http://localhost:3000/api/user/logs/stats?timeRange=last7days" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Google Login test:

```bash
# Google login
curl -X POST "http://localhost:3000/auth/google-login" \
  -H "Content-Type: application/json" \
  -d '{
    "google_token": "google_oauth_token",
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://example.com/photo.jpg",
    "google_id": "google_user_id"
  }'
```

---

Bu documentation Account Settings funksionallığının frontend-də tam inteqrasiyasını təmin edir. Bütün endpoint-lər test edilib və production-ready-dir.

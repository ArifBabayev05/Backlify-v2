# Backlify-v2 API Usage Limits System - Frontend Documentation

## 🎯 **Sistemin Məqsədi**

Bu sistem istifadəçilərin plan limitlərinə əsasən API istifadəsini məhdudlaşdırır. **Mövcud `api_logs` table-ından istifadə edərək** istifadə statistikalarını hesablayır.

### **🔧 Sistem Arxitekturası:**

1. **Mövcud `api_logs` table-ından istifadə** - Əlavə table yaratmaq lazım deyil
2. **Real-time statistikalar** - Hər request avtomatik log edilir
3. **Plan əsaslı limitlər** - Basic, Pro, Enterprise planları
4. **İki növ limit:** User authentication və API ID əsaslı

---

## 🔧 **API Endpoint-ləri**

### **1. Plan Məlumatları**
```http
GET /api/user/plans
```

**Cavab:**
```json
{
  "success": true,
  "data": [
    {
      "id": "basic",
      "name": "Basic Plan",
      "price": 0,
      "currency": "USD",
      "features": ["2 Projects", "1000 requests/month", "Email support"]
    },
    {
      "id": "pro", 
      "name": "Pro Plan",
      "price": 9.99,
      "currency": "USD",
      "features": ["10 Projects", "10000 requests/month", "Priority support", "Custom domains"]
    },
    {
      "id": "enterprise",
      "name": "Enterprise Plan", 
      "price": 29.99,
      "currency": "USD",
      "features": ["Unlimited Projects", "Unlimited requests", "24/7 support", "Custom integrations"]
    }
  ]
}
```

### **2. API Usage Məlumatları (Public API-lər üçün)**
```http
GET /api/{apiId}/usage
```

**Cavab:**
```json
{
  "success": true,
  "data": {
    "api_id": "0ce9781b-7e2a-450b-a999-e66e6067d623",
    "user_id": "default",
    "user_plan": "basic",
    "month_start": "2025-08-31T20:00:00.000Z",
    "requests_count": 2,
    "projects_count": 0,
    "limits": {
      "projects": 2,
      "requests": 1000
    },
    "remaining_requests": 998,
    "remaining_projects": 2
  }
}
```

### **3. Admin Usage Statistics**
```http
GET /api/user/usage/stats
Authorization: Bearer {token}
```

**Cavab:**
```json
{
  "success": true,
  "data": {
    "month_start": "2025-08-31T20:00:00.000Z",
    "user_stats": [
      {
        "user_id": "user123",
        "requests_count": 150,
        "projects_count": 3
      }
    ],
    "api_stats": [
      {
        "api_id": "api123",
        "requests_count": 75,
        "user_id": "user123"
      }
    ],
    "total_logs": 500
  }
}
```

---

## 📊 **Plan Limitləri**

| Plan | Projects | Requests/Month | Price |
|------|----------|----------------|-------|
| **Basic** | 2 | 1,000 | $0 |
| **Pro** | 10 | 10,000 | $9.99 |
| **Enterprise** | Unlimited | Unlimited | $29.99 |

---

## 🔄 **Sistem Necə İşləyir**

### **1. Request Tracking:**
- Hər API request avtomatik `api_logs` table-ına yazılır
- `is_api_request: true` olan request-lər sayılır
- `status_code >= 200 && < 400` olan request-lər valid sayılır

### **2. Project Tracking:**
- `/generate-schema` endpoint çağırışları sayılır
- Hər uğurlu schema generation = +1 project

### **3. Limit Checking:**
- **API Request-lər:** `api_id` əsasında limit yoxlanılır
- **Project Request-lər:** `user_id` əsasında limit yoxlanılır
- **Enterprise plan:** Heç bir limit yoxdur

### **4. Error Responses:**
```json
{
  "success": false,
  "message": "Monthly request limit exceeded for your current plan (1000 requests/month)",
  "current": 1001,
  "limit": 1000
}
```

---

## 🧪 **Test Nümunələri**

### **1. Plan Məlumatlarını Almaq:**
```bash
curl http://localhost:3000/api/user/plans
```

### **2. API Usage Məlumatlarını Almaq:**
```bash
curl http://localhost:3000/api/0ce9781b-7e2a-450b-a999-e66e6067d623/usage
```

### **3. Admin Statistics:**
```bash
curl -H "Authorization: Bearer {token}" http://localhost:3000/api/user/usage/stats
```

---

## 🎨 **Frontend İstifadəsi**

### **1. Plan Seçimi:**
```javascript
// Plan məlumatlarını göstər
fetch('/api/user/plans')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      displayPlans(data.data);
    }
  });
```

### **2. Usage Məlumatlarını Göstərmək:**
```javascript
// API usage məlumatlarını göstər
fetch(`/api/${apiId}/usage`)
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      displayUsageStats(data.data);
    }
  });
```

### **3. Limit Aşımı Handling:**
```javascript
// API request göndərərkən error handling
fetch('/api/my-api/endpoint')
  .then(response => response.json())
  .then(data => {
    if (!data.success && data.message.includes('limit exceeded')) {
      showUpgradeModal(data.message);
    }
  });
```

---

## 🔧 **Konfiqurasiya**

### **Headers:**
- `X-User-Id` və ya `X-User-Id` - User identification üçün
- `Authorization: Bearer {token}` - Protected endpoint-lər üçün



## 📈 **Admin Panel İnteqrasiyası**

Mövcud admin log səhifəsi (`/admin/logs`) ilə uyğunlaşdırılmışdır:

1. **Real-time monitoring** - Hər request avtomatik log edilir
2. **User journey tracking** - İstifadəçi fəaliyyətləri izlənilir
3. **API performance** - Response time və status code-lar
4. **Usage analytics** - Plan əsaslı istifadə statistikaları

---

## 🚀 **Növbəti Addımlar**

1. **Frontend-də plan seçimi** - User plan upgrade interface
2. **Usage dashboard** - Real-time usage göstəriciləri
3. **Notification system** - Limit yaxınlaşdıqda bildiriş
4. **Billing integration** - Plan upgrade və ödəniş

---

## ⚠️ **Qeydlər**

- **Əlavə table yaratmaq lazım deyil** - Mövcud `api_logs` table-ından istifadə
- **Real-time tracking** - Hər request avtomatik sayılır
- **Monthly reset** - Hər ayın əvvəlində avtomatik sıfırlanır
- **Enterprise plan** - Heç bir limit yoxdur
- **Error handling** - Limit aşımında 403 status code qaytarılır
# Backlify-v2 API Usage Limits System - Frontend Documentation

## 🎯 **Sistemin Məqsədi**

Bu sistem istifadəçilərin plan limitlərinə əsasən API istifadəsini məhdudlaşdırır. İki növ limit mövcuddur:

1. **User Authentication ilə** - İstifadəçi girişi tələb edən endpoint-lər
2. **API ID ilə** - Public API-lər üçün (external frontend-dən istifadə)

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

**Nə işə yarayır:** İstifadəçilərə mövcud planları göstərmək üçün. Frontend-də plan seçimi komponenti üçün istifadə edilir.

---

### **2. User Usage Məlumatları**
```http
GET /api/usage/current
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
X-User-Id: <USER_ID>
```

**Cavab:**
```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "user_plan": "basic",
    "month_start": "2025-01-01",
    "requests_count": 150,
    "projects_count": 1,
    "limits": {
      "max_projects": 2,
      "max_requests": 1000
    },
    "remaining": {
      "projects": 1,
      "requests": 850
    }
  }
}
```

**Nə işə yarayır:** İstifadəçinin cari aylıq istifadə məlumatlarını göstərmək. Dashboard-da progress bar və limit göstərmək üçün istifadə edilir.

---

### **3. API Usage Məlumatları (Public API-lər üçün)**
```http
GET /api/{API_ID}/usage
```

**Cavab:**
```json
{
  "success": true,
  "data": {
    "api_id": "abc123",
    "user_id": "user123", 
    "user_plan": "pro",
    "month_start": "2025-01-01",
    "requests_count": 2500,
    "projects_count": 3,
    "limits": {
      "max_projects": 10,
      "max_requests": 10000
    },
    "remaining": {
      "projects": 7,
      "requests": 7500
    }
  }
}
```

**Nə işə yarayır:** Public API-lərin istifadə məlumatlarını göstərmək. External frontend-dən API istifadə edərkən limit yoxlanması üçün istifadə edilir.

---

### **4. API Request (Limit Yoxlanması ilə)**
```http
GET /api/{API_ID}/users
POST /api/{API_ID}/users
PUT /api/{API_ID}/users/{id}
DELETE /api/{API_ID}/users/{id}
```

**Cavab (Normal):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

**Cavab (Limit Aşıldıqda):**
```json
{
  "success": false,
  "message": "Monthly request limit exceeded for your current plan (1000 requests/month)."
}
```

**Nə işə yarayır:** Bütün API request-ləri avtomatik olaraq limit yoxlanmasından keçir. Limit aşıldıqda 403 status code ilə xəta mesajı qaytarır.

---

### **5. Project Yaradma (Limit Yoxlanması ilə)**
```http
POST /generate-schema
```

**Request Body:**
```json
{
  "prompt": "Create users and products tables",
  "XAuthUserId": "user123"
}
```

**Cavab (Normal):**
```json
{
  "success": true,
  "XAuthUserId": "user123",
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "constraints": ["primary key", "default uuid_generate_v4()"]
        },
        {
          "name": "name",
          "type": "varchar(255)",
          "constraints": ["not null"]
        }
      ]
    }
  ]
}
```

**Cavab (Limit Aşıldıqda):**
```json
{
  "success": false,
  "message": "Project limit exceeded for your current plan (Basic Plan allows max 2 projects)."
}
```

**Nə işə yarayır:** Yeni API yaradarkən project limitini yoxlayır. Limit aşıldıqda yeni API yaratmağa icazə vermir.

---

## 🚫 **Limit Aşıldıqda Cavablar**

### **Project Limit Aşıldıqda:**
```json
{
  "success": false,
  "message": "Project limit exceeded for your current plan (Basic Plan allows max 2 projects)."
}
```

### **Request Limit Aşıldıqda:**
```json
{
  "success": false,
  "message": "Monthly request limit exceeded for your current plan (1000 requests/month)."
}
```

---

## 📊 **Plan Limitləri**

| Plan | Projects | Requests/Month | Price |
|------|----------|----------------|-------|
| Basic | 2 | 1,000 | $0 |
| Pro | 10 | 10,000 | $9.99 |
| Enterprise | Unlimited | Unlimited | $29.99 |

---

## 🎯 **İstifadə Nümunələri**

### **1. Yeni API Yaradarkən**

```bash
# 1. Schema yarat
curl -X POST http://localhost:3000/generate-schema \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create users and products tables", "XAuthUserId": "user123"}'

# 2. API yarat  
curl -X POST http://localhost:3000/create-api-from-schema \
  -H "Content-Type: application/json" \
  -d '{"tables": [...], "XAuthUserId": "user123"}'

# 3. API usage yoxla
curl http://localhost:3000/api/[API_ID]/usage
```

### **2. Public API İstifadəsi**

```bash
# API usage məlumatlarını al
curl http://localhost:3000/api/abc123/usage

# API request göndər
curl http://localhost:3000/api/abc123/users
curl http://localhost:3000/api/abc123/products
```

### **3. User Usage Məlumatları**

```bash
# User usage məlumatlarını al
curl http://localhost:3000/api/usage/current \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-User-Id: user123"
```

---

## 🎯 **Frontend-də İstifadə**

### **1. Plan Seçimi**
- `/api/user/plans` endpoint-indən plan məlumatlarını al
- UI-da plan kartları göstər
- İstifadəçi plan seçəndə limitləri göstər

### **2. Usage Dashboard**
- `/api/usage/current` endpoint-indən usage məlumatlarını al
- Progress bar ilə limitləri göstər
- Qalan istifadəni hesabla

### **3. API Request-ləri**
- Bütün API request-ləri avtomatik limit yoxlanmasından keçir
- 403 status code alındıqda error mesajı göstər
- Plan upgrade təklif et

### **4. Public API İstifadəsi**
- `/api/{API_ID}/usage` endpoint-indən API usage məlumatlarını al
- External frontend-dən API istifadə edərkən limit yoxlanması
- API owner-in plan limitləri əsasında məhdudiyyət

---

## 🔧 **Konfiqurasiya**

### **Headers**
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
X-User-Id: <USER_ID>
```

---

## 📝 **Əlavə Qeydlər**

1. **CORS:** Bütün endpoint-lər CORS dəstəkləyir
2. **Authentication:** JWT token və ya X-User-Id header istifadə edin
3. **Rate Limiting:** Hər endpoint üçün rate limit mövcuddur
4. **Error Handling:** Bütün xətalar JSON formatında qaytarılır
5. **Monitoring:** Bütün request-lər log edilir
6. **Aylıq Reset:** Hər ayın əvvəlində usage counter-ləri sıfırlanır

---

## 🚀 **Sistem Xüsusiyyətləri**

### **Avtomatik Limit Yoxlanması**
- Bütün API request-ləri avtomatik olaraq limit yoxlanmasından keçir
- Project yaradarkən project limitini yoxlayır
- Aylıq request limitini yoxlayır

### **Real-time Usage Tracking**
- Hər request-də usage counter-ləri yenilənir
- Aylıq reset avtomatik olaraq həyata keçirilir
- Enterprise plan istifadəçiləri üçün məhdudiyyət yoxdur

### **Flexible Authentication**
- JWT token ilə authentication
- X-User-Id header ilə user identification
- Public API-lər üçün API ID əsaslı limit yoxlanması

### **Comprehensive Error Handling**
- Aydın error mesajları
- HTTP status code-ları ilə error növləri
- JSON formatında structured responses

Bu sistem tam hazırdır və production mühitində istifadə edilə bilər! 🚀

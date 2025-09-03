# Frontend - Düzgün Endpoint-lər

## 📋 Bütün Düzgün Endpoint-lər:

### User Profile Management:
- ✅ `GET /api/user/profile` - Profil məlumatlarını əldə et
- ✅ `PUT /api/user/profile` - Profil məlumatlarını yenilə
- ✅ `PUT /api/user/change-password` - Şifrəni dəyiş

### Subscription Management:
- ✅ `GET /api/user/subscription` - Abunəlik məlumatlarını əldə et
- ✅ `POST /api/user/subscription/upgrade` - Abunəliyi yüksəlt

### API Usage & Analytics:
- ✅ `GET /api/user/usage` - API istifadə statistikaları
- ✅ `GET /api/user/logs` - Request logları

### Notification Settings:
- ✅ `GET /api/user/notifications/settings` - Bildiriş tənzimləmələri
- ✅ `PUT /api/user/notifications/settings` - Bildiriş tənzimləmələrini yenilə

## 🔧 Frontend makeRequest Funksiyası:

```javascript

```

## 🧪 Test Endpoint-ləri:

### 1. Əvvəlcə Login edin:

```bash
# Login
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin","password":"your_password"}'
```

### 2. Token ilə Account Settings test edin:

```bash
# Test user profile
curl -X GET "http://localhost:3000/api/user/profile" \


# Test update profile
curl -X PUT "http://localhost:3000/api/user/profile" \

  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com"}'

# Test subscription
curl -X GET "http://localhost:3000/api/user/subscription" \

```

**⚠️ QEYD:** Mövcud sistemdə Bearer token avtomatik yoxlanılır, sadəcə `addProtectedRoute` qeydiyyatı kifayətdir. Frontend-də əvvəl payment endpoint-ləri üçün istifadə etdiyiniz eyni strukturu istifadə edin.

## ⚠️ Əsas Fərqlər:

2. **Authentication:** Mövcud sistemdə avtomatik yoxlanılır
3. **Content-Type:** `application/json`
4. **Error Handling:** Response status və error message yoxlanması

**🔑 Əsas Məqam:** Mövcud sistemdə Bearer token avtomatik yoxlanılır, sadəcə `addProtectedRoute` qeydiyyatı kifayətdir. Frontend-də əvvəl payment endpoint-ləri üçün istifadə etdiyiniz eyni strukturu istifadə edin. Bu dəyişiklikləri etməklə bütün Account Settings endpoint-ləri düzgün işləyəcək!

# 🔐 Google OAuth Authentication Implementation

## 📋 Overview

Bu document Backlify sistemində Google OAuth authentication-in tam implementasiyasını təsvir edir. Frontend tərəfdə Google login sistemi ilə tam uyğun şəkildə hazırlanmışdır.

## 🎯 Features

✅ **Google OAuth 2.0 Integration** - Complete Google login flow  
✅ **Token Verification** - Server-side Google token validation  
✅ **User Management** - Automatic user creation/linking  
✅ **JWT Generation** - Standard Backlify access/refresh tokens  
✅ **Profile Management** - Google profile info storage  
✅ **CORS Compatible** - Works from any frontend domain  
✅ **Database Ready** - Auto-setup database schema  

## 🛠️ Implementation

### 1. Database Schema

Google authentication üçün `users` table-ına əlavə edilən columnlar:

```sql
-- Google OAuth columns
google_id VARCHAR(255) UNIQUE,        -- Google user ID
profile_picture TEXT,                 -- Google profile picture URL
full_name VARCHAR(255),              -- Full name from Google
email_verified BOOLEAN DEFAULT FALSE, -- Email verification status
login_method VARCHAR(50) DEFAULT 'email' -- Login method tracking
```

### 2. API Endpoints

#### Google Login/Register
```http
POST /auth/google-login
Content-Type: application/json

{
  "google_token": "ya29.a0AfH6SMC...",
  "email": "user@gmail.com",
  "name": "User Name",
  "picture": "https://lh3.googleusercontent.com/a/...",
  "google_id": "123456789012345678901"
}
```

**Response:**
```json
{
  "success": true,
  "XAuthUserId": "username",
  "email": "user@gmail.com",
  "name": "User Name",
  "picture": "https://profile-picture-url",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "loginMethod": "google",
  "message": "Google authentication successful"
}
```

#### Google Token Verification
```http
POST /auth/google-verify
Content-Type: application/json

{
  "google_token": "ya29.a0AfH6SMC..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Google token is valid",
  "userInfo": {
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://profile-picture-url",
    "id": "123456789012345678901",
    "verified_email": true
  }
}
```

#### Google User Profile
```http
GET /auth/google-profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "user": {
    "username": "username",
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://profile-picture-url",
    "googleLinked": true,
    "emailVerified": true,
    "joinedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🔄 Authentication Flow

### 1. Frontend Google Login
```javascript
// Frontend-də Google login
const handleGoogleLogin = useGoogleLogin({
  onSuccess: async (tokenResponse) => {
    // Get user info from Google API
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });
    
    const googleUserInfo = await userInfoResponse.json();
    
    // Send to backend
    const response = await fetch('https://backlify-v2.onrender.com/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_token: tokenResponse.access_token,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        picture: googleUserInfo.picture,
        google_id: googleUserInfo.id
      }),
    });
    
    const data = await response.json();
    // Use data.accessToken for authentication
  }
});
```

### 2. Backend Processing

1. **Token Verification**: Google token Google API ilə verify edilir
2. **User Lookup**: Google ID ilə istifadəçi axtarılır
3. **Account Linking**: Mövcud email hesabı varsa, Google ID link edilir
4. **User Creation**: Yeni istifadəçi yaradılır (lazım olduqda)
5. **JWT Generation**: Backlify access/refresh token-ları yaradılır
6. **Response**: Frontend üçün lazım olan məlumatlar qaytarılır

### 3. User Management Scenarios

#### Scenario 1: Yeni Google User
- Google ID database-də yoxdur
- Email də mövcud deyil
- ➡️ **Result**: Yeni user yaradılır

#### Scenario 2: Mövcud Email, Google Link Yoxdur
- Email database-də mövcuddur
- Google ID link edilməyib
- ➡️ **Result**: Google ID mövcud hesaba link edilir

#### Scenario 3: Mövcud Google User
- Google ID database-də mövcuddur
- ➡️ **Result**: Profile info yenilənir, login edilir

## 🔧 Setup Instructions

### 1. Database Setup
```bash
npm run setup-google-auth
```

Bu script aşağıdakı əməliyyatları aparır:
- Google auth columnlarını users table-a əlavə edir
- Lazımi indexləri yaradır
- Helper function və view yaradır

### 2. Manual Database Setup (əgər script işləməzsə)

Supabase SQL Editor-də bu kodu icra edin:

```sql
-- Add Google OAuth columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_picture TEXT,
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS login_method VARCHAR(50) DEFAULT 'email';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_login_method ON users(login_method);
```

### 3. Environment Variables

```bash
# .env faylına əlavə edin (lazım olduqda)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 🧪 Testing

### Automated Testing
```bash
# Google auth endpoint-lərini test et
npm run test-google-auth

# Route konfiqurasiyasını yoxla
npm run show-routes

# CORS-u test et
npm run test-cors
```

### Manual Testing

1. **Browser-də Token Test**:
   ```bash
   curl -X POST "https://backlify-v2.onrender.com/auth/google-verify" \
     -H "Content-Type: application/json" \
     -d '{"google_token": "your_test_token"}'
   ```

2. **Frontend Integration Test**:
   ```javascript
   // Test endpoint availability
   fetch('https://backlify-v2.onrender.com/auth/google-login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       google_token: 'test',
       email: 'test@gmail.com',
       google_id: '123'
     })
   }).then(r => console.log(r.status)); // Should get 401 or 400, not 404
   ```

## 🛡️ Security Features

### 1. Token Verification
- Google token Google API ilə verify edilir
- Expired/invalid token-lar rədd edilir
- Email mismatch yoxlanılır

### 2. User Data Protection
- Sensitive məlumatlar hash edilir
- JWT token-lər secure şəkildə yaradılır
- Rate limiting tətbiq edilir

### 3. Database Security
- Google ID unique constraint
- SQL injection protection
- Prepared statements istifadə edilir

## 🔗 Frontend Integration

Frontend-də istifadə üçün tam hazır kod:

```javascript
// React/Next.js example
import { useGoogleLogin } from '@react-oauth/google';

const GoogleAuthButton = () => {
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Get user info from Google
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );
        
        const googleUserInfo = await userInfoResponse.json();
        
        // Send to Backlify backend
        const response = await fetch(
          'https://backlify-v2.onrender.com/auth/google-login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              google_token: tokenResponse.access_token,
              email: googleUserInfo.email,
              name: googleUserInfo.name,
              picture: googleUserInfo.picture,
              google_id: googleUserInfo.id
            }),
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          // Store tokens
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('user', JSON.stringify({
            XAuthUserId: data.XAuthUserId,
            email: data.email,
            name: data.name,
            picture: data.picture
          }));
          
          // Redirect or update state
          window.location.href = '/dashboard';
        } else {
          console.error('Login failed:', data.error);
        }
      } catch (error) {
        console.error('Google login error:', error);
      }
    },
    onError: (error) => {
      console.error('Google Login Failed:', error);
    },
  });

  return (
    <button onClick={googleLogin}>
      Sign in with Google
    </button>
  );
};
```

## 📊 Route Configuration

Authentication middleware Google auth route-larını düzgün tanıyır:

**Public Routes:**
- `POST /auth/google-login` - Google login/register
- `POST /auth/google-verify` - Token verification

**Protected Routes:**
- `GET /auth/google-profile` - User profile

## ⚠️ Common Issues & Solutions

### 1. 404 Errors
- **Səbəb**: Yeni kod hələ deploy olmayıb
- **Həll**: Deployment tamamlanandan sonra yenidən test edin

### 2. CORS Errors
- **Səbəb**: Origin restrictions
- **Həll**: Bizim universal CORS konfiqurasiyası bunu həll edir

### 3. Token Verification Failed
- **Səbəb**: Invalid/expired Google token
- **Həll**: Frontend-də fresh token əldə edin

### 4. Database Connection Issues
- **Səbəb**: Missing columns or permissions
- **Həll**: `npm run setup-google-auth` icra edin

## 📈 Monitoring

### Success Metrics
- Google login request count
- Token verification success rate
- User creation vs linking ratio
- Error rate by type

### Logging
```javascript
// Backend automatic logging
console.log(`Google login successful for user: ${user.username}`);
console.log(`Created new Google user: ${user.username}`);
console.log(`Linked Google ID to existing user: ${user.username}`);
```

## 🎯 Next Steps

1. **Frontend Integration**: Provided kod frontend-ə inteqrasiya edin
2. **Database Migration**: `npm run setup-google-auth` icra edin
3. **Testing**: `npm run test-google-auth` ilə test edin
4. **Deployment**: Yeni kodu deploy edin
5. **Monitor**: User login flow-unu monitor edin

Bu implementasiya frontend-dəki Google login sistemi ilə 100% uyğundur və istifadəyə tamamilə hazırdır!

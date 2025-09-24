# Frontend Email Service Documentation

## 📧 Email Service API

### **Endpoint:** `POST /api/email/flexible`

Bu endpoint ilə tam nəzarət altında email göndərə bilərsiniz. Bütün email parametrlərini özünüz təyin edə bilərsiniz.

---

## 🔧 **Headers (Başlıqlar)**

### **Tələb olunan:**
```http
Content-Type: application/json
```

### **İsteğe bağlı:**
```http
Authorization: Bearer your_token_here  # Admin funksiyaları üçün
```

---

## 📝 **Request Body (Sorğu Gövdəsi)**

### **Tələb olunan parametrlər:**

| Parametr | Tip | Təsvir | Nümunə |
|----------|-----|---------|---------|
| `to` | string/array | Alıcı email(lar) | `"user@example.com"` və ya `["user1@example.com", "user2@example.com"]` |
| `from` | string | Göndərən email | `"sender@example.com"` |
| `subject` | string | Email mövzusu | `"Salam!"` |
| `html` | string | HTML məzmun | `"<h1>Salam!</h1><p>Bu HTML-dir</p>"` |

### **İsteğe bağlı parametrlər:**

| Parametr | Tip | Təsvir | Nümunə |
|----------|-----|---------|---------|
| `text` | string | Plain text məzmun | `"Salam!\nBu plain text-dir"` |
| `replyTo` | string | Cavab ünvanı | `"support@example.com"` |
| `cc` | string/array | Kopya | `"copy@example.com"` və ya `["copy1@example.com", "copy2@example.com"]` |
| `bcc` | string/array | Gizli kopya | `"hidden@example.com"` |
| `priority` | string | Prioritet | `"low"`, `"normal"`, `"high"` |
| `headers` | object | Xüsusi header-lar | `{"X-Priority": "1"}` |
| `attachments` | array | Əlavələr | `[{"filename": "file.pdf", "content": "base64content"}]` |
| `metadata` | object | Əlavə məlumatlar | `{"campaign": "welcome"}` |

---

## 📋 **Request Nümunələri**

### **1. Sadə HTML Email:**
```json
{
  "to": "recipient@example.com",
  "from": "sender@example.com",
  "subject": "Test Email",
  "html": "<h1>Salam!</h1><p>Bu test email-dir.</p>"
}
```

### **2. HTML və Text hər ikisi:**
```json
{
  "to": "recipient@example.com",
  "from": "sender@example.com",
  "subject": "HTML və Text",
  "html": "<h1>HTML versiya</h1><p>Bu HTML-dir</p>",
  "text": "HTML versiya\nBu HTML-dir"
}
```

### **3. Çoxlu alıcılar:**
```json
{
  "to": ["user1@example.com", "user2@example.com"],
  "from": "sender@example.com",
  "subject": "Hamıya salam!",
  "html": "<h1>Hamıya salam!</h1>"
}
```

### **4. CC və BCC ilə:**
```json
{
  "to": "main@example.com",
  "cc": "copy@example.com",
  "bcc": "hidden@example.com",
  "from": "sender@example.com",
  "subject": "CC və BCC ilə",
  "html": "<h1>Gizli kopya</h1>"
}
```

### **5. Prioritet və Header-lar:**
```json
{
  "to": "recipient@example.com",
  "from": "sender@example.com",
  "subject": "Vacib Email",
  "html": "<h1>Vacib mesaj</h1>",
  "priority": "high",
  "headers": {
    "X-Priority": "1",
    "X-MSMail-Priority": "High"
  }
}
```

### **6. Reply-To ilə:**
```json
{
  "to": "recipient@example.com",
  "from": "noreply@example.com",
  "replyTo": "support@example.com",
  "subject": "Cavab ünvanı",
  "html": "<h1>Cavabı support@example.com-a göndərin</h1>"
}
```

### **7. Ətraflı HTML Email:**
```json
{
  "to": "recipient@example.com",
  "from": "sender@example.com",
  "subject": "Ətraflı Email",
  "html": "<!DOCTYPE html><html><head><style>body{font-family:Arial;color:#333;}</style></head><body><div style=\"max-width:600px;margin:0 auto;padding:20px;\"><h1 style=\"color:#007bff;\">Salam!</h1><p>Bu çox gözəl email-dir.</p><a href=\"https://example.com\" style=\"background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;\">Davam et</a></div></body></html>"
}
```

---

## 📤 **Response (Cavab)**

### **Uğurlu cavab (200 OK):**
```json
{
  "success": true,
  "message": "Flexible email sent successfully",
  "messageId": "unique-message-id-here"
}
```

### **Xəta cavabları:**

#### **400 Bad Request - Çatışmayan parametrlər:**
```json
{
  "success": false,
  "error": "Missing required fields",
  "message": "to, from, subject, and (html or text) are required"
}
```

#### **400 Bad Request - Yanlış email formatı:**
```json
{
  "success": false,
  "error": "Invalid from email format",
  "message": "Please provide a valid from email address"
}
```

#### **500 Internal Server Error:**
```json
{
  "success": false,
  "error": "SMTP configuration is incomplete",
  "message": "Failed to send flexible email"
}
```

---

## 🚀 **Frontend İstifadə Nümunələri**

### **JavaScript (Fetch API):**
```javascript
const sendEmail = async (emailData) => {
  try {
    const response = await fetch('/api/email/flexible', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Email sent successfully:', result.messageId);
      return result;
    } else {
      console.error('Email sending failed:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Network error:', error);
    throw error;
  }
};

// İstifadə nümunəsi
const emailData = {
  to: "user@example.com",
  from: "sender@example.com",
  subject: "Salam!",
  html: "<h1>Salam!</h1><p>Bu test email-dir.</p>"
};

sendEmail(emailData)
  .then(result => {
    alert('Email göndərildi!');
  })
  .catch(error => {
    alert('Xəta: ' + error.message);
  });
```

### **Axios ilə:**
```javascript
import axios from 'axios';

const sendEmail = async (emailData) => {
  try {
    const response = await axios.post('/api/email/flexible', emailData);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error('Network error');
    }
  }
};
```

### **React Hook nümunəsi:**
```javascript
import { useState } from 'react';

const useEmailService = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendEmail = async (emailData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/email/flexible', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      const result = await response.json();

      if (result.success) {
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { sendEmail, isLoading, error };
};

export default useEmailService;
```

---

## ⚠️ **Vacib Qeydlər**

1. **Email formatı:** `from` parametri həmişə düzgün email formatında olmalıdır
2. **HTML və Text:** Ən azı biri (`html` və ya `text`) tələb olunur
3. **Çoxlu alıcılar:** `to`, `cc`, `bcc` parametrləri string və ya array ola bilər
4. **Rate limiting:** 15 dəqiqədə 10 sorğu limiti var
5. **Error handling:** Həmişə `success` field-ini yoxlayın
6. **Content-Type:** Həmişə `application/json` header-ı əlavə edin

---

## 🔍 **Debug və Test**

```bash
curl -X POST http://localhost:3000/api/email/flexible \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "from": "sender@example.com",
    "subject": "Test",
    "html": "<h1>Test</h1>"
  }'
```

Bu servis ilə tam nəzarət altında email göndərə bilərsiniz!

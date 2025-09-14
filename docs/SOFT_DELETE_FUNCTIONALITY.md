# API Soft Delete Functionality

Bu sənəd Backlify API Generator-da əlavə edilən soft delete funksionallığını izah edir.

## Xüsusiyyətlər

### 1. Soft Delete
- API-lər fiziki olaraq silinmir, yalnız `deleted_at` timestamp ilə işarələnir
- Silinmiş API-lər normal API siyahısında görünmür
- Məlumatlar veritabanında saxlanılır və bərpa edilə bilər

### 2. Restore (Bərpa)
- Soft delete edilmiş API-lər bərpa edilə bilər
- Bərpa zamanı `restored_at` və `restored_by` məlumatları əlavə edilir

### 3. Ayrıca Siyahılar
- Aktiv API-lər: `/my-apis` endpoint-i
- Silinmiş API-lər: `/my-apis/deleted` endpoint-i

## Yeni Endpoint-lər

### 1. API Silmək
```http
DELETE /api/:apiId
```

**Cavab:**
```json
{
  "success": true,
  "message": "API deleted successfully",
  "apiId": "123e4567-e89b-12d3-a456-426614174000",
  "deleted_at": "2024-01-15T10:30:00.000Z"
}
```

### 2. API Bərpa Etmək
```http
POST /api/:apiId/restore
```

**Cavab:**
```json
{
  "success": true,
  "message": "API restored successfully",
  "apiId": "123e4567-e89b-12d3-a456-426614174000",
  "restored_at": "2024-01-15T11:00:00.000Z"
}
```

### 3. Silinmiş API-ləri Görüntüləmək
```http
GET /my-apis/deleted
```

**Cavab:**
```json
{
  "success": true,
  "apis": [
    {
      "apiId": "123e4567-e89b-12d3-a456-426614174000",
      "prompt": "User management system",
      "tables": ["users", "profiles"],
      "createdAt": "2024-01-15T09:00:00.000Z",
      "deleted_at": "2024-01-15T10:30:00.000Z",
      "deleted_by": "user123"
    }
  ]
}
```

### 4. Aktiv API-ləri Görüntüləmək
```http
GET /my-apis
```

**Cavab:**
```json
{
  "XAuthUserId": "user123",
  "apis": [
    {
      "apiId": "456e7890-e89b-12d3-a456-426614174001",
      "prompt": "E-commerce system",
      "tables": ["products", "orders"],
      "createdAt": "2024-01-15T08:00:00.000Z"
    }
  ]
}
```

## Təhlükəsizlik

- Hər istifadəçi yalnız öz API-lərini silə və bərpa edə bilər
- `XAuthUserId` yoxlanılır və yalnız sahib istifadəçi əməliyyatları yerinə yetirə bilər

## Veritabanı Dəyişiklikləri

API metadata-da aşağıdakı sahələr əlavə edilir:

```json
{
  "deleted_at": "2024-01-15T10:30:00.000Z",
  "deleted_by": "user123",
  "restored_at": "2024-01-15T11:00:00.000Z",
  "restored_by": "user123"
}
```

## Test

Test faylı: `test-soft-delete.js`

```bash
node test-soft-delete.js
```

## Faydalar

1. **Məlumatların Qorunması**: API-lər fiziki olaraq silinmir
2. **Bərpa İmkanı**: Səhv silinmə halında bərpa edilə bilər
3. **Audit Trail**: Kim, nə vaxt silib/bərpa etdiyi qeyd edilir
4. **Performans**: Soft delete edilmiş API-lər normal siyahıdan çıxarılır
5. **Təhlükəsizlik**: Hər istifadəçi yalnız öz API-ləri ilə işləyə bilər

## İstifadə Nümunəsi

```javascript
// API silmək
const deleteResponse = await fetch('/api/123e4567-e89b-12d3-a456-426614174000', {
  method: 'DELETE',
  headers: {
    'X-Auth-User-Id': 'user123'
  }
});

// Silinmiş API-ləri görüntüləmək
const deletedApis = await fetch('/my-apis/deleted', {
  headers: {
    'X-Auth-User-Id': 'user123'
  }
});

// API bərpa etmək
const restoreResponse = await fetch('/api/123e4567-e89b-12d3-a456-426614174000/restore', {
  method: 'POST',
  headers: {
    'X-Auth-User-Id': 'user123'
  }
});
```

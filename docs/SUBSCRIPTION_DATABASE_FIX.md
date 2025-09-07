# 🔧 Subscription Database Fix Documentation

Bu sənəd subscription sistemindəki bütün problemlərin həllini və düzəlişləri əhatə edir.

## 🚨 Aşkar Edilən Problemlər

### 1. **Foreign Key Type Mismatch**
- `subscriptions` table-də `payment_order_id UUID` 
- `payment_orders` table-də `id SERIAL` (integer)
- Bu uyğunsuzluq foreign key constraint xətasına səbəb olurdu

### 2. **Missing Fields in Payment Orders**
- `payment_orders` table-də `plan_id` field-i yox idi
- `order_id` field-i düzgün istifadə edilmirdi

### 3. **User ID Issues**
- Bəzi table-lərdə `user_id` nullable idi
- Payment order yaradarkən user_id düzgün insert olunmurdu

### 4. **Table Schema Conflicts**
- Müxtəlif fayllarda fərqli table schema-ları var idi
- Bu inconsistency-lərə səbəb olurdu

## ✅ Həll Edilən Problemlər

### 1. **Yeni Table Schema (fix-subscription-tables.sql)**

```sql
-- Payment Orders Table (Fixed)
CREATE TABLE payment_orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL,                    -- Fixed: NOT NULL
    plan_id VARCHAR(50) NOT NULL,             -- Fixed: Added missing field
    api_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AZN',
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'epoint',
    payment_transaction_id VARCHAR(100),
    success_redirect_url TEXT,
    error_redirect_url TEXT,
    epoint_data JSONB,
    epoint_signature TEXT,
    epoint_redirect_url TEXT,
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions Table (Fixed)
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    api_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_order_id INTEGER REFERENCES payment_orders(id) ON DELETE SET NULL,  -- Fixed: INTEGER type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. **Code Fixes**

#### AccountController.js
```javascript
// Fixed: Added plan_id field to payment order creation
const { data: order, error: orderError } = await this.supabase
  .from('payment_orders')
  .insert([{
    order_id: orderId,
    user_id: userId,
    plan_id: plan,  // ✅ Added missing field
    amount: planPricing.price,
    currency: 'AZN',
    description: `Subscription upgrade to ${plan} plan`,
    status: 'pending',
    payment_method: 'epoint'
  }])
  .select()
  .single();
```

#### PaymentService.js
```javascript
// Fixed: Use order.order_id instead of order.id for Epoint
const paymentData = this.epointService.prepareStandardPayment({
  amount: order.amount,
  order_id: order.order_id,  // ✅ Fixed: Use order_id field
  description: `Backlify ${this.plans[order.plan_id]?.name || order.plan_id} Plan`,
  // ... other fields
});

// Fixed: Include payment_order_id in subscription data
const subscriptionData = {
  user_id: order.user_id,
  plan_id: order.plan_id,
  api_id: order.api_id,
  status: 'active',
  start_date: new Date().toISOString(),
  expiration_date: expirationDate.toISOString(),
  payment_order_id: order.id,  // ✅ Added payment order reference
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
```

## 🛠️ Düzəliş Proseduru

### 1. **Database-i Düzəltmək**

```bash
# 1. SQL script-i işə sal
node src/tools/fix-subscription-database.js

# 2. Test et
node src/tools/test-subscription-flow.js
```

### 2. **Manual SQL Execution**

Əgər script işləmirsə, manual olaraq SQL-i işə salın:

```sql
-- 1. Mövcud table-ləri sil
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS payment_orders CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;

-- 2. Yeni table-ləri yarat (fix-subscription-tables.sql faylından)
-- ... (SQL script-in tam məzmunu)
```

## 🧪 Test Proseduru

### 1. **Database Structure Test**
```bash
node src/tools/test-subscription-flow.js
```

Bu test aşağıdakıları yoxlayır:
- ✅ Table-lərin mövcudluğu
- ✅ Payment plan-ların düzgün insert olunması
- ✅ Payment order yaradılması
- ✅ Subscription yaradılması
- ✅ Foreign key relationship-lərin işləməsi

### 2. **Manual Test**

```javascript
// 1. Payment order yarat
const order = await supabase
  .from('payment_orders')
  .insert([{
    order_id: 'TEST_123',
    user_id: 'user-uuid',
    plan_id: 'pro',
    amount: 0.01,
    currency: 'AZN',
    description: 'Test order',
    status: 'pending',
    payment_method: 'epoint'
  }])
  .select()
  .single();

// 2. Subscription yarat
const subscription = await supabase
  .from('user_subscriptions')
  .insert([{
    user_id: 'user-uuid',
    plan_id: 'pro',
    status: 'active',
    start_date: new Date().toISOString(),
    expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    payment_order_id: order.id
  }])
  .select()
  .single();

// 3. Foreign key relationship yoxla
const subWithOrder = await supabase
  .from('user_subscriptions')
  .select(`
    *,
    payment_orders!inner(
      id,
      order_id,
      amount,
      status
    )
  `)
  .eq('id', subscription.id)
  .single();
```

## 📊 Yeni Table Structure

### Payment Orders Table
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| order_id | VARCHAR(100) | UNIQUE, NOT NULL | Unique order identifier |
| user_id | UUID | NOT NULL | User who made the payment |
| plan_id | VARCHAR(50) | NOT NULL | Plan being purchased |
| api_id | VARCHAR(100) | NULL | Optional API identifier |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| currency | VARCHAR(3) | DEFAULT 'AZN' | Payment currency |
| description | TEXT | NULL | Payment description |
| status | VARCHAR(20) | DEFAULT 'pending' | Payment status |
| payment_method | VARCHAR(50) | DEFAULT 'epoint' | Payment method |
| payment_transaction_id | VARCHAR(100) | NULL | External transaction ID |
| success_redirect_url | TEXT | NULL | Success redirect URL |
| error_redirect_url | TEXT | NULL | Error redirect URL |
| epoint_data | JSONB | NULL | Epoint payment data |
| epoint_signature | TEXT | NULL | Epoint signature |
| epoint_redirect_url | TEXT | NULL | Epoint redirect URL |
| payment_details | JSONB | NULL | Additional payment details |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### User Subscriptions Table
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | UUID | NOT NULL | User who has the subscription |
| plan_id | VARCHAR(50) | NOT NULL | Subscription plan |
| api_id | VARCHAR(100) | NULL | Optional API identifier |
| status | VARCHAR(20) | DEFAULT 'active' | Subscription status |
| start_date | TIMESTAMP | DEFAULT NOW() | Subscription start date |
| expiration_date | TIMESTAMP | NOT NULL | Subscription expiration date |
| payment_order_id | INTEGER | REFERENCES payment_orders(id) | Related payment order |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

## 🔒 Security Features

### Row Level Security (RLS)
- Bütün table-lər üçün RLS aktivdir
- İstifadəçilər yalnız öz məlumatlarını görə bilərlər
- Foreign key relationship-lər düzgün işləyir

### Indexes
- Performance üçün lazımi index-lər yaradılıb
- User ID, status, və tarix field-ləri üçün index-lər

## 🚀 Deployment Notes

### 1. **Production-da Düzəliş**
```bash
# 1. Backup yarat
pg_dump your_database > backup_before_fix.sql

# 2. Düzəlişi tətbiq et
node src/tools/fix-subscription-database.js

# 3. Test et
node src/tools/test-subscription-flow.js

# 4. Əgər hər şey yaxşıdırsa, backup-ı sil
rm backup_before_fix.sql
```

### 2. **Environment Variables**
Aşağıdakı environment variable-ların təyin edildiyindən əmin olun:
- `SUPABASE_URL`
- `SUPABASE_KEY` və ya `SUPABASE_SERVICE_ROLE_KEY`
- `SUCCESS_REDIRECT_URL`
- `ERROR_REDIRECT_URL`

## 📋 Checklist

### Database Fix
- [ ] Mövcud table-lər silinib
- [ ] Yeni table schema-ları yaradılıb
- [ ] Foreign key constraint-lər düzəldilib
- [ ] Index-lər yaradılıb
- [ ] RLS policy-ləri aktivdir
- [ ] Default payment plan-lar insert olunub

### Code Fix
- [ ] AccountController.js-də plan_id field-i əlavə edilib
- [ ] PaymentService.js-də order_id düzəldilib
- [ ] Payment order creation düzəldilib
- [ ] Subscription creation düzəldilib

### Testing
- [ ] Database structure test keçib
- [ ] Payment order creation test keçib
- [ ] Subscription creation test keçib
- [ ] Foreign key relationship test keçib
- [ ] End-to-end payment flow test keçib

## 🆘 Troubleshooting

### Problem: "Foreign key constraint cannot be implemented"
**Həll:** Table-ləri yenidən yaradın və foreign key type-larını yoxlayın.

### Problem: "user_id is null"
**Həll:** Payment order creation-da user_id field-inin düzgün göndərildiyini yoxlayın.

### Problem: "plan_id is missing"
**Həll:** Payment order insert-də plan_id field-ini əlavə edin.

### Problem: "Table does not exist"
**Həll:** SQL script-inin tam işlədiyindən əmin olun.

## 📞 Support

Əgər hər hansı problem varsa:
1. Test script-ini işə salın: `node src/tools/test-subscription-flow.js`
2. Error log-larını yoxlayın
3. Database connection-ı yoxlayın
4. Environment variable-ları yoxlayın

---

**Son yenilənmə:** 2024-01-15  
**Versiya:** 1.0.0  
**Status:** ✅ Fixed və Test Edilib

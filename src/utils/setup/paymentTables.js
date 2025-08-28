/**
 * Payment System Database Tables Setup
 * This file contains SQL scripts to create all necessary tables for the payment system
 */

const createPaymentTables = `
-- Payment Plans Table
CREATE TABLE IF NOT EXISTS payment_plans (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AZN',
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Orders Table
CREATE TABLE IF NOT EXISTS payment_orders (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    api_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AZN',
    status VARCHAR(20) DEFAULT 'pending',
    payment_transaction_id VARCHAR(100),
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    api_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Transactions Table (for detailed tracking)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES payment_orders(id),
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AZN',
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50),
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_api_id ON user_subscriptions(api_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expiration_date ON user_subscriptions(expiration_date);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON payment_transactions(transaction_id);

-- Insert default payment plans
INSERT INTO payment_plans (plan_id, name, price, currency, features) VALUES
('basic', 'Basic Plan', 9.99, 'AZN', '["Basic API access", "1000 requests/month", "Email support"]')
ON CONFLICT (plan_id) DO NOTHING;

INSERT INTO payment_plans (plan_id, name, price, currency, features) VALUES
('pro', 'Pro Plan', 19.99, 'AZN', '["Pro API access", "10000 requests/month", "Priority support", "Custom domains"]')
ON CONFLICT (plan_id) DO NOTHING;

INSERT INTO payment_plans (plan_id, name, price, currency, features) VALUES
('enterprise', 'Enterprise Plan', 49.99, 'AZN', '["Enterprise API access", "Unlimited requests", "24/7 support", "Custom integrations", "SLA guarantee"]')
ON CONFLICT (plan_id) DO NOTHING;
`;

const dropPaymentTables = `
-- Drop payment system tables (use with caution)
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS payment_orders CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;
`;

module.exports = {
  createPaymentTables,
  dropPaymentTables
};

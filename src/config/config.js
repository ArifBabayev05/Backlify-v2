require('dotenv').config();

const config = {
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    model: process.env.MISTRAL_MODEL
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  payment: {
    epoint: {
      publicKey: process.env.EPOINT_PUBLIC_KEY,
      privateKey: process.env.EPOINT_PRIVATE_KEY,
      merchantId: process.env.EPOINT_MERCHANT_ID,
      apiUrl: process.env.EPOINT_API_URL || 'https://api.epoint.az',
      apiBaseUrl: process.env.EPOINT_API_BASE_URL || 'https://epoint.az/api/1',
      callbackUrl: process.env.EPOINT_CALLBACK_URL || '/api/epoint-callback'
    },
    plans: {
      basic: {
        name: 'Basic Plan',
        price: 9.99,
        currency: 'AZN',
        features: ['Basic API access', '1000 requests/month', 'Email support']
      },
      pro: {
        name: 'Pro Plan',
        price: 19.99,
        currency: 'AZN',
        features: ['Pro API access', '10000 requests/month', 'Priority support', 'Custom domains']
      },
      enterprise: {
        name: 'Enterprise Plan',
        price: 49.99,
        currency: 'AZN',
        features: ['Enterprise API access', 'Unlimited requests', '24/7 support', 'Custom integrations', 'SLA guarantee']
      }
    }
  }
};

module.exports = config; 
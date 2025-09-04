const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function recreatePaymentOrdersTable() {
  try {
    console.log('Starting payment_orders table recreation...');

    // First, drop the existing table if it exists
    console.log('Dropping existing payment_orders table...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS public.payment_orders CASCADE;'
    });

    if (dropError) {
      console.error('Error dropping table:', dropError);
      // Try alternative method
      console.log('Trying alternative drop method...');
      const { error: dropError2 } = await supabase
        .from('payment_orders')
        .select('*')
        .limit(1);
      
      if (dropError2 && dropError2.code === 'PGRST116') {
        console.log('Table does not exist, proceeding with creation...');
      } else {
        throw dropError;
      }
    }

    // Create the new table with correct structure
    console.log('Creating new payment_orders table...');
    const createTableSQL = `
      CREATE TABLE public.payment_orders (
        id serial NOT NULL,
        order_id character varying(100) NOT NULL,
        user_id uuid NULL,
        plan_id character varying(50) NULL,
        api_id character varying(100) NULL,
        amount numeric(10, 2) NOT NULL,
        currency character varying(3) NULL DEFAULT 'AZN'::character varying,
        description text NULL,
        status character varying(20) NULL DEFAULT 'pending'::character varying,
        payment_method character varying(50) NULL DEFAULT 'epoint'::character varying,
        payment_transaction_id character varying(100) NULL,
        success_redirect_url text NULL,
        error_redirect_url text NULL,
        epoint_data jsonb NULL,
        epoint_signature text NULL,
        epoint_redirect_url text NULL,
        payment_details jsonb NULL,
        created_at timestamp with time zone NULL DEFAULT now(),
        updated_at timestamp with time zone NULL DEFAULT now(),
        CONSTRAINT payment_orders_pkey PRIMARY KEY (id),
        CONSTRAINT payment_orders_order_id_unique UNIQUE (order_id)
      ) TABLESPACE pg_default;
    `;

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL
    });

    if (createError) {
      console.error('Error creating table:', createError);
      throw createError;
    }

    // Create indexes for better performance
    console.log('Creating indexes...');
    const indexes = [
      'CREATE INDEX idx_payment_orders_user_id ON public.payment_orders(user_id);',
      'CREATE INDEX idx_payment_orders_status ON public.payment_orders(status);',
      'CREATE INDEX idx_payment_orders_created_at ON public.payment_orders(created_at);',
      'CREATE INDEX idx_payment_orders_payment_transaction_id ON public.payment_orders(payment_transaction_id);'
    ];

    for (const indexSQL of indexes) {
      const { error: indexError } = await supabase.rpc('exec_sql', {
        sql: indexSQL
      });
      
      if (indexError) {
        console.warn('Warning creating index:', indexError.message);
      }
    }

    // Enable Row Level Security (RLS)
    console.log('Enabling Row Level Security...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.warn('Warning enabling RLS:', rlsError.message);
    }

    // Create RLS policies
    console.log('Creating RLS policies...');
    const policies = [
      `CREATE POLICY "Users can view their own payment orders" ON public.payment_orders
       FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY "Users can insert their own payment orders" ON public.payment_orders
       FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);`,
      `CREATE POLICY "Users can update their own payment orders" ON public.payment_orders
       FOR UPDATE USING (auth.uid() = user_id);`
    ];

    for (const policySQL of policies) {
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: policySQL
      });
      
      if (policyError) {
        console.warn('Warning creating policy:', policyError.message);
      }
    }

    console.log('✅ payment_orders table recreated successfully!');
    console.log('\nTable structure:');
    console.log('- id (serial, primary key)');
    console.log('- order_id (varchar, unique)');
    console.log('- user_id (uuid, nullable)');
    console.log('- plan_id (varchar, nullable)');
    console.log('- api_id (varchar, nullable)');
    console.log('- amount (numeric)');
    console.log('- currency (varchar, default: AZN)');
    console.log('- description (text, nullable)');
    console.log('- status (varchar, default: pending)');
    console.log('- payment_method (varchar, default: epoint)');
    console.log('- payment_transaction_id (varchar, nullable)');
    console.log('- success_redirect_url (text, nullable)');
    console.log('- error_redirect_url (text, nullable)');
    console.log('- epoint_data (jsonb, nullable)');
    console.log('- epoint_signature (text, nullable)');
    console.log('- epoint_redirect_url (text, nullable)');
    console.log('- payment_details (jsonb, nullable)');
    console.log('- created_at (timestamp with time zone)');
    console.log('- updated_at (timestamp with time zone)');

  } catch (error) {
    console.error('❌ Error recreating payment_orders table:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  recreatePaymentOrdersTable()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { recreatePaymentOrdersTable };

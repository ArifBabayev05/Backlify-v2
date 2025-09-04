-- Drop existing payment_orders table if it exists
DROP TABLE IF EXISTS public.payment_orders CASCADE;

-- Create new payment_orders table with correct structure
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

-- Create indexes for better performance
CREATE INDEX idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX idx_payment_orders_created_at ON public.payment_orders(created_at);
CREATE INDEX idx_payment_orders_payment_transaction_id ON public.payment_orders(payment_transaction_id);

-- Enable Row Level Security
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own payment orders" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment orders" ON public.payment_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own payment orders" ON public.payment_orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payment_orders_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.payment_orders_id_seq TO service_role;

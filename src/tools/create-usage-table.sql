-- Create usage table for tracking user limits
CREATE TABLE IF NOT EXISTS public.usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_plan character varying(50) NOT NULL,
  month_start date NOT NULL,
  requests_count integer DEFAULT 0,
  projects_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON public.usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_month_start ON public.usage(month_start);
CREATE INDEX IF NOT EXISTS idx_usage_user_plan ON public.usage(user_plan);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_user_month ON public.usage(user_id, month_start);

-- Enable Row Level Security
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own usage" ON public.usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" ON public.usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" ON public.usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.usage TO authenticated;
GRANT ALL ON public.usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.usage_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.usage_id_seq TO service_role;

-- Create function to get or create usage record for current month
CREATE OR REPLACE FUNCTION get_or_create_usage(
  p_user_id uuid,
  p_user_plan character varying(50)
) RETURNS public.usage AS $$
DECLARE
  current_month_start date;
  usage_record public.usage;
BEGIN
  -- Get first day of current month
  current_month_start := date_trunc('month', CURRENT_DATE);
  
  -- Try to get existing usage record
  SELECT * INTO usage_record
  FROM public.usage
  WHERE user_id = p_user_id 
    AND month_start = current_month_start;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.usage (user_id, user_plan, month_start, requests_count, projects_count)
    VALUES (p_user_id, p_user_plan, current_month_start, 0, 0)
    RETURNING * INTO usage_record;
  END IF;
  
  RETURN usage_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reset monthly usage (to be run monthly)
CREATE OR REPLACE FUNCTION reset_monthly_usage() RETURNS void AS $$
BEGIN
  -- Reset all usage counters for the new month
  UPDATE public.usage 
  SET requests_count = 0, 
      projects_count = 0,
      updated_at = now()
  WHERE month_start < date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

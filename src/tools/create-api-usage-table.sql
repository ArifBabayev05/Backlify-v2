-- Create API usage table for tracking limits by API ID
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_id character varying(100) NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_plan character varying(50) NOT NULL,
  month_start date NOT NULL,
  requests_count integer DEFAULT 0,
  projects_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_usage_api_id ON public.api_usage(api_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_month_start ON public.api_usage(month_start);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_plan ON public.api_usage(user_plan);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_api_month ON public.api_usage(api_id, month_start);

-- Enable Row Level Security
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own API usage" ON public.api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API usage" ON public.api_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API usage" ON public.api_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.api_usage TO authenticated;
GRANT ALL ON public.api_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.api_usage_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.api_usage_id_seq TO service_role;

-- Create function to get or create API usage record for current month
CREATE OR REPLACE FUNCTION get_or_create_api_usage(
  p_api_id character varying(100),
  p_user_id uuid,
  p_user_plan character varying(50)
) RETURNS public.api_usage AS $$
DECLARE
  current_month_start date;
  usage_record public.api_usage;
BEGIN
  -- Get first day of current month
  current_month_start := date_trunc('month', CURRENT_DATE);
  
  -- Try to get existing usage record
  SELECT * INTO usage_record
  FROM public.api_usage
  WHERE api_id = p_api_id 
    AND month_start = current_month_start;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.api_usage (api_id, user_id, user_plan, month_start, requests_count, projects_count)
    VALUES (p_api_id, p_user_id, p_user_plan, current_month_start, 0, 0)
    RETURNING * INTO usage_record;
  END IF;
  
  RETURN usage_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reset monthly API usage
CREATE OR REPLACE FUNCTION reset_monthly_api_usage() RETURNS void AS $$
BEGIN
  -- Reset all usage counters for the new month
  UPDATE public.api_usage 
  SET requests_count = 0, 
      projects_count = 0,
      updated_at = now()
  WHERE month_start < date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

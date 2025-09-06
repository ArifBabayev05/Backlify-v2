const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function setupUsageFunction() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  console.log('🔧 Setting up usage tracking function...');

  try {
    // Create the get_or_create_usage function
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: `
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
      `
    });

    if (error) {
      console.error('❌ Error creating function:', error);
      return;
    }

    console.log('✅ get_or_create_usage function created successfully!');

    // Test the function
    console.log('🧪 Testing the function...');
    const testResult = await supabase.rpc('get_or_create_usage', {
      p_user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      p_user_plan: 'basic'
    });

    if (testResult.error) {
      console.error('❌ Function test failed:', testResult.error);
    } else {
      console.log('✅ Function test successful!');
      console.log('Test result:', testResult.data);
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupUsageFunction();

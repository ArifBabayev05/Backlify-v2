-- =====================================================
-- SUPABASE DASHBOARD MIGRATION SCRIPT
-- =====================================================
-- Copy and paste this entire script into your Supabase SQL Editor
-- This will add the original_id column to your SecurityLogAnalysis table

-- Step 1: Add the original_id column
ALTER TABLE "SecurityLogAnalysis" 
ADD COLUMN IF NOT EXISTS "original_id" TEXT;

-- Step 2: Add a comment to document the column
COMMENT ON COLUMN "SecurityLogAnalysis"."original_id" IS 'Original analysis ID before timestamp suffix was added for uniqueness';

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_securityloganalysis_original_id" 
ON "SecurityLogAnalysis" ("original_id");

CREATE INDEX IF NOT EXISTS "idx_securityloganalysis_original_id_timestamp" 
ON "SecurityLogAnalysis" ("original_id", "timestamp_created" DESC);

-- Step 4: Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'SecurityLogAnalysis' 
AND column_name = 'original_id';

-- Step 5: Show table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'SecurityLogAnalysis'
ORDER BY ordinal_position;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- After running this script, your analysis service will work
-- with full data persistence - no more data loss!

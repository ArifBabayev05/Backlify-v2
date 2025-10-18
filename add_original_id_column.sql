-- Migration script to add original_id column to SecurityLogAnalysis table
-- This script adds the original_id column to track the original analysis ID
-- and creates an index for better query performance

-- Add the original_id column
ALTER TABLE "SecurityLogAnalysis" 
ADD COLUMN "original_id" TEXT;

-- Add a comment to document the column purpose
COMMENT ON COLUMN "SecurityLogAnalysis"."original_id" IS 'Original analysis ID before timestamp suffix was added for uniqueness';

-- Create an index on original_id for better query performance
CREATE INDEX IF NOT EXISTS "idx_securityloganalysis_original_id" 
ON "SecurityLogAnalysis" ("original_id");

-- Create a composite index for common queries (original_id + timestamp)
CREATE INDEX IF NOT EXISTS "idx_securityloganalysis_original_id_timestamp" 
ON "SecurityLogAnalysis" ("original_id", "timestamp_created" DESC);

-- Optional: Update existing records to set original_id = id (if you want to migrate existing data)
-- Uncomment the following lines if you want to populate original_id for existing records
-- UPDATE "SecurityLogAnalysis" 
-- SET "original_id" = "id" 
-- WHERE "original_id" IS NULL;

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'SecurityLogAnalysis' 
AND column_name = 'original_id';

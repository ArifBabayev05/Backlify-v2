/**
 * Google Authentication Database Setup
 * Adds Google OAuth support to existing users table
 */

const addGoogleAuthSupport = `
-- Add Google OAuth columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_picture TEXT,
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS login_method VARCHAR(50) DEFAULT 'email';

-- Create index for Google ID for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create index for login method
CREATE INDEX IF NOT EXISTS idx_users_login_method ON users(login_method);

-- Update existing users to have login_method = 'email' if null
UPDATE users SET login_method = 'email' WHERE login_method IS NULL;

-- Add constraint to ensure google_id is unique when not null
-- (PostgreSQL allows multiple NULL values in UNIQUE columns)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique 
ON users(google_id) WHERE google_id IS NOT NULL;

-- Optional: Create a view for Google users
CREATE OR REPLACE VIEW google_users AS
SELECT 
  id,
  username,
  email,
  full_name,
  profile_picture,
  google_id,
  email_verified,
  created_at,
  updated_at
FROM users 
WHERE google_id IS NOT NULL;

-- Optional: Create a function to get user by Google ID or email
CREATE OR REPLACE FUNCTION get_user_by_google_or_email(
  p_google_id VARCHAR(255) DEFAULT NULL,
  p_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  username VARCHAR(50),
  email VARCHAR(255),
  full_name VARCHAR(255),
  profile_picture TEXT,
  google_id VARCHAR(255),
  email_verified BOOLEAN,
  login_method VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.profile_picture,
    u.google_id,
    u.email_verified,
    u.login_method,
    u.created_at,
    u.updated_at
  FROM users u
  WHERE 
    (p_google_id IS NOT NULL AND u.google_id = p_google_id) OR
    (p_email IS NOT NULL AND u.email = p_email)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON google_users TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_by_google_or_email TO authenticated, anon;
`;

const removeGoogleAuthSupport = `
-- Remove Google OAuth support (use with caution)
DROP VIEW IF EXISTS google_users CASCADE;
DROP FUNCTION IF EXISTS get_user_by_google_or_email CASCADE;
DROP INDEX IF EXISTS idx_users_google_id;
DROP INDEX IF EXISTS idx_users_login_method;
DROP INDEX IF EXISTS idx_users_google_id_unique;

ALTER TABLE users 
DROP COLUMN IF EXISTS google_id,
DROP COLUMN IF EXISTS profile_picture,
DROP COLUMN IF EXISTS full_name,
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS login_method;
`;

module.exports = {
  addGoogleAuthSupport,
  removeGoogleAuthSupport
};

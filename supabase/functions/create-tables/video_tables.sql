-- Create videos table for storing video files as binary data
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_data BYTEA NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on filename for faster lookups
CREATE INDEX IF NOT EXISTS idx_videos_filename ON videos(filename);

-- Create index on uploaded_at for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_at ON videos(uploaded_at);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE videos_id_seq TO authenticated;

-- Grant permissions to service role
GRANT ALL ON videos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE videos_id_seq TO service_role;

-- Update videos table to use file paths instead of binary data
-- This is a migration script to fix video streaming issues

-- First, backup existing data (optional)
-- CREATE TABLE videos_backup AS SELECT * FROM videos;

-- Drop the old videos table
DROP TABLE IF EXISTS videos;

-- Create new videos table with file path instead of binary data
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- Store file path instead of binary data
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_filename ON videos(filename);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_at ON videos(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_videos_file_path ON videos(file_path);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE videos_id_seq TO authenticated;

-- Insert sample data for testing (if you want to keep existing videos)
-- Note: You'll need to re-upload videos since we're changing the storage method
INSERT INTO videos (filename, original_name, file_path, file_size, mime_type, uploaded_at) VALUES
('sample_video_1.mp4', 'Sample Video 1', '/uploads/videos/sample_video_1.mp4', 1570024, 'video/mp4', NOW()),
('sample_video_2.mp4', 'Sample Video 2', '/uploads/videos/sample_video_2.mp4', 1570024, 'video/mp4', NOW());

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'videos' 
ORDER BY ordinal_position;

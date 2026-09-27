-- Migration: Track active Backblaze large file session ID on photos table for server-side resume
-- 1. Track the active Backblaze large file session ID on the photo/video row
ALTER TABLE photos ADD COLUMN IF NOT EXISTS b2_file_id text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS status text DEFAULT 'processed';

-- 2. Index active uploading sessions for fast resume lookups
CREATE INDEX IF NOT EXISTS idx_photos_active_upload 
ON photos (user_id, event_id, status) 
WHERE status = 'uploading';

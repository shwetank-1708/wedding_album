-- Migration: Add error logging, watchdog retry counter, and state query index for self-healing media pipeline
-- 1. Error message if transcoding fails
ALTER TABLE photos ADD COLUMN IF NOT EXISTS processing_error text;

-- 2. Watchdog retry attempt counter
ALTER TABLE photos ADD COLUMN IF NOT EXISTS transcode_attempts int DEFAULT 0;

-- 3. High-performance index for the Watchdog queries
CREATE INDEX IF NOT EXISTS idx_photos_watchdog_state 
ON photos (resource_type, status, uploaded_at) 
WHERE status IN ('uploading', 'processing');

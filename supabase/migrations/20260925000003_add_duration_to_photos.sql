-- Migration: Add duration column to photos table
-- Stores the video duration in seconds (numeric), populated during chunk complete or by Modal transcoder

ALTER TABLE public.photos
    ADD COLUMN IF NOT EXISTS duration NUMERIC NULL;

COMMENT ON COLUMN public.photos.duration IS 'Length of the video in seconds, populated after metadata probe or transcode';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

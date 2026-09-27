-- Migration: Add event_created_at to deleted_events_archive
-- Allows computing exact Byte-Hours for galleries that were uploaded and deleted within short timeframes (e.g. same day)

ALTER TABLE public.deleted_events_archive
    ADD COLUMN IF NOT EXISTS event_created_at TIMESTAMP WITH TIME ZONE;

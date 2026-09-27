-- Migration: Attribute Gallery Compute Expenses to Event Host
-- Ensures all historical and future compute costs (AI face detection, thumbnails, video transcoding)
-- for photos/videos in an event gallery are attributed to the host/event creator (events.created_by)
-- rather than the guest uploader who added media to that host's event.

-- 1. Backfill all modal_cost_logs that have an event_id to the event's created_by user
UPDATE public.modal_cost_logs m
SET user_id = e.created_by
FROM public.events e
WHERE m.event_id = e.id
  AND e.created_by IS NOT NULL
  AND (m.user_id IS NULL OR m.user_id != e.created_by);

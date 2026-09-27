-- Migration: Add user_id to modal_cost_logs and create deleted_events_archive table
-- Ensures historical compute costs (Modal.com AI face detection & video transcoding)
-- are permanently retained and auditable even when media or galleries are deleted.

-- 1. Add user_id to modal_cost_logs
ALTER TABLE public.modal_cost_logs 
    ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_modal_cost_logs_user_id ON public.modal_cost_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_modal_cost_logs_event_id ON public.modal_cost_logs(event_id);

-- 2. Backfill existing modal_cost_logs with user_id where possible
UPDATE public.modal_cost_logs m
SET user_id = e.created_by
FROM public.events e
WHERE m.event_id = e.id AND (m.user_id IS NULL OR m.user_id = '');

UPDATE public.modal_cost_logs m
SET user_id = p.user_id
FROM public.photos p
WHERE m.photo_id = p.id AND (m.user_id IS NULL OR m.user_id = '');

-- 3. Create deleted_events_archive table
CREATE TABLE IF NOT EXISTS public.deleted_events_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_title TEXT NOT NULL,
    photos_count INTEGER NOT NULL DEFAULT 0,
    videos_count INTEGER NOT NULL DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    estimated_modal_cost_inr DOUBLE PRECISION NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_deleted_events_user_id ON public.deleted_events_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_events_event_id ON public.deleted_events_archive(event_id);

-- Enable RLS
ALTER TABLE public.deleted_events_archive ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated and service role
CREATE POLICY "Allow authenticated and service role read" ON public.deleted_events_archive
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON public.deleted_events_archive
    FOR ALL USING (true) WITH CHECK (true);

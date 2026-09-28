-- Migration: Mobile Upload Intents and Consolidated Event Notifications Outbox

-- 1. Create upload_intents table (event_id matches events.id type: TEXT)
CREATE TABLE IF NOT EXISTS public.upload_intents (
    client_upload_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    declared_size BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_intents_event_user 
    ON public.upload_intents(event_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_upload_intents_created_at
    ON public.upload_intents(created_at) WHERE status = 'pending';

-- 2. Consolidated Event Notifications Outbox (for debouncing push notifications)
CREATE TABLE IF NOT EXISTS public.event_notifications_outbox (
    event_id TEXT PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    uploader_user_id TEXT NOT NULL,
    unsent_count INT NOT NULL DEFAULT 1,
    first_unsent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_unsent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ
);

-- 3. RLS & Permissions
ALTER TABLE public.upload_intents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.upload_intents TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.upload_intents TO authenticated;

ALTER TABLE public.event_notifications_outbox ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.event_notifications_outbox TO service_role;

-- 4. Helper RPC: cleanup stale pending intents older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_stale_upload_intents()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.upload_intents
    WHERE status = 'pending' AND created_at < now() - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

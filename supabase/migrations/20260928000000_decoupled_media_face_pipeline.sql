-- Migration: Decoupled 2-Stage Media & AI Face Pipeline
-- 1. Extend photos table with decoupled state machine, lease tokens, and asset versioning
-- 2. Create processing_outbox table for transactional job durability
-- 3. Atomic RPCs for claiming, completing, and replacing photo media and face data

-- 1. Extend photos table
ALTER TABLE public.photos
    ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS face_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS media_attempt INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS media_processing_token TEXT,
    ADD COLUMN IF NOT EXISTS media_lease_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS face_attempt INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS face_processing_token TEXT,
    ADD COLUMN IF NOT EXISTS face_lease_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS face_processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS asset_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Add check constraints if not existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_photos_media_status') THEN
        ALTER TABLE public.photos ADD CONSTRAINT chk_photos_media_status 
            CHECK (media_status IN ('pending', 'processing', 'ready', 'failed'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_photos_face_status') THEN
        ALTER TABLE public.photos ADD CONSTRAINT chk_photos_face_status 
            CHECK (face_status IN ('pending', 'indexing', 'indexed', 'failed'));
    END IF;
END $$;

-- Backfill existing rows so historical photos are marked ready / indexed
UPDATE public.photos
SET 
    media_status = CASE 
        WHEN status = 'failed' THEN 'failed'
        WHEN thumbnail_url IS NOT NULL OR preview_url IS NOT NULL OR status = 'processed' THEN 'ready'
        ELSE 'pending'
    END,
    face_status = CASE 
        WHEN face_indexed = TRUE THEN 'indexed'
        ELSE 'pending'
    END
WHERE media_status = 'pending' AND (thumbnail_url IS NOT NULL OR face_indexed = TRUE);

-- 2. Create processing_outbox table
CREATE TABLE IF NOT EXISTS public.processing_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id TEXT NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('media_preview', 'face_index')),
    asset_version INT NOT NULL DEFAULT 1 CHECK (asset_version >= 1),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    lease_until TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    qstash_message_id TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_outbox_photo_job_version UNIQUE (photo_id, job_type, asset_version)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_outbox_status_created 
    ON public.processing_outbox(status, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_publishing_lease 
    ON public.processing_outbox(status, lease_until) 
    WHERE status = 'publishing';

CREATE INDEX IF NOT EXISTS idx_photos_media_lease 
    ON public.photos(media_status, media_lease_until, media_attempt);

CREATE INDEX IF NOT EXISTS idx_photos_face_lease 
    ON public.photos(face_status, face_lease_until, face_attempt);

-- Enable RLS on outbox
ALTER TABLE public.processing_outbox ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.processing_outbox TO service_role;
GRANT SELECT ON public.processing_outbox TO authenticated;

-- 3. RPC: create_photo_with_media_job
CREATE OR REPLACE FUNCTION public.create_photo_with_media_job(
    p_photo JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_photo_id TEXT;
    v_asset_version INT := 1;
BEGIN
    v_photo_id := p_photo->>'id';
    IF v_photo_id IS NULL OR v_photo_id = '' THEN
        RAISE EXCEPTION 'photo id is required';
    END IF;

    -- Insert photo row (or update if already exists)
    INSERT INTO public.photos (
        id, event_id, storage_key, url, height, width, uploaded_at, tags,
        user_id, size, duration, format, media_type, resource_type,
        status, media_status, face_status, asset_version
    ) VALUES (
        v_photo_id,
        p_photo->>'event_id',
        p_photo->>'storage_key',
        p_photo->>'url',
        (p_photo->>'height')::INT,
        (p_photo->>'width')::INT,
        COALESCE((p_photo->>'uploaded_at')::TIMESTAMPTZ, now()),
        COALESCE((SELECT array_agg(x.val::TEXT) FROM jsonb_array_elements_text(p_photo->'tags') AS x(val)), '{}'::TEXT[]),
        p_photo->>'user_id',
        COALESCE((p_photo->>'size')::BIGINT, 0),
        (p_photo->>'duration')::DOUBLE PRECISION,
        COALESCE(p_photo->>'format', 'jpg'),
        COALESCE(p_photo->>'media_type', 'photo'),
        COALESCE(p_photo->>'resource_type', 'image'),
        'processing',
        'pending',
        'pending',
        v_asset_version
    )
    ON CONFLICT (id) DO UPDATE SET
        asset_version = public.photos.asset_version + 1,
        media_status = 'pending',
        face_status = 'pending',
        media_attempt = 0,
        face_attempt = 0,
        media_processing_token = NULL,
        face_processing_token = NULL,
        media_lease_until = NULL,
        face_lease_until = NULL
    RETURNING asset_version INTO v_asset_version;

    -- Insert outbox row for media_preview
    INSERT INTO public.processing_outbox (
        photo_id, job_type, asset_version, status
    ) VALUES (
        v_photo_id, 'media_preview', v_asset_version, 'pending'
    )
    ON CONFLICT (photo_id, job_type, asset_version) DO UPDATE SET
        status = 'pending',
        attempts = 0,
        lease_until = NULL,
        last_error = NULL,
        updated_at = now();

    RETURN jsonb_build_object('photo_id', v_photo_id, 'asset_version', v_asset_version);
END;
$$;

-- 4. RPC: claim_media_job
CREATE OR REPLACE FUNCTION public.claim_media_job(
    p_photo_id TEXT,
    p_token TEXT,
    p_asset_version INT,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE public.photos
    SET 
        media_status = 'processing',
        media_attempt = media_attempt + 1,
        media_processing_token = p_token,
        media_lease_until = now() + (p_lease_duration_seconds || ' seconds')::INTERVAL
    WHERE id = p_photo_id
      AND asset_version = p_asset_version
      AND media_attempt < 3
      AND (
          media_status IN ('pending', 'failed')
          OR (media_status = 'processing' AND (media_lease_until IS NULL OR media_lease_until < now()))
      );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- 5. RPC: complete_media_job
CREATE OR REPLACE FUNCTION public.complete_media_job(
    p_photo_id TEXT,
    p_token TEXT,
    p_asset_version INT,
    p_thumbnail_url TEXT,
    p_preview_url TEXT,
    p_width INT,
    p_height INT,
    p_overhead_size BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_photo_exists INT;
BEGIN
    -- Verify token and lock row
    SELECT 1 INTO v_photo_exists
    FROM public.photos
    WHERE id = p_photo_id
      AND media_processing_token = p_token
      AND asset_version = p_asset_version
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Update photos row
    UPDATE public.photos
    SET
        media_status = 'ready',
        status = 'processed',
        thumbnail_url = p_thumbnail_url,
        preview_url = p_preview_url,
        width = COALESCE(p_width, width),
        height = COALESCE(p_height, height),
        overhead_size = p_overhead_size,
        media_processing_token = NULL,
        media_lease_until = NULL
    WHERE id = p_photo_id;

    -- Enqueue face_index into outbox
    INSERT INTO public.processing_outbox (
        photo_id, job_type, asset_version, status
    ) VALUES (
        p_photo_id, 'face_index', p_asset_version, 'pending'
    )
    ON CONFLICT (photo_id, job_type, asset_version) DO NOTHING;

    -- Mark media_preview outbox entry as published
    UPDATE public.processing_outbox
    SET status = 'published', published_at = now(), updated_at = now()
    WHERE photo_id = p_photo_id
      AND job_type = 'media_preview'
      AND asset_version = p_asset_version;

    RETURN TRUE;
END;
$$;

-- 6. RPC: claim_face_job
CREATE OR REPLACE FUNCTION public.claim_face_job(
    p_photo_id TEXT,
    p_token TEXT,
    p_asset_version INT,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE public.photos
    SET 
        face_status = 'indexing',
        face_attempt = face_attempt + 1,
        face_processing_token = p_token,
        face_lease_until = now() + (p_lease_duration_seconds || ' seconds')::INTERVAL,
        face_processing_started_at = now()
    WHERE id = p_photo_id
      AND asset_version = p_asset_version
      AND face_attempt < 3
      AND (
          face_status IN ('pending', 'failed')
          OR (face_status = 'indexing' AND (face_lease_until IS NULL OR face_lease_until < now()))
      );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- 7. RPC: replace_photo_faces
CREATE OR REPLACE FUNCTION public.replace_photo_faces(
    p_photo_id TEXT,
    p_token TEXT,
    p_asset_version INT,
    p_faces JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_photo_exists INT;
BEGIN
    -- Lock row and verify token & asset_version
    SELECT 1 INTO v_photo_exists
    FROM public.photos
    WHERE id = p_photo_id
      AND face_processing_token = p_token
      AND asset_version = p_asset_version
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Delete old faces for this image
    DELETE FROM public.faces WHERE image_id = p_photo_id;

    -- Insert new faces if any
    IF p_faces IS NOT NULL AND jsonb_array_length(p_faces) > 0 THEN
        INSERT INTO public.faces (
            event_id, image_id, image_url, width, height, descriptor
        )
        SELECT
            f->>'event_id',
            p_photo_id,
            f->>'image_url',
            COALESCE((f->>'width')::INT, 0),
            COALESCE((f->>'height')::INT, 0),
            ARRAY(SELECT jsonb_array_elements_text(f->'descriptor')::DOUBLE PRECISION)
        FROM jsonb_array_elements(p_faces) AS f;
    END IF;

    -- Update photos
    UPDATE public.photos
    SET 
        face_status = 'indexed',
        face_indexed = TRUE,
        face_processing_token = NULL,
        face_lease_until = NULL
    WHERE id = p_photo_id;

    -- Mark face_index outbox row as published
    UPDATE public.processing_outbox
    SET status = 'published', published_at = now(), updated_at = now()
    WHERE photo_id = p_photo_id
      AND job_type = 'face_index'
      AND asset_version = p_asset_version;

    RETURN TRUE;
END;
$$;

-- 8. RPC: claim_outbox_batch
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(
    p_batch_size INT DEFAULT 50,
    p_lease_seconds INT DEFAULT 30
)
RETURNS SETOF public.processing_outbox
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH available AS (
        SELECT id
        FROM public.processing_outbox
        WHERE status = 'pending'
           OR (status = 'publishing' AND lease_until < now())
        ORDER BY created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.processing_outbox o
    SET 
        status = 'publishing',
        attempts = o.attempts + 1,
        lease_until = now() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = now()
    FROM available a
    WHERE o.id = a.id
    RETURNING o.*;
END;
$$;

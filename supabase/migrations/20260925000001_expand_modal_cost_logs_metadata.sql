-- Migration: Expand modal_cost_logs with media metadata and worker specifications
-- Allows detailed audit of user attribution, media sizes, video durations, and worker fleet profiles.

-- 1. Add metadata columns to modal_cost_logs
ALTER TABLE public.modal_cost_logs
    ADD COLUMN IF NOT EXISTS media_type TEXT,
    ADD COLUMN IF NOT EXISTS media_size BIGINT,
    ADD COLUMN IF NOT EXISTS video_duration_seconds DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS worker_type TEXT;

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_modal_cost_logs_user_created ON public.modal_cost_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modal_cost_logs_media_type ON public.modal_cost_logs(media_type);
CREATE INDEX IF NOT EXISTS idx_modal_cost_logs_function_name ON public.modal_cost_logs(function_name);

-- 3. Backfill media metadata from photos table
UPDATE public.modal_cost_logs m
SET 
    user_id = COALESCE(m.user_id, p.user_id),
    media_size = COALESCE(m.media_size, p.size),
    video_duration_seconds = COALESCE(m.video_duration_seconds, p.duration),
    media_type = COALESCE(
        m.media_type, 
        CASE 
            WHEN m.function_name LIKE '%video%' OR p.media_type = 'video' OR p.resource_type = 'video' THEN 'video'
            WHEN m.function_name = 'find_matching_photos' THEN 'selfie'
            WHEN m.function_name = 'process_media_batch' THEN 'batch'
            ELSE 'photo'
        END
    ),
    worker_type = COALESCE(
        m.worker_type,
        CASE
            WHEN m.function_name = 'process_video_gpu' OR m.gpu_type = 'l4' THEN 'Modal GPU Worker (NVIDIA L4 • 4 vCPU • 8GB RAM)'
            WHEN m.function_name = 'process_video_cpu' THEN 'Modal CPU Worker (4 vCPU • 4GB RAM)'
            WHEN m.function_name = 'find_matching_photos' THEN 'Modal Selfie Worker (0.125 vCPU • 1GB RAM)'
            WHEN m.function_name = 'process_media_batch' THEN 'Modal Batch Dispatcher (0.125 vCPU • 1GB RAM)'
            ELSE 'Modal Photo Worker (1 vCPU • 1GB RAM)'
        END
    )
FROM public.photos p
WHERE m.photo_id = p.id;

-- 4. Backfill user_id from events table if still missing
UPDATE public.modal_cost_logs m
SET user_id = e.created_by
FROM public.events e
WHERE m.event_id = e.id AND (m.user_id IS NULL OR m.user_id = '');

-- 5. Backfill worker_type and media_type for any remaining rows without photo_id match
UPDATE public.modal_cost_logs
SET 
    media_type = COALESCE(
        media_type,
        CASE 
            WHEN function_name LIKE '%video%' THEN 'video'
            WHEN function_name = 'find_matching_photos' THEN 'selfie'
            WHEN function_name = 'process_media_batch' THEN 'batch'
            ELSE 'photo'
        END
    ),
    worker_type = COALESCE(
        worker_type,
        CASE
            WHEN function_name = 'process_video_gpu' OR gpu_type = 'l4' THEN 'Modal GPU Worker (NVIDIA L4 • 4 vCPU • 8GB RAM)'
            WHEN function_name = 'process_video_cpu' THEN 'Modal CPU Worker (4 vCPU • 4GB RAM)'
            WHEN function_name = 'find_matching_photos' THEN 'Modal Selfie Worker (0.125 vCPU • 1GB RAM)'
            WHEN function_name = 'process_media_batch' THEN 'Modal Batch Dispatcher (0.125 vCPU • 1GB RAM)'
            ELSE 'Modal Photo Worker (1 vCPU • 1GB RAM)'
        END
    )
WHERE worker_type IS NULL OR media_type IS NULL;

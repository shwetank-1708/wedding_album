import { getSupabaseAdminClient } from "../supabase.js";
import { cancelLargeFile, getCachedBackblazeAuth } from "../backblaze.js";
import { publishManifestAssemblyTask } from "../qstash.js";

export interface WatchdogReport {
  timestamp: string;
  recoveredVideos: Array<{ id: string; storageKey: string; attempt: number }>;
  failedVideos: Array<{ id: string; storageKey: string; reason: string }>;
  cleanedAbandonedSessions: Array<{ id: string; fileId: string }>;
  errors: string[];
}

/**
 * Self-Healing Media Watchdog
 * 1. Finds videos stuck in 'processing' > 15 minutes and re-triggers transcoding.
 * 2. Marks videos as 'failed' if they exceed 3 recovery attempts.
 * 3. Aborts Backblaze B2 multipart sessions stuck in 'uploading' > 24 hours.
 */
export async function runMediaWatchdog(): Promise<WatchdogReport> {
  const supabase = getSupabaseAdminClient();
  const report: WatchdogReport = {
    timestamp: new Date().toISOString(),
    recoveredVideos: [],
    failedVideos: [],
    cleanedAbandonedSessions: [],
    errors: [],
  };

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Recover Stuck 'processing' Videos ──────────────────────────────────
  try {
    const { data: stuckVideos, error: queryError } = await supabase
      .from("photos")
      .select("id, storage_key, event_id, transcode_attempts, uploaded_at, user_id, size, duration")
      .eq("resource_type", "video")
      .eq("status", "processing")
      .lt("uploaded_at", fifteenMinutesAgo)
      .gt("uploaded_at", sixHoursAgo)
      .order("uploaded_at", { ascending: true })
      .limit(20);

    if (queryError) {
      report.errors.push(`Failed to query stuck videos: ${queryError.message}`);
    } else if (stuckVideos && stuckVideos.length > 0) {
      console.log(`[Watchdog] Found ${stuckVideos.length} video(s) stuck in 'processing'`);

      for (const video of stuckVideos) {
        const attempts = Number(video.transcode_attempts || 0);

        if (attempts >= 3) {
          // Exceeded retry budget — mark failed so it stops retrying indefinitely
          const failureReason = "Transcoding timed out after 3 automated recovery attempts.";
          await supabase
            .from("photos")
            .update({
              status: "failed",
              processing_error: failureReason,
            })
            .eq("id", video.id);

          report.failedVideos.push({
            id: video.id,
            storageKey: video.storage_key,
            reason: failureReason,
          });
          console.warn(`[Watchdog] Video ${video.id} marked as 'failed' (attempts exceeded)`);
        } else {
          // Re-enqueue transcode job with QStash
          const nextAttempt = attempts + 1;
          await supabase
            .from("photos")
            .update({ transcode_attempts: nextAttempt })
            .eq("id", video.id);

          await publishManifestAssemblyTask({
            id: video.id,
            photo_id: video.id,
            storage_key: video.storage_key,
            event_id: video.event_id,
            user_id: video.user_id,
            duration: Number(video.duration || 0),
            fileSize: Number(video.size || 0),
          }).catch((err: any) => {
            console.error(`[Watchdog] Failed to publish transcode task for ${video.id}:`, err);
            report.errors.push(`QStash publish failed for ${video.id}: ${err?.message || err}`);
          });

          report.recoveredVideos.push({
            id: video.id,
            storageKey: video.storage_key,
            attempt: nextAttempt,
          });
          console.log(`[Watchdog] Re-enqueued transcode for ${video.id} (attempt #${nextAttempt})`);
        }
      }
    }
  } catch (err: any) {
    report.errors.push(`Stuck videos recovery failed: ${err?.message || err}`);
  }

  // ── 2. Clean Up Abandoned 'uploading' Sessions > 24 Hours ─────────────────
  try {
    const { data: abandonedSessions, error: sessionQueryError } = await supabase
      .from("photos")
      .select("id, b2_file_id, storage_key")
      .eq("status", "uploading")
      .not("b2_file_id", "is", null)
      .lt("uploaded_at", twentyFourHoursAgo)
      .limit(20);

    if (sessionQueryError) {
      report.errors.push(`Failed to query abandoned sessions: ${sessionQueryError.message}`);
    } else if (abandonedSessions && abandonedSessions.length > 0) {
      console.log(`[Watchdog] Cleaning up ${abandonedSessions.length} abandoned B2 upload session(s)`);
      const auth = await getCachedBackblazeAuth();

      for (const session of abandonedSessions) {
        if (session.b2_file_id) {
          await cancelLargeFile(auth, session.b2_file_id).catch(() => {});
        }
        await supabase.from("photos").delete().eq("id", session.id);

        report.cleanedAbandonedSessions.push({
          id: session.id,
          fileId: session.b2_file_id || "none",
        });
        console.log(`[Watchdog] Aborted B2 session & removed row for: ${session.id}`);
      }
    }
  } catch (err: any) {
    report.errors.push(`Abandoned session cleanup failed: ${err?.message || err}`);
  }

  return report;
}

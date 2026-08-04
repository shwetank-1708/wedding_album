"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Film, AlertCircle } from "lucide-react";

interface HLSVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  style?: React.CSSProperties;
}

/**
 * Determines if a URL is an HLS manifest (.m3u8) or a raw video file.
 */
function isHLSUrl(url: string) {
  return url.includes(".m3u8");
}

/**
 * Determines if a URL is still the raw unprocessed video (not yet transcoded by Modal).
 * Raw videos are stored under /events/.../videos/ while HLS is stored under /hls/...
 */
function isRawVideoUrl(url: string) {
  // Raw video URL: not under hls/ prefix
  return !url.includes("/hls/") && !url.includes(".m3u8");
}

type PlayerState = "loading" | "processing" | "playing" | "error";

export function HLSVideoPlayer({
  src,
  poster,
  className = "",
  autoPlay = false,
  controls = true,
  playsInline = true,
  muted = false,
  style,
}: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Destroy any previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Raw unprocessed file: show "processing" state
    if (isRawVideoUrl(src)) {
      setState("processing");
      return;
    }

    // HLS URL (.m3u8)
    if (isHLSUrl(src)) {
      // Safari natively supports HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.load();
        setState("playing");
        return;
      }

      // Chrome/Firefox/Android — use HLS.js
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          // Absolute fallback: try native anyway (will likely fail on non-Safari)
          video.src = src;
          video.load();
          setState("playing");
          return;
        }

        const hls = new Hls({
          // Start from lowest quality to begin playback fast, then auto-upgrade
          startLevel: -1,
          // Buffer 10s ahead
          maxBufferLength: 10,
          // Cap initial buffer to 2s so playback starts immediately
          maxMaxBufferLength: 30,
        });

        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState("playing");
          if (autoPlay) {
            video.play().catch(() => {
              // Autoplay blocked by browser policy — fine, user can click play
            });
          }
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            setErrorMsg("Failed to load video stream.");
            setState("error");
          }
        });
      });
      return;
    }

    // Fallback: direct MP4/MOV (small videos <100MB that weren't chunked)
    video.src = src;
    video.load();
    setState("playing");

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  // Processing state — Modal worker is still transcoding
  if (state === "processing") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 bg-slate-950 text-white ${className}`}
        style={style}
      >
        {poster && (
          <img
            src={poster}
            alt="Video thumbnail"
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
          />
        )}
        <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <Film className="h-7 w-7 text-white/70" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing video…
          </div>
          <p className="text-xs text-white/50 max-w-[220px] leading-relaxed">
            Your video is being transcoded for smooth playback. Check back in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 bg-slate-950 text-white ${className}`}
        style={style}
      >
        <AlertCircle className="h-8 w-8 text-rose-400" />
        <p className="text-sm text-white/70">{errorMsg || "Failed to load video."}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Loading spinner — shown until manifest parsed */}
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      )}
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-contain"
        controls={controls}
        playsInline={playsInline}
        muted={muted}
        autoPlay={autoPlay}
        preload="metadata"
        onCanPlay={() => setState("playing")}
        onError={() => {
          setState("error");
          setErrorMsg("Failed to load video.");
        }}
      />
    </div>
  );
}

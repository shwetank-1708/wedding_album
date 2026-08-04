"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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

/** True if the URL is an HLS manifest */
function isHLSUrl(url: string) {
  return url.includes(".m3u8");
}

/** True if the URL is still the raw unprocessed video (not yet under /hls/) */
function isRawVideoUrl(url: string) {
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
  const [activeSrc, setActiveSrc] = useState(src);
  const [errorMsg, setErrorMsg] = useState("");

  // When parent passes a new src (e.g. via Realtime subscription updating the photo URL),
  // pick it up so we can transition from "processing" → playing once HLS is ready
  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  const startPlayback = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHLSUrl(url)) {
      // Safari natively supports HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.load();
        setState("playing");
        if (autoPlay) video.play().catch(() => {});
        return;
      }

      // Chrome / Firefox / Android — use HLS.js
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          video.src = url;
          video.load();
          setState("playing");
          return;
        }

        const hls = new Hls({
          startLevel: -1,       // begin at lowest rendition, auto-upgrade
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState("playing");
          if (autoPlay) video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            setState("error");
            setErrorMsg("Failed to load video stream.");
          }
        });
      });
      return;
    }

    // Direct MP4/MOV fallback (small videos that bypass the chunked path)
    video.src = url;
    video.load();
    setState("playing");
    if (autoPlay) video.play().catch(() => {});
  }, [autoPlay]);

  useEffect(() => {
    if (!activeSrc) return;

    if (isRawVideoUrl(activeSrc)) {
      // Show "Processing" — wait for the parent to pass an updated HLS src
      setState("processing");
      return;
    }

    // HLS or direct MP4 — start playback
    startPlayback(activeSrc);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeSrc, startPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  if (state === "processing") {
    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-3 bg-slate-950 text-white overflow-hidden ${className}`}
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
            Your video is being transcoded for smooth playback. It will start automatically once ready — no need to refresh.
          </p>
        </div>
      </div>
    );
  }

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

"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef } from "react";
import { Loader2, Film, AlertCircle, Settings, Check } from "lucide-react";

interface HLSVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  style?: React.CSSProperties;
  onLoadedMetadata?: () => void;
  onError?: () => void;
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

export const HLSVideoPlayer = forwardRef<HTMLVideoElement, HLSVideoPlayerProps>((
  {
    src,
    poster,
    className = "",
    autoPlay = false,
    controls = true,
    playsInline = true,
    muted = false,
    style,
    onLoadedMetadata,
    onError,
  },
  ref
) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [activeSrc, setActiveSrc] = useState(src);
  const [errorMsg, setErrorMsg] = useState("");

  // Quality selector states
  const [levels, setLevels] = useState<any[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1); // -1 is Auto
  const [activeLevel, setActiveLevel] = useState<number>(-1);
  const [menuOpen, setMenuOpen] = useState(false);

  // Combine forwarded ref and local ref
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLVideoElement | null>).current = node;
    }
  }, [ref]);

  // When parent passes a new src (e.g. via Realtime subscription updating the photo URL),
  // pick it up so we can transition from "processing" → playing once HLS is ready
  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  const startPlayback = useCallback((url: string) => {
    const video = localVideoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
      setLevels([]);
      setSelectedLevel(-1);
      setActiveLevel(-1);
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
          setLevels(hls.levels || []);
          setSelectedLevel(hls.loadLevel);
          if (autoPlay) video.play().catch(() => {});
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
          setActiveLevel(data.level);
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

  const changeQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setSelectedLevel(levelIndex);
      setMenuOpen(false);
    }
  };

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

  // Get current active quality height label
  const getActiveHeightLabel = () => {
    if (selectedLevel === -1) {
      if (activeLevel >= 0 && levels[activeLevel]) {
        return `Auto (${levels[activeLevel].height}p)`;
      }
      return "Auto";
    }
    if (levels[selectedLevel]) {
      return `${levels[selectedLevel].height}p`;
    }
    return "Auto";
  };

  return (
    <div className={`relative group/player ${className}`} style={style}>
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      )}
      
      <video
        ref={setVideoRef}
        poster={poster}
        className="w-full h-full object-contain"
        controls={controls}
        playsInline={playsInline}
        muted={muted}
        preload="metadata"
        onCanPlay={() => {
          setState("playing");
          onLoadedMetadata?.();
        }}
        onLoadedMetadata={onLoadedMetadata}
        onError={() => {
          setState("error");
          setErrorMsg("Failed to load video.");
          onError?.();
        }}
      />

      {/* Floating Quality Selector button (Only shown when HLS.js levels are loaded and player is playing) */}
      {levels.length > 0 && (
        <div className="absolute top-4 right-4 z-20 pointer-events-auto opacity-0 group-hover/player:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white border border-white/20 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all cursor-pointer active:scale-95 animate-fadeIn"
          >
            <Settings className={`w-3.5 h-3.5 ${menuOpen ? "rotate-45" : ""} transition-transform duration-300`} />
            <span>{getActiveHeightLabel()}</span>
          </button>

          {/* Click Backdrop to close dropdown */}
          {menuOpen && (
            <div className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
          )}

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 bg-zinc-950/90 border border-white/10 rounded-xl py-1.5 w-32 flex flex-col shadow-2xl backdrop-blur-md z-20 origin-top-right">
              <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider border-b border-white/5 pb-1 mb-1">Quality</div>
              
              {/* Auto Selection */}
              <button
                onClick={() => changeQuality(-1)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors text-white font-medium flex items-center justify-between cursor-pointer"
              >
                <span>Auto</span>
                {selectedLevel === -1 && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </button>

              {/* Individual rendition levels (Sorted highest height first) */}
              {[...levels]
                .map((level, originalIndex) => ({ level, originalIndex }))
                .sort((a, b) => b.level.height - a.level.height)
                .map(({ level, originalIndex }) => (
                  <button
                    key={originalIndex}
                    onClick={() => changeQuality(originalIndex)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors text-white font-medium flex items-center justify-between cursor-pointer"
                  >
                    <span>{level.height}p</span>
                    {selectedLevel === originalIndex && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

HLSVideoPlayer.displayName = "HLSVideoPlayer";

"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef } from "react";
import {
  Loader2,
  Film,
  AlertCircle,
  Settings,
  Check,
  Gauge,
  PictureInPicture,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import type Hls from "hls.js";
import type { Level } from "hls.js";
import { supabase } from "@/lib/supabase";

interface HLSVideoPlayerProps {
  src: string;
  rawSrc?: string;
  mediaId?: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  style?: React.CSSProperties;
  onLoadedMetadata?: () => void;
  onError?: () => void;
  onPreviousMedia?: () => void;
  onNextMedia?: () => void;
  onToggleFullscreen?: () => void | Promise<void>;
}

/** Derive raw MP4 URL if activeSrc is an HLS URL */
function deriveRawFallbackUrl(hlsUrl: string): string {
  // If URL is https://media.evebash.com/events/.../video.mp4/hls/master.m3u8
  // The raw URL is https://media.evebash.com/events/.../video.mp4
  if (hlsUrl.includes('/hls/master.m3u8')) {
    return hlsUrl.replace(/\/hls\/master\.m3u8.*$/, '');
  }
  return hlsUrl;
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

type PictureInPictureDocument = Document & {
  pictureInPictureElement?: Element | null;
  pictureInPictureEnabled?: boolean;
  exitPictureInPicture?: () => Promise<void>;
};

type PictureInPictureVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
};

const PLAYBACK_SPEEDS = [
  { label: "0.5x", value: 0.5 },
  { label: "0.75x", value: 0.75 },
  { label: "Normal (1x)", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
];

const VIDEO_CONTROL_ACCENT = "#CA9C68";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export const HLSVideoPlayer = forwardRef<HTMLVideoElement, HLSVideoPlayerProps>((
  {
    src,
    rawSrc,
    mediaId,
    poster,
    className = "",
    autoPlay = false,
    controls = true,
    playsInline = true,
    muted = false,
    style,
    onLoadedMetadata,
    onError,
    onPreviousMedia,
    onNextMedia,
    onToggleFullscreen,
  },
  ref
) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  const controlsHideTimerRef = useRef<number | null>(null);
  const surfaceClickTimerRef = useRef<number | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [activeSrc, setActiveSrc] = useState(src);
  const lastSourcePropRef = useRef({ src, mediaId });
  const [errorMsg, setErrorMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(muted ? 0 : 1);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // Seamless transition & resilience state
  const savedPlaybackTimeRef = useRef<number>(0);
  const wasPlayingBeforeSwitchRef = useRef<boolean>(false);
  const [isOptimizingInBackground, setIsOptimizingInBackground] = useState<boolean>(false);
  const [hasAttemptedHlsFallback, setHasAttemptedHlsFallback] = useState<boolean>(false);

  // Quality selector states
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1); // -1 is Auto
  const [activeLevel, setActiveLevel] = useState<number>(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<"main" | "speed" | "quality">("main");
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);

  // Combine forwarded ref and local ref
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLVideoElement | null>).current = node;
    }
  }, [ref]);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const clearSurfaceClickTimer = useCallback(() => {
    if (surfaceClickTimerRef.current !== null) {
      window.clearTimeout(surfaceClickTimerRef.current);
      surfaceClickTimerRef.current = null;
    }
  }, []);

  const revealControls = useCallback(() => {
    if (!controls) return;

    setControlsVisible(true);
    clearControlsHideTimer();

    if (isPlaying && !menuOpen) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2600);
    }
  }, [clearControlsHideTimer, controls, isPlaying, menuOpen]);

  const closeSettingsMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuTab("main");
  }, []);

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (localVideoRef.current) {
      localVideoRef.current.playbackRate = speed;
    }
    setMenuTab("main");
  };

  const handleTogglePip = async () => {
    if (!localVideoRef.current) return;

    const pipDocument = document as PictureInPictureDocument;
    const video = localVideoRef.current as PictureInPictureVideo;
    if (!pipDocument.pictureInPictureEnabled || !video.requestPictureInPicture) return;

    try {
      if (pipDocument.pictureInPictureElement) {
        await pipDocument.exitPictureInPicture?.();
        setIsPipActive(false);
      } else {
        await video.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch (err) {
      console.warn("[HLSVideoPlayer] Picture in Picture error:", err);
    }
    closeSettingsMenu();
  };

  const syncVideoTime = useCallback(() => {
    const video = localVideoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime || 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
  }, []);

  const handleTogglePlayback = async () => {
    const video = localVideoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    video.pause();
  };

  const handlePreviousMedia = () => {
    closeSettingsMenu();
    onPreviousMedia?.();
  };

  const handleNextMedia = () => {
    closeSettingsMenu();
    onNextMedia?.();
  };

  const handleVideoSurfaceClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!controls) return;
    if (event.detail > 1) return;
    if (menuOpen) {
      closeSettingsMenu();
      return;
    }

    clearSurfaceClickTimer();
    surfaceClickTimerRef.current = window.setTimeout(() => {
      surfaceClickTimerRef.current = null;

      if (!controlsVisible && isPlaying) {
        revealControls();
        return;
      }

      void handleTogglePlayback();
    }, 180);
  };

  const handleVideoSurfaceDoubleClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!controls) return;

    event.preventDefault();
    clearSurfaceClickTimer();
    revealControls();
    void handleToggleFullscreen();
  };

  const handlePointerLeave = () => {
    if (!controls || !isPlaying || menuOpen) return;

    clearControlsHideTimer();
    setControlsVisible(false);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = localVideoRef.current;
    const nextTime = Number(event.target.value);
    setCurrentTime(nextTime);
    if (video) {
      video.currentTime = nextTime;
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = localVideoRef.current;
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);

    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
    }
  };

  const handleToggleMute = () => {
    const video = localVideoRef.current;
    const nextMuted = !isMuted;
    const nextVolume = !nextMuted && volume === 0 ? 0.8 : volume;

    setIsMuted(nextMuted);
    setVolume(nextVolume);

    if (video) {
      video.muted = nextMuted;
      video.volume = nextVolume;
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (onToggleFullscreen) {
        await onToggleFullscreen();
        return;
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await containerRef.current?.requestFullscreen();
    } catch (err) {
      console.warn("[HLSVideoPlayer] Fullscreen error:", err);
    }
  };

  // When parent passes a new src (e.g. via Realtime subscription updating the photo URL),
  // pick it up so we can transition from raw → playing once HLS is ready
  useEffect(() => {
    const previous = lastSourcePropRef.current;
    if (previous.src === src && previous.mediaId === mediaId) return;
    lastSourcePropRef.current = { src, mediaId };
    if (previous.mediaId !== mediaId) {
      savedPlaybackTimeRef.current = 0;
      wasPlayingBeforeSwitchRef.current = false;
      setHasAttemptedHlsFallback(false);
    }
    if (src !== activeSrc) {
      if (previous.mediaId === mediaId && localVideoRef.current) {
        savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
        wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
      }
      setActiveSrc(src);
    }
  }, [src, mediaId, activeSrc]);

  useEffect(() => {
    const video = localVideoRef.current;
    setIsMuted(muted);
    setVolume(muted ? 0 : 1);

    if (video) {
      video.muted = muted;
      video.volume = muted ? 0 : 1;
    }
  }, [muted]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    video.playbackRate = playbackRate;
    video.volume = volume;
    video.muted = isMuted;
  }, [activeSrc, isMuted, playbackRate, volume]);

  useEffect(() => {
    const pipDocument = document as PictureInPictureDocument;
    setPipSupported(Boolean(pipDocument.pictureInPictureEnabled));

    const video = localVideoRef.current;
    if (!video) return;

    const handleEnterPip = () => setIsPipActive(true);
    const handleLeavePip = () => setIsPipActive(false);
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    video.addEventListener("enterpictureinpicture", handleEnterPip);
    video.addEventListener("leavepictureinpicture", handleLeavePip);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPip);
      video.removeEventListener("leavepictureinpicture", handleLeavePip);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!controls) {
      clearControlsHideTimer();
      setControlsVisible(false);
      return;
    }

    if (!isPlaying || menuOpen || state !== "playing") {
      clearControlsHideTimer();
      setControlsVisible(true);
      return;
    }

    revealControls();

    return clearControlsHideTimer;
  }, [clearControlsHideTimer, controls, isPlaying, menuOpen, revealControls, state]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (settingsButtonRef.current?.contains(target) || settingsMenuRef.current?.contains(target)) {
        return;
      }

      closeSettingsMenu();
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [closeSettingsMenu, menuOpen]);

  useEffect(() => {
    return () => {
      clearControlsHideTimer();
      clearSurfaceClickTimer();
    };
  }, [clearControlsHideTimer, clearSurfaceClickTimer]);

  useEffect(() => {
    if (!mediaId || !activeSrc || !isRawVideoUrl(activeSrc) || hasAttemptedHlsFallback) {
      setIsOptimizingInBackground(false);
      return;
    }

    setIsOptimizingInBackground(true);
    let isCancelled = false;

    // 1. Supabase Realtime channel for instant push notification
    const channel = supabase
      .channel(`photo-status-${mediaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photos',
          filter: `id=eq.${mediaId}`,
        },
        (payload: { new?: { status?: string; url?: string } }) => {
          if (isCancelled) return;
          const newStatus = payload.new?.status;
          const newUrl = payload.new?.url;

          if (newStatus === 'processed' && newUrl && isHLSUrl(newUrl)) {
            console.log('[HLSVideoPlayer] Realtime update: Video processed into HLS:', newUrl);
            // Save current playback position before switching
            if (localVideoRef.current) {
              savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
              wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
            }
            setActiveSrc(newUrl);
            setIsOptimizingInBackground(false);
          }
        }
      )
      .subscribe();

    // 2. Periodic poll fallback (in case Realtime socket disconnects or missed event)
    let pollCount = 0;
    const maxPolls = 30; // 5 minutes max (30 * 10s)
    const intervalId = setInterval(async () => {
      if (isCancelled || pollCount >= maxPolls) return;
      pollCount++;

      try {
        const { data, error } = await supabase
          .from('photos')
          .select('url, status')
          .eq('id', mediaId)
          .maybeSingle();

        if (error || !data) return;

        if (data.status === 'processed' && data.url && isHLSUrl(data.url)) {
          if (isCancelled) return;
          if (localVideoRef.current) {
            savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
            wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
          }
          setActiveSrc(data.url);
          setIsOptimizingInBackground(false);
          clearInterval(intervalId);
        }
      } catch (err) {
        console.warn('[HLSVideoPlayer] Polling check error:', err);
      }
    }, 10000);

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [mediaId, activeSrc, hasAttemptedHlsFallback]);

  // Clean up HLS on unmount or src change
  useEffect(() => {
    const video = localVideoRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!activeSrc) {
      setState("error");
      setErrorMsg("No video URL provided.");
      return;
    }

    // Wait for metadata before restoring a fallback's playback position.
    if (!isHLSUrl(activeSrc)) {
      const restorePlayback = () => {
        if (!video) return;
        if (savedPlaybackTimeRef.current > 0) {
          video.currentTime = savedPlaybackTimeRef.current;
          savedPlaybackTimeRef.current = 0;
        }
        if (autoPlay || wasPlayingBeforeSwitchRef.current) {
          video.play().catch(() => {});
          wasPlayingBeforeSwitchRef.current = false;
        }
      };
      if (video) {
        video.addEventListener("loadedmetadata", restorePlayback, { once: true });
        video.src = activeSrc;
      }
      setState("playing");
      setLevels([]);
      return () => video?.removeEventListener("loadedmetadata", restorePlayback);
    }

    // HLS .m3u8 stream playback logic
    setState("loading");

    let cancelled = false;
    const setupHls = async () => {
      const Hls = (await import("hls.js")).default;
      if (cancelled) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        hlsRef.current = hls;
        hls.loadSource(activeSrc);

        if (video) {
          hls.attachMedia(video);
        }

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          setLevels(data.levels || []);
          setState("playing");

          // Restore seamless playback position if switching from raw
          if (video && savedPlaybackTimeRef.current > 0) {
            video.currentTime = savedPlaybackTimeRef.current;
            savedPlaybackTimeRef.current = 0;
          }

          if (video && (autoPlay || wasPlayingBeforeSwitchRef.current)) {
            video.play().catch(() => {});
            wasPlayingBeforeSwitchRef.current = false;
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setActiveLevel(data.level);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Check if this was a 404 on the master playlist or variant
                if (data.response?.code === 404 && !hasAttemptedHlsFallback) {
                  console.warn("[HLSVideoPlayer] HLS manifest 404. Falling back to raw video URL.");
                  setHasAttemptedHlsFallback(true);
                  hls.destroy();
                  const fallback = rawSrc || deriveRawFallbackUrl(activeSrc);
                  if (fallback && fallback !== activeSrc) {
                    if (localVideoRef.current) {
                      savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
                      wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
                    }
                    setActiveSrc(fallback);
                    return;
                  }
                }
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                // Attempt raw fallback before giving up to an error screen
                if (!hasAttemptedHlsFallback) {
                  setHasAttemptedHlsFallback(true);
                  const fallback = rawSrc || deriveRawFallbackUrl(activeSrc);
                  if (fallback && fallback !== activeSrc) {
                    console.warn("[HLSVideoPlayer] Unrecoverable HLS error. Falling back to raw MP4:", fallback);
                    if (localVideoRef.current) {
                      savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
                      wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
                    }
                    setActiveSrc(fallback);
                    return;
                  }
                }
                setState("error");
                setErrorMsg("Video playback error.");
                onErrorRef.current?.();
                break;
            }
          }
        });
      } else if (video && video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari / iOS)
        video.src = activeSrc;
        const handleLoadedMetadata = () => {
          if (savedPlaybackTimeRef.current > 0) {
            video.currentTime = savedPlaybackTimeRef.current;
            savedPlaybackTimeRef.current = 0;
          }
          if (autoPlay || wasPlayingBeforeSwitchRef.current) {
            video.play().catch(() => {});
            wasPlayingBeforeSwitchRef.current = false;
          }
        };
        video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
        setState("playing");
        setLevels([]);
      } else {
        // If HLS is not supported in this browser, try raw fallback
        const fallback = rawSrc || deriveRawFallbackUrl(activeSrc);
        if (fallback && fallback !== activeSrc) {
          console.warn("[HLSVideoPlayer] HLS unsupported in browser. Falling back to raw MP4:", fallback);
          if (localVideoRef.current) {
                      savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
                      wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
                    }
                    setActiveSrc(fallback);
          return;
        }
        setState("error");
        setErrorMsg("HLS playback not supported in this browser.");
      }
    };

    setupHls();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeSrc, autoPlay, rawSrc, hasAttemptedHlsFallback]);

  const changeQuality = (levelIndex: number) => {
    setSelectedLevel(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
    setMenuTab("main");
  };

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

  const seekPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const volumePercent = isMuted ? 0 : Math.min(100, Math.max(0, volume * 100));
  const selectedMenuItemStyle: React.CSSProperties = { color: VIDEO_CONTROL_ACCENT };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-950 flex items-center justify-center ${className} font-sans`}
      style={style}
      onPointerMove={controls ? revealControls : undefined}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={controls ? revealControls : undefined}
    >
      {/* Non-blocking background optimization indicator */}
      {isOptimizingInBackground && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-500/30 px-3 py-1 text-[11px] font-semibold text-amber-300 shadow-lg pointer-events-none transition-opacity duration-300">
          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          <span>Optimizing video quality in background</span>
        </div>
      )}

      {/* State Overlay Screens */}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center z-10">
          <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
          <p className="text-sm font-bold text-white">{errorMsg || "Unable to play video."}</p>
        </div>
      )}

      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      )}
      
      <video
        ref={setVideoRef}
        poster={poster}
        className="w-full h-full object-contain"
        controls={false}
        controlsList="noplaybackrate nodownload noremoteplayback nopictureinpicture"
        playsInline={playsInline}
        muted={isMuted}
        preload="metadata"
        onClick={controls ? handleVideoSurfaceClick : undefined}
        onDoubleClick={controls ? handleVideoSurfaceDoubleClick : undefined}
        onCanPlay={() => {
          setState("playing");
          syncVideoTime();
          onLoadedMetadata?.();
        }}
        onLoadedMetadata={() => {
          syncVideoTime();
          onLoadedMetadata?.();
        }}
        onTimeUpdate={syncVideoTime}
        onDurationChange={syncVideoTime}
        onPlay={() => {
          setIsPlaying(true);
          setControlsVisible(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          setControlsVisible(true);
        }}
        onVolumeChange={() => {
          const video = localVideoRef.current;
          if (!video) return;
          setVolume(video.volume);
          setIsMuted(video.muted || video.volume === 0);
        }}
        onError={() => {
          if (isHLSUrl(activeSrc) && !hasAttemptedHlsFallback) {
            console.warn("[HLSVideoPlayer] Video element error on HLS. Falling back to raw video URL.");
            setHasAttemptedHlsFallback(true);
            const fallback = rawSrc || deriveRawFallbackUrl(activeSrc);
            if (fallback && fallback !== activeSrc) {
              if (localVideoRef.current) {
                      savedPlaybackTimeRef.current = localVideoRef.current.currentTime || 0;
                      wasPlayingBeforeSwitchRef.current = !localVideoRef.current.paused;
                    }
                    setActiveSrc(fallback);
              return;
            }
          }
          setState("error");
          setErrorMsg("Failed to load video.");
          onErrorRef.current?.();
        }}
      />

      <style>{`
        video::-webkit-media-controls-overflow-button,
        video::-webkit-media-controls-overflow-menu-list,
        video::-webkit-media-controls-picture-in-picture-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          visibility: hidden !important;
        }

        .hls-video-range::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 999px;
          background: transparent;
        }

        .hls-video-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          margin-top: -4px;
          border-radius: 999px;
          background: ${VIDEO_CONTROL_ACCENT};
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
        }

        .hls-video-range::-moz-range-track {
          height: 4px;
          border-radius: 999px;
          background: transparent;
        }

        .hls-video-range::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border: 0;
          border-radius: 999px;
          background: ${VIDEO_CONTROL_ACCENT};
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
        }

        .hls-volume-range::-webkit-slider-thumb {
          width: 10px;
          height: 10px;
          margin-top: -3px;
        }

        .hls-volume-range::-moz-range-thumb {
          width: 10px;
          height: 10px;
        }
      `}</style>

      {controls && state === "playing" && (
        <div
          className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black via-black/75 to-transparent px-3 pb-3 pt-12 font-sans text-white transition-all duration-200 sm:px-4 ${
            controlsVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            className="hls-video-range h-1 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, ${VIDEO_CONTROL_ACCENT} ${seekPercent}%, rgba(255,255,255,0.45) ${seekPercent}%)`,
            }}
            aria-label="Seek video"
          />

          <div className="mt-2 flex items-center gap-1 sm:gap-3">
            {onPreviousMedia && (
              <button
                type="button"
                onClick={handlePreviousMedia}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 sm:h-9 sm:w-9"
                title="Previous video"
                aria-label="Previous video"
              >
                <SkipBack className="h-4 w-4 fill-current" />
              </button>
            )}

            <button
              type="button"
              onClick={handleTogglePlayback}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 sm:h-9 sm:w-9"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>

            {onNextMedia && (
              <button
                type="button"
                onClick={handleNextMedia}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 sm:h-9 sm:w-9"
                title="Next video"
                aria-label="Next video"
              >
                <SkipForward className="h-4 w-4 fill-current" />
              </button>
            )}

            <span className="min-w-[74px] text-[11px] font-bold tabular-nums text-white/90 sm:min-w-[92px] sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="group/volume hidden h-9 items-center gap-1 rounded-full bg-black/35 px-1.5 py-1 backdrop-blur sm:flex">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
                  title={isMuted ? "Unmute" : "Mute"}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="hls-video-range hls-volume-range h-1 w-0 cursor-pointer appearance-none rounded-full opacity-0 transition-[width,opacity] duration-150 group-hover/volume:w-20 group-hover/volume:opacity-100 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100"
                  style={{
                    background: `linear-gradient(to right, ${VIDEO_CONTROL_ACCENT} ${volumePercent}%, rgba(255,255,255,0.36) ${volumePercent}%)`,
                  }}
                  aria-label="Volume"
                />
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 sm:hidden"
                title={isMuted ? "Unmute" : "Mute"}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <div className="relative">
                <button
                  ref={settingsButtonRef}
                  type="button"
                  onClick={() => {
                    setMenuOpen((prev) => !prev);
                    setMenuTab("main");
                  }}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold shadow-2xl backdrop-blur-md transition-all active:scale-95 ${
                    menuOpen
                      ? "text-slate-950"
                      : "border-white/20 bg-black/55 text-white hover:bg-black/75"
                  }`}
                  style={menuOpen ? {
                    backgroundColor: VIDEO_CONTROL_ACCENT,
                    borderColor: VIDEO_CONTROL_ACCENT,
                    boxShadow: `0 0 0 2px ${VIDEO_CONTROL_ACCENT}66`,
                  } : undefined}
                  title="Video Settings"
                  aria-label="Video Settings"
                  aria-expanded={menuOpen}
                >
                  <Settings className={`h-4 w-4 ${menuOpen ? "rotate-45" : ""} transition-transform duration-300`} />
                  <span className="hidden sm:inline">{playbackRate !== 1 ? `${playbackRate}x` : getActiveHeightLabel()}</span>
                </button>

                {menuOpen && (
                  <div className="fixed inset-0 z-20 cursor-default" onClick={closeSettingsMenu} />
                )}

                {menuOpen && (
                  <div ref={settingsMenuRef} className="absolute bottom-full right-0 z-50 mb-3 flex w-56 origin-bottom-right flex-col divide-y divide-white/10 rounded-2xl border border-white/15 bg-neutral-950/95 py-2 font-sans text-white shadow-2xl backdrop-blur-xl">
                    {menuTab === "main" && (
                      <>
                        <div className="flex items-center justify-between px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <span>Video Settings</span>
                          <span className="text-[9px] font-bold" style={selectedMenuItemStyle}>Custom</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setMenuTab("speed")}
                          className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                        >
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4" style={selectedMenuItemStyle} />
                            <span>Playback Speed</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400" style={selectedMenuItemStyle}>
                            <span>{playbackRate === 1 ? "Normal" : `${playbackRate}x`}</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </button>

                        {pipSupported && (
                          <button
                            type="button"
                            onClick={handleTogglePip}
                            className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <PictureInPicture className="h-4 w-4" style={isPipActive ? selectedMenuItemStyle : undefined} />
                              <span style={isPipActive ? selectedMenuItemStyle : undefined}>Picture-in-Picture</span>
                            </div>
                            {isPipActive && <Check className="h-3.5 w-3.5" style={selectedMenuItemStyle} />}
                          </button>
                        )}

                        {levels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setMenuTab("quality")}
                            className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <Sliders className="h-4 w-4" style={selectedMenuItemStyle} />
                              <span>Quality</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400" style={selectedMenuItemStyle}>
                              <span>{getActiveHeightLabel()}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </div>
                          </button>
                        )}
                      </>
                    )}

                    {menuTab === "speed" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMenuTab("main")}
                          className="flex w-full cursor-pointer items-center gap-1.5 px-3.5 py-2 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-white/10"
                        >
                          <ChevronLeft className="h-4 w-4" style={selectedMenuItemStyle} />
                          <span>Playback Speed</span>
                        </button>
                        <div className="py-1">
                          {PLAYBACK_SPEEDS.map((s) => (
                            <button
                              type="button"
                              key={s.value}
                              onClick={() => handleSpeedChange(s.value)}
                              className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                              style={playbackRate === s.value ? selectedMenuItemStyle : undefined}
                            >
                              <span>{s.label}</span>
                              {playbackRate === s.value && <Check className="h-3.5 w-3.5" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {menuTab === "quality" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMenuTab("main")}
                          className="flex w-full cursor-pointer items-center gap-1.5 px-3.5 py-2 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-white/10"
                        >
                          <ChevronLeft className="h-4 w-4" style={selectedMenuItemStyle} />
                          <span>Quality</span>
                        </button>
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => changeQuality(-1)}
                            className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                            style={selectedLevel === -1 ? selectedMenuItemStyle : undefined}
                          >
                            <span>Auto</span>
                            {selectedLevel === -1 && <Check className="h-3.5 w-3.5" />}
                          </button>
                          {[...levels]
                            .map((level, originalIndex) => ({ level, originalIndex }))
                            .sort((a, b) => b.level.height - a.level.height)
                            .map(({ level, originalIndex }) => (
                              <button
                                type="button"
                                key={originalIndex}
                                onClick={() => changeQuality(originalIndex)}
                                className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                                style={selectedLevel === originalIndex ? selectedMenuItemStyle : undefined}
                              >
                                <span>{level.height}p</span>
                                {selectedLevel === originalIndex && <Check className="h-3.5 w-3.5" />}
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

HLSVideoPlayer.displayName = "HLSVideoPlayer";

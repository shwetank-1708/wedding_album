import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, Share, TextInput, Keyboard, Modal, ActivityIndicator, StyleSheet, StatusBar as RNStatusBar, useWindowDimensions, type GestureResponderEvent, type NativeSyntheticEvent } from 'react-native';
import { Image as ExpoImage, type ImageLoadEventData } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, createVideoPlayer, type VideoPlayer } from 'expo-video';
import type { FullscreenOptions } from 'expo-video/build/VideoView.types';
import Svg, { Circle, Path } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { onPhotoInteractions, toggleLike, addComment, deletePhotoComment, Event as DatabaseEvent } from '@/lib/database';
import { getImageUrl } from '@/lib/imageUrl';
import { SCREEN_ORIENTATION_LOCK, canLockScreenOrientation, lockScreenOrientation } from '@/lib/screenOrientation';
import { MidnightColors, Fonts } from '../constants/theme';
import { styles } from './eventStyles';

interface PhotoViewerProps {
  visible: boolean;
  onClose: () => void;
  photos: any[];
  initialIndex: number;
  viewerIdentity: { id: string; name: string };
  event: DatabaseEvent | null;
  selectedTemplate: any;
  keepBottomBarVisible?: boolean;
  bottomBarOffset?: number;
  dashboardImageScrollReveal?: boolean;
  isPhotoFavourite?: (photo: any) => boolean;
  onTogglePhotoFavourite?: (photo: any) => Promise<void> | void;
  onRotatePhoto?: (photo: any, direction: 'left' | 'right') => Promise<void> | void;
}

type ViewerPalette = {
  background: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  tileBg: string;
  overlay: string[];
  controlBg: string;
  controlText: string;
  frameBorder: string;
  radius?: number;
};

type LucideIconProps = {
  size?: number;
  color: string;
  fill?: string;
  strokeWidth?: number;
};

type ViewerVideoControls = {
  seekBy: (seconds: number) => void;
};

const VIDEO_VOLUME_SLIDER_WIDTH = 54;
const VIDEO_CONTROLS_HIDE_DELAY_MS = 2500;
const VIDEO_NATIVE_FULLSCREEN_OPTIONS: FullscreenOptions =
  Platform.OS === 'web'
    ? { enable: true }
    : { enable: true, orientation: 'landscape' };
const VIDEO_CUSTOM_FULLSCREEN_OPTIONS: FullscreenOptions = { enable: false };

function formatVideoClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function LucideHeartIcon({ size = 20, color, fill = 'none', strokeWidth = 2 }: LucideIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        fill={fill}
      />
    </Svg>
  );
}

function LucideMessageCircleIcon({ size = 20, color, strokeWidth = 2 }: LucideIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Svg>
  );
}

function LucideShare2Icon({ size = 20, color, strokeWidth = 2 }: LucideIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx="18" cy="5" r="3" />
      <Circle cx="6" cy="12" r="3" />
      <Circle cx="18" cy="19" r="3" />
      <Path d="M8.59 13.51 15.42 17.49" />
      <Path d="M15.41 6.51 8.59 10.49" />
    </Svg>
  );
}

function LucideDownloadIcon({ size = 20, color, strokeWidth = 2 }: LucideIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Path d="M12 15V3" />
    </Svg>
  );
}

const VIEWER_TEMPLATE_PALETTES: Record<string, ViewerPalette> = {
  royal: { background: '#033026', panel: 'rgba(2,35,28,0.94)', text: '#fcfbf7', muted: '#a3b899', accent: '#ca9c69', tileBg: '#02231c', overlay: ['rgba(3,48,38,0.1)', 'rgba(3,48,38,0.78)', '#02231c'], controlBg: 'rgba(2,35,28,0.84)', controlText: '#fcfbf7', frameBorder: 'rgba(202,156,105,0.62)', radius: 18 },
  classic: { background: '#F7F2EB', panel: 'rgba(255,255,255,0.96)', text: '#2C352E', muted: '#6E7B6C', accent: '#8B9A6E', tileBg: '#ffffff', overlay: ['rgba(247,242,235,0.95)', 'rgba(234,226,214,0.92)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#2C352E', frameBorder: 'rgba(139,154,110,0.42)', radius: 2 },
  hero: { background: '#000000', panel: 'rgba(9,9,11,0.94)', text: '#ffffff', muted: '#94a3b8', accent: '#ca9c69', tileBg: '#09090b', overlay: ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.96)'], controlBg: 'rgba(0,0,0,0.56)', controlText: '#ffffff', frameBorder: 'rgba(202,156,105,0.48)', radius: 12 },
  ethereal: { background: '#F8FAFC', panel: 'rgba(238,242,246,0.96)', text: '#1E293B', muted: '#64748B', accent: '#4A6984', tileBg: '#ffffff', overlay: ['rgba(248,250,252,0.9)', 'rgba(226,232,240,0.94)'], controlBg: 'rgba(255,255,255,0.88)', controlText: '#1E293B', frameBorder: 'rgba(74,105,132,0.36)', radius: 2 },
  scrapbook: { background: '#f8f5f0', panel: 'rgba(255,253,249,0.96)', text: '#263331', muted: '#74827d', accent: '#d9826b', tileBg: '#fffdf9', overlay: ['rgba(248,245,240,0.92)', 'rgba(217,130,107,0.14)', '#f8f5f0'], controlBg: 'rgba(255,253,249,0.9)', controlText: '#263331', frameBorder: 'rgba(217,130,107,0.42)', radius: 18 },
  neon: { background: '#070611', panel: 'rgba(18,16,35,0.94)', text: '#f8f7ff', muted: '#b9b1d9', accent: '#ff3df2', tileBg: '#111020', overlay: ['rgba(7,6,17,0.92)', 'rgba(102,232,255,0.16)', 'rgba(255,61,242,0.1)'], controlBg: 'rgba(18,16,35,0.82)', controlText: '#f8f7ff', frameBorder: 'rgba(102,232,255,0.58)', radius: 20 },
  pastel: { background: '#fff7f4', panel: 'rgba(255,253,251,0.96)', text: '#4d4542', muted: '#9a8583', accent: '#c9768b', tileBg: '#fffdfb', overlay: ['rgba(255,247,244,0.94)', 'rgba(213,180,220,0.24)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#4d4542', frameBorder: 'rgba(201,118,139,0.36)', radius: 24 },
  pop: { background: '#ffe84a', panel: 'rgba(255,253,243,0.96)', text: '#231f20', muted: '#5b4b3d', accent: '#ef2b3a', tileBg: '#ffffff', overlay: ['rgba(255,232,74,0.94)', 'rgba(0,128,255,0.14)'], controlBg: 'rgba(255,253,243,0.92)', controlText: '#231f20', frameBorder: 'rgba(35,31,32,0.46)', radius: 18 },
  golden_years: { background: '#fbf4e6', panel: 'rgba(255,251,242,0.96)', text: '#3f2f22', muted: '#8b765e', accent: '#c99a2e', tileBg: '#fffaf0', overlay: ['rgba(251,244,230,0.94)', 'rgba(201,154,46,0.16)'], controlBg: 'rgba(255,251,242,0.9)', controlText: '#3f2f22', frameBorder: 'rgba(201,154,46,0.44)', radius: 20 },
  vintage: { background: '#0F0E0B', panel: 'rgba(28,24,18,0.96)', text: '#F2E7D2', muted: '#C7A96B', accent: '#B89145', tileBg: '#15130F', overlay: ['rgba(15,14,11,0.92)', 'rgba(184,145,69,0.12)'], controlBg: 'rgba(28,24,18,0.84)', controlText: '#F2E7D2', frameBorder: 'rgba(184,145,69,0.5)', radius: 2 },
  rose: { background: '#fff9f5', panel: 'rgba(255,252,247,0.96)', text: '#562733', muted: '#9a6c74', accent: '#b76578', tileBg: '#fffdfa', overlay: ['rgba(255,249,245,0.94)', 'rgba(183,101,120,0.16)'], controlBg: 'rgba(255,252,247,0.9)', controlText: '#562733', frameBorder: 'rgba(183,101,120,0.38)', radius: 28 },
  minimal_love: { background: '#f7efe4', panel: 'rgba(255,250,242,0.96)', text: '#3b2618', muted: '#8a7461', accent: '#6d4b34', tileBg: '#fffaf2', overlay: ['rgba(247,239,228,0.94)', 'rgba(109,75,52,0.12)'], controlBg: 'rgba(255,250,242,0.9)', controlText: '#3b2618', frameBorder: 'rgba(109,75,52,0.34)', radius: 24 },
  bohemian: { background: '#f3e8d3', panel: 'rgba(250,245,234,0.96)', text: '#38241b', muted: '#7d6457', accent: '#73863a', tileBg: '#fffdf9', overlay: ['rgba(243,232,211,0.94)', 'rgba(115,134,58,0.16)'], controlBg: 'rgba(243,232,211,0.9)', controlText: '#38241b', frameBorder: 'rgba(115,134,58,0.42)', radius: 22 },
  diamond: { background: '#f0f9ff', panel: 'rgba(255,255,255,0.96)', text: '#0c4a6e', muted: '#0369a1', accent: '#0284c7', tileBg: '#ffffff', overlay: ['rgba(240,249,255,0.94)', 'rgba(2,132,199,0.14)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#0c4a6e', frameBorder: 'rgba(2,132,199,0.36)', radius: 15 },
  blush: { background: '#f5dfdb', panel: 'rgba(255,255,255,0.96)', text: '#2b0d17', muted: '#8c5c56', accent: '#d89c8a', tileBg: '#ffffff', overlay: ['rgba(245,223,219,0.94)', 'rgba(216,156,138,0.14)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#2b0d17', frameBorder: 'rgba(216,156,138,0.38)', radius: 22 },
  garden: { background: '#e4ebe3', panel: 'rgba(253,251,247,0.96)', text: '#222e23', muted: '#536855', accent: '#7a9a6b', tileBg: '#ffffff', overlay: ['rgba(228,235,227,0.94)', 'rgba(122,154,107,0.14)'], controlBg: 'rgba(253,251,247,0.9)', controlText: '#222e23', frameBorder: 'rgba(122,154,107,0.36)', radius: 22 },
  midnight_glam: { background: '#1A1035', panel: 'rgba(58,32,96,0.94)', text: '#F4F0FD', muted: '#9689C9', accent: '#6B5BBF', tileBg: '#3A2060', overlay: ['rgba(26,16,53,0.94)', 'rgba(107,91,191,0.16)'], controlBg: 'rgba(58,32,96,0.84)', controlText: '#F4F0FD', frameBorder: 'rgba(168,158,223,0.48)', radius: 16 },
  cinematic: { background: '#0f0f12', panel: 'rgba(28,28,32,0.94)', text: '#ffffff', muted: '#a0a0aa', accent: '#e62b3a', tileBg: '#1c1c20', overlay: ['rgba(15,15,18,0.94)', 'rgba(230,43,58,0.12)'], controlBg: 'rgba(28,28,32,0.84)', controlText: '#ffffff', frameBorder: 'rgba(230,43,58,0.45)', radius: 6 },
  modern_lounge: { background: '#F0F4F8', panel: 'rgba(255,255,255,0.96)', text: '#0D1117', muted: '#3D5F8A', accent: '#3D5F8A', tileBg: '#ffffff', overlay: ['rgba(240,244,248,0.94)', 'rgba(61,95,138,0.14)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#0D1117', frameBorder: 'rgba(61,95,138,0.36)', radius: 16 },
  elegant_night: { background: '#111111', panel: 'rgba(26,26,26,0.94)', text: '#ffffff', muted: '#cccccc', accent: '#ffffff', tileBg: '#111111', overlay: ['rgba(17,17,17,0.94)', 'rgba(255,255,255,0.08)'], controlBg: 'rgba(26,26,26,0.84)', controlText: '#ffffff', frameBorder: 'rgba(255,255,255,0.32)', radius: 2 },
  museum: { background: '#0D1117', panel: '#121820', text: '#A7B7C9', muted: '#798FAF', accent: '#3D5F8A', tileBg: '#1C2430', overlay: ['rgba(13,17,23,0.94)', 'rgba(61,95,138,0.16)'], controlBg: 'rgba(18,24,32,0.9)', controlText: '#A7B7C9', frameBorder: 'rgba(61,95,138,0.4)', radius: 22 },
  brutalist: { background: '#171914', panel: '#272921', text: '#E6DFD3', muted: '#988B71', accent: '#988B71', tileBg: '#3B3C32', overlay: ['rgba(23,25,20,0.94)', 'rgba(152,139,113,0.14)'], controlBg: 'rgba(39,41,33,0.9)', controlText: '#988B71', frameBorder: 'rgba(152,139,113,0.4)', radius: 14 },
  tech_sleek: { background: '#040c1a', panel: '#0a182b', text: '#f0f8ff', muted: '#7ba4cc', accent: '#00a2ff', tileBg: '#0e233d', overlay: ['rgba(4,12,26,0.94)', 'rgba(0,162,255,0.14)'], controlBg: 'rgba(10,24,43,0.9)', controlText: '#f0f8ff', frameBorder: 'rgba(0,162,255,0.5)', radius: 14 },
  executive: { background: '#08111f', panel: 'rgba(245,237,220,0.96)', text: '#f5eddc', muted: '#d4b474', accent: '#d4b474', tileBg: '#f5eddc', overlay: ['rgba(8,17,31,0.94)', 'rgba(212,180,116,0.14)'], controlBg: 'rgba(8,17,31,0.84)', controlText: '#f5eddc', frameBorder: 'rgba(212,180,116,0.5)', radius: 18 },
  polaroid: { background: '#f8f3e7', panel: 'rgba(255,250,240,0.96)', text: '#1f2937', muted: '#78716c', accent: '#b45309', tileBg: '#ffffff', overlay: ['rgba(248,243,231,0.94)', 'rgba(180,83,9,0.12)'], controlBg: 'rgba(255,250,240,0.9)', controlText: '#1f2937', frameBorder: 'rgba(180,83,9,0.38)', radius: 2 },
  editorial: { background: '#fafaf9', panel: 'rgba(255,255,255,0.96)', text: '#111827', muted: '#374151', accent: '#111827', tileBg: '#e7e5e4', overlay: ['rgba(250,250,249,0.94)', 'rgba(17,24,39,0.1)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#111827', frameBorder: 'rgba(17,24,39,0.32)', radius: 2 },
  vibrant: { background: '#f5f3ff', panel: 'rgba(255,255,255,0.96)', text: '#4c1d95', muted: '#7c3aed', accent: '#8b5cf6', tileBg: '#ffffff', overlay: ['rgba(245,243,255,0.94)', 'rgba(139,92,246,0.16)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#4c1d95', frameBorder: 'rgba(139,92,246,0.4)', radius: 15 },
  zen: { background: '#f5f5f4', panel: 'rgba(255,255,255,0.96)', text: '#44403c', muted: '#78716c', accent: '#57534e', tileBg: '#ffffff', overlay: ['rgba(245,245,244,0.94)', 'rgba(87,83,78,0.1)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#44403c', frameBorder: 'rgba(87,83,78,0.32)', radius: 28 },
  cyber_tech: { background: '#08080a', panel: '#131318', text: '#ffffff', muted: '#9ca3af', accent: '#3af0d8', tileBg: '#131318', overlay: ['rgba(8,8,10,0.94)', 'rgba(58,240,216,0.14)'], controlBg: 'rgba(19,19,24,0.84)', controlText: '#ffffff', frameBorder: 'rgba(58,240,216,0.54)', radius: 12 },
  retro_arcade: { background: '#ffc200', panel: 'rgba(18,18,18,0.96)', text: '#121212', muted: '#4b5563', accent: '#ffc200', tileBg: '#121218', overlay: ['rgba(255,194,0,0.94)', 'rgba(18,18,18,0.16)'], controlBg: 'rgba(18,18,18,0.9)', controlText: '#ffc200', frameBorder: 'rgba(255,194,0,0.44)', radius: 12 },
  academic_editorial: { background: '#FCFAF7', panel: 'rgba(255,255,255,0.96)', text: '#1C1C1E', muted: '#636E72', accent: '#800020', tileBg: '#FFFFFF', overlay: ['rgba(252,250,247,0.94)', 'rgba(128,0,32,0.1)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#1C1C1E', frameBorder: 'rgba(128,0,32,0.34)', radius: 2 },
  neon_carnival: { background: '#06030a', panel: 'rgba(15,9,24,0.94)', text: '#faf5ff', muted: '#d8b4fe', accent: '#d946ef', tileBg: '#0b0612', overlay: ['rgba(6,3,10,0.94)', 'rgba(217,70,239,0.14)'], controlBg: 'rgba(15,9,24,0.84)', controlText: '#faf5ff', frameBorder: 'rgba(217,70,239,0.54)', radius: 24 },
};

const SPORTS_VIEWER_PALETTES: Record<string, ViewerPalette> = {
  bohemian: { ...VIEWER_TEMPLATE_PALETTES.bohemian, background: '#2f1b12', text: '#f3e8d3', muted: '#7d6457', accent: '#73863a', frameBorder: 'rgba(115,134,58,0.44)' },
  diamond: { background: '#060a12', panel: 'rgba(10,18,32,0.94)', text: '#eef2f7', muted: '#b9d8f2', accent: '#7dd3fc', tileBg: '#0a1220', overlay: ['rgba(6,10,18,0.94)', 'rgba(96,165,250,0.2)'], controlBg: 'rgba(10,18,32,0.84)', controlText: '#eef2f7', frameBorder: 'rgba(125,211,252,0.52)', radius: 15 },
  blush: { ...VIEWER_TEMPLATE_PALETTES.blush, background: '#230a12', text: '#f8e9e7', muted: '#c4a5a0', accent: '#d89c8a', frameBorder: 'rgba(216,156,138,0.44)' },
  garden: { ...VIEWER_TEMPLATE_PALETTES.garden, background: '#3f4f40', text: '#f0f5ef', muted: '#a1b39e', accent: '#7a9a6b', frameBorder: 'rgba(122,154,107,0.4)' },
  midnight_glam: { background: '#1A1035', panel: 'rgba(58,32,96,0.94)', text: '#F4F0FD', muted: '#9689C9', accent: '#6B5BBF', tileBg: '#3A2060', overlay: ['rgba(26,16,53,0.94)', 'rgba(107,91,191,0.16)'], controlBg: 'rgba(58,32,96,0.84)', controlText: '#F4F0FD', frameBorder: 'rgba(168,158,223,0.52)', radius: 16 },
  cinematic: VIEWER_TEMPLATE_PALETTES.cinematic,
  modern_lounge: { background: '#0D1117', panel: 'rgba(28,36,48,0.94)', text: '#A7B7C9', muted: '#798FAF', accent: '#3D5F8A', tileBg: '#1C2430', overlay: ['rgba(13,17,23,0.94)', 'rgba(61,95,138,0.16)'], controlBg: 'rgba(28,36,48,0.84)', controlText: '#A7B7C9', frameBorder: 'rgba(61,95,138,0.48)', radius: 16 },
  elegant_night: { background: '#07101f', panel: 'rgba(12,23,42,0.94)', text: '#f5eddc', muted: '#d4b474', accent: '#d4b474', tileBg: '#0b1628', overlay: ['rgba(7,16,31,0.94)', 'rgba(212,180,116,0.16)'], controlBg: 'rgba(12,23,42,0.84)', controlText: '#f5eddc', frameBorder: 'rgba(212,180,116,0.5)', radius: 2 },
  polaroid: { ...VIEWER_TEMPLATE_PALETTES.polaroid, background: '#f7efe1', accent: '#b45309' },
  editorial: VIEWER_TEMPLATE_PALETTES.editorial,
  vibrant: { background: '#08111f', panel: 'rgba(15,23,42,0.94)', text: '#f8fafc', muted: '#cbd5e1', accent: '#f97316', tileBg: '#101010', overlay: ['rgba(8,17,31,0.94)', 'rgba(249,115,22,0.18)'], controlBg: 'rgba(15,23,42,0.84)', controlText: '#f8fafc', frameBorder: 'rgba(249,115,22,0.5)', radius: 15 },
  zen: { ...VIEWER_TEMPLATE_PALETTES.zen, background: '#f1eee6', accent: '#66785f', frameBorder: 'rgba(102,120,95,0.36)' },
};

function ViewerVideo({
  uri,
  rawUri,
  frameBg,
  controlText = '#ffffff',
  accent = '#CA9C68',
  customControls = false,
  videoControlsRef,
  onPreviousMedia,
  onNextMedia,
}: {
  uri: string;
  rawUri?: string;
  frameBg: string;
  controlText?: string;
  accent?: string;
  customControls?: boolean;
  videoControlsRef?: React.MutableRefObject<ViewerVideoControls | null>;
  onPreviousMedia?: () => void;
  onNextMedia?: () => void;
}) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [currentPlayUri, setCurrentPlayUri] = useState<string>(uri);
  const [hasFallenBack, setHasFallenBack] = useState<boolean>(false);

  useEffect(() => {
    setCurrentPlayUri(uri);
    setHasFallenBack(false);
  }, [uri]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsInteractionKey, setControlsInteractionKey] = useState(0);
  const [isCustomFullscreen, setIsCustomFullscreen] = useState(false);
  const playerRef = useRef<VideoPlayer | null>(null);
  const videoViewRef = useRef<VideoView | null>(null);
  const sourceRef = useRef<string | null>(null);
  const controlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const shouldUseCustomFullscreen = customControls && Platform.OS !== 'web';
  const canUseOrientationLock = canLockScreenOrientation();
  const shouldUseCustomFullscreenOverlay = shouldUseCustomFullscreen;
  const shouldRotateFullscreenManually = shouldUseCustomFullscreen && !canUseOrientationLock && viewportHeight >= viewportWidth;
  const fullscreenLandscapeWidth = Math.max(viewportWidth, viewportHeight);
  const fullscreenLandscapeHeight = Math.min(viewportWidth, viewportHeight);

  const clearControlsHideTimeout = useCallback(() => {
    if (controlsHideTimeoutRef.current) {
      clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  }, []);

  const revealVideoControls = useCallback(() => {
    setControlsVisible(true);
    setControlsInteractionKey(key => key + 1);
  }, []);

  useEffect(() => {
    const nextPlayer = createVideoPlayer(null, {
      seekBackwardIncrement: 5,
      seekForwardIncrement: 5,
    });
    nextPlayer.loop = false;
    nextPlayer.muted = false;
    nextPlayer.timeUpdateEventInterval = 0.25;
    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);

    return () => {
      const playerToRelease = nextPlayer;
      playerRef.current = null;
      sourceRef.current = null;
      if (videoControlsRef) {
        videoControlsRef.current = null;
      }
      clearControlsHideTimeout();
      try {
        playerToRelease.pause();
      } catch {
        // The player may already be detached by native cleanup.
      }
      setPlayer(null);
      setTimeout(() => {
        try {
          playerToRelease.release();
        } catch {
          // Ignore double-release races during fast refresh or native teardown.
        }
      }, 250);
    };
  }, [clearControlsHideTimeout, videoControlsRef]);

  useEffect(() => {
    return () => {
      clearControlsHideTimeout();
    };
  }, [clearControlsHideTimeout]);

  useEffect(() => {
    if (!shouldUseCustomFullscreenOverlay || !isCustomFullscreen) return;

    RNStatusBar.setHidden(true, 'fade');

    return () => {
      RNStatusBar.setHidden(false, 'fade');
      if (canUseOrientationLock) {
        void lockScreenOrientation(SCREEN_ORIENTATION_LOCK.PORTRAIT_UP);
      }
    };
  }, [canUseOrientationLock, isCustomFullscreen, shouldUseCustomFullscreenOverlay]);

  useEffect(() => {
    if (!customControls) return;

    clearControlsHideTimeout();

    if (!isPlaying || showSettings || showVolume) {
      setControlsVisible(true);
      return;
    }

    if (!controlsVisible) return;

    controlsHideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, VIDEO_CONTROLS_HIDE_DELAY_MS);

    return () => {
      clearControlsHideTimeout();
    };
  }, [
    clearControlsHideTimeout,
    controlsInteractionKey,
    controlsVisible,
    customControls,
    isPlaying,
    showSettings,
    showVolume,
  ]);

  useEffect(() => {
    if (!player) return;

    const playingSubscription = player.addListener('playingChange', ({ isPlaying: nextIsPlaying }) => {
      setIsPlaying(nextIsPlaying);
    });
    const timeSubscription = player.addListener('timeUpdate', ({ currentTime: nextCurrentTime }) => {
      setCurrentTime(nextCurrentTime);

      const nextDuration = Number(player.duration);
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration);
      }
    });
    const sourceSubscription = player.addListener('sourceLoad', ({ duration: nextDuration }) => {
      setCurrentTime(0);
      setDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0);
    });
    const endSubscription = player.addListener('playToEnd', () => {
      setIsPlaying(false);
      const finalDuration = Number(player.duration);
      if (Number.isFinite(finalDuration) && finalDuration > 0) {
        setCurrentTime(finalDuration);
      }
    });
    const statusSubscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        console.warn('[PhotoViewer] Player status error:', error);
        if (!hasFallenBack && rawUri && rawUri !== currentPlayUri) {
          console.log('[PhotoViewer] Runtime error: Falling back to raw video URL:', rawUri);
          setHasFallenBack(true);
          setCurrentPlayUri(rawUri);
        }
      }
    });

    return () => {
      playingSubscription.remove();
      timeSubscription.remove();
      sourceSubscription.remove();
      endSubscription.remove();
      statusSubscription.remove();
    };
  }, [player, hasFallenBack, rawUri, currentPlayUri]);

  const seekBySeconds = useCallback((seconds: number) => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return;

    try {
      activePlayer.seekBy(seconds);
      const nextCurrentTime = Number(activePlayer.currentTime);
      if (Number.isFinite(nextCurrentTime)) {
        setCurrentTime(Math.max(0, nextCurrentTime));
      }
    } catch (error) {
      console.error('[PhotoViewer] Video seek failed:', error);
    }
  }, []);

  useEffect(() => {
    if (!videoControlsRef) return;

    videoControlsRef.current = { seekBy: seekBySeconds };

    return () => {
      if (videoControlsRef.current?.seekBy === seekBySeconds) {
        videoControlsRef.current = null;
      }
    };
  }, [seekBySeconds, videoControlsRef]);

  useEffect(() => {
    let cancelled = false;
    const activePlayer = playerRef.current;
    if (!activePlayer || !currentPlayUri || sourceRef.current === currentPlayUri) return;

    sourceRef.current = currentPlayUri;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowSettings(false);
    setShowVolume(false);
    setIsMuted(false);
    setVolumeLevel(1);
    setControlsVisible(true);
    setControlsInteractionKey(key => key + 1);
    activePlayer.muted = false;
    activePlayer.volume = 1;

    activePlayer.replaceAsync(currentPlayUri)
      .then(() => {
        if (cancelled) return;

        const nextDuration = Number(activePlayer.duration);
        if (Number.isFinite(nextDuration) && nextDuration > 0) {
          setDuration(nextDuration);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[PhotoViewer] Video source load failed:', error);

        // Fallback to raw video URL if HLS .m3u8 failed
        if (!hasFallenBack && rawUri && rawUri !== currentPlayUri) {
          console.log('[PhotoViewer] Falling back to raw video URL:', rawUri);
          setHasFallenBack(true);
          setCurrentPlayUri(rawUri);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPlayUri, rawUri, hasFallenBack]);

  const handleTogglePlayback = useCallback(() => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return;

    revealVideoControls();

    try {
      if (activePlayer.playing || isPlaying) {
        activePlayer.pause();
        setIsPlaying(false);
      } else {
        activePlayer.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('[PhotoViewer] Video playback toggle failed:', error);
    }
  }, [isPlaying, revealVideoControls]);

  const handleToggleVolumePanel = useCallback(() => {
    revealVideoControls();
    setShowVolume(prev => !prev);
    setShowSettings(false);
  }, [revealVideoControls]);

  const handleExitFullscreen = useCallback(() => {
    revealVideoControls();
    setShowSettings(false);
    setShowVolume(false);
    setIsCustomFullscreen(false);
  }, [revealVideoControls]);

  const handleEnterFullscreen = useCallback(async () => {
    revealVideoControls();
    setShowSettings(false);
    setShowVolume(false);

    if (shouldUseCustomFullscreen) {
      if (canUseOrientationLock) {
        await lockScreenOrientation(SCREEN_ORIENTATION_LOCK.LANDSCAPE);
      }
      setIsCustomFullscreen(true);
      return;
    }

    videoViewRef.current?.enterFullscreen().catch((error) => {
      console.error('[PhotoViewer] Video fullscreen failed:', error);
    });
  }, [canUseOrientationLock, revealVideoControls, shouldUseCustomFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    if (isCustomFullscreen) {
      handleExitFullscreen();
    } else {
      handleEnterFullscreen();
    }
  }, [handleEnterFullscreen, handleExitFullscreen, isCustomFullscreen]);

  const handleVolumeGesture = useCallback((event: GestureResponderEvent) => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return;

    revealVideoControls();

    const nextVolume = Math.min(1, Math.max(0, event.nativeEvent.locationX / VIDEO_VOLUME_SLIDER_WIDTH));

    try {
      activePlayer.volume = nextVolume;
      activePlayer.muted = nextVolume <= 0.01;
      setVolumeLevel(nextVolume);
      setIsMuted(nextVolume <= 0.01);
    } catch (error) {
      console.error('[PhotoViewer] Video volume update failed:', error);
    }
  }, [revealVideoControls]);

  const renderCustomControls = (fullscreen = false) => (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.76)', 'rgba(0,0,0,0.92)']}
      style={[
        localStyles.dashboardVideoControlOverlay,
        fullscreen && localStyles.mobileVideoFullscreenControlOverlay,
      ]}
      pointerEvents="box-none"
    >
      <View style={localStyles.dashboardVideoProgressTrack}>
        <View
          style={[
            localStyles.dashboardVideoProgressFill,
            { width: `${progressPercent}%`, backgroundColor: accent },
          ]}
        />
      </View>

      <View style={localStyles.dashboardVideoControlsRow}>
        <View style={localStyles.dashboardVideoLeftControls}>
          {onPreviousMedia && (
            <TouchableOpacity
              style={localStyles.dashboardVideoControlButton}
              onPress={() => {
                revealVideoControls();
                onPreviousMedia();
              }}
              accessibilityLabel="Previous media"
            >
              <IconSymbol name="backward.end.fill" size={18} color={controlText} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[localStyles.dashboardVideoControlButton, localStyles.dashboardVideoPlayButton]}
            onPress={handleTogglePlayback}
            accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
          >
            <IconSymbol name={isPlaying ? 'pause.fill' : 'play.fill'} size={22} color={controlText} />
          </TouchableOpacity>

          {onNextMedia && (
            <TouchableOpacity
              style={localStyles.dashboardVideoControlButton}
              onPress={() => {
                revealVideoControls();
                onNextMedia();
              }}
              accessibilityLabel="Next media"
            >
              <IconSymbol name="forward.end.fill" size={18} color={controlText} />
            </TouchableOpacity>
          )}

          <Text style={[localStyles.dashboardVideoTime, { color: controlText }]}>
            {formatVideoClock(currentTime)} / {formatVideoClock(duration)}
          </Text>
        </View>

        <View style={localStyles.dashboardVideoRightControls}>
          <View style={localStyles.dashboardVideoVolumeGroup}>
            <TouchableOpacity
              style={localStyles.dashboardVideoIconButton}
              onPress={handleToggleVolumePanel}
              accessibilityLabel="Video volume"
              activeOpacity={0.75}
            >
              <IconSymbol name={isMuted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'} size={19} color={showVolume ? accent : controlText} />
            </TouchableOpacity>

            {showVolume && (
              <View style={localStyles.dashboardVideoVolumeInline}>
                <View
                  style={localStyles.dashboardVideoVolumeTouch}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleVolumeGesture}
                  onResponderMove={handleVolumeGesture}
                >
                  <View style={localStyles.dashboardVideoVolumeTrack}>
                    <View
                      style={[
                        localStyles.dashboardVideoVolumeFill,
                        { width: `${volumeLevel * 100}%`, backgroundColor: accent },
                      ]}
                    />
                    <View
                      style={[
                        localStyles.dashboardVideoVolumeThumb,
                        {
                          left: `${volumeLevel * 100}%`,
                          backgroundColor: accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={localStyles.dashboardVideoIconButton}
            onPress={() => {
              revealVideoControls();
              setShowSettings(prev => !prev);
              setShowVolume(false);
            }}
            accessibilityLabel="Video settings"
            activeOpacity={0.75}
          >
            <IconSymbol name="gearshape.fill" size={20} color={controlText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.dashboardVideoIconButton}
            onPress={handleToggleFullscreen}
            accessibilityLabel={isCustomFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            activeOpacity={0.75}
          >
            <IconSymbol
              name={isCustomFullscreen ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right'}
              size={20}
              color={controlText}
            />
          </TouchableOpacity>
        </View>

        {showSettings && (
          <View style={[localStyles.dashboardVideoSettingsPopover, { borderColor: accent }]}>
            <Text style={[localStyles.dashboardVideoSettingsLabel, { color: controlText }]}>Quality</Text>
            <Text style={[localStyles.dashboardVideoSettingsValue, { color: accent }]}>Auto</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  const videoSurface = (
    <VideoView
      ref={videoViewRef}
      player={player}
      nativeControls={!customControls}
      fullscreenOptions={shouldUseCustomFullscreenOverlay ? VIDEO_CUSTOM_FULLSCREEN_OPTIONS : VIDEO_NATIVE_FULLSCREEN_OPTIONS}
      contentFit="contain"
      style={{ width: '100%', height: '100%', backgroundColor: frameBg }}
    />
  );

  return (
    <View style={localStyles.videoPlayerFrame}>
      {!isCustomFullscreen && videoSurface}

      {!currentPlayUri.includes('.m3u8') && (
        <View style={localStyles.optimizingBadge}>
          <ActivityIndicator size="small" color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={localStyles.optimizingText}>Optimizing video quality...</Text>
        </View>
      )}

      {customControls && !isCustomFullscreen && (
        <Pressable
          style={localStyles.dashboardVideoTapSurface}
          onPress={revealVideoControls}
          accessible={false}
        />
      )}

      {customControls && !isCustomFullscreen && controlsVisible && renderCustomControls()}

      {shouldUseCustomFullscreenOverlay && isCustomFullscreen && (
        <Modal
          visible
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          onRequestClose={handleExitFullscreen}
        >
          <View style={localStyles.mobileVideoFullscreenModal}>
            <View
              style={[
                localStyles.mobileVideoFullscreenStage,
                shouldRotateFullscreenManually && {
                  width: fullscreenLandscapeWidth,
                  height: fullscreenLandscapeHeight,
                  flex: 0,
                  alignSelf: 'center',
                  transform: [{ rotate: '90deg' }],
                },
              ]}
            >
              <VideoView
                player={player}
                nativeControls={false}
                fullscreenOptions={VIDEO_CUSTOM_FULLSCREEN_OPTIONS}
                contentFit="contain"
                surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
                style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
              />

              <Pressable
                style={localStyles.dashboardVideoTapSurface}
                onPress={revealVideoControls}
                accessible={false}
              />

              {controlsVisible && renderCustomControls(true)}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function PhotoViewer({
  visible,
  onClose,
  photos,
  initialIndex,
  viewerIdentity,
  event,
  selectedTemplate,
  keepBottomBarVisible = false,
  bottomBarOffset = 0,
  dashboardImageScrollReveal = false,
  isPhotoFavourite,
  onTogglePhotoFavourite,
  onRotatePhoto,
}: PhotoViewerProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [likes, setLikes] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTogglingFavourite, setIsTogglingFavourite] = useState(false);
  const [rotatingDirection, setRotatingDirection] = useState<'left' | 'right' | null>(null);
  const [expandedProfileImage, setExpandedProfileImage] = useState<{ src: string; name: string } | null>(null);
  const [loadedImageSizes, setLoadedImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const swipeStartXRef = useRef<number | null>(null);
  const hostScrollRef = useRef<ScrollView | null>(null);
  const dashboardImageScrollRef = useRef<ScrollView | null>(null);
  const dashboardVideoControlsRef = useRef<ViewerVideoControls | null>(null);

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentPhotoIndex(initialIndex);
  }, [initialIndex]);

  const currentPhoto = photos[currentPhotoIndex];
  const currentPhotoKey = String(currentPhoto?.id || currentPhoto?.url || currentPhotoIndex);
  const loadedImageSize = loadedImageSizes[currentPhotoKey] || null;
  const isLiked = useMemo(() => likes.some((like) => like.userId === viewerIdentity.id), [likes, viewerIdentity.id]);
  const isVideoMedia = currentPhoto?.mediaType === 'video' || currentPhoto?.resourceType === 'video';
  const showHostTopControls = keepBottomBarVisible;
  const shouldUseDashboardImageScrollReveal = dashboardImageScrollReveal && !showHostTopControls;
  const hostDisplayImageUrl = useMemo(() => {
    if (!currentPhoto) return '';
    if (isVideoMedia) return currentPhoto.url || '';

    return currentPhoto.previewUrl
      || getImageUrl(currentPhoto.url, { width: 900, quality: 75, format: 'webp' }, currentPhoto.thumbnailUrl);
  }, [currentPhoto, isVideoMedia]);
  const hostMediaAspectRatio = useMemo(() => {
    if (loadedImageSize?.width && loadedImageSize?.height) {
      return loadedImageSize.width / loadedImageSize.height;
    }

    const width = Number(currentPhoto?.width ?? currentPhoto?.metadata?.width ?? currentPhoto?.imageWidth);
    const height = Number(currentPhoto?.height ?? currentPhoto?.metadata?.height ?? currentPhoto?.imageHeight);

    if (width > 0 && height > 0) {
      return width / height;
    }

    return isVideoMedia ? 16 / 9 : 3 / 4;
  }, [currentPhoto, isVideoMedia, loadedImageSize]);
  const hostCollapsedLayout = useMemo(() => {
    const safeWidth = Math.max(1, viewportWidth);
    const availableHeight = Math.max(1, viewportHeight - bottomBarOffset);
    const horizontalInset = 0;
    const minMediaHeight = 300;
    const maxMediaHeight = 480;
    const preferredMediaHeight = availableHeight * 0.58;
    const safeAspectRatio = Math.max(0.2, hostMediaAspectRatio || 1);
    const isPortraitMedia = !isVideoMedia && safeAspectRatio < 1;
    const mediaWidth = Math.max(1, safeWidth - horizontalInset * 2);
    const landscapeStageHeight = Math.max(minMediaHeight, Math.min(preferredMediaHeight, maxMediaHeight));
    const mediaHeight = isPortraitMedia ? mediaWidth / safeAspectRatio : landscapeStageHeight;
    const guestbookScrollY = Math.max(0, mediaHeight + 104);

    return {
      mediaWidth,
      mediaHeight,
      guestbookScrollY,
    };
  }, [bottomBarOffset, hostMediaAspectRatio, isVideoMedia, viewportHeight, viewportWidth]);
  const hostRenderedMediaSize = useMemo(() => {
    const maxWidth = hostCollapsedLayout.mediaWidth;
    const maxHeight = hostCollapsedLayout.mediaHeight;
    const safeAspectRatio = Math.max(0.2, hostMediaAspectRatio || 1);
    const isPortraitMedia = !isVideoMedia && safeAspectRatio < 1;

    if (isPortraitMedia) {
      return {
        width: maxWidth,
        height: Math.max(1, maxWidth / safeAspectRatio),
      };
    }

    let width = maxWidth;
    let height = width / safeAspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * safeAspectRatio;
    }

    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }, [hostCollapsedLayout.mediaHeight, hostCollapsedLayout.mediaWidth, hostMediaAspectRatio, isVideoMedia]);
  const currentPhotoIsFavourite = useMemo(
    () => currentPhoto ? isPhotoFavourite?.(currentPhoto) ?? false : false,
    [currentPhoto, isPhotoFavourite]
  );

  const handleHostImageLoad = (event: ImageLoadEventData | NativeSyntheticEvent<ImageLoadEventData>) => {
    const payload = 'nativeEvent' in event ? event.nativeEvent : event;
    const width = Number(payload?.source?.width);
    const height = Number(payload?.source?.height);

    if (!(width > 0 && height > 0)) return;

    setLoadedImageSizes((prev) => {
      const existing = prev[currentPhotoKey];
      if (existing?.width === width && existing?.height === height) {
        return prev;
      }

      return {
        ...prev,
        [currentPhotoKey]: { width, height },
      };
    });
  };

  useEffect(() => {
    if (visible && showHostTopControls) {
      setShowComments(true);
    }
  }, [visible, showHostTopControls, currentPhoto?.id]);

  useEffect(() => {
    if (!visible || !shouldUseDashboardImageScrollReveal) return;

    dashboardImageScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentPhoto?.id, shouldUseDashboardImageScrollReveal, visible]);

  const isScrapbookTemplate = event?.templateId === 'scrapbook';
  const isNeonTemplate = event?.templateId === 'neon';
  const isPopTemplate = event?.templateId === 'pop';

  const viewerTheme = useMemo(() => {
    const id = selectedTemplate?.id || event?.templateId || 'hero';
    const palette = event?.category === 'Sports'
      ? (SPORTS_VIEWER_PALETTES[id] || VIEWER_TEMPLATE_PALETTES[id])
      : VIEWER_TEMPLATE_PALETTES[id];
    const background = palette?.background || selectedTemplate?.background || '#000000';
    const panel = palette?.panel || selectedTemplate?.panel || 'rgba(255,255,255,0.08)';
    const text = palette?.text || selectedTemplate?.text || '#ffffff';
    const muted = palette?.muted || selectedTemplate?.muted || '#cbd5e1';
    const accent = palette?.accent || selectedTemplate?.accent || MidnightColors.gold;
    const tileBg = palette?.tileBg || selectedTemplate?.tileBg || '#050505';
    const radius = Math.min(Math.max(selectedTemplate?.radius ?? 18, 10), 28);
    const overlay = palette?.overlay || (Array.isArray(selectedTemplate?.overlay) && selectedTemplate.overlay.length >= 2
      ? selectedTemplate.overlay
      : ['rgba(0,0,0,0.05)', background]);

    const lightTemplates = ['classic', 'ethereal', 'pastel', 'pop', 'academic_editorial', 'garden', 'museum'];
    const isLight = lightTemplates.includes(id);
    const controlBg = palette?.controlBg || (isLight ? 'rgba(255,255,255,0.84)' : 'rgba(0,0,0,0.42)');
    const controlText = palette?.controlText || (isLight ? text : '#ffffff');

    return {
      id,
      background,
      panel,
      text,
      muted,
      accent,
      tileBg,
      radius: palette?.radius ?? radius,
      overlay,
      controlBg,
      controlText,
      frameBorder: palette?.frameBorder || `${accent}55`,
      isLight,
    };
  }, [event?.category, event?.templateId, selectedTemplate]);

  const navigateViewer = (dir: 'prev' | 'next') => {
    if (photos.length === 0) return;
    if (dir === 'prev') {
      setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    } else {
      setCurrentPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    }
    // Dashboard keeps the compact viewer until comments are explicitly opened.
    // Host keeps the Guestbook in the scroll flow so only the media changes.
    if (!showHostTopControls) {
      setShowComments(false);
    }
    setReplyingTo(null);
    setNewComment('');
  };

  const handleOpenComments = () => {
    setShowComments(true);
    if (!showHostTopControls) return;

    setTimeout(() => {
      hostScrollRef.current?.scrollTo({
        y: hostCollapsedLayout.guestbookScrollY,
        animated: true,
      });
    }, 80);
  };

  const handleViewerTouchStart = (event: GestureResponderEvent) => {
    swipeStartXRef.current = event.nativeEvent.pageX;
  };

  const handleViewerTouchEnd = (event: GestureResponderEvent) => {
    if (swipeStartXRef.current === null || photos.length < 2) {
      swipeStartXRef.current = null;
      return;
    }

    const deltaX = event.nativeEvent.pageX - swipeStartXRef.current;
    swipeStartXRef.current = null;

    if (Math.abs(deltaX) < 45) return;
    navigateViewer(deltaX > 0 ? 'prev' : 'next');
  };

  useEffect(() => {
    if (!visible || !currentPhoto?.id) return;

    const unsubscribe = onPhotoInteractions(currentPhoto.id, (data) => {
      setLikes(data.likes || []);
      setComments(data.comments || []);
    });

    return () => unsubscribe();
  }, [visible, currentPhoto?.id]);

  const handleToggleLike = async () => {
    if (!currentPhoto?.id || isLiking) return;
    setIsLiking(true);
    try {
      await toggleLike(currentPhoto.id, viewerIdentity.id, viewerIdentity.name);
    } catch (err) {
      console.error('[PhotoViewer] Like failed:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentPhoto?.id || !newComment.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      await addComment(currentPhoto.id, viewerIdentity.id, viewerIdentity.name, newComment.trim(), replyingTo?.id);
      setNewComment('');
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch (err) {
      console.error('[PhotoViewer] Comment failed:', err);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhotoComment(commentId);
          } catch (err) {
            console.error('[PhotoViewer] Delete comment failed:', err);
          }
        },
      },
    ]);
  };

  const handleSharePhoto = async () => {
    if (!currentPhoto?.url) return;
    try {
      await Share.share({
        message: `A memory from "${event?.title || 'our event'}"\n${currentPhoto.url}`,
        url: currentPhoto.url,
      });
    } catch (error) {
      console.error('[PhotoViewer] Photo sharing failed', error);
    }
  };

  const handleToggleHostFavourite = async () => {
    if (!currentPhoto || !onTogglePhotoFavourite || isTogglingFavourite) return;
    setIsTogglingFavourite(true);
    try {
      await onTogglePhotoFavourite(currentPhoto);
    } catch (error) {
      console.error('[PhotoViewer] Primary gallery toggle failed:', error);
      Alert.alert('Primary Gallery Update Failed', 'Could not update this media. Please try again.');
    } finally {
      setIsTogglingFavourite(false);
    }
  };

  const handleRotateHostPhoto = async (direction: 'left' | 'right') => {
    if (!currentPhoto || !onRotatePhoto || isVideoMedia || rotatingDirection) return;
    setRotatingDirection(direction);
    try {
      await onRotatePhoto(currentPhoto, direction);
    } catch (error) {
      console.error('[PhotoViewer] Photo rotation failed:', error);
      Alert.alert('Rotation Failed', 'Could not rotate this photo. Please try again.');
    } finally {
      setRotatingDirection(null);
    }
  };

  const handleDownloadPhoto = async () => {
    if (!currentPhoto?.url) return;
    setIsDownloading(true);
    try {
      const extension = currentPhoto.url.split('.').pop() || 'jpg';
      const localUri = `${FileSystem.cacheDirectory}${Date.now()}-download.${extension}`;
      
      const downloadResult = await FileSystem.downloadAsync(
        currentPhoto.url,
        localUri
      );
      
      if (downloadResult.status === 200) {
        await Share.share(
          Platform.OS === 'ios'
            ? { url: downloadResult.uri }
            : { message: `Event memory: ${event?.title || 'our event'}`, url: downloadResult.uri }
        );
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error) {
      console.error('[PhotoViewer] Photo download/share failed:', error);
      Alert.alert('Download Failed', 'Could not download the original media. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!visible) {
    return null;
  }

  const renderGuestbookPanel = (hostFlow = false) => {
    const hostGuestbook = showHostTopControls || hostFlow;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          hostFlow ? localStyles.hostGuestbookPanelFlow : styles.guestbookPanel,
          !hostFlow && showHostTopControls && localStyles.hostGuestbookPanel,
          {
            backgroundColor: viewerTheme.panel,
            borderRadius: viewerTheme.radius + 10,
            borderWidth: 1,
            borderColor: viewerTheme.frameBorder,
          },
        ]}
      >
        <View style={[styles.guestbookHeader, hostGuestbook && localStyles.hostGuestbookHeader, { backgroundColor: viewerTheme.panel, borderBottomColor: viewerTheme.frameBorder }]}>
          <View>
            <Text style={[
              styles.guestbookTitle,
              hostGuestbook && localStyles.hostGuestbookTitle,
              { color: viewerTheme.text },
              selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
            ]}>Guestbook</Text>
            <Text style={[
              styles.guestbookSubtitle,
              hostGuestbook && localStyles.hostGuestbookSubtitle,
              { color: viewerTheme.muted },
              selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
            ]}>{comments.length} Shared Thoughts</Text>
          </View>
          <TouchableOpacity style={[styles.closeGuestbookBtn, hostGuestbook && localStyles.hostCloseGuestbookBtn, { backgroundColor: viewerTheme.controlBg }]} onPress={() => setShowComments(false)}>
            <IconSymbol name="xmark" size={18} color={viewerTheme.controlText} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.guestbookList} contentContainerStyle={[styles.guestbookListContent, hostGuestbook && localStyles.hostGuestbookListContent]}>
          {comments.length === 0 ? (
            <View style={[styles.emptyGuestbook, hostGuestbook && localStyles.hostEmptyGuestbook]}>
              <View style={[styles.emptyGuestbookIcon, hostGuestbook && localStyles.hostEmptyGuestbookIcon]}>
                <IconSymbol name="bubble.right" size={hostGuestbook ? 24 : 30} color="#78716c" />
              </View>
              <Text style={[
                styles.emptyGuestbookTitle,
                hostGuestbook && localStyles.hostEmptyGuestbookTitle,
                selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic', fontSize: hostGuestbook ? 16 : 18 }
              ]}>No whispers yet...</Text>
              <Text style={[
                styles.emptyGuestbookText,
                hostGuestbook && localStyles.hostEmptyGuestbookText,
                selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
              ]}>Write the first beautiful word.</Text>
            </View>
          ) : (
            comments.filter((comment) => !comment.parentId).map((comment) => {
              const replies = comments.filter((reply) => reply.parentId === comment.id);
              const commentProfileImage = comment.profileImage || null;
              const commentName = comment.userName || 'Guest';
              return (
                <View key={comment.id} style={styles.commentThread}>
                  <View style={styles.commentItem}>
                    <TouchableOpacity
                      disabled={!commentProfileImage}
                      onPress={() => commentProfileImage && setExpandedProfileImage({ src: commentProfileImage, name: commentName })}
                      style={[
                      styles.commentAvatar,
                        selectedTemplate.id === 'royal' && { backgroundColor: selectedTemplate.accentBg, borderWidth: 1, borderColor: selectedTemplate.accent }
                      ]}
                      activeOpacity={commentProfileImage ? 0.78 : 1}
                    >
                      {commentProfileImage ? (
                        <ExpoImage source={{ uri: commentProfileImage }} style={styles.commentAvatarImage} contentFit="cover" />
                      ) : (
                        <Text style={[
                          styles.commentAvatarText,
                          selectedTemplate.id === 'royal' && { color: selectedTemplate.accent, fontFamily: Fonts.serif, fontWeight: 'bold' }
                        ]}>{commentName.charAt(0)}</Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.commentContent}>
                      <View style={styles.commentRow}>
                        <Text style={[
                          styles.commentName,
                          selectedTemplate.id === 'royal' && { fontFamily: Fonts.serif, color: selectedTemplate.text }
                        ]} numberOfLines={1}>{commentName}</Text>
                        <Text style={styles.commentTime}>
                          {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                        </Text>
                      </View>
                      <View style={[
                        styles.commentBubble,
                        selectedTemplate.id === 'royal' && { borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', backgroundColor: 'rgba(212,175,55,0.04)' }
                      ]}>
                        <Text style={[
                          styles.commentText,
                          selectedTemplate.id === 'royal' && { color: selectedTemplate.text, fontFamily: Fonts.serif }
                        ]}>{comment.text}</Text>
                        <View style={styles.commentActions}>
                          <TouchableOpacity onPress={() => setReplyingTo(comment)}>
                            <Text style={styles.replyBtnText}>REPLY</Text>
                          </TouchableOpacity>
                          {comment.userId === viewerIdentity.id && (
                            <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                              <Text style={styles.deleteBtnText}>DELETE</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {replies.map((reply) => (
                    (() => {
                      const replyProfileImage = reply.profileImage || null;
                      const replyName = reply.userName || 'Guest';
                      return (
                        <View key={reply.id} style={styles.replyItem}>
                          <TouchableOpacity
                            disabled={!replyProfileImage}
                            onPress={() => replyProfileImage && setExpandedProfileImage({ src: replyProfileImage, name: replyName })}
                            style={[
                              styles.replyAvatar,
                              selectedTemplate.id === 'royal' && { backgroundColor: selectedTemplate.accentBg, borderWidth: 1, borderColor: selectedTemplate.accent }
                            ]}
                            activeOpacity={replyProfileImage ? 0.78 : 1}
                          >
                            {replyProfileImage ? (
                              <ExpoImage source={{ uri: replyProfileImage }} style={styles.replyAvatarImage} contentFit="cover" />
                            ) : (
                              <Text style={[
                                styles.replyAvatarText,
                                selectedTemplate.id === 'royal' && { color: selectedTemplate.accent, fontFamily: Fonts.serif, fontWeight: 'bold' }
                              ]}>{replyName.charAt(0)}</Text>
                            )}
                          </TouchableOpacity>
                          <View style={styles.commentContent}>
                            <View style={styles.commentRow}>
                              <Text style={[
                                styles.replyName,
                                selectedTemplate.id === 'royal' && { fontFamily: Fonts.serif, color: selectedTemplate.text }
                              ]} numberOfLines={1}>{replyName}</Text>
                              <Text style={styles.commentTime}>
                                {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                              </Text>
                            </View>
                            <View style={[
                              styles.replyBubble,
                              selectedTemplate.id === 'royal' && { borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', backgroundColor: 'rgba(212,175,55,0.04)' }
                            ]}>
                              <Text style={[
                                styles.replyText,
                                selectedTemplate.id === 'royal' && { color: selectedTemplate.text, fontFamily: Fonts.serif }
                              ]}>{reply.text}</Text>
                              {reply.userId === viewerIdentity.id && (
                                <TouchableOpacity onPress={() => handleDeleteComment(reply.id)}>
                                  <Text style={[styles.deleteBtnText, styles.replyDeleteText]}>DELETE</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })()
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.commentComposer, hostGuestbook && localStyles.hostCommentComposer, { backgroundColor: viewerTheme.panel, borderTopColor: viewerTheme.frameBorder }]}>
          {replyingTo && (
            <View style={styles.replyingToBanner}>
              <Text style={styles.replyingToText}>Replying to <Text style={styles.replyingToName}>{replyingTo.userName}</Text></Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <IconSymbol name="xmark" size={14} color="#78716c" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={replyingTo ? "Write a reply..." : "Share a wish..."}
              placeholderTextColor="#78716c"
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity style={[styles.commentSendBtn, (!newComment.trim() || isCommenting) && styles.commentSendBtnDisabled]} onPress={handleAddComment} disabled={!newComment.trim() || isCommenting}>
              <IconSymbol name="paperplane.fill" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  const viewerContent = (
    <View style={[styles.viewerContainer, showHostTopControls && localStyles.hostViewerContainer, { backgroundColor: viewerTheme.background }]}>
        <LinearGradient
          colors={viewerTheme.overlay as [string, string]}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        {showHostTopControls ? (
          <View style={[localStyles.hostTopControls, { backgroundColor: viewerTheme.controlBg }]}>
            {!!onTogglePhotoFavourite && (
              <TouchableOpacity
                style={[localStyles.hostToolbarButton, isTogglingFavourite && localStyles.hostToolbarButtonDisabled]}
                onPress={handleToggleHostFavourite}
                disabled={isTogglingFavourite}
                accessibilityLabel={currentPhotoIsFavourite ? 'Remove from Primary Gallery' : 'Add to Primary Gallery'}
              >
                {isTogglingFavourite ? (
                  <ActivityIndicator size="small" color={viewerTheme.controlText} />
                ) : (
                  <IconSymbol
                    name={currentPhotoIsFavourite ? 'star.fill' : 'star'}
                    size={23}
                    color={currentPhotoIsFavourite ? MidnightColors.gold : viewerTheme.controlText}
                  />
                )}
              </TouchableOpacity>
            )}
            {!!onRotatePhoto && !isVideoMedia && (
              <>
                <TouchableOpacity
                  style={[localStyles.hostToolbarButton, rotatingDirection === 'left' && localStyles.hostToolbarButtonDisabled]}
                  onPress={() => handleRotateHostPhoto('left')}
                  disabled={!!rotatingDirection}
                  accessibilityLabel="Rotate photo left"
                >
                  {rotatingDirection === 'left' ? (
                    <ActivityIndicator size="small" color={viewerTheme.controlText} />
                  ) : (
                    <IconSymbol name="arrow.counterclockwise" size={22} color={viewerTheme.controlText} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[localStyles.hostToolbarButton, rotatingDirection === 'right' && localStyles.hostToolbarButtonDisabled]}
                  onPress={() => handleRotateHostPhoto('right')}
                  disabled={!!rotatingDirection}
                  accessibilityLabel="Rotate photo right"
                >
                  {rotatingDirection === 'right' ? (
                    <ActivityIndicator size="small" color={viewerTheme.controlText} />
                  ) : (
                    <IconSymbol name="arrow.clockwise" size={22} color={viewerTheme.controlText} />
                  )}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[localStyles.hostToolbarButton, isDownloading && localStyles.hostToolbarButtonDisabled]}
              onPress={handleDownloadPhoto}
              disabled={isDownloading || !currentPhoto?.url}
              accessibilityLabel="Download media"
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={viewerTheme.controlText} />
              ) : (
                <IconSymbol name="arrow.down.to.line.compact" size={23} color={viewerTheme.controlText} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={localStyles.hostToolbarButton}
              onPress={onClose}
              accessibilityLabel="Close media viewer"
            >
              <IconSymbol name="xmark" size={25} color={viewerTheme.controlText} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.viewerClose, { backgroundColor: viewerTheme.controlBg, borderRadius: viewerTheme.radius }]} onPress={onClose}>
            <IconSymbol name="xmark" size={26} color={viewerTheme.controlText} />
          </TouchableOpacity>
        )}
        {shouldUseDashboardImageScrollReveal && (
          <View
            pointerEvents="none"
            style={[
              localStyles.dashboardImageTopCounter,
              {
                backgroundColor: viewerTheme.controlBg,
                borderColor: viewerTheme.frameBorder,
              },
            ]}
          >
            <Text style={[styles.viewerText, localStyles.dashboardImageTopCounterText, { color: viewerTheme.controlText }]}>
              {currentPhotoIndex + 1} / {photos.length}
            </Text>
          </View>
        )}

        {showHostTopControls ? (
          <ScrollView
            ref={hostScrollRef}
            style={localStyles.hostViewerScroll}
            contentContainerStyle={localStyles.hostViewerScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {photos[currentPhotoIndex] && (
              <View
                onTouchStart={handleViewerTouchStart}
                onTouchEnd={handleViewerTouchEnd}
                style={[
                  localStyles.hostScrollableMedia,
                  {
                    width: hostCollapsedLayout.mediaWidth,
                    height: hostCollapsedLayout.mediaHeight,
                    borderRadius: viewerTheme.radius,
                  },
                ]}
              >
                <View
                  style={[
                    localStyles.hostMediaClip,
                    {
                      width: hostRenderedMediaSize.width,
                      height: hostRenderedMediaSize.height,
                      borderRadius: viewerTheme.radius,
                    },
                  ]}
                >
                  {isVideoMedia ? (
                    <ViewerVideo
                      uri={photos[currentPhotoIndex].url}
                      rawUri={photos[currentPhotoIndex].raw_url || photos[currentPhotoIndex].rawUrl}
                      frameBg={viewerTheme.tileBg}
                      controlText={viewerTheme.controlText}
                      accent={viewerTheme.accent}
                      customControls
                      onPreviousMedia={() => navigateViewer('prev')}
                      onNextMedia={() => navigateViewer('next')}
                    />
                  ) : (
                    <ExpoImage
                      source={{ uri: hostDisplayImageUrl }}
                      style={[localStyles.hostMediaImage, { borderRadius: viewerTheme.radius }]}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      onLoad={handleHostImageLoad}
                    />
                  )}
                </View>
                {(isDownloading || rotatingDirection) && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                      {rotatingDirection ? 'Saving rotation...' : 'Downloading original...'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={localStyles.hostViewerActionsFlow}>
              <TouchableOpacity style={localStyles.hostViewerAction} onPress={handleToggleLike} disabled={isLiking}>
                <LucideHeartIcon
                  size={20}
                  color={isLiked ? "#f43f5e" : viewerTheme.controlText}
                  fill={isLiked ? "#f43f5e" : "none"}
                />
                <Text style={[localStyles.hostViewerActionLabel, { color: viewerTheme.muted }]}>{likes.length} LIKES</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.hostViewerAction} onPress={handleOpenComments}>
                <LucideMessageCircleIcon size={20} color={viewerTheme.controlText} />
                <Text style={[localStyles.hostViewerActionLabel, { color: viewerTheme.muted }]}>{comments.length} COMMENTS</Text>
              </TouchableOpacity>
            </View>

            {showComments ? (
              renderGuestbookPanel(true)
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  localStyles.hostGuestbookPeekFlow,
                  {
                    backgroundColor: viewerTheme.panel,
                    borderColor: viewerTheme.frameBorder,
                    borderRadius: viewerTheme.radius + 10,
                  },
                ]}
                onPress={handleOpenComments}
                accessibilityLabel="Open guestbook"
              >
                <View>
                  <Text
                    style={[
                      styles.guestbookTitle,
                      localStyles.hostGuestbookPeekTitle,
                      { color: viewerTheme.text },
                      selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' },
                    ]}
                  >
                    Guestbook
                  </Text>
                  <Text
                    style={[
                      styles.guestbookSubtitle,
                      localStyles.hostGuestbookPeekSubtitle,
                      { color: viewerTheme.muted },
                      selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' },
                    ]}
                  >
                    {comments.length} Shared Thoughts
                  </Text>
                </View>
                <View style={[localStyles.hostGuestbookPeekButton, { backgroundColor: viewerTheme.controlBg }]}>
                  <IconSymbol name="chevron.up" size={18} color={viewerTheme.controlText} />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : shouldUseDashboardImageScrollReveal ? (
          <>
            <ScrollView
              ref={dashboardImageScrollRef}
              style={localStyles.dashboardImageViewerScroll}
              contentContainerStyle={localStyles.dashboardImageViewerScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {photos[currentPhotoIndex] && (
                <View
                  onTouchStart={handleViewerTouchStart}
                  onTouchEnd={handleViewerTouchEnd}
                  style={[
                    localStyles.dashboardFullscreenImageFrame,
                    {
                      height: viewportHeight,
                      backgroundColor: viewerTheme.tileBg,
                    },
                  ]}
                >
                  {isVideoMedia ? (
                    <ViewerVideo
                      uri={photos[currentPhotoIndex].url}
                      rawUri={photos[currentPhotoIndex].raw_url || photos[currentPhotoIndex].rawUrl}
                      frameBg={viewerTheme.tileBg}
                      controlText={viewerTheme.controlText}
                      accent={viewerTheme.accent}
                      customControls
                      videoControlsRef={dashboardVideoControlsRef}
                      onPreviousMedia={() => navigateViewer('prev')}
                      onNextMedia={() => navigateViewer('next')}
                    />
                  ) : (
                    <ExpoImage
                      source={{ uri: getImageUrl(photos[currentPhotoIndex].url, { width: 1200, quality: 82, format: 'webp' }, photos[currentPhotoIndex].thumbnailUrl) }}
                      style={localStyles.dashboardFullscreenImage}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  )}
                  {(isDownloading || rotatingDirection) && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={{ color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                        {rotatingDirection ? 'Saving rotation...' : 'Downloading original...'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={localStyles.dashboardImageDetails}>
                <View style={localStyles.dashboardImageActionsFlow}>
                  <TouchableOpacity style={styles.viewerAction} onPress={handleToggleLike} disabled={isLiking}>
                    <LucideHeartIcon
                      size={30}
                      color={isLiked ? "#f43f5e" : viewerTheme.controlText}
                      fill={isLiked ? "#f43f5e" : "none"}
                      strokeWidth={2}
                    />
                    <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>{likes.length}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerAction} onPress={handleOpenComments}>
                    <LucideMessageCircleIcon size={30} color={showComments ? viewerTheme.accent : viewerTheme.controlText} strokeWidth={2} />
                    <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>{comments.length}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerAction} onPress={handleSharePhoto}>
                    <LucideShare2Icon size={28} color={viewerTheme.controlText} strokeWidth={2} />
                    <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerAction} onPress={handleDownloadPhoto} disabled={isDownloading}>
                    <LucideDownloadIcon size={30} color={viewerTheme.controlText} strokeWidth={2} />
                    <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>Download</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </ScrollView>

            {showComments && renderGuestbookPanel(false)}
          </>
        ) : (
          <>
            {photos[currentPhotoIndex] && (
              <View
                onTouchStart={handleViewerTouchStart}
                onTouchEnd={handleViewerTouchEnd}
                style={[
                  styles.fullImage,
                  showComments && styles.fullImageWithComments,
                  {
                    backgroundColor: viewerTheme.tileBg,
                    borderRadius: viewerTheme.radius,
                    borderWidth: 1,
                    borderColor: viewerTheme.frameBorder,
                    overflow: 'hidden',
                    width: isVideoMedia ? '100%' : '92%',
                  },
                ]}
              >
                {isVideoMedia ? (
                  <ViewerVideo
                    uri={photos[currentPhotoIndex].url}
                    rawUri={photos[currentPhotoIndex].raw_url || photos[currentPhotoIndex].rawUrl}
                    frameBg={viewerTheme.tileBg}
                    controlText={viewerTheme.controlText}
                    accent={viewerTheme.accent}
                    customControls
                    videoControlsRef={dashboardVideoControlsRef}
                    onPreviousMedia={() => navigateViewer('prev')}
                    onNextMedia={() => navigateViewer('next')}
                  />
                ) : (
                  <ExpoImage
                    source={{ uri: getImageUrl(photos[currentPhotoIndex].url, { width: 900, quality: 75, format: 'webp' }, photos[currentPhotoIndex].thumbnailUrl) }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                )}
                {(isDownloading || rotatingDirection) && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                      {rotatingDirection ? 'Saving rotation...' : 'Downloading original...'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={[styles.viewerActions, showComments ? styles.viewerActionsRaised : styles.viewerActionsDocked]}>
              <TouchableOpacity style={styles.viewerAction} onPress={handleToggleLike} disabled={isLiking}>
                <IconSymbol name={isLiked ? "heart.fill" : "heart"} size={30} color={isLiked ? "#f43f5e" : viewerTheme.controlText} />
                <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>{likes.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewerAction} onPress={handleOpenComments}>
                <IconSymbol name="bubble.right" size={30} color={showComments ? viewerTheme.accent : viewerTheme.controlText} />
                <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>{comments.length}</Text>
              </TouchableOpacity>
              {(isScrapbookTemplate || isNeonTemplate || isPopTemplate) && (
                <TouchableOpacity style={styles.viewerAction} onPress={handleSharePhoto}>
                  <IconSymbol name="square.and.arrow.up" size={28} color={isNeonTemplate ? '#66e8ff' : (isPopTemplate ? '#231f20' : viewerTheme.controlText)} />
                  <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }, isNeonTemplate && styles.neonViewerActionCount, isPopTemplate && styles.popViewerActionCount]}>Share</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.viewerAction} onPress={handleDownloadPhoto} disabled={isDownloading}>
                <IconSymbol name="arrow.down.to.line.compact" size={30} color={viewerTheme.controlText} />
                <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>Download</Text>
              </TouchableOpacity>
            </View>

            {!showComments && (
              <View style={[styles.viewerFooter, { backgroundColor: viewerTheme.controlBg, borderRadius: 999, paddingVertical: 8 }]}>
                <Text style={[styles.viewerText, { color: viewerTheme.controlText }]}>{currentPhotoIndex + 1} / {photos.length}</Text>
              </View>
            )}

            {showComments && renderGuestbookPanel(false)}
          </>
        )}

        <Modal
          visible={!!expandedProfileImage}
          transparent
          animationType="fade"
          onRequestClose={() => setExpandedProfileImage(null)}
        >
          <View style={styles.profilePreviewOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setExpandedProfileImage(null)} />
            {expandedProfileImage && (
              <View style={[styles.profilePreviewCard, { backgroundColor: viewerTheme.panel, borderColor: viewerTheme.frameBorder }]}>
                <TouchableOpacity style={[styles.profilePreviewClose, { backgroundColor: viewerTheme.controlBg }]} onPress={() => setExpandedProfileImage(null)}>
                  <IconSymbol name="xmark" size={18} color={viewerTheme.controlText} />
                </TouchableOpacity>
                <ExpoImage source={{ uri: expandedProfileImage.src }} style={styles.profilePreviewImage} contentFit="cover" />
                <Text style={[styles.profilePreviewName, { color: viewerTheme.text }]} numberOfLines={1}>{expandedProfileImage.name}</Text>
              </View>
            )}
          </View>
        </Modal>
      </View>
  );

  if (keepBottomBarVisible) {
    return (
      <View style={[localStyles.inlineViewerOverlay, { bottom: bottomBarOffset }]}>
        {viewerContent}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {viewerContent}
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  videoPlayerFrame: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  dashboardVideoControlOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: 12,
    paddingTop: 34,
    paddingBottom: 10,
  },
  dashboardVideoTapSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  mobileVideoFullscreenModal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  mobileVideoFullscreenStage: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  mobileVideoFullscreenControlOverlay: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  dashboardVideoProgressTrack: {
    height: 3,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dashboardVideoProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  dashboardVideoControlsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  dashboardVideoLeftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  dashboardVideoControlButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardVideoPlayButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  dashboardVideoTime: {
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
  },
  dashboardVideoRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dashboardVideoVolumeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dashboardVideoIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardVideoVolumeInline: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  dashboardVideoVolumeTouch: {
    width: VIDEO_VOLUME_SLIDER_WIDTH,
    height: 18,
    justifyContent: 'center',
  },
  dashboardVideoVolumeTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  dashboardVideoVolumeFill: {
    height: '100%',
    borderRadius: 999,
  },
  dashboardVideoVolumeThumb: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    transform: [{ translateX: -5.5 }],
  },
  dashboardVideoSettingsPopover: {
    position: 'absolute',
    right: 0,
    bottom: 36,
    minWidth: 104,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dashboardVideoSettingsLabel: {
    fontSize: 9,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  dashboardVideoSettingsValue: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: Fonts.inter.bold,
  },
  dashboardImageViewerScroll: {
    flex: 1,
    width: '100%',
  },
  dashboardImageViewerScrollContent: {
    alignItems: 'center',
    paddingBottom: 52,
  },
  dashboardFullscreenImageFrame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dashboardFullscreenImage: {
    width: '100%',
    height: '100%',
  },
  dashboardImageDetails: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 30,
  },
  dashboardImageActionsFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    gap: 18,
  },
  dashboardImageTopCounter: {
    position: 'absolute',
    top: 58,
    left: 20,
    zIndex: 12,
    elevation: 12,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dashboardImageTopCounterText: {
    fontSize: 13,
  },
  hostViewerContainer: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  hostTopControls: {
    position: 'absolute',
    top: 50,
    right: 12,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  hostToolbarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostToolbarButtonDisabled: {
    opacity: 0.55,
  },
  hostViewerScroll: {
    flex: 1,
    width: '100%',
  },
  hostViewerScrollContent: {
    alignItems: 'center',
    paddingTop: 112,
    paddingBottom: 28,
  },
  hostScrollableMedia: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  hostMediaClip: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  hostMediaImage: {
    width: '100%',
    height: '100%',
  },
  hostFullImageWithPeek: {
    height: '54%',
    marginBottom: 160,
  },
  hostFullImageWithGuestbook: {
    height: '42%',
    marginBottom: 270,
  },
  hostViewerActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  hostViewerActionsRaised: {
    bottom: 318,
  },
  hostViewerActionsDocked: {
    bottom: 116,
  },
  hostViewerActionsFlow: {
    flexDirection: 'row',
    gap: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 28,
    zIndex: 20,
    elevation: 20,
  },
  hostViewerAction: {
    alignItems: 'center',
    gap: 6,
    minWidth: 76,
  },
  hostViewerActionLabel: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  hostGuestbookPanel: {
    left: 20,
    right: 20,
    bottom: 12,
    height: 290,
  },
  hostGuestbookPanelFlow: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    height: 330,
    overflow: 'hidden',
  },
  hostGuestbookHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  hostGuestbookTitle: {
    fontSize: 22,
  },
  hostGuestbookSubtitle: {
    fontSize: 9,
    letterSpacing: 1.8,
  },
  hostCloseGuestbookBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
  },
  hostGuestbookListContent: {
    padding: 18,
    paddingBottom: 20,
  },
  hostEmptyGuestbook: {
    paddingVertical: 26,
  },
  hostEmptyGuestbookIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginBottom: 12,
  },
  hostEmptyGuestbookTitle: {
    fontSize: 16,
  },
  hostEmptyGuestbookText: {
    fontSize: 12,
  },
  hostCommentComposer: {
    padding: 14,
  },
  hostGuestbookPeek: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 82,
    borderWidth: 1,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    zIndex: 18,
    elevation: 18,
  },
  hostGuestbookPeekFlow: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    height: 82,
    borderWidth: 1,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    zIndex: 18,
    elevation: 18,
  },
  hostGuestbookPeekTitle: {
    fontSize: 22,
  },
  hostGuestbookPeekSubtitle: {
    fontSize: 9,
    letterSpacing: 1.8,
    marginTop: 5,
  },
  hostGuestbookPeekButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineViewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 900,
    elevation: 900,
  },
  optimizingBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    zIndex: 20,
  },
  optimizingText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '600',
  },
});

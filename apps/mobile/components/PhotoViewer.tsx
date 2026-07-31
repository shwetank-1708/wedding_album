import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Share, TextInput, Keyboard, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { onPhotoInteractions, toggleLike, addComment, deletePhotoComment, Event as DatabaseEvent } from '@/lib/database';
import { getImageUrl } from '@/lib/imageUrl';
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

const VIEWER_TEMPLATE_PALETTES: Record<string, ViewerPalette> = {
  royal: { background: '#033026', panel: 'rgba(2,35,28,0.94)', text: '#fcfbf7', muted: '#a3b899', accent: '#cca43b', tileBg: '#02231c', overlay: ['rgba(3,48,38,0.1)', 'rgba(3,48,38,0.78)', '#02231c'], controlBg: 'rgba(2,35,28,0.84)', controlText: '#fcfbf7', frameBorder: 'rgba(204,164,59,0.62)', radius: 18 },
  classic: { background: '#FAF9F6', panel: 'rgba(255,255,255,0.96)', text: '#1e293b', muted: '#64748b', accent: '#cca43b', tileBg: '#ffffff', overlay: ['rgba(250,249,246,0.95)', 'rgba(238,232,218,0.92)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#1e293b', frameBorder: 'rgba(204,164,59,0.42)', radius: 2 },
  hero: { background: '#000000', panel: 'rgba(9,9,11,0.94)', text: '#ffffff', muted: '#94a3b8', accent: '#cca43b', tileBg: '#09090b', overlay: ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.96)'], controlBg: 'rgba(0,0,0,0.56)', controlText: '#ffffff', frameBorder: 'rgba(204,164,59,0.48)', radius: 12 },
  ethereal: { background: '#F8FAFC', panel: 'rgba(238,242,246,0.96)', text: '#1E293B', muted: '#64748B', accent: '#4A6984', tileBg: '#ffffff', overlay: ['rgba(248,250,252,0.9)', 'rgba(226,232,240,0.94)'], controlBg: 'rgba(255,255,255,0.88)', controlText: '#1E293B', frameBorder: 'rgba(74,105,132,0.36)', radius: 2 },
  scrapbook: { background: '#f8f5f0', panel: 'rgba(255,253,249,0.96)', text: '#263331', muted: '#74827d', accent: '#d9826b', tileBg: '#fffdf9', overlay: ['rgba(248,245,240,0.92)', 'rgba(217,130,107,0.14)', '#f8f5f0'], controlBg: 'rgba(255,253,249,0.9)', controlText: '#263331', frameBorder: 'rgba(217,130,107,0.42)', radius: 18 },
  neon: { background: '#070611', panel: 'rgba(18,16,35,0.94)', text: '#f8f7ff', muted: '#b9b1d9', accent: '#ff3df2', tileBg: '#111020', overlay: ['rgba(7,6,17,0.92)', 'rgba(102,232,255,0.16)', 'rgba(255,61,242,0.1)'], controlBg: 'rgba(18,16,35,0.82)', controlText: '#f8f7ff', frameBorder: 'rgba(102,232,255,0.58)', radius: 20 },
  pastel: { background: '#fff7f4', panel: 'rgba(255,253,251,0.96)', text: '#4d4542', muted: '#9a8583', accent: '#c9768b', tileBg: '#fffdfb', overlay: ['rgba(255,247,244,0.94)', 'rgba(213,180,220,0.24)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#4d4542', frameBorder: 'rgba(201,118,139,0.36)', radius: 24 },
  pop: { background: '#ffe84a', panel: 'rgba(255,253,243,0.96)', text: '#231f20', muted: '#5b4b3d', accent: '#ef2b3a', tileBg: '#ffffff', overlay: ['rgba(255,232,74,0.94)', 'rgba(0,128,255,0.14)'], controlBg: 'rgba(255,253,243,0.92)', controlText: '#231f20', frameBorder: 'rgba(35,31,32,0.46)', radius: 18 },
  golden_years: { background: '#fbf4e6', panel: 'rgba(255,251,242,0.96)', text: '#3f2f22', muted: '#8b765e', accent: '#c99a2e', tileBg: '#fffaf0', overlay: ['rgba(251,244,230,0.94)', 'rgba(201,154,46,0.16)'], controlBg: 'rgba(255,251,242,0.9)', controlText: '#3f2f22', frameBorder: 'rgba(201,154,46,0.44)', radius: 20 },
  vintage: { background: '#0F0E0B', panel: 'rgba(28,24,18,0.96)', text: '#F2E7D2', muted: '#C7A96B', accent: '#B89145', tileBg: '#15130F', overlay: ['rgba(15,14,11,0.92)', 'rgba(184,145,69,0.12)'], controlBg: 'rgba(28,24,18,0.84)', controlText: '#F2E7D2', frameBorder: 'rgba(184,145,69,0.5)', radius: 2 },
  rose: { background: '#fff9f5', panel: 'rgba(255,252,247,0.96)', text: '#562733', muted: '#9a6c74', accent: '#b76578', tileBg: '#fffdfa', overlay: ['rgba(255,249,245,0.94)', 'rgba(183,101,120,0.16)'], controlBg: 'rgba(255,252,247,0.9)', controlText: '#562733', frameBorder: 'rgba(183,101,120,0.38)', radius: 28 },
  minimal_love: { background: '#f7efe4', panel: 'rgba(255,250,242,0.96)', text: '#3b2618', muted: '#8a7461', accent: '#6d4b34', tileBg: '#fffaf2', overlay: ['rgba(247,239,228,0.94)', 'rgba(109,75,52,0.12)'], controlBg: 'rgba(255,250,242,0.9)', controlText: '#3b2618', frameBorder: 'rgba(109,75,52,0.34)', radius: 24 },
  bohemian: { background: '#fff7ed', panel: 'rgba(255,247,237,0.96)', text: '#431407', muted: '#9a3412', accent: '#fb923c', tileBg: '#ffffff', overlay: ['rgba(255,247,237,0.94)', 'rgba(251,146,60,0.16)'], controlBg: 'rgba(255,247,237,0.9)', controlText: '#431407', frameBorder: 'rgba(251,146,60,0.42)', radius: 22 },
  diamond: { background: '#f0f9ff', panel: 'rgba(255,255,255,0.96)', text: '#0c4a6e', muted: '#0369a1', accent: '#0284c7', tileBg: '#ffffff', overlay: ['rgba(240,249,255,0.94)', 'rgba(2,132,199,0.14)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#0c4a6e', frameBorder: 'rgba(2,132,199,0.36)', radius: 15 },
  blush: { background: '#fff7ed', panel: 'rgba(255,255,255,0.96)', text: '#7c2d12', muted: '#9a3412', accent: '#ea580c', tileBg: '#ffffff', overlay: ['rgba(255,247,237,0.94)', 'rgba(234,88,12,0.14)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#7c2d12', frameBorder: 'rgba(234,88,12,0.38)', radius: 10 },
  garden: { background: '#E5ECE9', panel: 'rgba(253,251,247,0.96)', text: '#1A3322', muted: '#4D6D53', accent: '#2E6F40', tileBg: '#FDFBF7', overlay: ['rgba(229,236,233,0.94)', 'rgba(46,111,64,0.14)'], controlBg: 'rgba(253,251,247,0.9)', controlText: '#1A3322', frameBorder: 'rgba(46,111,64,0.36)', radius: 22 },
  midnight_glam: { background: '#050505', panel: 'rgba(15,23,42,0.94)', text: '#f8fafc', muted: '#94a3b8', accent: '#3b82f6', tileBg: '#101010', overlay: ['rgba(2,6,23,0.94)', 'rgba(59,130,246,0.16)'], controlBg: 'rgba(15,23,42,0.84)', controlText: '#f8fafc', frameBorder: 'rgba(59,130,246,0.48)', radius: 8 },
  cinematic: { background: '#000000', panel: 'rgba(17,17,17,0.94)', text: '#ffffff', muted: '#a3a3a3', accent: '#ef4444', tileBg: '#111111', overlay: ['rgba(0,0,0,0.94)', 'rgba(239,68,68,0.1)'], controlBg: 'rgba(17,17,17,0.84)', controlText: '#ffffff', frameBorder: 'rgba(239,68,68,0.45)', radius: 4 },
  modern_lounge: { background: '#f8fafc', panel: 'rgba(255,255,255,0.96)', text: '#101010', muted: '#64748b', accent: '#818cf8', tileBg: '#ffffff', overlay: ['rgba(248,250,252,0.94)', 'rgba(129,140,248,0.14)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#101010', frameBorder: 'rgba(129,140,248,0.36)', radius: 2 },
  elegant_night: { background: '#111111', panel: 'rgba(26,26,26,0.94)', text: '#ffffff', muted: '#cccccc', accent: '#ffffff', tileBg: '#111111', overlay: ['rgba(17,17,17,0.94)', 'rgba(255,255,255,0.08)'], controlBg: 'rgba(26,26,26,0.84)', controlText: '#ffffff', frameBorder: 'rgba(255,255,255,0.32)', radius: 2 },
  museum: { background: '#f3f0ea', panel: 'rgba(255,255,252,0.96)', text: '#17202b', muted: '#66717d', accent: '#9b7a44', tileBg: '#fffffc', overlay: ['rgba(243,240,234,0.94)', 'rgba(155,122,68,0.14)'], controlBg: 'rgba(255,255,252,0.9)', controlText: '#17202b', frameBorder: 'rgba(155,122,68,0.38)', radius: 22 },
  brutalist: { background: '#efede7', panel: 'rgba(255,255,250,0.96)', text: '#111113', muted: '#62625d', accent: '#1a1a1c', tileBg: '#fffffa', overlay: ['rgba(239,237,231,0.94)', 'rgba(26,26,28,0.12)'], controlBg: 'rgba(255,255,250,0.9)', controlText: '#111113', frameBorder: 'rgba(26,26,28,0.34)', radius: 14 },
  tech_sleek: { background: '#050b17', panel: 'rgba(8,15,30,0.94)', text: '#f8fafc', muted: '#cbd5e1', accent: '#22d3ee', tileBg: '#080f1e', overlay: ['rgba(5,11,23,0.94)', 'rgba(34,211,238,0.14)'], controlBg: 'rgba(8,15,30,0.84)', controlText: '#f8fafc', frameBorder: 'rgba(34,211,238,0.54)', radius: 22 },
  executive: { background: '#08111f', panel: 'rgba(245,237,220,0.96)', text: '#f5eddc', muted: '#d4b474', accent: '#d4b474', tileBg: '#f5eddc', overlay: ['rgba(8,17,31,0.94)', 'rgba(212,180,116,0.14)'], controlBg: 'rgba(8,17,31,0.84)', controlText: '#f5eddc', frameBorder: 'rgba(212,180,116,0.5)', radius: 18 },
  polaroid: { background: '#f8f3e7', panel: 'rgba(255,250,240,0.96)', text: '#1f2937', muted: '#78716c', accent: '#b45309', tileBg: '#ffffff', overlay: ['rgba(248,243,231,0.94)', 'rgba(180,83,9,0.12)'], controlBg: 'rgba(255,250,240,0.9)', controlText: '#1f2937', frameBorder: 'rgba(180,83,9,0.38)', radius: 2 },
  editorial: { background: '#fafaf9', panel: 'rgba(255,255,255,0.96)', text: '#111827', muted: '#57534e', accent: '#111827', tileBg: '#e7e5e4', overlay: ['rgba(250,250,249,0.94)', 'rgba(17,24,39,0.1)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#111827', frameBorder: 'rgba(17,24,39,0.32)', radius: 2 },
  vibrant: { background: '#f5f3ff', panel: 'rgba(255,255,255,0.96)', text: '#4c1d95', muted: '#7c3aed', accent: '#8b5cf6', tileBg: '#ffffff', overlay: ['rgba(245,243,255,0.94)', 'rgba(139,92,246,0.16)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#4c1d95', frameBorder: 'rgba(139,92,246,0.4)', radius: 15 },
  zen: { background: '#f5f5f4', panel: 'rgba(255,255,255,0.96)', text: '#44403c', muted: '#78716c', accent: '#57534e', tileBg: '#ffffff', overlay: ['rgba(245,245,244,0.94)', 'rgba(87,83,78,0.1)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#44403c', frameBorder: 'rgba(87,83,78,0.32)', radius: 28 },
  cyber_tech: { background: '#05070c', panel: 'rgba(9,16,30,0.94)', text: '#e2eafc', muted: '#8ea8db', accent: '#00f0ff', tileBg: '#060a14', overlay: ['rgba(5,7,12,0.94)', 'rgba(0,240,255,0.14)'], controlBg: 'rgba(9,16,30,0.84)', controlText: '#e2eafc', frameBorder: 'rgba(0,240,255,0.54)', radius: 8 },
  retro_arcade: { background: '#ffde4a', panel: 'rgba(255,255,255,0.96)', text: '#231f20', muted: '#5b4b3d', accent: '#ff3562', tileBg: '#ffffff', overlay: ['rgba(255,222,74,0.94)', 'rgba(255,53,98,0.16)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#231f20', frameBorder: 'rgba(35,31,32,0.44)', radius: 18 },
  academic_editorial: { background: '#FCFAF7', panel: 'rgba(255,255,255,0.96)', text: '#1C1C1E', muted: '#636E72', accent: '#800020', tileBg: '#FFFFFF', overlay: ['rgba(252,250,247,0.94)', 'rgba(128,0,32,0.1)'], controlBg: 'rgba(255,255,255,0.9)', controlText: '#1C1C1E', frameBorder: 'rgba(128,0,32,0.34)', radius: 2 },
  neon_carnival: { background: '#06030a', panel: 'rgba(15,9,24,0.94)', text: '#faf5ff', muted: '#d8b4fe', accent: '#d946ef', tileBg: '#0b0612', overlay: ['rgba(6,3,10,0.94)', 'rgba(217,70,239,0.14)'], controlBg: 'rgba(15,9,24,0.84)', controlText: '#faf5ff', frameBorder: 'rgba(217,70,239,0.54)', radius: 24 },
};

const SPORTS_VIEWER_PALETTES: Record<string, ViewerPalette> = {
  bohemian: { ...VIEWER_TEMPLATE_PALETTES.bohemian, background: '#f5ead8', accent: '#c76633', frameBorder: 'rgba(199,102,51,0.44)' },
  diamond: { background: '#060a12', panel: 'rgba(10,18,32,0.94)', text: '#eef2f7', muted: '#b9d8f2', accent: '#7dd3fc', tileBg: '#0a1220', overlay: ['rgba(6,10,18,0.94)', 'rgba(96,165,250,0.2)'], controlBg: 'rgba(10,18,32,0.84)', controlText: '#eef2f7', frameBorder: 'rgba(125,211,252,0.52)', radius: 15 },
  blush: { ...VIEWER_TEMPLATE_PALETTES.blush, background: '#fff3ee', accent: '#d9796f', frameBorder: 'rgba(217,121,111,0.42)' },
  garden: { ...VIEWER_TEMPLATE_PALETTES.garden, background: '#e8eee5', accent: '#587c43', frameBorder: 'rgba(88,124,67,0.4)' },
  midnight_glam: { background: '#050508', panel: 'rgba(19,18,16,0.94)', text: '#fff7e6', muted: '#d6bf94', accent: '#cca43b', tileBg: '#15130f', overlay: ['rgba(5,5,8,0.94)', 'rgba(204,164,59,0.16)'], controlBg: 'rgba(19,18,16,0.84)', controlText: '#fff7e6', frameBorder: 'rgba(204,164,59,0.52)', radius: 8 },
  cinematic: VIEWER_TEMPLATE_PALETTES.cinematic,
  modern_lounge: { background: '#efe7dc', panel: 'rgba(255,250,242,0.96)', text: '#2b211b', muted: '#756353', accent: '#7a563b', tileBg: '#fffaf2', overlay: ['rgba(239,231,220,0.94)', 'rgba(122,86,59,0.14)'], controlBg: 'rgba(255,250,242,0.9)', controlText: '#2b211b', frameBorder: 'rgba(122,86,59,0.38)', radius: 2 },
  elegant_night: { background: '#07101f', panel: 'rgba(12,23,42,0.94)', text: '#f5eddc', muted: '#d4b474', accent: '#d4b474', tileBg: '#0b1628', overlay: ['rgba(7,16,31,0.94)', 'rgba(212,180,116,0.16)'], controlBg: 'rgba(12,23,42,0.84)', controlText: '#f5eddc', frameBorder: 'rgba(212,180,116,0.5)', radius: 2 },
  polaroid: { ...VIEWER_TEMPLATE_PALETTES.polaroid, background: '#f7efe1', accent: '#b45309' },
  editorial: VIEWER_TEMPLATE_PALETTES.editorial,
  vibrant: { background: '#08111f', panel: 'rgba(15,23,42,0.94)', text: '#f8fafc', muted: '#cbd5e1', accent: '#f97316', tileBg: '#101010', overlay: ['rgba(8,17,31,0.94)', 'rgba(249,115,22,0.18)'], controlBg: 'rgba(15,23,42,0.84)', controlText: '#f8fafc', frameBorder: 'rgba(249,115,22,0.5)', radius: 15 },
  zen: { ...VIEWER_TEMPLATE_PALETTES.zen, background: '#f1eee6', accent: '#66785f', frameBorder: 'rgba(102,120,95,0.36)' },
};

function ViewerVideo({ uri, frameBg }: { uri: string; frameBg: string }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      surfaceType="textureView"
      style={{ width: '100%', height: '100%', backgroundColor: frameBg }}
    />
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
}: PhotoViewerProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [likes, setLikes] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedProfileImage, setExpandedProfileImage] = useState<{ src: string; name: string } | null>(null);

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentPhotoIndex(initialIndex);
  }, [initialIndex]);

  const currentPhoto = photos[currentPhotoIndex];
  const isLiked = useMemo(() => likes.some((like) => like.userId === viewerIdentity.id), [likes, viewerIdentity.id]);
  const isVideoMedia = currentPhoto?.mediaType === 'video' || currentPhoto?.resourceType === 'video';

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
    // Reset commenting context on navigation
    setShowComments(false);
    setReplyingTo(null);
    setNewComment('');
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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.viewerContainer, { backgroundColor: viewerTheme.background }]}>
        <LinearGradient
          colors={viewerTheme.overlay as [string, string]}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 28,
            left: 18,
            right: 18,
            height: 1,
            backgroundColor: viewerTheme.frameBorder,
            opacity: 0.75,
          }}
        />
        <TouchableOpacity style={[styles.viewerClose, { backgroundColor: viewerTheme.controlBg, borderRadius: viewerTheme.radius }]} onPress={onClose}>
          <IconSymbol name="xmark" size={26} color={viewerTheme.controlText} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navBtnLeft, { backgroundColor: viewerTheme.controlBg, borderColor: viewerTheme.frameBorder, borderWidth: 1 }]} onPress={() => navigateViewer('prev')}>
          <IconSymbol name="chevron.left" size={32} color={viewerTheme.controlText} />
        </TouchableOpacity>

        {photos[currentPhotoIndex] && (
          <View
            style={[
              styles.fullImage,
              showComments && styles.fullImageWithComments,
              {
                backgroundColor: viewerTheme.tileBg,
                borderRadius: viewerTheme.radius,
                borderWidth: 1,
                borderColor: viewerTheme.frameBorder,
                overflow: 'hidden',
                width: '92%',
              },
            ]}
          >
            {isVideoMedia ? (
              <ViewerVideo key={photos[currentPhotoIndex].id || photos[currentPhotoIndex].url} uri={photos[currentPhotoIndex].url} frameBg={viewerTheme.tileBg} />
            ) : (
              <ExpoImage
                source={{ uri: getImageUrl(photos[currentPhotoIndex].url, { width: 900, quality: 75, format: 'webp' }, photos[currentPhotoIndex].thumbnailUrl) }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            )}
            {isDownloading && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' }}>Downloading original...</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={[styles.navBtnRight, { backgroundColor: viewerTheme.controlBg, borderColor: viewerTheme.frameBorder, borderWidth: 1 }]} onPress={() => navigateViewer('next')}>
          <IconSymbol name="chevron.right" size={32} color={viewerTheme.controlText} />
        </TouchableOpacity>

        <View style={[styles.viewerActions, showComments ? styles.viewerActionsRaised : styles.viewerActionsDocked]}>
          <TouchableOpacity style={styles.viewerAction} onPress={handleToggleLike} disabled={isLiking}>
            <IconSymbol name={isLiked ? "heart.fill" : "heart"} size={30} color={isLiked ? "#f43f5e" : viewerTheme.controlText} />
            <Text style={[styles.viewerActionCount, { color: viewerTheme.controlText }]}>{likes.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.viewerAction} onPress={() => setShowComments(true)}>
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

        {showComments && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.guestbookPanel, { backgroundColor: viewerTheme.panel, borderRadius: viewerTheme.radius + 10, borderWidth: 1, borderColor: viewerTheme.frameBorder }]}>
            <View style={[styles.guestbookHeader, { backgroundColor: viewerTheme.panel, borderBottomColor: viewerTheme.frameBorder }]}>
              <View>
                <Text style={[
                  styles.guestbookTitle,
                  { color: viewerTheme.text },
                  selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
                ]}>Guestbook</Text>
                <Text style={[
                  styles.guestbookSubtitle,
                  { color: viewerTheme.muted },
                  selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
                ]}>{comments.length} Shared Thoughts</Text>
              </View>
              <TouchableOpacity style={[styles.closeGuestbookBtn, { backgroundColor: viewerTheme.controlBg }]} onPress={() => setShowComments(false)}>
                <IconSymbol name="xmark" size={18} color={viewerTheme.controlText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.guestbookList} contentContainerStyle={styles.guestbookListContent}>
              {comments.length === 0 ? (
                <View style={styles.emptyGuestbook}>
                  <View style={styles.emptyGuestbookIcon}>
                    <IconSymbol name="bubble.right" size={30} color="#78716c" />
                  </View>
                  <Text style={[
                    styles.emptyGuestbookTitle,
                    selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic', fontSize: 18 }
                  ]}>No whispers yet...</Text>
                  <Text style={[
                    styles.emptyGuestbookText,
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

            <View style={styles.commentComposer}>
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
    </Modal>
  );
}

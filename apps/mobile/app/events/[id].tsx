import React, { useCallback, useEffect, useState } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Share, Keyboard, useWindowDimensions, useColorScheme, BackHandler, PanResponder, Animated as RNAnimated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path, Rect } from 'react-native-svg';
import { getEventById, getSubEvents, logGuestLogin, Event as DatabaseEvent, updateEvent, createEvent, getEventLogs, updateGuestStatus, updateGuestPermissions, deleteGuest, GuestLog, deleteEvent, getBusinessByVendorCode, getBusinessById, Business, updatePhotosOrder, updateSubEventsOrder, getEventPhotos, getEventPhotosPaginated, getRetainedMediaIdsForEventGrace, getUsers, UserProfile, removeGuestChatPermission, saveCoverUsagePhoto, deleteCoverUsagePhoto, getUserTotalStorage, generateEventJoinId, getFavouritePhotosForEvents } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../../constants/theme';
import { styles, FunkyFonts } from '../../components/eventStyles';
import PhotoViewer from '../../components/PhotoViewer';
import { MOBILE_TEMPLATE_THEMES, getDefaultTemplateForEventCategory } from '../../constants/templates';
import * as ImagePicker from 'expo-image-picker';
import { uploadEventImage, uploadEventMedia } from '@/lib/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { subscribeToUploadQueue, addToUploadQueue, retryUploadItem, cancelUploadItem, clearFinishedUploads, resetUploadQueue, UploadQueueItem } from '@/lib/uploadQueue';
import { VideoView, useVideoPlayer } from 'expo-video';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { supabase } from '@/lib/supabase';
import { getGridThumbnail } from '@/lib/imageUrl';
import { resolveEventCoverImage } from '@/lib/eventCovers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlanDetails, getUsagePercent } from '@/lib/planLimits';
import { getSubscriptionStatus } from '@/lib/subscriptionStatus';

// ── Extracted modular components ──
import { ThemeHeader } from '../../components/event/ThemeHeader';
import { ThemeDivider } from '../../components/event/ThemeDivider';
import { GatedAccessPanel } from '../../components/event/GatedAccessPanel';
import { RenameEventModal } from '../../components/event/modals/RenameEventModal';
import { SubEventModal } from '../../components/event/modals/SubEventModal';
import { TemplateSelectionModal } from '../../components/event/modals/TemplateSelectionModal';
import { GalleryDescriptionModal } from '../../components/event/modals/GalleryDescriptionModal';
import { useGuestAccess } from '../../hooks/useGuestAccess';
import { FindYouPanel } from '../../components/event/FindYouPanel';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GRID_GAP = 3;
const PHOTO_PAGE_SIZE = 20;
const FREE_PLAN_VIDEO_LIMIT_BYTES = 200 * 1024 * 1024;
const SPORTS_TEMPLATE_IDS = [
  'bohemian',
  'diamond',
  'blush',
  'garden',
  'midnight_glam',
  'cinematic',
  'modern_lounge',
  'elegant_night',
  'polaroid',
  'editorial',
  'vibrant',
  'zen',
];

const SPORTS_TEMPLATE_THEMES: Record<string, any> = {
  bohemian: {
    label: 'Bohemian Rhapsody',
    categoryLabel: 'Outdoor Sports Festival',
    noteLabel: 'Tournament Journal',
    galleryLabel: 'Field Highlights',
    galleryTitle: 'Tournament Memories',
    background: '#f5ead8',
    overlay: ['rgba(61, 37, 22, 0.64)', 'rgba(199, 102, 51, 0.2)', 'rgba(245, 234, 216, 1)'],
    card: 'rgba(255, 247, 235, 0.94)',
    text: '#2f241b',
    muted: '#755f4a',
    accent: '#c76633',
    accentAlt: '#4f7f75',
    imageFrame: '#fff7eb',
    darkControl: '#2f241b',
    headingFont: Fonts.playfair.bold,
  },
  diamond: {
    label: 'Diamond Shine',
    categoryLabel: 'Championship Night',
    noteLabel: 'Elite Match Brief',
    galleryLabel: 'Trophy Highlights',
    galleryTitle: 'Championship Frames',
    background: '#060a12',
    overlay: ['rgba(2, 6, 23, 0.9)', 'rgba(96, 165, 250, 0.22)', 'rgba(6, 10, 18, 1)'],
    card: 'rgba(238, 242, 247, 0.94)',
    text: '#06111f',
    muted: '#5b6b7f',
    accent: '#b9d8f2',
    accentAlt: '#7dd3fc',
    imageFrame: '#eef2f7',
    darkControl: '#06111f',
    headingFont: Fonts.spaceGrotesk.bold,
  },
  blush: {
    label: 'Blush & Bashful',
    categoryLabel: 'Soft Athletic Story',
    noteLabel: 'Match Note',
    galleryLabel: 'Warm Highlights',
    galleryTitle: 'Grace In Motion',
    background: '#fff3ee',
    overlay: ['rgba(74, 39, 37, 0.58)', 'rgba(220, 112, 95, 0.16)', 'rgba(255, 243, 238, 1)'],
    card: 'rgba(255, 250, 246, 0.95)',
    text: '#4a2725',
    muted: '#9a6b64',
    accent: '#d9796f',
    accentAlt: '#b4534d',
    imageFrame: '#fffaf6',
    darkControl: '#4a2725',
    headingFont: Fonts.cormorant.bold,
  },
  garden: {
    label: 'Garden Path',
    categoryLabel: 'Outdoor Tournament',
    noteLabel: 'Field Note',
    galleryLabel: 'Field Highlights',
    galleryTitle: 'Outdoor Moments',
    background: '#e8eee5',
    overlay: ['rgba(22, 53, 34, 0.68)', 'rgba(76, 111, 68, 0.16)', 'rgba(232, 238, 229, 1)'],
    card: 'rgba(253, 251, 247, 0.95)',
    text: '#1a3322',
    muted: '#526b50',
    accent: '#587c43',
    accentAlt: '#a06f37',
    imageFrame: '#fdfbf7',
    darkControl: '#1a3322',
    headingFont: Fonts.cormorant.bold,
  },
  midnight_glam: {
    label: 'Midnight Glam',
    categoryLabel: 'Night Stadium Event',
    noteLabel: 'Spotlight Brief',
    galleryLabel: 'Stadium Highlights',
    galleryTitle: 'Gold Medal Night',
    background: '#050508',
    overlay: ['rgba(5, 5, 8, 0.92)', 'rgba(204, 164, 59, 0.18)', 'rgba(5, 5, 8, 1)'],
    card: 'rgba(19, 18, 16, 0.9)',
    text: '#fff7e6',
    muted: '#d6bf94',
    accent: '#cca43b',
    accentAlt: '#f4d58d',
    imageFrame: '#15130f',
    darkControl: '#0a0a0c',
    headingFont: Fonts.playfair.bold,
  },
  cinematic: {
    label: 'Cinematic Noir',
    categoryLabel: 'Sports Documentary',
    noteLabel: 'Documentary Note',
    galleryLabel: 'Noir Highlights',
    galleryTitle: 'Frames Of The Game',
    background: '#0d0d0d',
    overlay: ['rgba(0, 0, 0, 0.92)', 'rgba(80, 80, 80, 0.18)', 'rgba(13, 13, 13, 1)'],
    card: 'rgba(245, 245, 245, 0.93)',
    text: '#121212',
    muted: '#5e5e5e',
    accent: '#d9d9d9',
    accentAlt: '#ef4444',
    imageFrame: '#f2f2f2',
    darkControl: '#121212',
    headingFont: Fonts.spaceGrotesk.bold,
  },
  modern_lounge: {
    label: 'Modern Lounge',
    categoryLabel: 'VIP Sports Lounge',
    noteLabel: 'Club Brief',
    galleryLabel: 'Private Highlights',
    galleryTitle: 'Lounge Moments',
    background: '#efe7dc',
    overlay: ['rgba(45, 31, 24, 0.7)', 'rgba(111, 78, 55, 0.18)', 'rgba(239, 231, 220, 1)'],
    card: 'rgba(255, 250, 242, 0.95)',
    text: '#2b211b',
    muted: '#756353',
    accent: '#7a563b',
    accentAlt: '#b89145',
    imageFrame: '#fffaf2',
    darkControl: '#2b211b',
    headingFont: Fonts.cormorant.bold,
  },
  elegant_night: {
    label: 'Elegant Night',
    categoryLabel: 'Evening Sports Gala',
    noteLabel: 'Evening Brief',
    galleryLabel: 'Night Highlights',
    galleryTitle: 'Elegant Match Night',
    background: '#07101f',
    overlay: ['rgba(7, 16, 31, 0.9)', 'rgba(212, 180, 116, 0.18)', 'rgba(7, 16, 31, 1)'],
    card: 'rgba(245, 237, 220, 0.95)',
    text: '#111827',
    muted: '#6b5b45',
    accent: '#d4b474',
    accentAlt: '#8aa4c8',
    imageFrame: '#f5eddc',
    darkControl: '#07101f',
    headingFont: Fonts.playfair.bold,
  },
  polaroid: {
    label: 'Vintage Polaroid',
    categoryLabel: 'Retro Sports Album',
    noteLabel: 'Film Roll Note',
    galleryLabel: 'Archive Highlights',
    galleryTitle: 'Vintage Match Prints',
    background: '#f7efe1',
    overlay: ['rgba(78, 52, 36, 0.64)', 'rgba(180, 83, 9, 0.16)', 'rgba(247, 239, 225, 1)'],
    card: 'rgba(255, 250, 240, 0.96)',
    text: '#3f2a1e',
    muted: '#806653',
    accent: '#b45309',
    accentAlt: '#9f3f32',
    imageFrame: '#fffaf0',
    darkControl: '#3f2a1e',
    headingFont: Fonts.playfair.bold,
  },
  editorial: {
    label: 'Editorial Mag',
    categoryLabel: 'Sports Magazine Feature',
    noteLabel: 'Editor Note',
    galleryLabel: 'Feature Story',
    galleryTitle: 'The Match Issue',
    background: '#fafaf7',
    overlay: ['rgba(17, 24, 39, 0.72)', 'rgba(17, 24, 39, 0.14)', 'rgba(250, 250, 247, 1)'],
    card: 'rgba(255, 255, 255, 0.96)',
    text: '#111827',
    muted: '#57534e',
    accent: '#111827',
    accentAlt: '#b91c1c',
    imageFrame: '#ffffff',
    darkControl: '#111827',
    headingFont: Fonts.spaceGrotesk.bold,
  },
  vibrant: {
    label: 'Vibrant Energy',
    categoryLabel: 'High Energy Matchday',
    noteLabel: 'Energy Brief',
    galleryLabel: 'Momentum Highlights',
    galleryTitle: 'Game Day Rush',
    background: '#08111f',
    overlay: ['rgba(8, 17, 31, 0.84)', 'rgba(249, 115, 22, 0.22)', 'rgba(8, 17, 31, 1)'],
    card: 'rgba(248, 250, 252, 0.94)',
    text: '#101010',
    muted: '#475569',
    accent: '#f97316',
    accentAlt: '#84cc16',
    imageFrame: '#f8fafc',
    darkControl: '#101010',
    headingFont: Fonts.spaceGrotesk.bold,
  },
  zen: {
    label: 'Zen Garden',
    categoryLabel: 'Wellness Sports Event',
    noteLabel: 'Calm Match Note',
    galleryLabel: 'Quiet Highlights',
    galleryTitle: 'Balanced Motion',
    background: '#f1eee6',
    overlay: ['rgba(64, 70, 55, 0.54)', 'rgba(120, 113, 108, 0.12)', 'rgba(241, 238, 230, 1)'],
    card: 'rgba(255, 252, 246, 0.95)',
    text: '#44403c',
    muted: '#78716c',
    accent: '#66785f',
    accentAlt: '#b89b6a',
    imageFrame: '#fffaf2',
    darkControl: '#44403c',
    headingFont: Fonts.cormorant.bold,
  },
};

const getSportsTemplateTheme = (templateId?: string) => SPORTS_TEMPLATE_THEMES[templateId || ''] || SPORTS_TEMPLATE_THEMES.bohemian;

const isVideoMedia = (item: any) => item?.mediaType === 'video' || item?.resourceType === 'video';
const isPhotoMedia = (item: any) => !isVideoMedia(item);
const isFreePlanRole = (role?: string | null) => {
  const normalizedRole = String(role || 'user').toLowerCase();
  return normalizedRole === 'user' || normalizedRole === 'free' || normalizedRole === 'freemium';
};

function formatEventDisplayDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeEventDate(value?: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return trimmed;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const parsedSlashDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsedSlashDate.getTime())) return formatEventDisplayDate(parsedSlashDate);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  return formatEventDisplayDate(parsed);
}

function parseEventDateValue(value?: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return new Date();

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return new Date();
}

function ExpiredMediaThumbnailNotice() {
  return (
    <View pointerEvents="none" style={localStyles.expiredMediaThumbnailNotice}>
      <Text style={localStyles.expiredMediaThumbnailTitle}>Plan expired</Text>
      <Text style={localStyles.expiredMediaThumbnailSubtitle}>May be deleted after grace period</Text>
    </View>
  );
}

function GalleryThumbnailImage({
  url,
  thumbnailUrl,
  style,
  blurRadius = 0,
}: {
  url?: string;
  thumbnailUrl?: string | null;
  style: any;
  blurRadius?: number;
}) {
  const resolvedThumbnailUrl = React.useMemo(() => getGridThumbnail(url, thumbnailUrl), [url, thumbnailUrl]);
  const [sourceUri, setSourceUri] = useState(resolvedThumbnailUrl || url || '');

  useEffect(() => {
    setSourceUri(resolvedThumbnailUrl || url || '');
  }, [resolvedThumbnailUrl, url]);

  if (!sourceUri) {
    return <View style={[style, { backgroundColor: 'rgba(15,23,42,0.9)' }]} />;
  }

  return (
    <ExpoImage
      source={{ uri: sourceUri }}
      style={style}
      contentFit="cover"
      blurRadius={blurRadius}
      onError={() => {
        // Do not fall back to original url
      }}
    />
  );
}

function GalleryVideoCard({
  video,
  accent = '#d4af37',
  onOpen,
  compact = false,
  blurred = false,
}: {
  video: any;
  accent?: string;
  onOpen?: () => void;
  compact?: boolean;
  blurred?: boolean;
}) {
  const player = useVideoPlayer(video.url, (player) => {
    player.loop = false;
    player.muted = compact;
  });

  return (
    <View style={{
      borderRadius: compact ? 10 : 18,
      overflow: 'hidden',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderWidth: 1,
      borderColor: `${accent}55`,
      marginBottom: compact ? 0 : 16,
      ...(compact ? { width: '100%', height: '100%' } : {}),
    }}>
      <View style={{ position: 'relative', backgroundColor: '#050505', flex: compact ? 1 : undefined }}>
        <VideoView
          player={player}
          nativeControls={!compact}
          contentFit={compact ? "cover" : "contain"}
          surfaceType="textureView"
          style={[
            compact ? { width: '100%', height: '100%', backgroundColor: '#050505' } : { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#050505' },
            blurred && { opacity: 0.42 },
          ]}
        />
        {onOpen && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onOpen}
            style={{
              position: 'absolute',
              top: compact ? 0 : 10,
              right: compact ? 0 : 10,
              bottom: compact ? 0 : undefined,
              left: compact ? 0 : undefined,
              minHeight: compact ? undefined : 34,
              borderRadius: compact ? 0 : 17,
              paddingHorizontal: compact ? 0 : 12,
              backgroundColor: compact ? 'rgba(2, 6, 23, 0.26)' : 'rgba(2, 6, 23, 0.78)',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              borderWidth: compact ? 0 : 1,
              borderColor: `${accent}88`,
            }}
          >
            {compact ? (
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(2, 6, 23, 0.82)',
                borderWidth: 1,
                borderColor: `${accent}99`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IconSymbol name="play.fill" size={16} color={accent} />
              </View>
            ) : (
              <>
                <IconSymbol name="arrow.up.right" size={13} color={accent} />
                <Text style={{ color: accent, fontSize: 11, fontFamily: Fonts.inter.bold }}>
                  Large View
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {blurred && <ExpiredMediaThumbnailNotice />}
      </View>
      {!compact && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <IconSymbol name="play.fill" size={15} color={accent} />
          <Text style={{ flex: 1, color: '#e2e8f0', fontSize: 12, fontFamily: Fonts.inter.semiBold }} numberOfLines={1}>
            {video.title || 'Uploaded video'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [tempCoverOffset, setTempCoverOffset] = useState(0);
  const [tempCoverScale, setTempCoverScale] = useState(1.0);
  const offsetRef = React.useRef(0);
  const scaleRef = React.useRef(1.0);

  useEffect(() => {
    offsetRef.current = tempCoverOffset;
  }, [tempCoverOffset]);

  useEffect(() => {
    scaleRef.current = tempCoverScale;
  }, [tempCoverScale]);
  const { width } = useWindowDimensions();
  const { id, shared, guestView, tab, share, mode } = useLocalSearchParams<{ id: string; shared?: string; guestView?: string; tab?: string; share?: string; mode?: 'admin' | 'visitor' }>();
  const router = useRouter();
  const { user } = useAuth();
  const subscriptionStatus = React.useMemo(() => getSubscriptionStatus({
    role: user?.role,
    planStartDate: user?.planStartDate,
    planEndDate: user?.planEndDate,
  }), [user?.role, user?.planStartDate, user?.planEndDate]);

  const [scrollY, setScrollY] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const normalizePhoneValue = useCallback((value?: string | null) => {
    return (value || '').replace(/\D/g, '');
  }, []);

  const normalizeEmailValue = useCallback((value?: string | null) => {
    return (value || '').trim().toLowerCase();
  }, []);

  const [event, setEvent] = useState<DatabaseEvent | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<GuestLog | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GuestLog | null>(null);
  const [selectedGuestProfile, setSelectedGuestProfile] = useState<UserProfile | null>(null);
  const [loadingGuestProfile, setLoadingGuestProfile] = useState(false);
  const [showGuestInfo, setShowGuestInfo] = useState(false);
  const [selectedRequestProfile, setSelectedRequestProfile] = useState<UserProfile | null>(null);
  const [loadingRequestProfile, setLoadingRequestProfile] = useState(false);
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [subEvents, setSubEvents] = useState<DatabaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestStatus, setGuestStatus] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submittedIdentifier, setSubmittedIdentifier] = useState<string | null>(null);

  const [isOwner, setIsOwner] = useState(false);
  const [isSharedEventAdmin, setIsSharedEventAdmin] = useState(false);

  const isAccountEventManager = React.useMemo(() => {
    if (!user || !event) return false;
    return (
      user.role === 'admin' ||
      user.uid === event.createdBy ||
      (user.roleType === 'primary' && user.delegatedBy === event.createdBy)
    );
  }, [user, event]);

  const canManageEvent = isAccountEventManager || isSharedEventAdmin;

  const isPrivilegedViewer = React.useMemo(() => {
    if (!user || !event) return false;
    return (
      canManageEvent ||
      !!user.assignedEvents?.some((eventId) =>
        eventId === event.id ||
        eventId === event.legacyId ||
        eventId === event.parentId
      )
    );
  }, [user, event, canManageEvent]);

  useEffect(() => {
    let isActive = true;

    const loadSelectedGuestProfile = async () => {
      if (!selectedGuest) {
        setSelectedGuestProfile(null);
        setShowGuestInfo(false);
        return;
      }

      setLoadingGuestProfile(true);
      try {
        const users = await getUsers();
        const guestEmail = normalizeEmailValue(selectedGuest.email || selectedGuest.phone);
        const guestPhone = normalizePhoneValue(selectedGuest.phone);
        const profile = users.find((candidate) => {
          const candidateEmail = normalizeEmailValue(candidate.email);
          const candidatePhone = normalizePhoneValue(candidate.phone);
          return (
            (!!guestEmail && guestEmail === candidateEmail) ||
            (!!guestPhone && guestPhone === candidatePhone)
          );
        }) || null;

        if (isActive) {
          setSelectedGuestProfile(profile);
        }
      } catch (error) {
        console.error('Error loading selected guest profile:', error);
        if (isActive) {
          setSelectedGuestProfile(null);
        }
      } finally {
        if (isActive) {
          setLoadingGuestProfile(false);
        }
      }
    };

    loadSelectedGuestProfile();

    return () => {
      isActive = false;
    };
  }, [normalizeEmailValue, normalizePhoneValue, selectedGuest]);

  useEffect(() => {
    let isActive = true;

    const loadSelectedRequestProfile = async () => {
      if (!selectedRequest) {
        setSelectedRequestProfile(null);
        setShowRequestInfo(false);
        return;
      }

      setLoadingRequestProfile(true);
      try {
        const users = await getUsers();
        const requestEmail = normalizeEmailValue(selectedRequest.email || selectedRequest.phone);
        const requestPhone = normalizePhoneValue(selectedRequest.phone);
        const profile = users.find((candidate) => {
          const candidateEmail = normalizeEmailValue(candidate.email);
          const candidatePhone = normalizePhoneValue(candidate.phone);
          return (
            (!!requestEmail && requestEmail === candidateEmail) ||
            (!!requestPhone && requestPhone === candidatePhone)
          );
        }) || null;

        if (isActive) {
          setSelectedRequestProfile(profile);
        }
      } catch (error) {
        console.error('Error loading selected request profile:', error);
        if (isActive) {
          setSelectedRequestProfile(null);
        }
      } finally {
        if (isActive) {
          setLoadingRequestProfile(false);
        }
      }
    };

    loadSelectedRequestProfile();

    return () => {
      isActive = false;
    };
  }, [normalizeEmailValue, normalizePhoneValue, selectedRequest]);

  const canViewContent = isOwner || isPrivilegedViewer || guestStatus === 'approved';
  const isFreePlanUser = !user?.delegatedBy && isFreePlanRole(user?.role);

  const [activeTab, setActiveTab] = useState<'galleries' | 'permissions' | 'design' | 'partners'>((tab as any) || 'galleries');
  const [linkingVendor, setLinkingVendor] = useState(false);
  const [vendorCode, setVendorCode] = useState('');
  const [linkedVendors, setLinkedVendors] = useState<Business[]>([]);
  const [guestLogs, setGuestLogs] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [coverUploadMessage, setCoverUploadMessage] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [showUploadCompleteModal, setShowUploadCompleteModal] = useState(false);
  const [mobileIndexingStatus, setMobileIndexingStatus] = useState<any>(null);
  const [showUploadFailedModal, setShowUploadFailedModal] = useState(false);
  const prevActiveCountRef = React.useRef(0);
  const completedIdsRef = React.useRef<string[]>([]);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';


  // Decide which view to show
  // We show Admin view only when the route asks for it and the current user can manage this event.
  // Otherwise, we default to the premium Visitor view.
  const [isAdminViewActive, setIsAdminViewActive] = useState(mode === 'admin');
  const showAdminView = isAdminViewActive && canManageEvent;

  // Theme colors are intentionally FIXED to the light palette for the visitor event view —
  // the selected template must look the same regardless of the device OS dark/light setting.
  // Only the admin back-office (which locks to the 'hero'/Midnight theme) follows the OS scheme.
  const isThemeDark = showAdminView && isDark;

  const selectedTemplate = React.useMemo(() => {
    // If we are in Admin/Management View, we ALWAYS lock the palette to the default 'hero' (Midnight theme)
    // to keep the back-office controls consistent and standard for the app shell.
    const activeTemplateId = showAdminView ? 'hero' : (event?.templateId || 'hero');
    const base = MOBILE_TEMPLATE_THEMES.find((theme) => theme.id === activeTemplateId) || MOBILE_TEMPLATE_THEMES[0];
    const isClassic = base.id === 'classic';
    const isHero = base.id === 'hero';
    const isEthereal = base.id === 'ethereal';
    const isAcademicEditorial = base.id === 'academic_editorial';
    const isGarden = base.id === 'garden';
    const isBohemian = base.id === 'bohemian';
    const isMuseum = base.id === 'museum';
    const isBrutalist = base.id === 'brutalist';
    const isTechSleek = base.id === 'tech_sleek';
    const isExecutive = base.id === 'executive';
    return {
      ...base,
      background: isThemeDark ? base.background.dark : base.background.light,
      panel: isThemeDark ? base.panel.dark : base.panel.light,
      text: isThemeDark ? base.text.dark : base.text.light,
      muted: isThemeDark ? base.muted.dark : base.muted.light,
      accentBg: isThemeDark ? base.accentBg.dark : base.accentBg.light,
      tileBg: isThemeDark ? base.tileBg.dark : base.tileBg.light,
      overlay: isThemeDark ? base.overlay.dark : base.overlay.light,
      serifFont: isExecutive ? Fonts.cormorant.regular : (isBohemian ? Fonts.cinzel.bold : (isGarden ? Fonts.cormorant.regular : ((isClassic || isHero || isEthereal || isAcademicEditorial) ? Fonts.playfair.regular : Fonts.serif))),
      serifItalic: isExecutive ? Fonts.cormorant.italic : (isBohemian ? Fonts.cinzel.bold : (isGarden ? Fonts.cormorant.italic : ((isClassic || isHero || isEthereal || isAcademicEditorial) ? Fonts.playfair.italic : Fonts.serif))),
      serifBold: isExecutive ? Fonts.cormorant.bold : (isBohemian ? Fonts.cinzel.bold : (isGarden ? Fonts.cormorant.bold : ((isClassic || isHero || isEthereal || isAcademicEditorial) ? Fonts.playfair.bold : Fonts.serif))),
      bodyFont: (isMuseum || isBrutalist || isTechSleek || isExecutive) ? Fonts.inter.regular : (isBohemian ? Fonts.cinzel.regular : (isGarden ? Fonts.lora.regular : (base.useSerif ? Fonts.serif : Fonts.sans))),
      bodyMedium: (isMuseum || isBrutalist || isTechSleek || isExecutive) ? Fonts.inter.semiBold : (isBohemian ? Fonts.cinzel.bold : (isGarden ? Fonts.lora.semiBold : (base.useSerif ? Fonts.serif : Fonts.sans))),
      bodyBold: (isMuseum || isBrutalist || isTechSleek) ? Fonts.spaceGrotesk.bold : (isExecutive ? Fonts.inter.semiBold : (isBohemian ? Fonts.cinzel.bold : (isGarden ? Fonts.lora.bold : (base.useSerif ? Fonts.serif : Fonts.sans)))),
    };
  }, [event?.templateId, isThemeDark, showAdminView]);

  const isSportsTemplate = !showAdminView && event?.category === 'Sports' && SPORTS_TEMPLATE_IDS.includes(event?.templateId || '');
  const sportsTheme = React.useMemo(() => getSportsTemplateTheme(event?.templateId), [event?.templateId]);
  const pageBackground = isSportsTemplate ? sportsTheme.background : selectedTemplate.background;

  const heroHeight = showAdminView
    ? 400
    : isSportsTemplate
      ? 555 + insets.top
    : event?.templateId === 'royal' || event?.templateId === 'classic' || event?.templateId === 'hero'
      ? windowHeight
      : event?.templateId === 'ethereal'
        ? windowHeight * 0.8
        : event?.templateId === 'academic_editorial'
          ? windowHeight * 0.75
          : event?.templateId === 'garden'
            ? windowHeight * 0.42
            : event?.templateId === 'bohemian'
              ? 555 + insets.top
              : event?.templateId === 'museum'
                ? 560 + insets.top
                : event?.templateId === 'brutalist'
                  ? 545 + insets.top
                  : event?.templateId === 'tech_sleek'
                    ? 550 + insets.top
                    : event?.templateId === 'executive'
                      ? 540 + insets.top
              : event?.templateId === 'golden_years'
                ? 540 + insets.top
                : event?.templateId === 'rose'
                  ? 560 + insets.top
                  : event?.templateId === 'vintage'
                    ? 500 + insets.top
                    : event?.templateId === 'minimal_love'
                      ? 455 + insets.top
                      : event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade'
                        ? SCREEN_WIDTH * 1.33 + 180 + insets.top
                        : event?.templateId === 'pop' || event?.templateId === 'neon_carnival'
                          ? 465 + insets.top
                          : 400;
  const isScrapbookTemplate = !showAdminView && event?.templateId === 'scrapbook';
  const isNeonTemplate = !showAdminView && event?.templateId === 'neon';
  const isPastelTemplate = !showAdminView && event?.templateId === 'pastel';
  const isPopTemplate = !showAdminView && event?.templateId === 'pop';
  const isGoldenYearsTemplate = !showAdminView && event?.templateId === 'golden_years';
  const isVintageTemplate = !showAdminView && event?.templateId === 'vintage';
  const isRoseTemplate = !showAdminView && event?.templateId === 'rose';
  const isMinimalLoveTemplate = !showAdminView && event?.templateId === 'minimal_love';
  const isAnniversaryTemplate = isGoldenYearsTemplate || isVintageTemplate || isRoseTemplate || isMinimalLoveTemplate;
  const isEtherealTemplate = !showAdminView && event?.templateId === 'ethereal';
  const isCyberTechTemplate = !showAdminView && event?.templateId === 'cyber_tech';
  const isRetroArcadeTemplate = !showAdminView && event?.templateId === 'retro_arcade';
  const isAcademicEditorialTemplate = !showAdminView && event?.templateId === 'academic_editorial';
  const isNeonCarnivalTemplate = !showAdminView && event?.templateId === 'neon_carnival';
  const isGardenTemplate = !showAdminView && event?.templateId === 'garden' && !isSportsTemplate;
  const isBohemianTemplate = !showAdminView && event?.templateId === 'bohemian' && !isSportsTemplate;
  const isMuseumTemplate = !showAdminView && event?.templateId === 'museum';
  const isBrutalistTemplate = !showAdminView && event?.templateId === 'brutalist';
  const isTechSleekTemplate = !showAdminView && event?.templateId === 'tech_sleek';
  const isExecutiveTemplate = !showAdminView && event?.templateId === 'executive';

  const [tempCoverOffsetX, setTempCoverOffsetX] = useState(0);
  const offsetXRef = React.useRef(0);

  useEffect(() => {
    offsetXRef.current = tempCoverOffsetX;
  }, [tempCoverOffsetX]);

  const panResponder = React.useMemo(() => {
    let startOffsetY = 0;
    let startOffsetX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startOffsetY = offsetRef.current;
        startOffsetX = offsetXRef.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Vertical offset has a base limit of 50, and scales with scaleFactor
        const limitY = 50 + (heroHeight * scaleRef.current - heroHeight) / 2;
        // Horizontal offset limit is strictly determined by extra width of scaling factor
        const limitX = (SCREEN_WIDTH * scaleRef.current - SCREEN_WIDTH) / 2;

        const nextOffsetY = Math.min(Math.max(startOffsetY + gestureState.dy, -limitY), limitY);
        const nextOffsetX = Math.min(Math.max(startOffsetX + gestureState.dx, -limitX), limitX);

        setTempCoverOffset(nextOffsetY);
        setTempCoverOffsetX(nextOffsetX);
      },
      onPanResponderRelease: () => {}
    });
  }, [heroHeight]);

  // Modals
  const [showSubEventModal, setShowSubEventModal] = useState(false);

  // Bohemian theme playback states and animations
  const [isBohemianPlaying, setIsBohemianPlaying] = useState(true);
  const bohemianRotation = React.useRef(new RNAnimated.Value(0)).current;
  const bohemianPulse = React.useRef(new RNAnimated.Value(1)).current;
  const bohemianPulseWave = React.useRef(new RNAnimated.Value(0)).current;
  const bohemianEq1 = React.useRef(new RNAnimated.Value(1)).current;
  const bohemianEq2 = React.useRef(new RNAnimated.Value(1)).current;
  const bohemianEq3 = React.useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    let rotationAnimation: RNAnimated.CompositeAnimation | null = null;
    let pulseAnimation: RNAnimated.CompositeAnimation | null = null;
    let pulseWaveAnimation: RNAnimated.CompositeAnimation | null = null;
    let eqAnimations: RNAnimated.CompositeAnimation[] = [];

    if (isBohemianPlaying && !showAdminView) {
      // Rotation animation loop
      rotationAnimation = RNAnimated.loop(
        RNAnimated.timing(bohemianRotation, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
          isInteraction: false,
        })
      );
      rotationAnimation.start();

      // Pulse animation loop for vinyl sleeve cover
      pulseAnimation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(bohemianPulse, {
            toValue: 1.03,
            duration: 1000,
            useNativeDriver: true,
            isInteraction: false,
          }),
          RNAnimated.timing(bohemianPulse, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ])
      );
      pulseAnimation.start();

      // Pulse wave ring loop
      pulseWaveAnimation = RNAnimated.loop(
        RNAnimated.timing(bohemianPulseWave, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
          isInteraction: false,
        })
      );
      pulseWaveAnimation.start();

      // Equalizer bars animations
      const startEqLoop = (val: RNAnimated.Value, minVal: number, maxVal: number, speed: number) => {
        const anim = RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.timing(val, {
              toValue: maxVal,
              duration: speed,
              useNativeDriver: true,
              isInteraction: false,
            }),
            RNAnimated.timing(val, {
              toValue: minVal,
              duration: speed,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ])
        );
        anim.start();
        eqAnimations.push(anim);
      };

      startEqLoop(bohemianEq1, 0.3, 1.2, 350);
      startEqLoop(bohemianEq2, 0.4, 1.4, 250);
      startEqLoop(bohemianEq3, 0.2, 1.0, 450);
    } else {
      // Stop animations
      bohemianRotation.stopAnimation();
      bohemianPulse.stopAnimation();
      bohemianPulseWave.stopAnimation();
      bohemianEq1.stopAnimation();
      bohemianEq2.stopAnimation();
      bohemianEq3.stopAnimation();

      // Reset values or smoothly transit them back
      RNAnimated.parallel([
        RNAnimated.timing(bohemianPulse, {
          toValue: 1.0,
          duration: 300,
          useNativeDriver: true,
        }),
        RNAnimated.timing(bohemianPulseWave, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        RNAnimated.timing(bohemianEq1, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        }),
        RNAnimated.timing(bohemianEq2, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        }),
        RNAnimated.timing(bohemianEq3, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (rotationAnimation) rotationAnimation.stop();
      if (pulseAnimation) pulseAnimation.stop();
      if (pulseWaveAnimation) pulseWaveAnimation.stop();
      eqAnimations.forEach(anim => anim.stop());
    };
  }, [isBohemianPlaying, showAdminView]);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDate, setNewSubDate] = useState(formatEventDisplayDate(new Date()));
  const [newSubDateValue, setNewSubDateValue] = useState(new Date());
  const [showSubDatePicker, setShowSubDatePicker] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTitleAlign, setEditTitleAlign] = useState<'left' | 'center' | 'right'>('left');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(share === 'true');
  const [showApproved, setShowApproved] = useState(false);

  const [activeSubEvent, setActiveSubEvent] = useState<DatabaseEvent | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [mediaTotals, setMediaTotals] = useState({ photos: 0, videos: 0 });
  const [storageStats, setStorageStats] = useState<{ used: number; limit: number; label: string; percent: number } | null>(null);
  const [retainedMediaIds, setRetainedMediaIds] = useState<Set<string>>(new Set());

  const fetchStorage = useCallback(async () => {
    if (!user?.uid || !showAdminView) return;
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.phone) identifiers.push(user.phone);
      const usage = await getUserTotalStorage(identifiers);
      const plan = getPlanDetails(user.role);
      const percent = getUsagePercent(usage, plan.storageBytes);
      setStorageStats({
        used: usage,
        limit: plan.storageBytes,
        label: plan.storageLabel,
        percent: percent / 100,
      });
    } catch (err) {
      console.error('[EventDetails] Error fetching storage stats:', err);
    }
  }, [user?.uid, user?.role, showAdminView]);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage, photos.length]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoPage, setPhotoPage] = useState(0);
  const [hasMorePhotos, setHasMorePhotos] = useState(false);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const [galleryMediaTab, setGalleryMediaTab] = useState<'photos' | 'videos'>('photos');
  const photoItems = React.useMemo(() => photos.filter(isPhotoMedia), [photos]);
  const videoItems = React.useMemo(() => photos.filter(isVideoMedia), [photos]);
  const displayedPhotoCount = mediaTotals.photos || photoItems.length;
  const displayedVideoCount = mediaTotals.videos || videoItems.length;
  const mediaTabs = React.useMemo<{ id: 'photos' | 'videos'; label: string }[]>(() => {
    return [
      { id: 'photos', label: `Photos (${displayedPhotoCount})` },
      { id: 'videos', label: `Videos (${displayedVideoCount})` },
    ];
  }, [displayedPhotoCount, displayedVideoCount]);
  const activeGalleryItems = galleryMediaTab === 'photos' ? photoItems : videoItems;
  const shouldWarnExpiredPlanMedia = subscriptionStatus.status === 'grace' && retainedMediaIds.size > 0;
  const shouldBlurMediaForPlan = useCallback((media: any) => {
    return shouldWarnExpiredPlanMedia && !!media?.id && !retainedMediaIds.has(media.id);
  }, [retainedMediaIds, shouldWarnExpiredPlanMedia]);

  // Gallery Welcome Text Settings State
  const [galleryDescModalVisible, setGalleryDescModalVisible] = useState(false);
  const [galleryDescText, setGalleryDescText] = useState('');

  // Admin Gallery Manager — which gallery is the host currently managing
  // null = Home gallery, DatabaseEvent = a sub-event gallery
  const [selectedAdminGallery, setSelectedAdminGallery] = useState<DatabaseEvent | null | undefined>(undefined);

  const currentActiveEvent = selectedAdminGallery !== undefined
    ? (selectedAdminGallery || event)
    : (activeSubEvent || event);
  const resolvedActiveCoverImage = resolveEventCoverImage(currentActiveEvent?.coverImage || event?.coverImage || (event as any)?.coverUrl, 'preview');

  const activeCoverMode = currentActiveEvent ? currentActiveEvent.coverMode : event?.coverMode;
  const activeCoverOffset = currentActiveEvent ? currentActiveEvent.coverOffset : event?.coverOffset;
  const activeCoverOffsetX = currentActiveEvent ? currentActiveEvent.coverOffsetX : event?.coverOffsetX;
  const activeCoverScale = currentActiveEvent ? currentActiveEvent.coverScale : event?.coverScale;

  // Image Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoActionItem, setPhotoActionItem] = useState<any | null>(null);

  const viewerIdentity = React.useMemo(() => user
    ? { id: user.uid, name: user.name || user.email?.split('@')[0] || 'User' }
    : { id: guestPhone || 'anonymous', name: guestName || 'Guest' }, [user, guestPhone, guestName]);

  const openViewer = (index: number) => {
    setCurrentPhotoIndex(index);
    setViewerVisible(true);
  };

  const doesGuestLogBelongToCurrentUser = useCallback((log: GuestLog) => {
    if (!user) return false;

    const userEmail = normalizeEmailValue(user.email);
    const userPhone = normalizePhoneValue(user.phone);
    const userUid = user.uid;
    const logEmail = normalizeEmailValue(log.email);
    const logPhone = normalizePhoneValue(log.phone);
    const logIdPrefix = log.id?.split('_')[0] || '';

    return (
      (!!userUid && (logIdPrefix === userUid || log.phone === userUid || log.email === userUid)) ||
      (!!userEmail && (logEmail === userEmail || normalizeEmailValue(logIdPrefix) === userEmail)) ||
      (!!userPhone && (logPhone === userPhone || normalizePhoneValue(logIdPrefix) === userPhone))
    );
  }, [normalizeEmailValue, normalizePhoneValue, user]);

  const loadEvent = async () => {
    setLoading(true);
    setIsSharedEventAdmin(false);
    const perfStart = Date.now();
    console.log('[PERF] Starting loadEvent fetching pipeline...');
    try {
      const eventData = await getEventById(id);
      if (eventData) {
        // Ensure joinId exists
        if (!eventData.joinId) {
          const shortId = generateEventJoinId(eventData.id);
          await updateEvent(eventData.id, { joinId: shortId });
          eventData.joinId = shortId;
        }

        if (!eventData.templateId) {
          const defaultTemplate = getDefaultTemplateForEventCategory(eventData.category);
          await updateEvent(eventData.id, { templateId: defaultTemplate.id });
          eventData.templateId = defaultTemplate.id;
        }

        const normalizedMainDate = normalizeEventDate(eventData.date);
        if (normalizedMainDate && normalizedMainDate !== eventData.date) {
          eventData.date = normalizedMainDate;
          updateEvent(eventData.id, { date: normalizedMainDate }).catch((err) => {
            console.error('[DateNormalize] Failed to update main event date:', err);
          });
        }

        const ownerAccess = user?.uid === eventData.createdBy;
        setEvent(eventData);
        setIsOwner(ownerAccess);

        // Fetch sub-events, vendors, guest logs, and photos concurrently
        const [subs, vendorsData, logs, photoDataResult, retainedIds] = await Promise.all([
          getSubEvents(id, eventData.legacyId),
          eventData.vendors && eventData.vendors.length > 0
            ? Promise.all(eventData.vendors.map((vid: string) => getBusinessById(vid)))
            : Promise.resolve([]),
          user
            ? getEventLogs(id)
            : Promise.resolve([]),
          getEventPhotosPaginated(eventData.id, eventData.legacyId, 0, PHOTO_PAGE_SIZE),
          getRetainedMediaIdsForEventGrace(eventData.id, eventData.legacyId),
        ]);

        const eventLogs = logs.filter(l => l.eventId === id || l.parentEventId === id);
        const hasSharedAdminAccess = !ownerAccess && eventLogs.some((log: GuestLog) =>
          log.status === 'approved' &&
          !!log.canAdmin &&
          doesGuestLogBelongToCurrentUser(log)
        );
        setIsSharedEventAdmin(hasSharedAdminAccess);

        const normalizedSubs = subs.map((sub) => ({
          ...sub,
          date: normalizeEventDate(sub.date) || sub.date,
        }));
        normalizedSubs.forEach((sub, index) => {
          if (sub.date !== subs[index].date) {
            updateEvent(sub.id, { date: sub.date }).catch((err) => {
              console.error('[DateNormalize] Failed to update sub-event date:', err);
            });
          }
        });

        setSubEvents(normalizedSubs);
        setLinkedVendors(vendorsData.filter(v => v !== null) as Business[]);
        setPhotos(photoDataResult.photos);
        setMediaTotals({ photos: photoDataResult.totalPhotos, videos: photoDataResult.totalVideos });
        setPhotoPage(0);
        setHasMorePhotos(photoDataResult.hasMore);
        setRetainedMediaIds(new Set(retainedIds));

        if (ownerAccess || hasSharedAdminAccess) {
          eventLogs
            .filter((log: any) => Object.prototype.hasOwnProperty.call(log, 'canChat'))
            .forEach((log: any) => {
              removeGuestChatPermission(log.id).catch((err) => {
                console.error('[Permissions] Failed to remove legacy chat permission:', err);
              });
            });
          setGuestLogs(eventLogs.map((log: any) => {
            const { canChat, ...rest } = log;
            return rest;
          }));
        }

        console.log(`[PERF] loadEvent pipeline completed in ${Date.now() - perfStart}ms`);
      }
    } catch (err) {
      console.error('[EventDetail] Load error:', err);
      setMediaTotals({ photos: 0, videos: 0 });
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async (eventId: string, legacyId?: string) => {
    setLoadingPhotos(true);
    const perfPhotosStart = Date.now();
    try {
      const [photoDataResult, retainedIds] = await Promise.all([
        getEventPhotosPaginated(eventId, legacyId, 0, PHOTO_PAGE_SIZE),
        getRetainedMediaIdsForEventGrace(eventId, legacyId),
      ]);
      setPhotos(photoDataResult.photos);
      setMediaTotals({ photos: photoDataResult.totalPhotos, videos: photoDataResult.totalVideos });
      setPhotoPage(0);
      setHasMorePhotos(photoDataResult.hasMore);
      setRetainedMediaIds(new Set(retainedIds));
      console.log(`[PERF] loadPhotos completed in ${Date.now() - perfPhotosStart}ms`);
    } catch (err) {
      console.error('[EventDetail] Photos load error:', err);
      setPhotos([]);
      setMediaTotals({ photos: 0, videos: 0 });
      setHasMorePhotos(false);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const getFavouriteEventIds = () => {
    if (!event) return [];
    return Array.from(new Set([event.id, event.legacyId, ...subEvents.map(sub => sub.id), ...subEvents.map(sub => sub.legacyId)].filter(Boolean) as string[]));
  };

  const loadFavouritePhotos = async () => {
    setLoadingPhotos(true);
    try {
      const favouritePhotos = await getFavouritePhotosForEvents(getFavouriteEventIds());
      const favouritePhotoCount = favouritePhotos.filter(isPhotoMedia).length;
      const favouriteVideoCount = favouritePhotos.filter(isVideoMedia).length;
      setPhotos(favouritePhotos);
      setMediaTotals({ photos: favouritePhotoCount, videos: favouriteVideoCount });
      setPhotoPage(0);
      setHasMorePhotos(false);
    } catch (err) {
      console.error('[EventDetail] Favourite photos load error:', err);
      setPhotos([]);
      setMediaTotals({ photos: 0, videos: 0 });
      setHasMorePhotos(false);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleLoadMorePhotos = async () => {
    if (loadingMorePhotos || !hasMorePhotos || !event) return;
    setLoadingMorePhotos(true);
    const nextPage = photoPage + 1;
    const activeId = selectedAdminGallery !== undefined
      ? (selectedAdminGallery ? selectedAdminGallery.id : event.id)
      : (activeSubEvent ? activeSubEvent.id : event.id);
    const legacyId = selectedAdminGallery !== undefined
      ? (selectedAdminGallery ? selectedAdminGallery.legacyId : event.legacyId)
      : (activeSubEvent ? activeSubEvent.legacyId : event.legacyId);

    try {
      const { photos: nextPhotos, hasMore, totalPhotos, totalVideos } = await getEventPhotosPaginated(activeId, legacyId, nextPage, PHOTO_PAGE_SIZE);
      setPhotos(prev => [...prev, ...nextPhotos]);
      setMediaTotals({ photos: totalPhotos, videos: totalVideos });
      setPhotoPage(nextPage);
      setHasMorePhotos(hasMore);
    } catch (err) {
      console.error('[EventDetail] Load more photos error:', err);
    } finally {
      setLoadingMorePhotos(false);
    }
  };

  const handleSubEventChange = (sub: DatabaseEvent | null) => {
    setGalleryMediaTab('photos');
    if (sub?.id === 'favourite') {
      setActiveSubEvent({
        ...sub,
        description: `Your favourite photos from ${event?.title || 'this event'}.`,
      } as any);
      loadFavouritePhotos();
      return;
    }
    setActiveSubEvent(sub);
    if (sub?.id === 'event-partners' || sub?.id === 'find-you') {
      return;
    }
    if (sub) {
      loadPhotos(sub.id, sub.legacyId);
    } else if (event) {
      loadPhotos(event.id, event.legacyId);
    }
  };

  const handleEventBack = useCallback(() => {
    if (selectedAdminGallery !== undefined) {
      setSelectedAdminGallery(undefined);
      setGalleryMediaTab('photos');
      if (event) {
        loadPhotos(event.id, event.legacyId);
      }
      return;
    }

    if (activeSubEvent) {
      setActiveSubEvent(null);
      setGalleryMediaTab('photos');
      if (event) {
        loadPhotos(event.id, event.legacyId);
      }
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }, [activeSubEvent, event, router, selectedAdminGallery]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEventBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleEventBack]);

  const handleOpenEditWelcomeModal = () => {
    const currentDesc = activeSubEvent ? activeSubEvent.description : event?.description;
    setGalleryDescText(currentDesc || '');
    setGalleryDescModalVisible(true);
  };

  const handleSaveGalleryDesc = async () => {
    if (!event) return;
    setUpdating(true);
    try {
      if (activeSubEvent) {
        await updateEvent(activeSubEvent.id, { description: galleryDescText.trim() });
        setActiveSubEvent({ ...activeSubEvent, description: galleryDescText.trim() });
        const loadedSubs = await getSubEvents(event.id, event.legacyId);
        setSubEvents(loadedSubs);
      } else {
        await updateEvent(event.id, { description: galleryDescText.trim() });
        setEvent({ ...event, description: galleryDescText.trim() });
      }
      setGalleryDescModalVisible(false);
      Alert.alert("Success", "Gallery message updated successfully!");
    } catch (err) {
      console.error('[SaveDesc] Error:', err);
      Alert.alert("Error", "Failed to update description.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUploadGalleryMedia = async (mediaType: 'photo' | 'video' = 'photo') => {
    if (!event) return;
    if (!user?.uid) {
      Alert.alert("Login Required", "Please log in before uploading media.");
      return;
    }
    const activeId = selectedAdminGallery !== undefined
      ? (selectedAdminGallery ? selectedAdminGallery.id : event.id)
      : (activeSubEvent ? activeSubEvent.id : event.id);
    if (!activeId) {
      Alert.alert("Error", "Please select a valid gallery before uploading.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'video' ? ['videos'] : ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 1.0,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      try {
        if (mediaType === 'video' && isFreePlanUser) {
          const oversizedVideo = result.assets.find(asset => (asset.fileSize || 0) > FREE_PLAN_VIDEO_LIMIT_BYTES);
          if (oversizedVideo) {
            Alert.alert("Upgrade Required", "Free plan videos can be up to 200 MB. Upgrade to upload larger videos.");
            return;
          }
        }

        const files = result.assets.map(asset => {
          const fallbackType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          const fallbackName = mediaType === 'video' ? 'video.mp4' : 'photo.jpg';
          return {
            uri: asset.uri,
            name: asset.fileName || fallbackName,
            type: asset.mimeType || fallbackType,
          };
        });

        await addToUploadQueue(files, activeId, user.uid, mediaType);
      } catch (err: any) {
        console.error('[UploadMedia] Error queueing uploads:', err);
        Alert.alert("Error", `Failed to start upload: ${err.message || err}`);
      }
    }
  };

  const handleUploadGalleryPhoto = () => handleUploadGalleryMedia('photo');
  const handleUploadGalleryVideo = () => handleUploadGalleryMedia('video');

  const handleReorderPhotos = async (newOrder: any[]) => {
    const reorderedIds = newOrder.map((p: any) => p.id);
    setPhotos(newOrder);
    try {
      await updatePhotosOrder(reorderedIds);
    } catch (err) {
      console.error('[ReorderPhotos] Error saving order:', err);
    }
  };

  const handleReorderSubEvents = async (newOrder: any[]) => {
    const reorderedIds = newOrder.map((s: any) => s.id);
    setSubEvents(newOrder);
    try {
      await updateSubEventsOrder(reorderedIds);
    } catch (err) {
      console.error('[ReorderSubEvents] Error saving order:', err);
    }
  };

  const handleDeleteGalleryPhoto = async (photoId: string) => {
    const selectedMediaLabel = galleryMediaTab === 'videos' ? 'video' : 'photo';
    Alert.alert(
      `Delete ${selectedMediaLabel === 'video' ? 'Video' : 'Photo'}`,
      `Are you sure you want to permanently delete this ${selectedMediaLabel} from the gallery?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              const { deletePhoto } = await import('@/lib/database');
              await deletePhoto(photoId);

              const activeId = selectedAdminGallery !== undefined
                ? (selectedAdminGallery ? selectedAdminGallery.id : event!.id)
                : (activeSubEvent ? activeSubEvent.id : event!.id);
              const activeLegacyId = selectedAdminGallery !== undefined
                ? (selectedAdminGallery ? selectedAdminGallery.legacyId : event!.legacyId)
                : (activeSubEvent ? activeSubEvent.legacyId : event!.legacyId);

              loadPhotos(activeId, activeLegacyId);
              Alert.alert("Success", `${selectedMediaLabel === 'video' ? 'Video' : 'Photo'} removed from gallery.`);
            } catch (err) {
              console.error('[DeletePhoto] Error:', err);
              Alert.alert("Error", "Failed to delete photo.");
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const syncCoverForEvent = (targetId: string, coverImage: string) => {
    if (event?.id === targetId) {
      setEvent({ ...event, coverImage });
    }
    if (selectedAdminGallery?.id === targetId) {
      setSelectedAdminGallery({ ...selectedAdminGallery, coverImage });
    }
    if (activeSubEvent?.id === targetId) {
      setActiveSubEvent({ ...activeSubEvent, coverImage });
    }
    setSubEvents(prev => prev.map(sub => sub.id === targetId ? { ...sub, coverImage } : sub));
  };

  const handleSetGalleryPhotoAsCover = async (photoUrl: string, targetId: string, label: string) => {
    setUpdating(true);
    try {
      const success = await updateEvent(targetId, { coverImage: photoUrl });
      if (!success) throw new Error("Cover update failed");
      syncCoverForEvent(targetId, photoUrl);
      setPhotoActionItem(null);
      Alert.alert("Updated", `${label} thumbnail updated.`);
    } catch (err) {
      console.error('[SetPhotoCover] Error:', err);
      Alert.alert("Error", `Failed to update ${label.toLowerCase()} thumbnail.`);
    } finally {
      setUpdating(false);
    }
  };

  const openGalleryPhotoActions = (photo: any) => {
    if (!event) return;
    setPhotoActionItem(photo);
  };

  const handleOpenGalleryImmersive = (sub: DatabaseEvent | null) => {
    console.log('[GalleryOpen] Tapped gallery card:', sub ? sub.title : 'Home');
    try {
      handleSubEventChange(sub);
      setIsAdminViewActive(false);
      console.log('[GalleryOpen] Switched isAdminViewActive to false successfully!');
    } catch (error) {
      console.error('[GalleryOpen] Error in handleOpenGalleryImmersive:', error);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    const shareUrl = `https://wedalbum.app/events/${event.id}`;
    try {
      await Share.share({
        message: `Join our event "${event.title}" on EveBash!\nJoin ID: ${event.joinId}\nLink: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };


  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, user]);

  useEffect(() => {
    const unsubscribe = subscribeToUploadQueue((items) => {
      const currentActiveId = selectedAdminGallery !== undefined
        ? (selectedAdminGallery ? selectedAdminGallery.id : event?.id)
        : (activeSubEvent ? activeSubEvent.id : event?.id);

      if (!currentActiveId) return;

      const filtered = items.filter(item => item.eventId === currentActiveId);
      setUploadQueue(filtered);

      const activeItems = filtered.filter(i => i.status === 'uploading' || i.status === 'pending');
      const completedItems = filtered.filter(i => i.status === 'completed');
      const failedItems = filtered.filter(i => i.status === 'failed');

      const prevActiveCount = prevActiveCountRef.current;
      prevActiveCountRef.current = activeItems.length;

      if (prevActiveCount > 0 && activeItems.length === 0) {
        if (failedItems.length > 0) {
          setShowUploadFailedModal(true);
        } else if (completedItems.length > 0) {
          setShowUploadCompleteModal(true);
        }
        clearFinishedUploads();
        completedIdsRef.current = [];
      }

      // Reload photos if any upload just finished successfully (one-by-one check)
      const newlyCompleted = completedItems.filter(item => !completedIdsRef.current.includes(item.id));
      if (newlyCompleted.length > 0) {
        completedIdsRef.current = [...completedIdsRef.current, ...newlyCompleted.map(item => item.id)];
        const activeLegacyId = selectedAdminGallery !== undefined
          ? (selectedAdminGallery ? selectedAdminGallery.legacyId : event?.legacyId)
          : (activeSubEvent ? activeSubEvent.legacyId : event?.legacyId);
        loadPhotos(currentActiveId, activeLegacyId);
      }
    });

    return unsubscribe;
  }, [event?.id, activeSubEvent?.id, selectedAdminGallery?.id]);

  // Poll face indexing status when upload completes in mobile app
  useEffect(() => {
    if (!showUploadCompleteModal || !id) {
      setMobileIndexingStatus(null);
      return;
    }

    let pollInterval: NodeJS.Timeout;

    const getApiBaseUrl = () => {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
      if (apiBase) return apiBase.replace(/\/+$/, '');
      
      try {
        const Constants = require('expo-constants').default;
        const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest2?.extra?.expoGo?.developer?.hostUri;
        const devHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
        if (devHost) return `http://${devHost}:3000`;
      } catch (e) {}

      try {
        const { Platform } = require('react-native');
        if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
      } catch (e) {}

      return 'http://localhost:8080';
    };

    const checkStatus = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const eventIdToQuery = selectedAdminGallery !== undefined
          ? (selectedAdminGallery ? selectedAdminGallery.id : id)
          : (activeSubEvent ? activeSubEvent.id : id);

        const res = await fetch(`${baseUrl}/api/v1/media/indexing-status?eventId=${eventIdToQuery}`);
        if (res.ok) {
          const data = await res.json();
          setMobileIndexingStatus(data);
          
          const hasActiveUploads = uploadQueue.some(i => i.status === 'uploading' || i.status === 'pending');
          if (data.status === 'complete' && !hasActiveUploads) {
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('[UploadCompleteModal] Error fetching status:', err);
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, 4000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [showUploadCompleteModal, id, activeSubEvent?.id, selectedAdminGallery?.id]);

  useEffect(() => {
    if (user) {
      setGuestName(user.name || '');
      const identifier = user.phone || user.email || user.uid || '';
      setGuestPhone(identifier);
      setSubmittedIdentifier(identifier);
    }
  }, [user]);

  useEffect(() => {
    const loadStoredGuestInfo = async () => {
      if (!user) {
        try {
          const storedName = await AsyncStorage.getItem('@guest_name');
          const storedPhone = await AsyncStorage.getItem('@guest_phone');
          if (storedName) setGuestName(storedName);
          if (storedPhone) {
            setGuestPhone(storedPhone);
            setSubmittedIdentifier(storedPhone);
          }
        } catch (e) {
          console.error('[EventDetail] Failed to load guest info from storage:', e);
        }
      }
    };
    loadStoredGuestInfo();
  }, [user]);

  useEffect(() => {
    if (!id || isOwner || isPrivilegedViewer) {
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let isActive = true;

    const checkGuestAccess = async () => {
      const identifiers: string[] = [];
      if (user) {
        if (user.phone) identifiers.push(user.phone);
        if (user.email) identifiers.push(user.email);
        if (user.uid) identifiers.push(user.uid);
      } else if (submittedIdentifier) {
        const normalized = submittedIdentifier.replace(/\D/g, '');
        if (normalized) identifiers.push(normalized);
      }

      if (identifiers.length === 0) {
        if (isActive) setGuestStatus(null);
        return;
      }

      let foundLogId: string | null = null;
      let foundStatus: string | null = null;

      for (const identifier of identifiers) {
        const logId = `${identifier}_${id}`;
        try {
          const { data: guestData, error } = await supabase
            .from('guests')
            .select('status')
            .eq('id', logId)
            .maybeSingle();

          if (error) throw error;
          if (guestData) {
            foundLogId = logId;
            foundStatus = guestData.status || 'pending';
            break;
          }
        } catch (err) {
          console.error('[GuestCheck] Error fetching document:', err);
        }
      }

      if (!isActive) return;

      if (foundLogId && foundStatus) {
        setGuestStatus(foundStatus);

        const fetchGuestStatus = async () => {
          try {
            const { data, error } = await supabase
              .from('guests')
              .select('status')
              .eq('id', foundLogId as string)
              .maybeSingle();
            if (error) throw error;
            if (data && isActive) {
              setGuestStatus(data.status || 'pending');
            }
          } catch (err) {
            console.error("Error updating guest status real-time:", err);
          }
        };

        // Create a completely unique channel name so React re-renders don't try to attach listeners to an already-subscribed channel
        const uniqueChannelName = `guest-status-${foundLogId}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
          .channel(uniqueChannelName)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'guests',
            filter: `id=eq.${foundLogId}`
          }, () => {
            fetchGuestStatus();
          })
          .subscribe();

        unsubscribe = () => {
          supabase.removeChannel(channel);
        };
      } else {
        setGuestStatus(null);
      }
    };

    checkGuestAccess();

    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [id, user, submittedIdentifier, isOwner, isPrivilegedViewer]);

  const handleGuestAccess = async () => {
    const nameToSubmit = user ? (user.name || guestName || 'Guest') : guestName.trim();
    const rawPhone = user ? (user.phone || user.email || user.uid) : guestPhone.trim();

    if (!nameToSubmit) {
      Alert.alert("Error", "Please enter your name.");
      return;
    }
    if (!rawPhone) {
      Alert.alert("Error", "Please enter your phone number or email.");
      return;
    }

    const normalizedIdentifier = (!user && !rawPhone.includes('@'))
      ? rawPhone.replace(/\D/g, '')
      : rawPhone;

    if (!normalizedIdentifier) {
      Alert.alert("Error", "Invalid phone number or email.");
      return;
    }

    setUpdating(true);
    try {
      const success = await logGuestLogin(
        nameToSubmit,
        normalizedIdentifier,
        id,
        event?.parentId || event?.id,
        event?.title,
        event?.createdBy,
        'pending'
      );
      if (success) {
        if (!user) {
          try {
            await AsyncStorage.setItem('@guest_name', nameToSubmit);
            await AsyncStorage.setItem('@guest_phone', normalizedIdentifier);
          } catch (e) {
            console.error('[GuestAccess] Failed to save credentials to AsyncStorage:', e);
          }
        }
        setSubmittedIdentifier(normalizedIdentifier);
        const logId = `${normalizedIdentifier}_${id}`;
        setGuestStatus('pending');

        const fetchGuestStatus = async () => {
          try {
            const { data, error } = await supabase
              .from('guests')
              .select('status')
              .eq('id', logId)
              .maybeSingle();
            if (error) throw error;
            if (data) {
              setGuestStatus(data.status || 'pending');
            }
          } catch (err) {
            console.error("Error updating guest status real-time:", err);
          }
        };

        const channel = supabase
          .channel(`guest-status-new-${logId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'guests',
            filter: `id=eq.${logId}`
          }, () => {
            fetchGuestStatus();
          })
          .subscribe();
      } else {
        Alert.alert("Error", "Failed to send access request.");
      }
    } catch (err) {
      console.error('[GuestAccess] Request error:', err);
      Alert.alert("Error", "An error occurred while sending the request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestAccessAgain = () => {
    setGuestStatus(null);
    setSubmittedIdentifier(null);
  };

  const handleChangeCover = async () => {
    if (!user?.uid) {
      Alert.alert("Login Required", "Please log in before changing the cover.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const target = currentActiveEvent;
      if (!target) return;
      setUpdating(true);
      setCoverUploadMessage("Updating your cover image...");
      try {
        setCoverUploadMessage("Preparing your cover image...");
        const manipulated = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        const file = { uri: manipulated.uri, name: 'cover.jpg', type: 'image/jpeg' } as any;
        setCoverUploadMessage("Uploading your cover image...");
        const upload = await uploadEventImage(file, event?.id || target.id, user.uid);

        const updatedFields = {
          coverImage: upload.url,
          coverOffset: 0,
          coverOffsetX: 0,
          coverScale: 1.0
        };

        if (selectedAdminGallery) {
          const newSub = { ...selectedAdminGallery, ...updatedFields };
          setSelectedAdminGallery(newSub);
          setSubEvents(prev => prev.map(sub => sub.id === selectedAdminGallery.id ? newSub : sub));
        } else if (activeSubEvent && activeSubEvent.id === target.id) {
          const newSub = { ...activeSubEvent, ...updatedFields };
          setActiveSubEvent(newSub);
          setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
        } else if (event) {
          setEvent({ ...event, ...updatedFields });
        }

        await updateEvent(target.id, updatedFields);
        const usageSaved = await saveCoverUsagePhoto({
          eventId: target.id,
          storageKey: upload.storageKey || upload.publicId || upload.url,
          url: upload.url,
          userId: user.uid,
          width: upload.width,
          height: upload.height,
          size: upload.bytes,
          format: upload.format,
          mediaType: upload.mediaType || 'photo',
          resourceType: upload.resourceType || 'image',
        });

        if (!usageSaved) {
          console.warn("[EventDetail] Cover updated, but storage usage could not be synced.");
        }

        showToast("Cover image updated successfully!");
      } catch (err) {
        Alert.alert("Error", "Failed to update cover.");
      } finally {
        setCoverUploadMessage(null);
        setUpdating(false);
      }
    }
  };

  const handleRemoveCover = () => {
    const target = currentActiveEvent;
    if (!target) return;

    if (!target.coverImage) {
      showToast("This gallery is already using the default cover.");
      return;
    }

    Alert.alert(
      "Remove Cover",
      "This will remove only the cover picture. Your event and galleries will stay as they are.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              const coverUrlToRemove = target.coverImage;
              const updatedFields = {
                coverImage: "",
                coverOffset: 0,
                coverOffsetX: 0,
                coverScale: 1.0
              };

              if (selectedAdminGallery) {
                const newSub = { ...selectedAdminGallery, ...updatedFields };
                setSelectedAdminGallery(newSub);
                setSubEvents(prev => prev.map(sub => sub.id === selectedAdminGallery.id ? newSub : sub));
              } else if (activeSubEvent && activeSubEvent.id === target.id) {
                const newSub = { ...activeSubEvent, ...updatedFields };
                setActiveSubEvent(newSub);
                setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
              } else if (event) {
                setEvent({ ...event, ...updatedFields });
              }

              await updateEvent(target.id, updatedFields);
              const usageDeleted = await deleteCoverUsagePhoto(target.id, coverUrlToRemove);
              if (!usageDeleted) {
                console.warn("[EventDetail] Cover removed, but storage usage could not be synced.");
              }

              showToast("Cover picture removed. Default cover restored.");
            } catch (err) {
              console.log("Error removing cover:", err);
              Alert.alert("Error", "Failed to remove cover.");
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const openSubEventModal = () => {
    const initialDate = parseEventDateValue(event?.date);
    setNewSubTitle('');
    setNewSubDateValue(initialDate);
    setNewSubDate(formatEventDisplayDate(initialDate));
    setShowSubDatePicker(false);
    setShowSubEventModal(true);
  };

  const closeSubEventModal = () => {
    setShowSubDatePicker(false);
    setShowSubEventModal(false);
  };

  const handleSubEventDateChange = (e: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowSubDatePicker(false);
    }

    if (e.type === 'dismissed') return;
    if (!selectedDate) return;

    setNewSubDateValue(selectedDate);
    setNewSubDate(formatEventDisplayDate(selectedDate));
  };

  const handleCreateSubEvent = async () => {
    if (!newSubTitle.trim() || !event) return;
    if (!newSubDate.trim()) {
      Alert.alert("Missing Date", "Please choose a sub-gallery date.");
      return;
    }
    if (!user?.uid) {
      Alert.alert("Login Required", "Please log in before creating a gallery.");
      return;
    }
    setUpdating(true);
    try {
      const subId = `${newSubTitle.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(-4)}`;
      const success = await createEvent({
        id: subId,
        title: newSubTitle,
        date: normalizeEventDate(newSubDate) || newSubDate,
        coverImage: resolveEventCoverImage(event.coverImage),
        description: `Welcome to the ${newSubTitle} gallery! Share your beautiful moments and thoughts here.`,
        createdBy: user.uid,
        type: 'sub',
        parentId: event.id,
        templateId: event.templateId || 'hero',
        order: subEvents.length
      });
      if (!success) {
        Alert.alert("Error", "Failed to create gallery. Please try again.");
        return;
      }
      setNewSubTitle('');
      closeSubEventModal();
      await loadEvent();
    } catch (err) {
      console.error("Error creating sub-gallery:", err);
      Alert.alert("Error", "Failed to create gallery.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateTemplate = async (templateId: string) => {
    if (!event) return;
    setUpdating(true);
    try {
      setEvent({ ...event, templateId });
      await updateEvent(event.id, { templateId });
      setShowTemplateModal(false);
    } catch (err) {
      Alert.alert("Error", "Failed to update theme.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCategory = async (category: string) => {
    if (!event) return;
    setUpdating(true);
    try {
      const defaultTemplate = getDefaultTemplateForEventCategory(category);
      const updates = {
        category,
        ...(defaultTemplate ? { templateId: defaultTemplate.id } : {}),
      };

      setEvent({ ...event, ...updates });
      await updateEvent(event.id, updates);
    } catch (err) {
      Alert.alert("Error", "Failed to update event type.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRenameEvent = async () => {
    const target = currentActiveEvent;
    if (!target || !editTitle.trim()) return;
    setUpdating(true);
    try {
      const success = await updateEvent(target.id, { title: editTitle.trim(), titleAlign: editTitleAlign });
      if (success) {
        const updated = { title: editTitle.trim(), titleAlign: editTitleAlign };
        if (selectedAdminGallery) {
          const newGallery = { ...selectedAdminGallery, ...updated };
          setSelectedAdminGallery(newGallery);
          setSubEvents(prev => prev.map(sub => sub.id === selectedAdminGallery.id ? newGallery : sub));
        } else if (activeSubEvent && activeSubEvent.id === target.id) {
          const newSub = { ...activeSubEvent, ...updated };
          setActiveSubEvent(newSub);
          setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
        } else if (event) {
          setEvent({ ...event, ...updated } as any);
        }
        setShowRenameModal(false);
      } else {
        Alert.alert("Error", "Failed to rename in database.");
      }
    } catch (err) {
      console.error("[RenameEvent] Error:", err);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setUpdating(false);
    }
  };
  const handleDateChange = async (e: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    const target = currentActiveEvent;
    if (e.type === 'set' && selectedDate && target) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      setUpdating(true);
      try {
        const success = await updateEvent(target.id, { date: formattedDate });
        if (success) {
          if (selectedAdminGallery) {
            const newGallery = { ...selectedAdminGallery, date: formattedDate };
            setSelectedAdminGallery(newGallery);
            setSubEvents(prev => prev.map(sub => sub.id === selectedAdminGallery.id ? newGallery : sub));
          } else if (activeSubEvent && activeSubEvent.id === target.id) {
            const newSub = { ...activeSubEvent, date: formattedDate };
            setActiveSubEvent(newSub);
            setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
          } else if (event) {
            setEvent({ ...event, date: formattedDate });
          }
        } else {
          Alert.alert("Error", "Failed to update date in database.");
        }
      } catch (err) {
        console.error("[DateChange] Error:", err);
        Alert.alert("Error", "Failed to update date.");
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleDeleteMainEvent = async () => {
    if (!event) return;
    Alert.alert(
      "Delete Event",
      `Are you sure you want to delete "${event.title}"? This will permanently remove all photos and sub-events.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            const success = await deleteEvent(event.id);
            if (success) {
              Alert.alert("Success", "Event deleted successfully.");
              router.replace('/(tabs)/gallery');
            } else {
              Alert.alert("Error", "Failed to delete event.");
            }
            setUpdating(false);
          }
        }
      ]
    );
  };

  const handleDeleteSubGallery = async (targetGallery?: DatabaseEvent) => {
    const gallery = targetGallery || selectedAdminGallery;
    if (!gallery) return;
    Alert.alert(
      "Delete Gallery",
      `Are you sure you want to delete the gallery "${gallery.title}"? This will permanently remove all photos inside this gallery.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              const success = await deleteEvent(gallery.id);
              if (success) {
                Alert.alert("Success", "Gallery deleted successfully.");
                if (selectedAdminGallery?.id === gallery.id) {
                  setSelectedAdminGallery(undefined);
                }
                loadEvent();
              } else {
                Alert.alert("Error", "Failed to delete gallery.");
              }
            } catch (err) {
              console.error("[DeleteSubGallery] Error:", err);
              Alert.alert("Error", "Failed to delete gallery.");
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const selectedGuestName = selectedGuestProfile?.name || selectedGuest?.name || 'Not set';
  const selectedGuestUsername = selectedGuestProfile?.username ? `@${selectedGuestProfile.username}` : 'Not set';
  const selectedGuestEmail = selectedGuestProfile?.email || selectedGuest?.email || (selectedGuest?.phone?.includes('@') ? selectedGuest.phone : '') || 'Not set';
  const selectedGuestPhone = selectedGuestProfile?.phone || (!selectedGuest?.phone?.includes('@') ? selectedGuest?.phone : '') || 'Not set';
  const selectedGuestPhoto = selectedGuestProfile?.profileImage;
  const selectedRequestName = selectedRequestProfile?.name || selectedRequest?.name || 'Not set';
  const selectedRequestUsername = selectedRequestProfile?.username ? `@${selectedRequestProfile.username}` : 'Not set';
  const selectedRequestEmail = selectedRequestProfile?.email || selectedRequest?.email || (selectedRequest?.phone?.includes('@') ? selectedRequest.phone : '') || 'Not set';
  const selectedRequestPhone = selectedRequestProfile?.phone || (!selectedRequest?.phone?.includes('@') ? selectedRequest?.phone : '') || 'Not set';
  const selectedRequestPhoto = selectedRequestProfile?.profileImage;
  const pendingGuests = guestLogs.filter((log) => log.status === 'pending');
  const approvedGuests = guestLogs.filter((log) => log.status === 'approved');
  const adminGuests = approvedGuests.filter((log) => !!log.canAdmin);
  const memberGuests = approvedGuests.filter((log) => !log.canAdmin);

  const renderApprovedGuestCard = (log: any, index: number) => (
    <TouchableOpacity
      key={log.id}
      style={styles.memberCard}
      onPress={() => setSelectedGuest(log)}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.avatarText}>{log.name.charAt(0)}</Text>
      </View>

      <View style={styles.memberMain}>
        <Text style={styles.memberName}>{log.name}</Text>

        <View style={styles.memberSecondary}>
          <Text style={styles.memberPhone}>{log.phone}</Text>
          <View style={styles.grantedRowSmall}>
            {log.status === 'approved' && <View style={styles.miniIcon}><IconSymbol name="eye.fill" size={14} color={MidnightColors.gold} /></View>}
            {log.canAdmin && <View style={styles.miniIcon}><IconSymbol name="shield.fill" size={14} color={MidnightColors.gold} /></View>}
            {(log.canAdmin || log.canUpload) && <View style={styles.miniIcon}><IconSymbol name="camera.fill" size={14} color={MidnightColors.gold} /></View>}
            {(log.canAdmin || log.canComment) && <View style={styles.miniIcon}><IconSymbol name={"bubble.left.fill" as any} size={14} color={MidnightColors.gold} /></View>}
          </View>
        </View>
      </View>

      <View style={styles.memberActions}>
        <Text style={styles.memberNumber}>#{String(index + 1).padStart(2, '0')}</Text>
        <TouchableOpacity
          style={styles.memberDelete}
          onPress={() => {
            if (doesGuestLogBelongToCurrentUser(log) && !isOwner) {
              Alert.alert("Permission Denied", "Ask host to remove you.");
              return;
            }
            deleteGuest(log.id).then(loadEvent);
          }}
        >
          <IconSymbol name="trash.fill" size={16} color="rgba(239, 68, 68, 0.4)" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingScreen message="Loading event" />
      </>
    );
  }

  if (!event) {
    return (
      <View style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }


  const getVendorInitials = (name: string): string[] => {
    if (!name) return ['W', 'E', 'D'];
    const words = name.split(/\s+/).filter(w => {
      const lower = w.toLowerCase();
      return lower !== 'by' && lower !== 'of' && lower !== 'and' && lower !== '&';
    });
    if (words.length === 0) return ['W', 'E', 'D'];
    const letters = words.slice(0, 4).map(w => w.charAt(0).toUpperCase());
    return letters;
  };

  const renderUploadProgressCard = () => {
    const active = uploadQueue.filter(i => i.status === 'uploading' || i.status === 'pending');
    const failed = uploadQueue.filter(i => i.status === 'failed');

    if (active.length === 0 && failed.length === 0) return null;

    const total = uploadQueue.length;
    const completed = uploadQueue.filter(i => i.status === 'completed').length;
    const currentUploading = uploadQueue.find(i => i.status === 'uploading');

    // Calculate progress percentage
    const progressSum = uploadQueue.reduce((sum, item) => {
      if (item.status === 'completed') return sum + 100;
      return sum + item.progress;
    }, 0);
    const overallPercent = total > 0 ? progressSum / (total * 100) * 100 : 0;

    const bottomPosition = showAdminView ? 70 + insets.bottom : 20 + insets.bottom;

    return (
      <View style={[localStyles.progressCard, { bottom: bottomPosition, backgroundColor: selectedTemplate.panel, borderColor: selectedTemplate.accentBg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={localStyles.progressCardTitle}>
              {active.length > 0
                ? `Uploading Media (${completed}/${total})`
                : 'Upload Halted with Issues'}
            </Text>
            {currentUploading && (
              <Text style={localStyles.progressCardSubtitle} numberOfLines={1}>
                {currentUploading.progress >= 90
                  ? `Processing ${currentUploading.fileName}...`
                  : `${currentUploading.fileName} (${Math.round(currentUploading.progress)}%)`}
              </Text>
            )}
            {failed.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const errors = failed.map(item => `${item.fileName}: ${item.error || 'Unknown error'}`).join('\n\n');
                  Alert.alert('Upload Details', errors);
                }}
              >
                <Text style={[localStyles.progressCardSubtitle, { color: '#f87171', textDecorationLine: 'underline' }]}>
                  {failed.length} upload(s) failed. (Tap to view details)
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {failed.length > 0 && (
              <TouchableOpacity
                style={[localStyles.progressCardBtn, { backgroundColor: 'rgba(248,113,113,0.15)' }]}
                onPress={async () => {
                  for (const item of failed) {
                    await retryUploadItem(item.id);
                  }
                }}
              >
                <Text style={{ color: '#f87171', fontSize: 11, fontWeight: 'bold' }}>Retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[localStyles.progressCardBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={async () => {
                if (active.length > 0) {
                  Alert.alert(
                    "Cancel Uploads",
                    "Are you sure you want to cancel all ongoing uploads?",
                    [
                      { text: "No", style: "cancel" },
                      {
                        text: "Yes, Cancel All",
                        style: "destructive",
                        onPress: async () => {
                          await resetUploadQueue();
                        }
                      }
                    ]
                  );
                } else {
                  await clearFinishedUploads();
                }
              }}
            >
              <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }}>
                {active.length > 0 ? 'Cancel' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={localStyles.progressBarBg}>
          <View style={[localStyles.progressBarFill, { width: `${overallPercent}%`, backgroundColor: selectedTemplate.accent }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: pageBackground }]}>
      <Stack.Screen
        options={{
          headerShown: showAdminView ? false : !(isSportsTemplate || event?.templateId === 'classic' || event?.templateId === 'hero' || event?.templateId === 'pop' || event?.templateId === 'ethereal' || event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade' || event?.templateId === 'academic_editorial' || event?.templateId === 'neon_carnival' || event?.templateId === 'garden' || event?.templateId === 'bohemian' || event?.templateId === 'tech_sleek' || event?.templateId === 'executive'),
          headerTransparent: true,
          headerTitle: '',
          headerLeft: () => {
            if (showAdminView) return null; // Custom back button is rendered inline inside the cover container to scroll with content

            const isPop = !showAdminView && event?.templateId === 'pop';
            const isVintage = event?.templateId === 'vintage';
            const isMinimal = event?.templateId === 'minimal_love';
            const isMuseum = event?.templateId === 'museum';
            const isBrutalist = event?.templateId === 'brutalist';
            return (!showAdminView && (isSportsTemplate || event?.templateId === 'classic' || event?.templateId === 'hero' || event?.templateId === 'ethereal' || event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade' || event?.templateId === 'academic_editorial' || event?.templateId === 'neon_carnival' || event?.templateId === 'garden' || event?.templateId === 'bohemian' || event?.templateId === 'tech_sleek' || event?.templateId === 'executive')) ? null : (
              <TouchableOpacity
                onPress={handleEventBack}
                style={[
                  styles.floatingBack,
                  { marginLeft: 16 },
                  (!showAdminView && (event?.templateId === 'royal' || event?.templateId === 'classic')) && {
                    marginLeft: 24,
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    borderColor: selectedTemplate.accent,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                  },
                  isPop && styles.popFloatingBack,
                  isVintage && styles.vintageFloatingButton,
                  isMinimal && styles.minimalFloatingButton,
                  isMuseum && styles.museumFloatingButton,
                  isBrutalist && styles.brutalistFloatingButton,
                ]}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <IconSymbol name="chevron.left" size={isPop ? 22 : 28} color={(isPop || isMinimal || isMuseum || isBrutalist) ? '#fffaf2' : selectedTemplate.accent} />
              </TouchableOpacity>
            );
          },
          headerRight: () => {
            if (showAdminView) return null;
            const isPop = event?.templateId === 'pop';
            const isVintage = event?.templateId === 'vintage';
            const isMinimal = event?.templateId === 'minimal_love';
            const isMuseum = event?.templateId === 'museum';
            const isBrutalist = event?.templateId === 'brutalist';
            return (!showAdminView && (isSportsTemplate || event?.templateId === 'classic' || event?.templateId === 'hero' || event?.templateId === 'ethereal' || event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade' || event?.templateId === 'academic_editorial' || event?.templateId === 'neon_carnival' || event?.templateId === 'garden' || event?.templateId === 'bohemian' || event?.templateId === 'tech_sleek' || event?.templateId === 'executive')) ? null : (
              <TouchableOpacity
                style={[
                  styles.floatingBack,
                  { marginTop: Platform.OS === 'ios' ? 44 : 10, marginRight: 16 },
                  (!showAdminView && (event?.templateId === 'royal' || event?.templateId === 'classic')) && {
                    marginRight: 24,
                    marginTop: 36,
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    borderColor: selectedTemplate.accent,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                  },
                  isPop && styles.popFloatingShare,
                  isVintage && styles.vintageFloatingButton,
                  isMinimal && styles.minimalFloatingButton,
                  isMuseum && styles.museumFloatingButton,
                  isBrutalist && styles.brutalistFloatingButton,
                ]}
                onPress={() => setShowShareModal(true)}
                hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
              >
                <IconSymbol name="square.and.arrow.up" size={isPop ? 18 : 20} color={(isPop || isMinimal || isMuseum || isBrutalist) ? '#fffaf2' : selectedTemplate.accent} />
              </TouchableOpacity>
            );
          }
        }}
      />

      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: pageBackground }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        stickyHeaderIndices={!showAdminView ? [1] : undefined}
      >
        {/* ── HERO ── */}
        <View
          style={[styles.hero, { height: heroHeight, backgroundColor: pageBackground, overflow: 'hidden' }]}
          {...(isRepositioning ? panResponder.panHandlers : {})}
        >
          {isSportsTemplate ? (
            <View style={[styles.sportsHeroStage, { backgroundColor: sportsTheme.background, paddingTop: insets.top }]}>
              <Image
                source={{ uri: resolvedActiveCoverImage }}
                style={styles.sportsHeroImage}
                resizeMode="cover"
                blurRadius={0.8}
              />
              <LinearGradient
                colors={sportsTheme.overlay as any}
                locations={[0, 0.5, 1]}
                style={styles.sportsHeroOverlay}
              />
              <View style={styles.sportsTextureLayer}>
                <View style={[styles.sportsTextureLine, styles.sportsTextureLineTop, { backgroundColor: `${sportsTheme.accent}33` }]} />
                <View style={[styles.sportsTextureLine, styles.sportsTextureLineMid, { backgroundColor: `${sportsTheme.accentAlt}30` }]} />
                <View style={[styles.sportsTextureLine, styles.sportsTextureLineBottom, { backgroundColor: `${sportsTheme.text}18` }]} />
              </View>
              <View style={[styles.sportsAccentOrb, { backgroundColor: sportsTheme.accentAlt }]} />

              <View style={[styles.sportsTopBar, { top: insets.top + 12 }]}>
                <TouchableOpacity
                  style={[styles.sportsHeaderButton, { backgroundColor: `${sportsTheme.darkControl}dd`, borderColor: `${sportsTheme.accent}66` }]}
                  onPress={handleEventBack}
                  activeOpacity={0.86}
                >
                  <IconSymbol name="chevron.left" size={18} color={sportsTheme.imageFrame} />
                </TouchableOpacity>
                <Text style={[styles.sportsTopLabel, { color: sportsTheme.accent }]}>{sportsTheme.label}</Text>
                <TouchableOpacity
                  style={[styles.sportsHeaderButton, { backgroundColor: `${sportsTheme.darkControl}dd`, borderColor: `${sportsTheme.accent}66` }]}
                  onPress={() => setShowShareModal(true)}
                  activeOpacity={0.86}
                >
                  <IconSymbol name="square.and.arrow.up" size={16} color={sportsTheme.imageFrame} />
                </TouchableOpacity>
              </View>

              <Animated.View
                entering={FadeInUp.delay(80).duration(650)}
                style={[styles.sportsPosterFrame, { top: insets.top + 82, backgroundColor: sportsTheme.imageFrame, borderColor: `${sportsTheme.accent}66`, shadowColor: sportsTheme.darkControl }]}
              >
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.sportsPosterImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0)', `${sportsTheme.darkControl}66`]}
                  style={styles.sportsPosterShade}
                />
                <View style={[styles.sportsPosterBadge, { backgroundColor: `${sportsTheme.darkControl}dd`, borderColor: `${sportsTheme.accent}66` }]}>
                  <Text style={[styles.sportsPosterBadgeText, { color: sportsTheme.accent }]}>Matchday Gallery</Text>
                </View>
              </Animated.View>

              <View style={[styles.sportsMetricCard, { top: insets.top + 214, backgroundColor: sportsTheme.card, borderColor: `${sportsTheme.accent}55`, shadowColor: sportsTheme.darkControl }]}>
                <Text style={[styles.sportsMetricNumber, { color: sportsTheme.text }]}>{String(photos.length || 1).padStart(2, '0')}</Text>
                <Text style={[styles.sportsMetricLabel, { color: sportsTheme.accent }]}>Moments</Text>
              </View>

              <Animated.View
                entering={FadeInUp.delay(180).duration(650)}
                style={[styles.sportsHeroCard, { backgroundColor: sportsTheme.card, borderColor: `${sportsTheme.accent}55`, shadowColor: sportsTheme.darkControl }]}
              >
                <View style={styles.sportsHeroKickerRow}>
                  <View style={[styles.sportsHeroKickerDot, { backgroundColor: sportsTheme.accentAlt }]} />
                  <Text style={[styles.sportsHeroKicker, { color: sportsTheme.accent }]}>{sportsTheme.categoryLabel}</Text>
                  <View style={[styles.sportsHeroKickerLine, { backgroundColor: `${sportsTheme.accent}33` }]} />
                </View>
                <Text
                  style={[styles.sportsHeroTitle, { color: sportsTheme.text, fontFamily: sportsTheme.headingFont }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  {...({ minimumScaleFactor: 0.72 } as any)}
                >
                  {currentActiveEvent?.title || event.title}
                </Text>
                <View style={styles.sportsHeroDivider}>
                  <View style={[styles.sportsHeroDividerLine, { backgroundColor: `${sportsTheme.accent}33` }]} />
                  <View style={[styles.sportsHeroDividerMark, { backgroundColor: sportsTheme.accent }]} />
                  <View style={[styles.sportsHeroDividerLine, { backgroundColor: `${sportsTheme.accent}33` }]} />
                </View>
                <View style={styles.sportsHeroMetaRow}>
                  <Text style={[styles.sportsHeroDate, { color: sportsTheme.muted }]} numberOfLines={1}>{currentActiveEvent?.date || event.date || 'Matchday'}</Text>
                  <TouchableOpacity
                    style={[styles.sportsShareButton, { backgroundColor: sportsTheme.darkControl }]}
                    onPress={() => setShowShareModal(true)}
                    activeOpacity={0.86}
                  >
                    <IconSymbol name="square.and.arrow.up" size={14} color={sportsTheme.imageFrame} />
                    <Text style={[styles.sportsShareButtonText, { color: sportsTheme.imageFrame }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : !showAdminView && isBohemianTemplate ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedTemplate.background, paddingTop: insets.top }]}>
              {/* Sunset / Dusk Gradient Background */}
              <LinearGradient
                colors={isThemeDark ? ['#1e140f', '#3f2214', '#2f241d'] : ['#ffedd5', '#fed7aa', '#fff7ed']}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Subtle background lines/guitar fret lines */}
              <View style={styles.bohemianBgLinesContainer}>
                <View style={[styles.bohemianBgLine, { opacity: isThemeDark ? 0.05 : 0.08 }]} />
                <View style={[styles.bohemianBgLine, { opacity: isThemeDark ? 0.08 : 0.12 }]} />
                <View style={[styles.bohemianBgLine, { opacity: isThemeDark ? 0.04 : 0.06 }]} />
              </View>

              {/* Faded overlay to soften the sunset background and blend it to solid background at the bottom */}
              <LinearGradient
                colors={selectedTemplate.overlay as any}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Header Top Bar: Back | Date | Share */}
              <View style={styles.bohemianTopBar}>
                <TouchableOpacity
                  onPress={handleEventBack}
                  style={styles.bohemianHeaderButton}
                  activeOpacity={0.85}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="chevron.left" size={20} color="#431407" />
                </TouchableOpacity>

                <View style={styles.bohemianDateBadge}>
                  <Text style={[
                    styles.bohemianHeaderDate,
                    {
                      fontFamily: selectedTemplate.serifFont,
                      color: '#c2410c',
                    }
                  ]}>
                    {(() => {
                      const dateStr = event?.date;
                      if (!dateStr) return 'LIVE';
                      try {
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr.slice(0, 10);
                        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                        return `• ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} •`;
                      } catch (e) {
                        return dateStr.slice(0, 10);
                      }
                    })()}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowShareModal(true)}
                  style={styles.bohemianHeaderButton}
                  activeOpacity={0.85}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="square.and.arrow.up" size={18} color="#431407" />
                </TouchableOpacity>
              </View>

              {/* Floating Album Sleeve + Peeking Rotating Vinyl Disc Mockup */}
              <View style={styles.bohemianAlbumContainer}>
                {/* Dynamic expanding pulse waves behind the sleeve */}
                <RNAnimated.View
                  style={[
                    styles.bohemianPulseRing,
                    {
                      transform: [
                        {
                          scale: bohemianPulseWave.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.0, 1.45],
                          }),
                        },
                      ],
                      opacity: bohemianPulseWave.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.65, 0.35, 0.0],
                      }),
                    },
                  ]}
                />

                {/* Secondary offset pulse wave for multi-layered ripple depth */}
                <RNAnimated.View
                  style={[
                    styles.bohemianPulseRing,
                    {
                      transform: [
                        {
                          scale: bohemianPulseWave.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1.3],
                          }),
                        },
                      ],
                      opacity: bohemianPulseWave.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [0.5, 0.25, 0.0],
                      }),
                      width: 260,
                      height: 260,
                      borderRadius: 28,
                      top: 25,
                    },
                  ]}
                />

                {/* Vinyl Record peeking from behind the sleeve */}
                <RNAnimated.View
                  style={[
                    styles.bohemianVinylRecord,
                    {
                      transform: [
                        {
                          rotate: bohemianRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.bohemianVinylDisc}>
                    <View style={styles.bohemianVinylGroove1} />
                    <View style={styles.bohemianVinylGroove2} />
                    <View style={styles.bohemianVinylGroove3} />
                    <View style={styles.bohemianVinylSheenLine1} />
                    <View style={styles.bohemianVinylSheenLine2} />
                    <View style={[styles.bohemianVinylCenterLabel, { backgroundColor: selectedTemplate.accent }]}>
                      <View style={styles.bohemianVinylCenterRing} />
                      <View style={[styles.bohemianVinylCenterHole, { backgroundColor: isThemeDark ? '#2f241d' : '#fff7ed' }]} />
                    </View>
                  </View>
                </RNAnimated.View>

                {/* Floating Album Sleeve Cover */}
                <RNAnimated.View
                  style={[
                    styles.bohemianAlbumSleeve,
                    {
                      transform: [{ scale: bohemianPulse }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 12 },
                      shadowOpacity: 0.35,
                      shadowRadius: 16,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={styles.bohemianSleeveImage}
                  />
                  {/* Decorative double border to look like printed vinyl jacket */}
                  <View style={styles.bohemianSleeveInnerBorder} />

                  {/* Linear gradient overlay for texture/contrast */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {/* Gloss reflection overlay sheen */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.0)', 'rgba(0,0,0,0.08)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {/* Premium Vintage Badge */}
                  <View style={styles.bohemianSleeveBadge}>
                    <Text style={styles.bohemianSleeveBadgeText}>LP STEREO • SIDE A</Text>
                  </View>
                </RNAnimated.View>
              </View>

              {/* Now Playing HUD */}
              <View style={styles.bohemianHudContainer}>
                {/* Track Info */}
                <View style={styles.bohemianTrackInfo}>
                  <Text
                    style={[
                      styles.bohemianTrackTitle,
                      {
                        fontFamily: selectedTemplate.serifFont,
                        color: isThemeDark ? '#fdba74' : '#c2410c',
                        textShadowColor: isThemeDark ? 'rgba(0,0,0,0.5)' : 'rgba(67, 20, 7, 0.15)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 3,
                      }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    {...({ minimumScaleFactor: 0.6 } as any)}
                  >
                    {currentActiveEvent?.title || event?.title}
                  </Text>
                  <Text style={[styles.bohemianTrackHost, { fontFamily: selectedTemplate.bodyMedium, color: selectedTemplate.muted }]}>
                    {`Hosted by ${event?.createdBy === user?.uid ? 'You' : (event?.hostName || 'Music Festival Crew')}`}
                  </Text>
                </View>

                {/* Playback Controls */}
                <View style={styles.bohemianControlsRow}>
                  <TouchableOpacity style={styles.bohemianControlBtn} activeOpacity={0.7}>
                    <IconSymbol name="backward.fill" size={20} color={selectedTemplate.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bohemianPlayBtn, { backgroundColor: selectedTemplate.text }]}
                    onPress={() => setIsBohemianPlaying(prev => !prev)}
                    activeOpacity={0.8}
                  >
                    <IconSymbol
                      name={isBohemianPlaying ? 'pause.fill' : 'play.fill'}
                      size={24}
                      color={isThemeDark ? '#2f241d' : '#fff7ed'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.bohemianControlBtn} activeOpacity={0.7}>
                    <IconSymbol name="forward.fill" size={20} color={selectedTemplate.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : !showAdminView && event?.templateId === 'pop' ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#ffe84a' }]}>
              {/* Giant background comic decorative shapes */}
              <View style={styles.popBackgroundShapeBlue} />
              <View style={styles.popBackgroundShapePink} />
            </View>
          ) : !showAdminView && event?.templateId === 'classic' ? (
            <View style={styles.classicHeroImageContainer}>
              <Image
                source={{ uri: resolvedActiveCoverImage }}
                style={[
                  styles.classicHeroImage,
                  (activeCoverMode === 'fit') ? {
                    resizeMode: 'contain',
                  } : {
                    height: '120%',
                    top: '-10%',
                    resizeMode: 'cover',
                    transform: [
                      { translateY: activeCoverOffset || 0 },
                      { translateX: activeCoverOffsetX || 0 },
                      { scale: activeCoverScale || 1.0 }
                    ]
                  }
                ]}
              />
            </View>
          ) : !showAdminView && event?.templateId === 'ethereal' ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedTemplate.background }]}>
              {/* Full-bleed Photo */}
              <View style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.88 }}
                />
                {/* Dark gradient overlay at bottom of image for readability */}
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.4)']}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 }}
                />
              </View>
            </View>
          ) : !showAdminView && event?.templateId === 'academic_editorial' ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedTemplate.background, paddingTop: insets.top }]}>
              <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'column' }}>

                {/* Top Bar: Back | Kicker label | Share */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                  marginTop: 12,
                  marginBottom: 12,
                }}>
                  <TouchableOpacity
                    onPress={handleEventBack}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="chevron.left" size={20} color={selectedTemplate.text} />
                  </TouchableOpacity>

                  <Text style={{
                    fontFamily: selectedTemplate.serifFont,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 2.5,
                    color: selectedTemplate.muted,
                  }}>
                    {`· ${activeSubEvent ? 'EXCERPT' : 'CAMPUS JOURNAL'} ·`}
                  </Text>

                  <TouchableOpacity
                    onPress={() => setShowShareModal(true)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="square.and.arrow.up" size={18} color={selectedTemplate.text} />
                  </TouchableOpacity>
                </View>

                {/* Cover Image — fills remaining space */}
                <View style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: selectedTemplate.text + '60',
                  padding: 6,
                  backgroundColor: selectedTemplate.panel,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                  elevation: 2,
                }}>
                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                  />
                </View>

                {/* Title + Date — below the image, solid background for guaranteed visibility */}
                <View style={{
                  marginTop: 10,
                  backgroundColor: isDark ? '#13161F' : '#FFFFFF',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 2,
                  borderTopColor: isDark ? '#CC1010' : '#800020',
                }}>
                  {/* Event Title */}
                  <Text style={{
                    fontFamily: selectedTemplate.serifBold,
                    fontSize: 24,
                    fontWeight: '800',
                    color: isDark ? '#FFFFFF' : '#000000',
                    textAlign: 'center',
                    letterSpacing: 0.4,
                    lineHeight: 32,
                  }} numberOfLines={2}>
                    {(currentActiveEvent?.title || event.title || '').toUpperCase()}
                  </Text>

                  {/* Thin accent divider */}
                  <View style={{
                    height: 1,
                    backgroundColor: isDark ? '#CC1010' : '#800020',
                    opacity: 0.4,
                    marginVertical: 8,
                    marginHorizontal: 24,
                  }} />

                  {/* Date */}
                  <Text style={{
                    fontFamily: selectedTemplate.serifBold,
                    fontSize: 15,
                    color: isDark ? '#CC1010' : '#800020',
                    textAlign: 'center',
                    letterSpacing: 1.2,
                    marginBottom: 2,
                  }}>
                    {currentActiveEvent?.date || event.date || '—'}
                  </Text>

                  {/* Category label */}
                  <Text style={{
                    fontFamily: selectedTemplate.serifFont,
                    fontSize: 11,
                    color: isDark ? '#9CA3AF' : '#4B5563',
                    textAlign: 'center',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}>
                    {`Vol. I · ${event.category || 'CAMPUS'}`}
                  </Text>
                </View>

              </View>
            </View>
          ) : !showAdminView && isExecutiveTemplate ? (
            <View style={[styles.executiveHeroStage, { paddingTop: insets.top }]}>
              <Image
                source={{ uri: resolvedActiveCoverImage }}
                style={styles.executiveBackdrop}
                resizeMode="cover"
                blurRadius={1}
              />
              <LinearGradient
                colors={['rgba(8, 17, 31, 0.94)', 'rgba(8, 17, 31, 0.62)', 'rgba(8, 17, 31, 1)']}
                locations={[0, 0.48, 1]}
                style={styles.executiveHeroGradient}
              />
              <View style={styles.executiveVignette} />

              <View style={[styles.executiveTopBar, { top: insets.top + 12 }]}>
                <TouchableOpacity style={styles.executiveHeaderButton} onPress={handleEventBack} activeOpacity={0.86}>
                  <IconSymbol name="chevron.left" size={18} color="#f5eddc" />
                </TouchableOpacity>
                <Text style={styles.executiveHeaderLabel}>Executive Suite</Text>
                <TouchableOpacity style={styles.executiveHeaderButton} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
                  <IconSymbol name="square.and.arrow.up" size={16} color="#f5eddc" />
                </TouchableOpacity>
              </View>

              <Animated.View entering={FadeInUp.delay(80).duration(650)} style={[styles.executivePortraitFrame, { top: insets.top + 84 }]}>
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.executivePortraitImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.02)', 'rgba(17,24,39,0.32)']}
                  style={styles.executivePortraitOverlay}
                />
                <View style={styles.executivePortraitCaption}>
                  <Text style={styles.executivePortraitCaptionText}>Private Leadership Album</Text>
                </View>
              </Animated.View>

              <View style={[styles.executiveSealCard, { top: insets.top + 206 }]}>
                <Text style={styles.executiveSealNumber}>{String(photos.length || 1).padStart(2, '0')}</Text>
                <Text style={styles.executiveSealLabel}>Moments</Text>
              </View>

              <Animated.View entering={FadeInUp.delay(180).duration(650)} style={styles.executiveHeroCard}>
                <View style={styles.executiveKickerRow}>
                  <Text style={styles.executiveKicker}>Boardroom Brief</Text>
                  <View style={styles.executiveKickerLine} />
                </View>
                <Text style={styles.executiveHeroTitle} numberOfLines={2} adjustsFontSizeToFit {...({ minimumScaleFactor: 0.72 } as any)}>
                  {currentActiveEvent?.title || event.title}
                </Text>
                <View style={styles.executiveDivider}>
                  <View style={styles.executiveDividerLine} />
                  <View style={styles.executiveDividerMark} />
                  <View style={styles.executiveDividerLine} />
                </View>
                <View style={styles.executiveMetaRow}>
                  <Text style={styles.executiveDate} numberOfLines={1}>{currentActiveEvent?.date || event.date || 'Executive Event'}</Text>
                  <TouchableOpacity style={styles.executiveShare} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#f5eddc" />
                    <Text style={styles.executiveShareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : !showAdminView && isTechSleekTemplate ? (
            <View style={[styles.techSleekHeroStage, { paddingTop: insets.top }]}>
              <Image
                source={{ uri: resolvedActiveCoverImage }}
                style={styles.techSleekBackdrop}
                resizeMode="cover"
                blurRadius={2}
              />
              <LinearGradient
                colors={['rgba(3, 7, 18, 0.96)', 'rgba(7, 16, 34, 0.82)', 'rgba(5, 11, 23, 1)']}
                locations={[0, 0.44, 1]}
                style={styles.techSleekHeroGradient}
              />
              <View style={[styles.techSleekGlowOrb, styles.techSleekGlowTop]} />
              <View style={[styles.techSleekGlowOrb, styles.techSleekGlowBottom]} />
              <View style={styles.techSleekGrid}>
                <View style={[styles.techSleekGridLine, styles.techSleekGridVerticalOne]} />
                <View style={[styles.techSleekGridLine, styles.techSleekGridVerticalTwo]} />
                <View style={[styles.techSleekGridLine, styles.techSleekGridHorizontalOne]} />
                <View style={[styles.techSleekGridLine, styles.techSleekGridHorizontalTwo]} />
              </View>

              <View style={[styles.techSleekTopBar, { top: insets.top + 12 }]}>
                <TouchableOpacity style={styles.techSleekHeaderButton} onPress={handleEventBack} activeOpacity={0.86}>
                  <IconSymbol name="chevron.left" size={18} color="#e0f2fe" />
                </TouchableOpacity>
                <Text style={styles.techSleekHeaderLabel}>Tech Showcase</Text>
                <TouchableOpacity style={styles.techSleekHeaderButton} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
                  <IconSymbol name="square.and.arrow.up" size={16} color="#e0f2fe" />
                </TouchableOpacity>
              </View>

              <Animated.View entering={FadeInUp.delay(80).duration(650)} style={[styles.techSleekDeviceFrame, { top: insets.top + 84 }]}>
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.techSleekDeviceImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.16)', 'rgba(34,211,238,0.05)', 'rgba(3,7,18,0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.techSleekDeviceGlass}
                />
                <View style={styles.techSleekDeviceBadge}>
                  <Text style={styles.techSleekDeviceBadgeText}>Live Capture System</Text>
                </View>
              </Animated.View>

              <View style={[styles.techSleekMetricCard, { top: insets.top + 204 }]}>
                <Text style={styles.techSleekMetricNumber}>{String(photos.length || 1).padStart(2, '0')}</Text>
                <Text style={styles.techSleekMetricLabel}>Moments</Text>
              </View>

              <Animated.View entering={FadeInUp.delay(180).duration(650)} style={styles.techSleekHeroCard}>
                <View style={styles.techSleekKickerRow}>
                  <View style={styles.techSleekKickerDot} />
                  <Text style={styles.techSleekKicker}>Corporate Technology Event</Text>
                  <View style={styles.techSleekKickerLine} />
                </View>
                <Text style={styles.techSleekHeroTitle} numberOfLines={2} adjustsFontSizeToFit {...({ minimumScaleFactor: 0.72 } as any)}>
                  {currentActiveEvent?.title || event.title}
                </Text>
                <View style={styles.techSleekDivider} />
                <View style={styles.techSleekMetaRow}>
                  <Text style={styles.techSleekDate} numberOfLines={1}>{currentActiveEvent?.date || event.date || 'Premium Tech Gallery'}</Text>
                  <TouchableOpacity style={styles.techSleekShare} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#03101f" />
                    <Text style={styles.techSleekShareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : !showAdminView && isMuseumTemplate ? (
            <View style={[styles.museumHeroStage, { paddingTop: insets.top }]}>
              <Image
                source={{ uri: resolvedActiveCoverImage }}
                style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]}
                resizeMode="cover"
                blurRadius={1.2}
              />
              <LinearGradient
                colors={['rgba(11, 17, 24, 0.78)', 'rgba(11, 17, 24, 0.24)', 'rgba(243, 240, 234, 0.98)']}
                locations={[0, 0.48, 1]}
                style={styles.museumHeroVignette}
              />
              <View style={styles.museumWallTexture}>
                <View style={[styles.museumWallLine, styles.museumWallLineTop]} />
                <View style={[styles.museumWallLine, styles.museumWallLineMid]} />
                <View style={[styles.museumWallLine, styles.museumWallLineBottom]} />
              </View>
              <View style={styles.museumArchOutline} />
              <View style={styles.museumAmbientBlock} />
              <View style={styles.museumPedestalBase} />
              <View style={[styles.museumExhibitionRail, { top: insets.top + 52 }]}>
                <Text style={styles.museumExhibitionRailText}>EXHIBITION / {new Date().getFullYear()}</Text>
              </View>

              <Animated.View entering={FadeInUp.delay(80).duration(650)} style={[styles.museumArtworkFrame, { top: insets.top + 82 }]}>
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.museumArtworkImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.06)', 'rgba(11,17,24,0.18)']}
                  style={styles.museumArtworkSheen}
                />
                <View style={styles.museumArtworkLabel}>
                  <Text style={styles.museumArtworkLabelIndex}>WORK 01</Text>
                  <Text style={styles.museumArtworkLabelText} numberOfLines={1}>Corporate Collection</Text>
                </View>
              </Animated.View>

              <View style={[styles.museumHeroIndexCard, { top: insets.top + 204 }]}>
                <Text style={styles.museumHeroIndexNumber}>{String(photos.length || 1).padStart(2, '0')}</Text>
                <Text style={styles.museumHeroIndexLabel}>Works</Text>
              </View>

              <Animated.View entering={FadeInUp.delay(180).duration(650)} style={styles.museumHeroCard}>
                <View style={styles.museumHeroKickerRow}>
                  <Text style={styles.museumHeroKicker}>Corporate Exhibition</Text>
                  <View style={styles.museumHeroKickerLine} />
                </View>
                <Text style={styles.museumHeroTitle} numberOfLines={2} adjustsFontSizeToFit {...({ minimumScaleFactor: 0.72 } as any)}>
                  {currentActiveEvent?.title || event.title}
                </Text>
                <View style={styles.museumHeroDivider}>
                  <View style={styles.museumHeroDividerLine} />
                  <View style={styles.museumHeroDividerBlock} />
                  <View style={styles.museumHeroDividerLine} />
                </View>
                <View style={styles.museumHeroMetaRow}>
                  <Text style={styles.museumHeroDate} numberOfLines={1}>{currentActiveEvent?.date || event.date || 'Curated Collection'}</Text>
                  <View style={styles.museumHeroMetaChip}>
                    <Text style={styles.museumHeroMetaChipText}>Gallery {String(subEvents.length + 1).padStart(2, '0')}</Text>
                  </View>
                  <TouchableOpacity style={styles.museumHeroShare} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#f8f6ef" />
                    <Text style={styles.museumHeroShareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : !showAdminView && isBrutalistTemplate ? (
            <View style={[styles.brutalistHeroStage, { paddingTop: insets.top }]}>
              <Image
                source={{ uri: resolvedActiveCoverImage }}
                style={styles.brutalistHeroBackdrop}
                resizeMode="cover"
                blurRadius={0.8}
              />
              <LinearGradient
                colors={['rgba(17,17,19,0.9)', 'rgba(17,17,19,0.32)', 'rgba(239,237,231,0.98)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.brutalistGridTexture}>
                <View style={[styles.brutalistGridLine, styles.brutalistGridLineVerticalOne]} />
                <View style={[styles.brutalistGridLine, styles.brutalistGridLineVerticalTwo]} />
                <View style={[styles.brutalistGridLineHorizontal, styles.brutalistGridLineHorizontalOne]} />
                <View style={[styles.brutalistGridLineHorizontal, styles.brutalistGridLineHorizontalTwo]} />
              </View>
              <View style={[styles.brutalistHeaderRail, { top: insets.top + 52 }]}>
                <Text style={styles.brutalistHeaderRailText}>Corporate Grid System</Text>
                <Text style={styles.brutalistHeaderRailCode}>EB/{String(new Date().getFullYear()).slice(2)}</Text>
              </View>

              <Animated.View entering={FadeInUp.delay(80).duration(650)} style={[styles.brutalistArtworkBlock, { top: insets.top + 104 }]}>
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.brutalistArtworkImage}
                  resizeMode="cover"
                />
                <View style={styles.brutalistArtworkCaption}>
                  <Text style={styles.brutalistArtworkCaptionNumber}>01</Text>
                  <Text style={styles.brutalistArtworkCaptionText}>Key Visual</Text>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(180).duration(650)} style={styles.brutalistHeroCard}>
                <View style={styles.brutalistHeroLabelRow}>
                  <Text style={styles.brutalistHeroLabel}>Brutalist Grid</Text>
                  <View style={styles.brutalistHeroLabelLine} />
                </View>
                <Text style={styles.brutalistHeroTitle} numberOfLines={2} adjustsFontSizeToFit {...({ minimumScaleFactor: 0.7 } as any)}>
                  {(currentActiveEvent?.title || event.title || '').toUpperCase()}
                </Text>
                <View style={styles.brutalistHeroMetaRow}>
                  <Text style={styles.brutalistHeroDate} numberOfLines={1}>{currentActiveEvent?.date || event.date || 'Corporate Archive'}</Text>
                  <TouchableOpacity style={styles.brutalistHeroShare} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#fffffa" />
                    <Text style={styles.brutalistHeroShareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
              <View style={styles.brutalistHeroMarker}>
                <Text style={styles.brutalistHeroMarkerText}>GRID</Text>
              </View>
            </View>
          ) : (
            <Image
              source={{ uri: resolvedActiveCoverImage }}
              style={[
                styles.heroImage,
                (!showAdminView && event?.templateId === 'pop') ? styles.popPolaroidImage : {},
                isGoldenYearsTemplate && styles.goldenHeroImage,
                isVintageTemplate && styles.vintageHeroImage,
                (activeCoverMode === 'fit') ? {
                  height: heroHeight,
                  resizeMode: 'contain',
                } : {
                  height: heroHeight + 100,
                  top: -50,
                  resizeMode: 'cover',
                  transform: [
                    { translateY: isRepositioning ? tempCoverOffset : (activeCoverOffset || 0) },
                    { translateX: isRepositioning ? tempCoverOffsetX : (activeCoverOffsetX || 0) },
                    { scale: isRepositioning ? tempCoverScale : (activeCoverScale || 1.0) }
                  ],
                }
              ]}
              blurRadius={isGoldenYearsTemplate ? 0.8 : (isVintageTemplate ? 1.1 : 0)}
            />
          )}
          {!isSportsTemplate && selectedTemplate.id !== 'classic' && selectedTemplate.id !== 'pop' && selectedTemplate.id !== 'ethereal' && selectedTemplate.id !== 'academic_editorial' && selectedTemplate.id !== 'garden' && selectedTemplate.id !== 'bohemian' && selectedTemplate.id !== 'museum' && selectedTemplate.id !== 'brutalist' && selectedTemplate.id !== 'tech_sleek' && selectedTemplate.id !== 'executive' && (
            <LinearGradient
              colors={selectedTemplate.overlay as any}
              style={styles.heroGradient}
            />
          )}

          {showAdminView && (
            <TouchableOpacity
              onPress={handleEventBack}
              style={[
                styles.floatingBack,
                {
                  position: 'absolute',
                  top: insets.top > 0 ? insets.top + 8 : 16,
                  left: 16,
                  zIndex: 10,
                }
              ]}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <IconSymbol name="chevron.left" size={24} color={selectedTemplate.accent} />
            </TouchableOpacity>
          )}

          {showAdminView && !isRepositioning && (
            <View style={[styles.coverControlRow, { top: insets.top > 0 ? insets.top + 8 : 16 }]}>
              {/* Fit / Toggle */}
              <TouchableOpacity
                style={styles.coverControlSubBtn}
                onPress={async () => {
                  const target = currentActiveEvent;
                  if (!target) return;
                  const newMode: 'fit' | 'fill' = (target.coverMode || 'fill') === 'fill' ? 'fit' : 'fill';
                  setUpdating(true);
                  try {
                    const updatedFields = {
                      coverMode: newMode,
                      coverOffset: 0,
                      coverOffsetX: 0,
                      coverScale: 1.0
                    };

                    if (selectedAdminGallery) {
                      const newSub = { ...selectedAdminGallery, ...updatedFields };
                      setSelectedAdminGallery(newSub as any);
                      setSubEvents(prev => prev.map(sub => sub.id === selectedAdminGallery.id ? newSub as any : sub));
                    } else if (activeSubEvent && activeSubEvent.id === target.id) {
                      const newSub = { ...activeSubEvent, ...updatedFields };
                      setActiveSubEvent(newSub as any);
                      setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub as any : sub));
                    } else if (event) {
                      setEvent({ ...event, ...updatedFields } as any);
                    }

                    showToast(newMode === 'fit' ? 'Cover set to Fit' : 'Cover set to Fill');
                    await updateEvent(target.id, updatedFields);
                  } catch (err) {
                    console.log('Error updating cover mode:', err);
                  } finally {
                    setUpdating(false);
                  }
                }}
                disabled={updating}
              >
                <IconSymbol
                  name={((activeCoverMode || 'fill') === 'fill' ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right.asymmetrical') as any}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.coverControlText}>
                  {(activeCoverMode || 'fill') === 'fill' ? 'Fit' : 'Fill'}
                </Text>
              </TouchableOpacity>

              {/* Reposition Button (Only in Fill mode) */}
              {(activeCoverMode || 'fill') === 'fill' && (
                <TouchableOpacity
                  style={styles.coverControlSubBtn}
                  onPress={() => {
                    const target = currentActiveEvent;
                    setTempCoverOffset(target?.coverOffset || 0);
                    setTempCoverOffsetX(target?.coverOffsetX || 0);
                    setTempCoverScale(target?.coverScale || 1.0);
                    setIsRepositioning(true);
                  }}
                  disabled={updating}
                >
                  <IconSymbol name={"arrow.up.and.down" as any} size={14} color="#fff" />
                  <Text style={styles.coverControlText}>Position</Text>
                </TouchableOpacity>
              )}

              {/* Change Cover */}
              <TouchableOpacity
                style={styles.coverControlSubBtn}
                onPress={handleChangeCover}
                disabled={updating}
              >
                <IconSymbol name="camera.fill" size={14} color="#fff" />
                <Text style={styles.coverControlText}>{updating ? '...' : 'Cover'}</Text>
              </TouchableOpacity>

              {/* Remove Cover */}
              <TouchableOpacity
                style={styles.coverControlSubBtn}
                onPress={handleRemoveCover}
                disabled={updating}
              >
                <IconSymbol name="trash.fill" size={14} color="#fff" />
                <Text style={styles.coverControlText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}


          {(!showAdminView && (isSportsTemplate || event?.templateId === 'academic_editorial' || event?.templateId === 'bohemian' || event?.templateId === 'museum' || event?.templateId === 'brutalist' || event?.templateId === 'tech_sleek' || event?.templateId === 'executive')) ? null : (!showAdminView && event?.templateId === 'royal') ? (
            <View style={styles.royalHeroOverlay}>
              {/* 1. Elegant Thin Inset Frame */}
              <View style={[styles.royalFrame, { borderColor: selectedTemplate.accent }]} />

              {/* 2. Centered Text & Button */}
              <View style={styles.royalCenterContent}>
                <Text style={[styles.royalTitle, { color: '#fff' }]}>
                  {(currentActiveEvent?.title || event.title).toUpperCase()}
                </Text>

                <Text style={[styles.royalDateText, { color: selectedTemplate.accent }]}>
                  {(currentActiveEvent?.date || event.date || '').toUpperCase()}
                </Text>

                <TouchableOpacity
                  style={[styles.royalButton, { borderColor: selectedTemplate.accent }]}
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                >
                  <Text style={[styles.royalButtonText, { color: selectedTemplate.text }]}>MY PHOTOS</Text>
                </TouchableOpacity>
              </View>

              {/* 3. Bottom Brand/Logo and Chevron */}
              <View style={styles.royalBottomContent}>
                <View style={styles.brandLogoContainer}>
                  <Text style={[styles.royalBrandLogoScript, { color: '#fff', fontSize: 13, opacity: 0.8 }]}>Delivered by</Text>
                  <Text style={[styles.royalBrandSubText, { color: selectedTemplate.accent, fontSize: 16, marginTop: 2, letterSpacing: 2 }]}>EveBash</Text>
                  <Text style={[styles.royalBrandLogoScript, { color: '#fff', fontSize: 12, marginTop: 4, opacity: 0.8, fontStyle: 'normal' }]}>with love ❤️</Text>
                </View>

                {/* Downward Chevron */}
                <TouchableOpacity
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  style={styles.royalChevron}
                >
                  <IconSymbol name="chevron.down" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'classic') ? (
            <View style={styles.classicHeroOverlay}>
              {/* 1. Elegant Thin Matte Frame */}
              <View style={[styles.classicFrame, { borderColor: 'rgba(212, 175, 55, 0.15)' }]} />

              {/* 2. Center Content with Spaced-out Fine-Art Typography */}
              <View style={styles.classicCenterContent}>
                <Text style={[styles.classicTitle, { color: selectedTemplate.text, fontFamily: selectedTemplate.serifFont }]}>
                  {currentActiveEvent?.title || event.title}
                </Text>

                <View style={styles.classicDividerOrnament}>
                  <View style={[styles.classicDividerOrnamentLine, { backgroundColor: '#cca43b' }]} />
                  <Text style={styles.classicDividerOrnamentDot}>✦</Text>
                  <View style={[styles.classicDividerOrnamentLine, { backgroundColor: '#cca43b' }]} />
                </View>

                <Text style={[styles.classicDateText, { color: '#cca43b', fontFamily: selectedTemplate.serifItalic }]}>
                  {`— ${currentActiveEvent?.date || event.date || ''} —`.toUpperCase()}
                </Text>

                <View style={styles.classicActionRow}>
                  {/* Left: Symmetrical Gold Square Back Button */}
                  <TouchableOpacity
                    style={[styles.classicSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                  >
                    <IconSymbol name="chevron.left" size={16} color="#cca43b" />
                  </TouchableOpacity>

                  {/* Center: Main Gold Square Enter Gallery Button */}
                  <TouchableOpacity
                    style={[styles.classicButton, { borderColor: '#cca43b', marginTop: 0 }]}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  >
                    <Text style={[styles.classicButtonText, { color: '#cca43b' }]}>ENTER GALLERY</Text>
                  </TouchableOpacity>

                  {/* Right: Symmetrical Gold Square Share Button */}
                  <TouchableOpacity
                    style={[styles.classicSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => setShowShareModal(true)}
                  >
                    <IconSymbol name="square.and.arrow.up" size={16} color="#cca43b" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Classic Fine Art Brand Signature */}
              <View style={styles.classicBottomContent}>
                <View style={styles.brandLogoContainer}>
                  <Text style={[styles.classicBrandSubText, { color: '#94a3b8' }]}>EXHIBITION DELIVERED BY</Text>
                  <Text style={[styles.classicBrandLogoScript, { color: selectedTemplate.text, fontFamily: selectedTemplate.serifItalic }]}>EveBash</Text>
                </View>

                <TouchableOpacity
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  style={styles.classicChevron}
                >
                  <IconSymbol name="chevron.down" size={20} color="#cca43b" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'ethereal') ? (
            <View style={styles.etherealOverlayContainer}>
              {/* Back button at top left */}
              <TouchableOpacity
                style={styles.etherealBackBtnRound}
                onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
              >
                <IconSymbol name="chevron.left" size={20} color="#ffffff" />
              </TouchableOpacity>

              {/* Share button at top right */}
              <TouchableOpacity
                style={styles.etherealShareBtnRound}
                onPress={() => setShowShareModal(true)}
              >
                <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
              </TouchableOpacity>

              {/* Floating Details Card */}
              <View style={[styles.etherealDetailsCard, { backgroundColor: selectedTemplate.panel, borderColor: selectedTemplate.accent + '26' }]}>
                {/* Couple Names */}
                <Text style={[styles.etherealCoupleNames, { fontFamily: selectedTemplate.serifBold, color: selectedTemplate.text }]}>
                  {(currentActiveEvent?.title || event.title).toUpperCase()}
                </Text>

                {/* Elegant Separator Ornament */}
                <Text style={{ color: selectedTemplate.accent, fontSize: 16, marginVertical: 4 }}>❦</Text>

                {/* Event Date */}
                {(currentActiveEvent?.date || event.date) && (
                  <Text style={{ color: selectedTemplate.text, opacity: 0.75, fontFamily: selectedTemplate.serifItalic, fontSize: 14, fontStyle: 'italic', letterSpacing: 1, marginBottom: 16 }}>
                    {currentActiveEvent?.date || event.date}
                  </Text>
                )}

                {/* "ENTER GALLERY" Button integrated inside card */}
                <TouchableOpacity
                  style={[styles.etherealEnterBtn, { backgroundColor: selectedTemplate.accent }]}
                  onPress={() => scrollViewRef.current?.scrollTo({ y: heroHeight, animated: true })}
                >
                  <Text style={styles.etherealEnterBtnText}>ENTER GALLERY</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'hero') ? (
            <View style={styles.heroHeroOverlay}>
              {/* 1. Immersive dark linear gradient overlay for ultimate depth */}
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.92)']}
                style={StyleSheet.absoluteFillObject}
              />

              {/* 2. Glassmorphic Hero Inset Card - floating above bottom third */}
              <View style={styles.heroGlassCard}>
                {/* Thin golden-bordered micro-badge */}
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>THE CELEBRATION OF</Text>
                </View>

                {/* Event Title - Poetic fluid Playfair Display Serif Italic */}
                <Text style={[styles.heroTitleMain, { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }]}>
                  {currentActiveEvent?.title || event.title}
                </Text>

                {/* Micro-thin gold sparkle separator */}
                <View style={styles.heroDividerContainer}>
                  <View style={styles.heroDividerLine} />
                  <Text style={styles.heroDividerStar}>✦</Text>
                  <View style={styles.heroDividerLine} />
                </View>

                {/* Wide tracked starlight-gold date */}
                <Text style={styles.heroDateMain}>
                  {`— ${currentActiveEvent?.date || event.date || 'SAVE THE DATE'} —`.toUpperCase()}
                </Text>

                {/* Symmetrical parallel buttons block */}
                <View style={styles.heroActionRow}>
                  {/* Left: Gold bordered Square back/chevron icon button */}
                  <TouchableOpacity
                    style={[styles.heroSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                  >
                    <IconSymbol name="chevron.left" size={16} color="#cca43b" />
                  </TouchableOpacity>

                  {/* Center: Glowing Enter Gallery pill button */}
                  <TouchableOpacity
                    style={styles.heroEnterButton}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  >
                    <Text style={styles.heroEnterButtonText}>ENTER GALLERY</Text>
                  </TouchableOpacity>

                  {/* Right: Gold bordered Square share icon button */}
                  <TouchableOpacity
                    style={[styles.heroSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => setShowShareModal(true)}
                  >
                    <IconSymbol name="square.and.arrow.up" size={16} color="#cca43b" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Infinite Dark Star Sign-off */}
              <View style={styles.heroBottomContent}>
                <View style={styles.brandLogoContainer}>
                  <Text style={styles.heroBrandText}>CINEMATIC EDITIONS — WED ALBUM</Text>
                </View>
                <TouchableOpacity
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  style={styles.heroChevron}
                >
                  <IconSymbol name="chevron.down" size={20} color="#cca43b" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'pop') ? (
            <View style={[styles.popHeroCanvas, { height: 465 + insets.top }]}>
              {/* 1. Large Event Title Starburst Banner */}
              <View style={[styles.popTitleContainerOuter, { top: insets.top + 16 }]}>
                <View style={styles.popTitleContainerShadow} />
                <View style={styles.popTitleContainer}>
                  <Text style={styles.popTitleText}>
                    {currentActiveEvent?.title || event.title}
                  </Text>
                </View>
              </View>

              {/* 2. Tilted White Polaroid Frame */}
              <View style={[styles.popPolaroidFrame, { marginTop: insets.top + 78 }]}>
                <View style={styles.popPolaroidInner}>
                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={styles.popPolaroidImage}
                    resizeMode="contain"
                  />
                  <View style={styles.popPolaroidOverlay} />
                </View>

                {/* Integrated Tactile Navigation Console */}
                <View style={styles.popPolaroidCaptionRow}>
                  <TouchableOpacity onPress={handleEventBack} style={styles.popCaptionBackBtn}>
                    <IconSymbol name="chevron.left" size={16} color="#ffffff" />
                  </TouchableOpacity>

                  <Text style={styles.popPolaroidCaption}>
                    {`${currentActiveEvent?.date || event.date || 'PARTY TIME'}`.toUpperCase()}
                  </Text>

                  <TouchableOpacity onPress={() => setShowShareModal(true)} style={styles.popCaptionShareBtn}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                {/* Corner Starburst stickers */}
                <View style={[styles.popSticker, styles.popStickerLeft]}>
                  <Text style={styles.popStickerText}>BOOM! 🎉</Text>
                </View>
                <View style={[styles.popSticker, styles.popStickerRight]}>
                  <Text style={styles.popStickerText}>YEAH! 💥</Text>
                </View>
                {/* Birthday Cap Emoji Sticker */}
                <View style={styles.popStickerCapContainer}>
                  <Text style={styles.popStickerCapEmoji}>🥳</Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'cyber_tech') ? (
            <View style={[styles.cyberHeroOverlay, { paddingTop: insets.top }]}>
              {/* Scanline Background & Ambient glow backdrops */}
              <View style={styles.cyberGridLines} />
              <View style={styles.cyberGlowDot1} />
              <View style={styles.cyberGlowDot2} />

              {/* Top status bar with centered Event Name and navigation icons */}
              <View style={styles.cyberTopBar}>
                {/* Left: Back Button */}
                <TouchableOpacity
                  style={styles.cyberHeaderButton}
                  onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                >
                  <IconSymbol name="chevron.left" size={16} color="#00f0ff" />
                </TouchableOpacity>

                {/* Center: Centered Event Name */}
                <View style={styles.cyberTitleContainer}>
                  <Text style={styles.cyberPathText} numberOfLines={1} ellipsizeMode="tail">
                    {(currentActiveEvent?.title || event.title).toUpperCase()}
                  </Text>
                </View>

                {/* Right: Share Button */}
                <TouchableOpacity
                  style={styles.cyberHeaderButton}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={16} color="#00f0ff" />
                </TouchableOpacity>
              </View>

              {/* Poster frame in middle */}
              <View style={styles.cyberMiddleFrame}>
                <View style={styles.cyberPosterWrapper}>
                  {/* Decorative neon corners */}
                  <View style={[styles.cyberCorner, styles.cyberCornerTL]} />
                  <View style={[styles.cyberCorner, styles.cyberCornerTR]} />
                  <View style={[styles.cyberCorner, styles.cyberCornerBL]} />
                  <View style={[styles.cyberCorner, styles.cyberCornerBR]} />

                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={styles.cyberPosterImg}
                    resizeMode="cover"
                  />
                  {/* Scanning scanline bar */}
                  <View style={styles.cyberScanBar} />
                </View>
                <Text style={styles.cyberScanStatus}>[DECRYPTING MEMORIES... 100% SUCCESS]</Text>
              </View>

              {/* Bottom terminal console */}
              <View style={styles.cyberBottomConsole}>
                {/* Cyberpunk date display */}
                <View style={styles.cyberDateContainer}>
                  <Text style={styles.cyberDateText}>
                    {`JOIN US ON: ${currentActiveEvent?.date || event.date || 'PENDING'}`.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'retro_arcade') ? (
            <View style={[styles.retroHeroOverlay, { paddingTop: insets.top }]}>
              {/* Arcade Top Bar Header */}
              <View style={styles.retroTopBar}>
                {/* Left: Back Button styled as a round arcade button */}
                <TouchableOpacity
                  style={styles.retroHeaderButtonBack}
                  onPress={handleEventBack}
                >
                  <IconSymbol name="chevron.left" size={18} color="#ffffff" />
                </TouchableOpacity>

                {/* Center: Uppercase Title */}
                <View style={styles.retroTitleContainer}>
                  <Text style={styles.retroPathText} numberOfLines={1} ellipsizeMode="tail">
                    {(currentActiveEvent?.title || event.title).toUpperCase()}
                  </Text>
                </View>

                {/* Right: Share Button styled as a round arcade button */}
                <TouchableOpacity
                  style={styles.retroHeaderButtonShare}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Poster frame in middle */}
              <View style={styles.retroMiddleFrame}>
                <View style={styles.retroPosterWrapper}>
                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={styles.retroPosterImg}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* High-Score / Ticket Date Console */}
              <View style={styles.retroBottomConsole}>
                <View style={styles.retroDateContainer}>
                  <Text style={styles.retroDateText}>
                    {`JOIN US ON: ${currentActiveEvent?.date || event.date || 'PENDING'}`.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'neon_carnival') ? (
            <View style={[styles.neonCarnivalHeroOverlay, { paddingTop: insets.top }]}>
              {/* Cover Image spanning full background, blending top & bottom */}
              <View style={styles.neonCarnivalCoverWrapper}>
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.neonCarnivalCoverImg}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(12, 7, 20, 0.75)', 'rgba(12, 7, 20, 0.15)', '#0c0714']}
                  style={styles.neonCarnivalGradient}
                />
              </View>

              {/* Top status bar with Event Name and navigation icons */}
              <View style={styles.neonCarnivalTopBar}>
                <TouchableOpacity
                  style={styles.neonCarnivalHeaderButton}
                  onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                >
                  <IconSymbol name="chevron.left" size={16} color="#faf5ff" />
                </TouchableOpacity>

                {/* Right: Share Button */}
                <TouchableOpacity
                  style={styles.neonCarnivalHeaderButton}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={16} color="#faf5ff" />
                </TouchableOpacity>
              </View>

              <View style={styles.neonCarnivalContent}>
                {/* Title and Date */}
                <Text style={styles.neonCarnivalDateText}>
                  {currentActiveEvent?.date || event.date || 'DATE TBD'}
                </Text>

                <View style={styles.neonCarnivalTitleWrapper}>
                  <Text style={styles.neonCarnivalTitle} numberOfLines={2} adjustsFontSizeToFit>
                    {(currentActiveEvent?.title || event.title).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'academic_editorial') ? (
            null
          ) : (!showAdminView && isGardenTemplate) ? (
            <View style={[StyleSheet.absoluteFillObject, { paddingTop: insets.top + 2 }]}>
              {/* Single top bar row: [← back  share↑]  ···  [title / date] */}
              <View style={styles.gardenTopBar}>
                {/* Left: back + share */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.gardenHeaderButton}
                    onPress={handleEventBack}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="chevron.left" size={20} color="#ffffff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gardenHeaderButton}
                    onPress={() => setShowShareModal(true)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                {/* Right: title + date stacked */}
                <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 12 }}>
                  <Text
                    style={[styles.gardenTitle, { fontFamily: selectedTemplate.serifBold, color: '#ffffff', textAlign: 'right', fontSize: 20, lineHeight: 26 }]}
                    numberOfLines={2}
                  >
                    {currentActiveEvent?.title || event.title}
                  </Text>
                  {(currentActiveEvent?.date || event.date) && (
                    <Text style={[styles.gardenDate, { fontFamily: selectedTemplate.serifItalic, color: 'rgba(255,255,255,0.85)', textAlign: 'right' }]}>
                      {currentActiveEvent?.date || event.date}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ) : (!showAdminView && isGoldenYearsTemplate) ? (
            <View style={styles.goldenCeremonyHero}>
              <LinearGradient
                colors={['rgba(63, 47, 34, 0.18)', 'rgba(255, 250, 240, 0.18)', 'rgba(63, 47, 34, 0.38)']}
                locations={[0, 0.48, 1]}
                style={styles.goldenCeremonyVignette}
              />
              <LinearGradient
                colors={['rgba(255, 250, 240, 0.56)', 'rgba(255, 250, 240, 0.16)', 'rgba(255, 250, 240, 0)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.88, y: 0.78 }}
                style={styles.goldenCeremonyCreamWash}
              />
              <View style={styles.goldenCeremonyTexture}>
                <View style={[styles.goldenGrainLine, styles.goldenGrainLineOne]} />
                <View style={[styles.goldenGrainLine, styles.goldenGrainLineTwo]} />
                <View style={[styles.goldenGrainDot, styles.goldenGrainDotOne]} />
                <View style={[styles.goldenGrainDot, styles.goldenGrainDotTwo]} />
                <View style={[styles.goldenGrainDot, styles.goldenGrainDotThree]} />
              </View>
              <View style={styles.goldenCeremonyHalo} />
              <View style={styles.goldenCeremonyFrame}>
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerTopLeft]} />
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerTopRight]} />
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerBottomLeft]} />
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerBottomRight]} />
              </View>
              <Animated.View
                entering={FadeInUp.delay(90).duration(760).springify().damping(18)}
                style={styles.goldenCeremonyPhotoMotion}
              >
                <View style={styles.goldenCeremonyPhotoCard}>
                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={styles.goldenCeremonyPhoto}
                    resizeMode="cover"
                  />
                  <View style={styles.goldenCeremonyPhotoVeil} />
                </View>
              </Animated.View>
              <View style={styles.goldenCeremonyYearRail}>
                <Text style={styles.goldenCeremonyYearRailText}>FOREVER</Text>
              </View>
              <Animated.View
                entering={FadeInUp.delay(160).duration(820).springify().damping(20)}
                style={styles.goldenCeremonyContent}
              >
                <Text style={styles.goldenCeremonyKicker}>Anniversary Legacy</Text>
                <View style={styles.goldenCeremonySeal}>
                  <Text style={styles.goldenCeremonySealText}>∞</Text>
                </View>
                <Text style={styles.goldenCeremonyTitle}>{currentActiveEvent?.title || event.title}</Text>
                <View style={styles.goldenCeremonyRule}>
                  <View style={styles.goldenCeremonyRuleLine} />
                  <View style={styles.goldenCeremonyRuleDot} />
                  <View style={styles.goldenCeremonyRuleLine} />
                </View>
                <Text style={styles.goldenCeremonyDate}>{currentActiveEvent?.date || event.date}</Text>
                <TouchableOpacity style={styles.goldenCeremonyShare} onPress={() => setShowShareModal(true)}>
                  <IconSymbol name="square.and.arrow.up" size={14} color="#3f2f22" />
                  <Text style={styles.goldenCeremonyShareText}>Share Event</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : (!showAdminView && isVintageTemplate) ? (
            <View style={styles.vintageEditorialHero}>
              <LinearGradient
                colors={['rgba(15, 14, 11, 0.86)', 'rgba(28, 24, 18, 0.62)', 'rgba(15, 14, 11, 0.96)']}
                locations={[0, 0.5, 1]}
                style={styles.vintageEditorialVignette}
              />
              <View style={styles.vintageEditorialTexture}>
                <View style={[styles.vintageGrainLine, styles.vintageGrainLineOne]} />
                <View style={[styles.vintageGrainLine, styles.vintageGrainLineTwo]} />
                <View style={[styles.vintageGrainDot, styles.vintageGrainDotOne]} />
                <View style={[styles.vintageGrainDot, styles.vintageGrainDotTwo]} />
                <View style={[styles.vintageGrainDot, styles.vintageGrainDotThree]} />
              </View>
              <View style={styles.vintageEditorialMasthead}>
                <Text style={styles.vintageEditorialMastheadText}>THE ANNIVERSARY JOURNAL</Text>
              </View>
              <View style={styles.vintageEditorialTopBar}>
                <Text style={styles.vintageEditorialEdition}>Vol. {new Date().getFullYear()}</Text>
                <Text style={styles.vintageEditorialEdition}>Anniversary Archive</Text>
              </View>
              <Animated.View
                entering={FadeInUp.delay(100).duration(780).springify().damping(19)}
                style={styles.vintageEditorialFeatureRow}
              >
                <View style={styles.vintageEditorialImagePlate}>
                  <View style={styles.vintageEditorialTape} />
                  <View style={styles.vintageEditorialClip} />
                  <Image
                    source={{ uri: resolvedActiveCoverImage }}
                    style={styles.vintageEditorialImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['rgba(67, 46, 23, 0.16)', 'rgba(17, 14, 9, 0.28)']}
                    style={styles.vintageEditorialImageFade}
                  />
                </View>
                <View style={styles.vintageEditorialNumberBlock}>
                  <Text style={styles.vintageEditorialNumber}>25</Text>
                  <Text style={styles.vintageEditorialNumberLabel}>moments</Text>
                </View>
              </Animated.View>
              <Animated.View
                entering={FadeInUp.delay(170).duration(820).springify().damping(20)}
                style={styles.vintageEditorialBand}
              >
                <Text style={styles.vintageEditorialTitle}>{currentActiveEvent?.title || event.title}</Text>
              </Animated.View>
              <View style={styles.vintageEditorialFooter}>
                <Text style={styles.vintageEditorialDate}>{currentActiveEvent?.date || event.date}</Text>
                <TouchableOpacity style={styles.vintageEditorialShare} onPress={() => setShowShareModal(true)}>
                  <Text style={styles.vintageEditorialShareText}>Share</Text>
                  <IconSymbol name="square.and.arrow.up" size={13} color="#B89145" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && isRoseTemplate) ? (
            <View style={styles.roseBloomHero}>
              <LinearGradient
                colors={['rgba(255, 249, 245, 0.74)', 'rgba(248, 218, 224, 0.38)', 'rgba(255, 249, 245, 0.94)']}
                locations={[0, 0.46, 1]}
                style={styles.roseBloomWash}
              />
              <View style={[styles.roseBloomOrb, styles.roseBloomOrbLarge]} />
              <View style={[styles.roseBloomOrb, styles.roseBloomOrbSmall]} />
              <View style={styles.roseBloomGrain}>
                <View style={[styles.roseBloomGrainDot, styles.roseBloomGrainDotOne]} />
                <View style={[styles.roseBloomGrainDot, styles.roseBloomGrainDotTwo]} />
                <View style={[styles.roseBloomGrainDot, styles.roseBloomGrainDotThree]} />
              </View>
              <View style={styles.roseBloomVine}>
                <View style={[styles.roseBloomPetal, styles.roseBloomPetalA]} />
                <View style={[styles.roseBloomPetal, styles.roseBloomPetalB]} />
                <View style={[styles.roseBloomPetal, styles.roseBloomPetalC]} />
              </View>
              <View style={styles.roseBloomHeader}>
                <Text style={styles.roseBloomHeaderTitle}>Rose Garden Anniversary</Text>
                <Text style={styles.roseBloomHeaderSubtitle}>Our Story, Our Forever</Text>
                <View style={styles.roseBloomHeaderDivider}>
                  <View style={styles.roseBloomHeaderLine} />
                  <View style={styles.roseBloomHeaderFlower}>
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalTop]} />
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalRight]} />
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalBottom]} />
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalLeft]} />
                  </View>
                  <View style={styles.roseBloomHeaderLine} />
                </View>
              </View>
              <View style={styles.roseBloomPhotoStamp}>
                <View style={styles.roseBloomPhotoTape} />
                <View style={styles.roseBloomPhotoCorner} />
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.roseBloomPhoto}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.roseBloomMomentCard}>
                <Text style={styles.roseBloomMomentNumber}>{photos.length || 25}</Text>
                <Text style={styles.roseBloomMomentLabel}>Moments</Text>
                <View style={styles.roseBloomMomentDivider} />
              </View>
              <View style={styles.roseBloomCard}>
                <View style={styles.roseBloomKickerRow}>
                  <View style={styles.roseBloomKickerDot} />
                  <Text style={styles.roseBloomKicker}>Rose Garden Anniversary</Text>
                  <View style={styles.roseBloomKickerLine} />
                </View>
                <Text style={styles.roseBloomTitle}>{currentActiveEvent?.title || event.title}</Text>
                <View style={styles.roseBloomStem}>
                  <View style={styles.roseBloomLeaf} />
                  <View style={styles.roseBloomStemLine} />
                  <View style={[styles.roseBloomLeaf, styles.roseBloomLeafAlt]} />
                </View>
                <Text style={styles.roseBloomDate}>{currentActiveEvent?.date || event.date}</Text>
                <TouchableOpacity style={styles.roseBloomShare} onPress={() => setShowShareModal(true)}>
                  <IconSymbol name="square.and.arrow.up" size={14} color="#5c2632" />
                  <Text style={styles.roseBloomShareText}>Share Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && isMinimalLoveTemplate) ? (
            <View style={styles.minimalEditorialHero}>
              <LinearGradient
                colors={['rgba(247, 239, 228, 0.16)', 'rgba(247, 239, 228, 0.78)', '#f7efe4']}
                locations={[0, 0.58, 1]}
                style={styles.minimalEditorialWash}
              />
              <View style={[styles.minimalEditorialBotanical, styles.minimalEditorialBotanicalLeft]}>
                <View style={styles.minimalEditorialStem} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafOne]} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafTwo]} />
              </View>
              <View style={[styles.minimalEditorialBotanical, styles.minimalEditorialBotanicalRight]}>
                <View style={styles.minimalEditorialStem} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafOne]} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafTwo]} />
              </View>
              <View style={styles.minimalEditorialPhotoPanel}>
                <View style={styles.minimalEditorialTape} />
                <Image
                  source={{ uri: resolvedActiveCoverImage }}
                  style={styles.minimalEditorialPhoto}
                  resizeMode="cover"
                />
                <View style={styles.minimalEditorialPhotoFade} />
              </View>
              <View style={styles.minimalEditorialGridLineVertical} />
              <View style={styles.minimalEditorialGridLineHorizontal} />
              <View style={styles.minimalEditorialContent}>
                <Text style={styles.minimalEditorialKicker}>Anniversary Journal</Text>
                <Text style={styles.minimalEditorialTitle}>{currentActiveEvent?.title || event.title}</Text>
                <View style={styles.minimalEditorialDivider}>
                  <View style={styles.minimalEditorialDividerLine} />
                  <View style={styles.minimalEditorialDividerOrnament} />
                  <View style={styles.minimalEditorialDividerLine} />
                </View>
                <View style={styles.minimalEditorialMetaRow}>
                  <Text style={styles.minimalEditorialDate}>{currentActiveEvent?.date || event.date}</Text>
                  <TouchableOpacity style={styles.minimalEditorialShare} onPress={() => setShowShareModal(true)}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#fffaf2" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.minimalEditorialIndex}>
                <Text style={styles.minimalEditorialIndexText}>{photos.length || 1}</Text>
                <Text style={styles.minimalEditorialIndexLabel}>Moments</Text>
              </View>
            </View>
          ) : (
            <View style={[
              styles.heroContent,
              isScrapbookTemplate && styles.scrapbookHeroContent,
              isNeonTemplate && styles.neonHeroContent,
              isPastelTemplate && styles.pastelHeroContent,
              isPopTemplate && styles.popHeroContent,
              isGoldenYearsTemplate && styles.goldenHeroContent,
              isVintageTemplate && styles.vintageHeroContent,
              isRoseTemplate && styles.roseHeroContent,
              isMinimalLoveTemplate && styles.minimalHeroContent,
            ]}>
              {isScrapbookTemplate && (
                <>
                  <View style={[styles.scrapbookTape, styles.scrapbookTapeLeft]} />
                  <View style={[styles.scrapbookTape, styles.scrapbookTapeRight]} />
                  <View style={styles.scrapbookSticker}>
                    <Text style={styles.scrapbookStickerText}>Birthday memories</Text>
                  </View>
                  <View style={styles.scrapbookHeroRule}>
                    <View style={styles.scrapbookHeroRuleLine} />
                    <View style={[styles.scrapbookHeroDot, { backgroundColor: selectedTemplate.accent }]} />
                    <View style={styles.scrapbookHeroRuleLine} />
                  </View>
                </>
              )}
              {isNeonTemplate && (
                <>
                  <View style={[styles.neonLightStreak, styles.neonLightStreakTop]} />
                  <View style={[styles.neonLightStreak, styles.neonLightStreakBottom]} />
                  <View style={styles.neonHeroChip}>
                    <View style={styles.neonHeroChipDot} />
                    <Text style={styles.neonHeroChipText}>Neon party</Text>
                  </View>
                  <View style={styles.neonHeroDivider}>
                    <View style={styles.neonHeroDividerLine} />
                    <View style={styles.neonHeroDividerCore} />
                    <View style={styles.neonHeroDividerLine} />
                  </View>
                </>
              )}
              {isPastelTemplate && (
                <>
                  <View style={[styles.pastelFloatOrb, styles.pastelFloatOrbPink]} />
                  <View style={[styles.pastelFloatOrb, styles.pastelFloatOrbBlue]} />
                  <View style={styles.pastelHeroChip}>
                    <View style={styles.pastelHeroSparkle} />
                    <Text style={styles.pastelHeroChipText}>Sweet birthday journal</Text>
                  </View>
                  <View style={styles.pastelHeroDivider}>
                    <View style={styles.pastelHeroDividerDot} />
                    <View style={styles.pastelHeroDividerLine} />
                    <View style={[styles.pastelHeroDividerDot, styles.pastelHeroDividerDotAlt]} />
                  </View>
                </>
              )}
              {isPopTemplate && (
                <>
                  <View style={[styles.popBurstShape, styles.popBurstShapePink]} />
                  <View style={[styles.popBurstShape, styles.popBurstShapeBlue]} />
                  <View style={styles.popHeroSticker}>
                    <Text style={styles.popHeroStickerText}>WOW!</Text>
                  </View>
                  <Text style={styles.popHeroChipText}>★ GALLERY HIGHLIGHTS ★</Text>
                  <View style={styles.popHeroDivider}>
                    <View style={styles.popHeroDividerBlock} />
                    <View style={styles.popHeroDividerLine} />
                    <View style={[styles.popHeroDividerBlock, styles.popHeroDividerBlockAlt]} />
                  </View>
                </>
              )}
              {isGoldenYearsTemplate && (
                <>
                  <View style={[styles.anniversaryRibbon, styles.goldenRibbon]} />
                  <Text style={styles.goldenHeroLabel}>Golden Years</Text>
                  <View style={styles.goldenHeroRule}>
                    <View style={styles.goldenHeroRuleLine} />
                    <View style={styles.goldenHeroMedallion} />
                    <View style={styles.goldenHeroRuleLine} />
                  </View>
                </>
              )}
              {isVintageTemplate && (
                <>
                  <Text style={styles.vintageHeroIssue}>Anniversary archive</Text>
                  <View style={styles.vintageHeroRule} />
                </>
              )}
              {isRoseTemplate && (
                <>
                  <View style={[styles.rosePetal, styles.rosePetalOne]} />
                  <View style={[styles.rosePetal, styles.rosePetalTwo]} />
                  <Text style={styles.roseHeroLabel}>Rose Garden</Text>
                  <View style={styles.roseHeroVine} />
                </>
              )}
              {isMinimalLoveTemplate && (
                <>
                  <Text style={styles.minimalHeroLabel}>A quiet love story</Text>
                  <View style={styles.minimalHeroRule} />
                </>
              )}
              <View style={styles.titleRowMain}>
                <Text style={[
                  styles.heroTitle,
                  { color: selectedTemplate.text, flex: 1 },
                  isScrapbookTemplate && styles.scrapbookHeroTitle,
                  isNeonTemplate && styles.neonHeroTitle,
                  isPastelTemplate && styles.pastelHeroTitle,
                  isPopTemplate && styles.popHeroTitle,
                  isGoldenYearsTemplate && styles.goldenHeroTitle,
                  isVintageTemplate && styles.vintageHeroTitle,
                  isRoseTemplate && styles.roseHeroTitle,
                  isMinimalLoveTemplate && styles.minimalHeroTitle,
                  selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' },
                  { textAlign: (currentActiveEvent as any)?.titleAlign || (event as any)?.titleAlign || 'left' }
                ]}>
                  {currentActiveEvent?.title || event.title}
                </Text>
                {showAdminView && (
                  <TouchableOpacity
                    style={styles.renameHeroBtn}
                    onPress={() => {
                      setEditTitle(currentActiveEvent?.title || event.title);
                      setEditTitleAlign((currentActiveEvent as any)?.titleAlign || (event as any)?.titleAlign || 'left');
                      setShowRenameModal(true);
                    }}
                  >
                    <IconSymbol name="pencil" size={22} color={MidnightColors.gold} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={[
                  styles.heroMeta,
                  { marginTop: 0 },
                  isNeonTemplate && styles.neonHeroMeta,
                  isPastelTemplate && styles.pastelHeroMeta,
                  isPopTemplate && styles.popHeroMeta,
                  isGoldenYearsTemplate && styles.goldenHeroMeta,
                  isVintageTemplate && styles.vintageHeroMeta,
                  isRoseTemplate && styles.roseHeroMeta,
                  isMinimalLoveTemplate && styles.minimalHeroMeta,
                ]}>
                  <IconSymbol name="calendar" size={12} color={selectedTemplate.accent} />
                  <Text style={[
                    styles.heroDate,
                    { color: selectedTemplate.accent },
                    isNeonTemplate && styles.neonHeroDate,
                    isPastelTemplate && styles.pastelHeroDate,
                    isPopTemplate && styles.popHeroDate,
                    isAnniversaryTemplate && styles.anniversaryHeroDate,
                    selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic', letterSpacing: 2 }
                  ]}>{currentActiveEvent?.date || event.date}</Text>
                  {showAdminView && (
                    <TouchableOpacity
                      style={styles.editDateBtn}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <IconSymbol name="pencil" size={12} color={selectedTemplate.accent} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.heroMeta,
                    { marginTop: 0 },
                    isNeonTemplate && styles.neonShareButton,
                    isPastelTemplate && styles.pastelShareButton,
                    isPopTemplate && styles.popShareButton,
                    isAnniversaryTemplate && styles.anniversaryShareButton,
                  ]}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={12} color={selectedTemplate.accent} />
                  <Text style={[
                    styles.heroDate,
                    { color: selectedTemplate.accent },
                    isNeonTemplate && styles.neonHeroDate,
                    isPastelTemplate && styles.pastelHeroDate,
                    isPopTemplate && styles.popHeroDate,
                    isAnniversaryTemplate && styles.anniversaryHeroDate,
                  ]}>Share Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Visitor Navigation Tabs placed BELOW the Cover Photo screen */}
        {!showAdminView && canViewContent && (
          <ThemeHeader
            event={event}
            selectedTemplate={selectedTemplate}
            activeSubEvent={activeSubEvent}
            subEvents={subEvents}
            handleSubEventChange={handleSubEventChange}
            styles={styles}
          />
        )}

        {/* ── CONTENT ── */}
        <View style={[styles.content, showAdminView && { paddingBottom: 60 + insets.bottom }]}>
          {showAdminView ? (
            <>
              {/* Owner Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'galleries' && styles.activeTab]}
                  onPress={() => { setActiveTab('galleries'); setGalleryMediaTab('photos'); setSelectedAdminGallery(undefined); }}
                >
                  <Text style={[styles.tabText, activeTab === 'galleries' && styles.activeTabText]}>Galleries</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'permissions' && styles.activeTab]}
                  onPress={() => setActiveTab('permissions')}
                >
                  <Text style={[styles.tabText, activeTab === 'permissions' && styles.activeTabText]}>Permissions</Text>
                  {guestLogs.filter(l => l.status === 'pending').length > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{guestLogs.filter(l => l.status === 'pending').length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'design' && styles.activeTab]}
                  onPress={() => { setActiveTab('design'); setGalleryMediaTab('photos'); setSelectedAdminGallery(undefined); }}
                >
                  <Text style={[styles.tabText, activeTab === 'design' && styles.activeTabText]}>Design</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'partners' && styles.activeTab]}
                  onPress={() => { setActiveTab('partners'); setGalleryMediaTab('photos'); setSelectedAdminGallery(undefined); }}
                >
                  <Text style={[styles.tabText, activeTab === 'partners' && styles.activeTabText]}>Partners</Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'galleries' && (
                <View style={styles.section}>
                  {selectedAdminGallery === undefined ? (
                    // ── GALLERY CARDS LIST ──
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Galleries</Text>
                        <TouchableOpacity style={styles.addBtn} onPress={openSubEventModal}>
                          <IconSymbol name="plus" size={12} color={MidnightColors.gold} />
                          <Text style={styles.addBtnText}>Add Sub-Gallery</Text>
                        </TouchableOpacity>
                      </View>

                      {/* PRIMARY GALLERY */}
                      <View style={{ width: '100%', marginBottom: 20 }}>
                        <Text style={{
                          fontSize: 12,
                          color: MidnightColors.gold,
                          fontFamily: Fonts.outfit.bold,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          marginBottom: 8,
                          marginTop: 4
                        }}>
                          Primary Gallery
                        </Text>
                        {event && (
                          <TouchableOpacity
                            style={[
                              styles.subCard,
                              { borderColor: selectedTemplate.accent, borderWidth: 1.5 }
                            ]}
	                            onPress={() => {
	                              loadPhotos(event.id, event.legacyId);
	                              setGalleryDescText(event.description || '');
                                  setGalleryMediaTab('photos');
	                              setSelectedAdminGallery(null);
	                            }}
                            activeOpacity={0.85}
                          >
                            <Image source={{ uri: resolveEventCoverImage(event.coverImage, 'thumbnail') }} style={styles.subImageFull} />
                            <LinearGradient
                              colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.35)', 'rgba(0, 0, 0, 0.85)']}
                              style={StyleSheet.absoluteFillObject}
                            />

                            {/* Premium Badge */}
                            <View style={styles.badgeContainer}>
                              <LinearGradient
                                colors={['#e2c262', '#cfa126']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.badgeGradient}
                              >
                                <IconSymbol name="house.fill" size={10} color="#000000" />
                                <Text style={styles.badgeTextLabel}>PRIMARY</Text>
                              </LinearGradient>
                            </View>

                            <View style={styles.subInfoOverlay}>
                              <Text style={styles.subTitleOverlay} numberOfLines={2}>
                                {event.title || 'Home'}
                              </Text>
                              <View style={styles.subArrowCircle}>
                                <IconSymbol name="chevron.right" size={10} color="#ffffff" />
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* SUB-GALLERIES (DRAG TO REORDER) */}
                      <View style={{ width: '100%', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{
                            fontSize: 12,
                            color: MidnightColors.gold,
                            fontFamily: Fonts.outfit.bold,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            marginTop: 4
                          }}>
                            Sub-Galleries
                          </Text>
                        </View>

                        {subEvents.length === 0 ? (
                          <View style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: 16,
                            padding: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.05)',
                            borderStyle: 'dashed'
                          }}>
                            <IconSymbol name="photo.on.rectangle" size={24} color={MidnightColors.slate400} />
                            <Text style={{ color: MidnightColors.slate400, marginTop: 8, fontSize: 13, fontFamily: Fonts.inter.regular }}>
                              No sub-galleries created yet.
                            </Text>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' }}>
                            {subEvents.map((sub: any) => (
                              <TouchableOpacity
                                key={sub.id}
                                style={[styles.subCard, { width: '48%' }]}
	                                onPress={() => {
	                                  loadPhotos(sub.id, sub.legacyId);
	                                  setGalleryDescText(sub.description || '');
                                      setGalleryMediaTab('photos');
	                                  setSelectedAdminGallery(sub);
	                                }}
                                activeOpacity={0.85}
                              >
                                <Image source={{ uri: resolveEventCoverImage(sub.coverImage, 'thumbnail') }} style={styles.subImageFull} />
                                <LinearGradient
                                  colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.35)', 'rgba(0, 0, 0, 0.85)']}
                                  style={StyleSheet.absoluteFillObject}
                                />

                                {/* Sub-gallery Badge */}
                                <View style={styles.badgeContainer}>
                                  <View style={styles.subBadge}>
                                    <IconSymbol name="photo.on.rectangle" size={10} color="rgba(255, 255, 255, 0.9)" />
                                    <Text style={styles.subBadgeTextLabel}>SUB-GALLERY</Text>
                                  </View>
                                </View>

                                {/* Card Delete Option */}
                                <TouchableOpacity
                                  style={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    zIndex: 20,
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.15)',
                                  }}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubGallery(sub);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <IconSymbol name="trash.fill" size={12} color="#ef4444" />
                                </TouchableOpacity>

                                <View style={styles.subInfoOverlay}>
                                  <Text style={styles.subTitleOverlay} numberOfLines={2}>
                                    {sub.title}
                                  </Text>
                                  <View style={styles.subArrowCircle}>
                                    <IconSymbol name="chevron.right" size={10} color="#ffffff" />
                                  </View>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Delete Event */}
                      <TouchableOpacity style={styles.deleteMainBtn} onPress={handleDeleteMainEvent}>
                        <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                        <Text style={styles.deleteMainText}>Delete Event</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // ── INLINE GALLERY MANAGER ──
                    <>
                      {/* Header with back button */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                          onPress={() => setSelectedAdminGallery(undefined)}
                        >
                          <IconSymbol name="chevron.left" size={18} color={MidnightColors.gold} />
                          <Text style={{ color: MidnightColors.gold, fontSize: 14, fontWeight: '600', fontFamily: Fonts.outfit.semiBold }}>Back to Galleries</Text>
                        </TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 12, fontFamily: Fonts.inter.bold, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {selectedAdminGallery === null ? 'PRIMARY' : 'SUB-GALLERY'}
                        </Text>
                      </View>

                      {/* Welcome Message Editor */}
                      <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>Welcome Message</Text>
                          <Text style={{ color: (galleryDescText?.length || 0) >= 200 ? '#ef4444' : 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                            {galleryDescText?.length || 0}/200
                          </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(204,164,59,0.25)', overflow: 'hidden' }}>
                          <TextInput
                            style={{ color: '#ffffff', fontSize: 14, lineHeight: 22, minHeight: 60, maxHeight: 100, padding: 12, textAlignVertical: 'top' }}
                            value={galleryDescText}
                            onChangeText={setGalleryDescText}
                            placeholder="Write a brief, elegant welcome note..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            multiline
                            maxLength={200}
                          />
                          <View style={{ backgroundColor: 'rgba(204,164,59,0.05)', borderTopWidth: 1, borderColor: 'rgba(204,164,59,0.1)', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                            {(() => {
                              const originalDesc = (selectedAdminGallery === null ? event!.description : selectedAdminGallery.description) || '';
                              const isChanged = galleryDescText !== originalDesc;

                              if (isChanged) {
                                return (
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                    onPress={async () => {
                                      const targetId = selectedAdminGallery === null ? event!.id : selectedAdminGallery.id;
                                      const { updateEvent } = await import('@/lib/database');
                                      await updateEvent(targetId, { description: galleryDescText });

                                      if (selectedAdminGallery === null) {
                                        event!.description = galleryDescText;
                                      } else {
                                        selectedAdminGallery.description = galleryDescText;
                                      }

                                      Alert.alert('Saved', 'Welcome message updated.');
                                    }}
                                  >
                                    <IconSymbol name="checkmark" size={12} color={MidnightColors.gold} />
                                    <Text style={{ color: MidnightColors.gold, fontWeight: '600', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Save</Text>
                                  </TouchableOpacity>
                                );
                              } else {
                                return (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.5 }} pointerEvents="none">
                                    <IconSymbol name="pencil" size={12} color={'#cbd5e1'} />
                                    <Text style={{ color: '#cbd5e1', fontWeight: '600', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Edit</Text>
                                  </View>
                                );
                              }
                            })()}
                          </View>
                        </View>
                      </View>

                      {/* Storage Quota Card (Admin View Only) */}
                      {showAdminView && storageStats && (
                        <View style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.06)',
                          gap: 8
                        }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <IconSymbol name="cloud.fill" size={14} color="#94a3b8" />
                              <Text style={{ color: '#94a3b8', fontSize: 13, fontFamily: Fonts.inter.bold }}>Storage Usage</Text>
                            </View>
                            <Text style={{ color: '#f1f5f9', fontSize: 13, fontFamily: Fonts.inter.bold }}>
                              {(() => {
                                const bytes = storageStats.used;
                                if (bytes === 0) return '0 GB';
                                const gb = bytes / (1024 * 1024 * 1024);
                                if (gb < 0.1) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                return `${gb.toFixed(2)} GB`;
                              })()}
                              <Text style={{ color: '#475569', fontSize: 11 }}> / {storageStats.label}</Text>
                            </Text>
                          </View>
                          <View style={{ height: 6, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <LinearGradient
                              colors={storageStats.percent >= 1 ? ['#ef4444', '#b91c1c'] : ['#d4af37', '#b49430']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, storageStats.percent * 100)}%` }}
                            />
                          </View>
                        </View>
                      )}

                      {/* Media Grid Header */}
                      <View style={{ marginBottom: 12, gap: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.sectionTitle}>
                            Gallery Media
                          </Text>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(204,164,59,0.12)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: MidnightColors.gold }}
                            onPress={galleryMediaTab === 'videos' ? handleUploadGalleryVideo : handleUploadGalleryPhoto}
                          >
                            <IconSymbol name="plus" size={13} color={MidnightColors.gold} />
                            <Text style={{ color: MidnightColors.gold, fontSize: 12, fontWeight: '600' }}>
                              {galleryMediaTab === 'videos' ? 'Add Video' : 'Add Photo'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                          {mediaTabs.map((item) => {
                            const active = galleryMediaTab === item.id;
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, backgroundColor: active ? MidnightColors.gold : 'transparent' }}
                                onPress={() => setGalleryMediaTab(item.id)}
                              >
                                <Text style={{ color: active ? '#050505' : '#cbd5e1', fontSize: 12, fontFamily: Fonts.inter.bold }}>
                                  {item.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Media Grid */}
                      {loadingPhotos ? (
                        <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 24 }} />
                      ) : activeGalleryItems.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                          <IconSymbol name={galleryMediaTab === 'videos' ? 'play.fill' : 'photo.on.rectangle'} size={36} color={MidnightColors.slate700} />
                          <Text style={{ color: MidnightColors.slate400, marginTop: 10, fontSize: 14 }}>
                            {galleryMediaTab === 'videos' ? 'No videos yet. Tap Add Video!' : 'No photos yet. Tap Add Photo!'}
                          </Text>
                        </View>
                      ) : galleryMediaTab === 'videos' ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {videoItems.map((video, idx) => {
                            const shouldBlurVideo = shouldBlurMediaForPlan(video);
                            return (
                            <View key={video.id} style={{ position: 'relative', width: '31.5%', aspectRatio: 1 }}>
                              <GalleryVideoCard
                                video={video}
                                accent={MidnightColors.gold}
                                compact
                                blurred={shouldBlurVideo}
                                onOpen={() => openViewer(idx)}
                              />
                              <TouchableOpacity
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: 'rgba(239,68,68,0.92)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onPress={() => handleDeleteGalleryPhoto(video.id)}
                              >
                                <IconSymbol name="trash.fill" size={10} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          );
                          })}
                        </View>
                      ) : (
                        <View>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8, letterSpacing: 0.4 }}>
                            ✦ Hold & drag a photo to reorder
                          </Text>
                          <Sortable.Grid
                            data={photoItems}
                            keyExtractor={(item: any) => item.id}
                            columns={3}
                            columnGap={8}
                            rowGap={8}
                            onDragEnd={({ data: newData }: { data: any[] }) => handleReorderPhotos(newData)}
                            renderItem={({ item }: { item: any }) => {
                              const shouldBlurPhoto = shouldBlurMediaForPlan(item);
                              return (
                              <View style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() => {
                                    const photoIndex = photoItems.findIndex(photo => photo.id === item.id);
                                    openViewer(photoIndex >= 0 ? photoIndex : 0);
                                  }}
                                >
                                  <GalleryThumbnailImage
                                    url={item.url}
                                    thumbnailUrl={item.thumbnailUrl}
                                    style={{
                                      width: '100%',
                                      aspectRatio: 1,
                                      borderRadius: 10,
                                    }}
                                    blurRadius={shouldBlurPhoto ? 6 : 0}
                                  />
                                </TouchableOpacity>
                                {shouldBlurPhoto && <ExpiredMediaThumbnailNotice />}
                                <TouchableOpacity
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4,
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: 'rgba(15,23,42,0.85)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onPress={() => openGalleryPhotoActions(item)}
                                >
                                  <Text style={{ color: '#fff', fontSize: 14, lineHeight: 14, fontWeight: '900' }}>⋯</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: 'rgba(239,68,68,0.9)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onPress={() => handleDeleteGalleryPhoto(item.id)}
                                >
                                  <IconSymbol name="trash.fill" size={10} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            );
                            }}
                          />
                        </View>
                      )}

                      {/* Delete Sub-Gallery Option */}
                      {selectedAdminGallery !== null && (
                        <TouchableOpacity style={[styles.deleteMainBtn, { marginTop: 24, marginBottom: 10 }]} onPress={() => handleDeleteSubGallery()}>
                          <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                          <Text style={styles.deleteMainText}>Delete Gallery</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}

              {activeTab === 'permissions' && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Guest List</Text>
                  </View>

                  {/* ── PENDING REQUESTS ── */}
                  <View style={{ gap: 12 }}>
                    {pendingGuests.length > 0 && (
                      <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 4, marginTop: 10 }]}>
                        Pending Requests ({pendingGuests.length})
                      </Text>
                    )}
                    {pendingGuests.map(log => (
                      <TouchableOpacity
                        key={log.id}
                        style={styles.requestCardItem}
                        onPress={() => setSelectedRequest(log)}
                      >
                        <View style={styles.requestAvatar}>
                          <Text style={styles.avatarTextSmall}>{log.name.charAt(0)}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.requestName}>{log.name}</Text>
                          <Text style={styles.requestPhone}>{log.phone}</Text>
                        </View>

                        <View style={styles.requestActionsMini}>
                          <TouchableOpacity
                            style={styles.miniActionBtnRed}
                            onPress={() => updateGuestStatus(log.id, 'rejected').then(loadEvent)}
                          >
                            <IconSymbol name="xmark" size={12} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.miniActionBtnGreen}
                            onPress={() => updateGuestStatus(log.id, 'approved').then(loadEvent)}
                          >
                            <IconSymbol name="checkmark" size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* ── APPROVED MEMBERS ── */}
                  {approvedGuests.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      {adminGuests.length > 0 && (
                        <View>
                          <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 16, marginTop: 10 }]}>
                            Admins ({adminGuests.length})
                          </Text>
                          {adminGuests.map((log, index) => renderApprovedGuestCard(log, index))}
                        </View>
                      )}

                      {memberGuests.length > 0 && (
                        <View style={{ marginTop: adminGuests.length > 0 ? 18 : 0 }}>
                          <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 16, marginTop: 10 }]}>
                            Members ({memberGuests.length})
                          </Text>
                          {memberGuests.map((log, index) => renderApprovedGuestCard(log, index))}
                        </View>
                      )}
                    </View>
                  )}

                  {guestLogs.length === 0 && (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="person.2.fill" size={48} color="rgba(255, 255, 255, 0.05)" />
                      <Text style={styles.emptyText}>No guests yet.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── PREMIUM MEMBER PERMISSIONS MODAL ── */}
              <Modal visible={!!selectedGuest} transparent animationType="fade">
                <View style={styles.premiumModalBackdrop}>
                  <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    <LinearGradient
                      colors={['#101010', '#050505']}
                      style={styles.premiumModalContent}
                    >
                      {/* Header: Member Identity */}
                      <View style={styles.premiumModalHeader}>
                        <View style={styles.premiumAvatar}>
                          {selectedGuestPhoto ? (
                            <Image source={{ uri: selectedGuestPhoto }} style={styles.memberInfoAvatarImage} />
                          ) : (
                            <LinearGradient colors={[MidnightColors.gold, '#b8860b']} style={styles.avatarGradient}>
                              <Text style={styles.premiumAvatarText}>{selectedGuest?.name.charAt(0)}</Text>
                            </LinearGradient>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                          <Text style={styles.premiumModalTitle}>{selectedGuest?.name}</Text>
                          <Text style={styles.premiumModalSub}>Member #0{guestLogs.filter(l => l.status === 'approved').findIndex(l => l.id === selectedGuest?.id) + 1}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedGuest(null)} style={styles.closeModalCircle}>
                          <IconSymbol name="xmark" size={16} color={MidnightColors.slate400} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.permissionsScroll}>
                        <View style={styles.userInfoPanel}>
                          <View style={styles.userInfoDetails}>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Profile Name</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedGuestName}</Text>
                            </View>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Username</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedGuestUsername}</Text>
                            </View>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Email ID</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedGuestEmail}</Text>
                            </View>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Phone Number</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedGuestPhone}</Text>
                            </View>
                          </View>
                        </View>

                        <Text style={styles.permissionsGroupLabel}>Member Privileges</Text>

                        {[
                          { id: 'viewAccess', label: 'View Access', desc: 'Can open and view this event gallery', icon: 'eye.fill' },
                          { id: 'canAdmin', label: 'Admin Access', desc: 'Manage event, sub-galleries, and other guests', icon: 'shield.fill' },
                          { id: 'canUpload', label: 'Allow Uploads', desc: 'Can add photos and videos to the event', icon: 'camera.fill' },
                          { id: 'canComment', label: 'Allow Comments', desc: 'Can react and post comments on any media', icon: 'bubble.left.fill' },
                        ].map((perm) => {
                          const isViewAccess = perm.id === 'viewAccess';
                          const isActive = isViewAccess
                            ? selectedGuest?.status === 'approved'
                            : Boolean((selectedGuest as any)?.[perm.id] || (selectedGuest?.canAdmin && (perm.id === 'canUpload' || perm.id === 'canComment')));
                          const isSelfAdminCheck = perm.id === 'canAdmin' && selectedGuest && doesGuestLogBelongToCurrentUser(selectedGuest) && !isOwner;
                          const displayDesc = isSelfAdminCheck ? "Ask host to remove you" : perm.desc;

                          return (
                            <TouchableOpacity
                              key={perm.id}
                              style={[
                                styles.richPermCard,
                                isActive && styles.richPermCardActive,
                                isSelfAdminCheck && { opacity: 0.8 }
                              ]}
                              onPress={() => {
                                if (selectedGuest) {
                                  if (isViewAccess) {
                                    const nextStatus: GuestLog['status'] = isActive ? 'rejected' : 'approved';
                                    updateGuestStatus(selectedGuest.id, nextStatus).then(() => {
                                      const updatedGuest = {
                                        ...selectedGuest,
                                        status: nextStatus,
                                        ...(nextStatus === 'approved' ? { canUpload: true, canComment: true } : {}),
                                      };
                                      setSelectedGuest(nextStatus === 'approved' ? updatedGuest : null);
                                      loadEvent();
                                    });
                                    return;
                                  }
                                  if (isSelfAdminCheck) {
                                    Alert.alert("Permission Denied", "Ask host to remove you.");
                                    return;
                                  }
                                  const nextValue = !isActive;
                                  const newPerms = perm.id === 'canAdmin' && nextValue
                                    ? { canAdmin: true, canUpload: true, canComment: true }
                                    : { [perm.id]: nextValue };
                                  const applyPermissionUpdate = () => {
                                    updateGuestPermissions(selectedGuest.id, newPerms).then(() => {
                                      setSelectedGuest({
                                        ...selectedGuest,
                                        ...(perm.id === 'canAdmin' && nextValue ? { status: 'approved' as GuestLog['status'] } : {}),
                                        ...newPerms,
                                      });
                                      loadEvent();
                                    });
                                  };

                                  if (perm.id === 'canAdmin' && nextValue && selectedGuest.status !== 'approved') {
                                    updateGuestStatus(selectedGuest.id, 'approved').then(applyPermissionUpdate);
                                  } else {
                                    applyPermissionUpdate();
                                  }
                                }
                              }}
                            >
                              <View style={[styles.richPermIconBox, isActive && { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                                <IconSymbol name={perm.icon as any} size={26} color={isActive ? MidnightColors.gold : MidnightColors.slate400} />
                              </View>

                              <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={[styles.richPermLabel, isActive && { color: '#fff' }]}>{perm.label}</Text>
                                <Text
                                  style={[
                                    styles.richPermDesc,
                                    isSelfAdminCheck && { color: MidnightColors.gold, fontWeight: '600' }
                                  ]}
                                  numberOfLines={2}
                                >
                                  {displayDesc}
                                </Text>
                              </View>

                              <View style={[styles.customToggle, isActive && styles.customToggleActive, isSelfAdminCheck && { opacity: 0.6 }]}>
                                <View style={[styles.customToggleThumb, isActive && styles.customToggleThumbActive]} />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        style={styles.premiumDoneBtn}
                        onPress={() => setSelectedGuest(null)}
                      >
                        <LinearGradient
                          colors={[MidnightColors.gold, '#b8860b']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.premiumDoneGradient}
                        >
                          <Text style={styles.premiumDoneText}>Save Permissions</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </View>
              </Modal>

              {/* ── PREMIUM REQUEST DETAIL MODAL ── */}
              <Modal visible={!!selectedRequest} transparent animationType="fade">
                <View style={styles.premiumModalBackdrop}>
                  <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    <LinearGradient
                      colors={['#101010', '#050505']}
                      style={styles.premiumModalContent}
                    >
                      {/* Header: Member Identity */}
                      <View style={styles.premiumModalHeader}>
                        <View style={styles.premiumAvatar}>
                          {selectedRequestPhoto ? (
                            <Image source={{ uri: selectedRequestPhoto }} style={styles.memberInfoAvatarImage} />
                          ) : (
                            <LinearGradient colors={[MidnightColors.gold, '#b8860b']} style={styles.avatarGradient}>
                              <Text style={styles.premiumAvatarText}>{selectedRequest?.name.charAt(0)}</Text>
                            </LinearGradient>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                          <Text style={styles.premiumModalTitle}>{selectedRequest?.name}</Text>
                          <Text style={styles.premiumModalSub}>Requesting Access</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedRequest(null)} style={styles.closeModalCircle}>
                          <IconSymbol name="xmark" size={16} color={MidnightColors.slate400} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.permissionsScroll}>
                        <View style={styles.userInfoPanel}>
                          <View style={styles.userInfoDetails}>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Profile Name</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedRequestName}</Text>
                            </View>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Username</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedRequestUsername}</Text>
                            </View>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Email ID</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedRequestEmail}</Text>
                            </View>
                            <View style={styles.userInfoDetailRow}>
                              <Text style={styles.userInfoDetailLabel}>Phone Number</Text>
                              <Text style={styles.userInfoDetailValue}>{selectedRequestPhone}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={[styles.modalFooter, { paddingHorizontal: 16, paddingBottom: 18, gap: 10 }]}>
                        <TouchableOpacity
                          style={[styles.modalActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                          onPress={() => {
                            if (selectedRequest) {
                              updateGuestStatus(selectedRequest.id, 'rejected').then(() => {
                                setSelectedRequest(null);
                                loadEvent();
                              });
                            }
                          }}
                        >
                          <Text style={[styles.modalActionText, { color: '#ef4444' }]}>Reject</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.modalActionBtnApprove}
                          onPress={() => {
                            if (selectedRequest) {
                              updateGuestStatus(selectedRequest.id, 'approved').then(() => {
                                setSelectedRequest(null);
                                loadEvent();
                              });
                            }
                          }}
                        >
                          <LinearGradient
                            colors={['#10b981', '#059669']}
                            style={styles.approveGradient}
                          >
                            <Text style={styles.modalActionTextWhite}>Approve Access</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </View>
                </View>
              </Modal>

              {activeTab === 'design' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Event Design</Text>

                  {/* Step 1: Event Type */}
                  <TouchableOpacity style={styles.designCard} onPress={() => setShowCategoryModal(true)}>
                    <View style={styles.designInfo}>
                      <Text style={styles.designLabel}>Event Type</Text>
                      <Text style={styles.designValue}>{event.category || 'Select Type'}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={MidnightColors.gold} />
                  </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.designCard, { marginTop: 12 }]}
                      onPress={() => setShowTemplateModal(true)}
                    >
                      <View style={styles.designInfo}>
                        <Text style={styles.designLabel}>Change Template</Text>
                        <Text style={styles.designValue}>{event.templateId ? MOBILE_TEMPLATE_THEMES.find(t => t.id === event.templateId)?.label : 'Hero (Default)'}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={MidnightColors.gold} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.designCard, { marginTop: 12, backgroundColor: 'rgba(212, 175, 55, 0.08)', borderColor: 'rgba(212, 175, 55, 0.3)', borderWidth: 1 }]}
                      onPress={() => setIsAdminViewActive(false)}
                    >
                      <View style={styles.designInfo}>
                        <Text style={[styles.designLabel, { color: '#cca43b' }]}>Preview Guest Theme</Text>
                        <Text style={[styles.designValue, { color: '#cbd5e1', fontSize: 12, fontFamily: Fonts.inter.regular, marginTop: 2 }]}>
                          See how guests view your {event.templateId ? MOBILE_TEMPLATE_THEMES.find(t => t.id === event.templateId)?.label : 'Hero'} theme
                        </Text>
                      </View>
                      <IconSymbol name="eye.fill" size={16} color="#cca43b" />
                    </TouchableOpacity>
                </View>
              )}

              {activeTab === 'partners' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Event Partners</Text>

                  {linkedVendors.length === 0 && (
                    <View style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.4)',
                      borderRadius: 20,
                      paddingVertical: 20,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(204, 164, 59, 0.2)',
                    }}>
                      <Text style={{
                        color: '#fff',
                        fontSize: 14,
                        fontFamily: Fonts.outfit.bold,
                        textTransform: 'uppercase',
                        letterSpacing: 1.5,
                        marginBottom: 8
                      }}>Partner Management</Text>

                      <Text style={{
                        color: '#cbd5e1',
                        fontSize: 13,
                        textAlign: 'center',
                        lineHeight: 20,
                        paddingHorizontal: 12,
                        fontFamily: Fonts.inter.regular,
                      }}>
                        Connect photographers, makeup artists, and venues to your event page using their unique Vendor Code.
                      </Text>

                      <TouchableOpacity
                        style={{
                          marginTop: 18,
                          backgroundColor: MidnightColors.gold,
                          paddingHorizontal: 28,
                          paddingVertical: 10,
                          borderRadius: 24,
                        }}
                        onPress={() => setLinkingVendor(true)}
                      >
                        <Text style={{ color: '#000', fontFamily: Fonts.outfit.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Link a Vendor</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {linkedVendors.length > 0 && (
                    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{
                          color: '#cbd5e1',
                          fontSize: 11,
                          fontFamily: Fonts.inter.bold,
                          textTransform: 'uppercase',
                          letterSpacing: 1.2
                        }}>Linked Partners</Text>

                        {!linkingVendor && (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: 'rgba(204, 164, 59, 0.12)',
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderWidth: 1,
                              borderColor: MidnightColors.gold
                            }}
                            onPress={() => setLinkingVendor(true)}
                          >
                            <IconSymbol name="plus" size={12} color={MidnightColors.gold} />
                            <Text style={{ color: MidnightColors.gold, fontSize: 11, fontFamily: Fonts.outfit.bold, textTransform: 'uppercase', letterSpacing: 0.5 }}>Link Partner</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={{ gap: 12 }}>
                        {linkedVendors.map((biz) => (
                          <View key={biz.id} style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: 'rgba(30, 41, 59, 0.3)',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.05)',
                          }}>
                            <Image
                              source={{ uri: biz.coverImage || 'https://via.placeholder.com/150' }}
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                marginRight: 14,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                              }}
                            />

                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 15, fontFamily: Fonts.outfit.bold }}>{biz.name}</Text>
                              <Text style={{ color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium, marginTop: 2 }}>{biz.type}</Text>
                            </View>

                            <TouchableOpacity
                              style={{
                                padding: 8,
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.15)',
                              }}
                              onPress={async () => {
                                const newVendors = event?.vendors?.filter(vid => vid !== biz.id) || [];
                                await updateEvent(event!.id, { vendors: newVendors });
                                setEvent({ ...event!, vendors: newVendors });
                                setLinkedVendors(linkedVendors.filter(v => v.id !== biz.id));
                              }}
                            >
                              <IconSymbol name="trash.fill" size={14} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              {!canViewContent ? (
                <GatedAccessPanel
                  event={event}
                  selectedTemplate={selectedTemplate}
                  isThemeDark={isThemeDark}
                  guestStatus={guestStatus}
                  guestName={guestName}
                  setGuestName={setGuestName}
                  guestPhone={guestPhone}
                  setGuestPhone={setGuestPhone}
                  user={user}
                  updating={updating}
                  handleGuestAccess={handleGuestAccess}
                  handleRequestAccessAgain={handleRequestAccessAgain}
                  styles={styles}
                />
              ) : (
                <>
                  {/* ── VISITOR IMMERSIVE CONTENT ── */}
                  <View style={[styles.visitorContent, { backgroundColor: pageBackground }]}>
                {(event as any).showWelcomeCard !== false && activeSubEvent?.id !== 'event-partners' && activeSubEvent?.id !== 'find-you' && (
                  <View style={[
                    styles.mainInfoBox,
                    {
                      backgroundColor: selectedTemplate.panel,
                      borderColor: event.templateId === 'classic' ? 'rgba(0,0,0,0.05)' : selectedTemplate.accentBg,
                      borderRadius: selectedTemplate.radius,
                    },
                    isScrapbookTemplate && styles.scrapbookInfoBox,
                    isNeonTemplate && styles.neonInfoBox,
                    isPastelTemplate && styles.pastelInfoBox,
                    isPopTemplate && styles.popInfoBox,
                    isGoldenYearsTemplate && styles.goldenInfoBox,
                    isVintageTemplate && styles.vintageInfoBox,
                    isRoseTemplate && styles.roseInfoBox,
                    isMinimalLoveTemplate && styles.minimalInfoBox,
                    isCyberTechTemplate && styles.cyberInfoBox,
                    isRetroArcadeTemplate && styles.retroArcadeInfoBox,
                    isNeonCarnivalTemplate && styles.neonCarnivalInfoBox,
                    isGardenTemplate && styles.gardenInfoBox,
                    isMuseumTemplate && styles.museumInfoBox,
                    isBrutalistTemplate && styles.brutalistInfoBox,
                    isTechSleekTemplate && styles.techSleekInfoBox,
                    isExecutiveTemplate && styles.executiveInfoBox,
                    isSportsTemplate && [
                      styles.sportsInfoBox,
                      { backgroundColor: sportsTheme.card, borderColor: `${sportsTheme.accent}55`, shadowColor: sportsTheme.darkControl },
                    ],
                    event.templateId === 'classic' && {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 2,
                      elevation: 1,
                      borderWidth: 1,
                    },
                    event.templateId === 'royal' && {
                      borderWidth: 1,
                      borderColor: 'rgba(204, 164, 59, 0.35)',
                      borderRadius: 12,
                      padding: 10,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    },
                    event.templateId === 'hero' && {
                      borderWidth: 0.8,
                      borderColor: '#cca43b',
                      borderRadius: 4,
                      padding: 12,
                      borderLeftWidth: 0.8, // override dynamic left border stripe
                    },
                    event.templateId === 'ethereal' && {
                      borderWidth: 1,
                      borderColor: selectedTemplate.accent + '4d',
                      borderRadius: 2,
                      padding: 8,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    },
                    event.templateId === 'academic_editorial' && {
                      borderWidth: 1,
                      borderColor: selectedTemplate.text,
                      borderRadius: 0,
                      padding: 6,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    }
                  ]}>
                    <View style={[
                      isScrapbookTemplate && styles.scrapbookInfoInner,
                      isNeonTemplate && styles.neonInfoInner,
                      isPastelTemplate && styles.pastelInfoInner,
                      isPopTemplate && styles.popInfoInner,
                      isGoldenYearsTemplate && styles.goldenInfoInner,
                      isVintageTemplate && styles.vintageInfoInner,
                      isRoseTemplate && styles.roseInfoInner,
                      isMinimalLoveTemplate && styles.minimalInfoInner,
                      isCyberTechTemplate && styles.cyberInfoInner,
                      isRetroArcadeTemplate && styles.retroArcadeInfoInner,
                      isNeonCarnivalTemplate && styles.neonCarnivalInfoInner,
                      isGardenTemplate && styles.gardenInfoInner,
                      isMuseumTemplate && styles.museumInfoInner,
                      isBrutalistTemplate && styles.brutalistInfoInner,
                      isTechSleekTemplate && styles.techSleekInfoInner,
                      isExecutiveTemplate && styles.executiveInfoInner,
                      isSportsTemplate && styles.sportsInfoInner,
                      event.templateId === 'royal' && {
                        borderWidth: 1,
                        borderColor: 'rgba(204, 164, 59, 0.15)',
                        borderRadius: 8,
                        paddingVertical: 20,
                        paddingHorizontal: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      },
                      event.templateId === 'hero' && {
                        borderWidth: 0.8,
                        borderColor: 'rgba(204, 164, 59, 0.25)',
                        borderRadius: 2,
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      },
                      event.templateId === 'ethereal' && {
                        borderWidth: 0.5,
                        borderColor: selectedTemplate.accent + '33',
                        borderRadius: 1,
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      },
                      event.templateId === 'academic_editorial' && {
                        borderWidth: 0.5,
                        borderColor: selectedTemplate.text + '26',
                        borderRadius: 0,
                        paddingVertical: 20,
                        paddingHorizontal: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        backgroundColor: selectedTemplate.background,
                      },
                      { position: 'relative' }
                    ]}>
                      {isScrapbookTemplate && (
                        <View style={styles.scrapbookInfoRule}>
                          <View style={[styles.scrapbookInfoRuleLine, { backgroundColor: selectedTemplate.accent }]} />
                          <View style={styles.scrapbookInfoRuleShort} />
                        </View>
                      )}

                      {event.templateId === 'royal' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 10, marginBottom: 12 }}>✦  ♦  ✦</Text>
                      )}
                      {event.templateId === 'hero' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 11, marginBottom: 14, letterSpacing: 2 }}>✦   ♦   ✦</Text>
                      )}
                      {event.templateId === 'ethereal' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 14, marginBottom: 12, fontFamily: selectedTemplate.serifFont }}>❦</Text>
                      )}
                      {event.templateId === 'academic_editorial' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 14, marginBottom: 12, fontFamily: selectedTemplate.serifFont }}>§</Text>
                      )}

                      {isCyberTechTemplate && (
                        <View style={styles.cyberInfoHeader}>
                          <Text style={styles.cyberInfoKicker}>[BROADCAST INCOMING]</Text>
                        </View>
                      )}

                      {isNeonTemplate && (
                        <View style={styles.neonInfoHeader}>
                          <View style={styles.neonInfoPulse} />
                          <Text style={styles.neonInfoKicker}>Party highlights</Text>
                          <View style={styles.neonInfoLine} />
                        </View>
                      )}

                      {isPastelTemplate && (
                        <View style={styles.pastelInfoHeader}>
                          <View style={styles.pastelInfoPetal} />
                          <Text style={styles.pastelInfoKicker}>Sweet Memories</Text>
                          <View style={styles.pastelInfoLine} />
                        </View>
                      )}

                      {isPopTemplate && (
                        <>
                          <View style={styles.popInfoHeader}>
                            <Text style={styles.popInfoBang}>!</Text>
                            <Text style={styles.popInfoKicker}>{"Host's Broadcast"}</Text>
                            <View style={styles.popInfoStripe} />
                          </View>
                          {/* Speech Bubble Tail */}
                          <View style={styles.popBubbleTailOuter}>
                            <View style={styles.popBubbleTail} />
                          </View>
                        </>
                      )}

                      {isRetroArcadeTemplate && (
                        <View style={styles.retroArcadeInfoHeader}>
                          <View style={styles.retroArcadeInfoBadge}>
                            <Text style={styles.retroArcadeInfoBadgeText}>! BROADCAST</Text>
                          </View>
                          <View style={styles.retroArcadeInfoStripe} />
                        </View>
                      )}

                      {isNeonCarnivalTemplate && (
                        <View style={styles.neonCarnivalInfoHeader}>
                          <View style={styles.neonCarnivalInfoPulse} />
                          <Text style={styles.neonCarnivalInfoKicker}>CARNIVAL BROADCAST</Text>
                          <View style={styles.neonCarnivalInfoLine} />
                        </View>
                      )}

                      {isGardenTemplate && (
                        <View style={styles.gardenInfoHeader}>
                          <IconSymbol name="leaf.fill" size={14} color="#16a34a" />
                          <Text style={[styles.gardenInfoKicker, { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic', color: '#16a34a' }]}>
                            Garden Letter
                          </Text>
                          <View style={[styles.gardenInfoLine, { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]} />
                        </View>
                      )}

                      {isMuseumTemplate && (
                        <View style={styles.museumInfoHeader}>
                          <Text style={styles.museumInfoKicker}>Curator Note</Text>
                          <View style={styles.museumInfoLine} />
                          <Text style={styles.museumInfoCode}>EB/{String(new Date().getFullYear()).slice(2)}</Text>
                        </View>
                      )}

                      {isBrutalistTemplate && (
                        <View style={styles.brutalistInfoHeader}>
                          <Text style={styles.brutalistInfoKicker}>Curator Entry</Text>
                          <View style={styles.brutalistInfoLine} />
                          <Text style={styles.brutalistInfoCode}>GRID/{String(photos.length || 1).padStart(2, '0')}</Text>
                        </View>
                      )}

                      {isTechSleekTemplate && (
                        <View style={styles.techSleekInfoHeader}>
                          <View style={styles.techSleekInfoPulse} />
                          <Text style={styles.techSleekInfoKicker}>Event Brief</Text>
                          <View style={styles.techSleekInfoLine} />
                        </View>
                      )}

                      {isExecutiveTemplate && (
                        <View style={styles.executiveInfoHeader}>
                          <View style={styles.executiveInfoMark} />
                          <Text style={styles.executiveInfoKicker}>Executive Note</Text>
                          <View style={styles.executiveInfoLine} />
                        </View>
                      )}

                      {isSportsTemplate && (
                        <View style={styles.sportsInfoHeader}>
                          <View style={[styles.sportsInfoMark, { backgroundColor: sportsTheme.accentAlt }]} />
                          <Text style={[styles.sportsInfoKicker, { color: sportsTheme.accent }]}>{sportsTheme.noteLabel}</Text>
                          <View style={[styles.sportsInfoLine, { backgroundColor: `${sportsTheme.accent}33` }]} />
                        </View>
                      )}

                      {isAnniversaryTemplate && (
                        <View style={[
                          styles.anniversaryInfoHeader,
                          isVintageTemplate && styles.vintageInfoHeader,
                          isMinimalLoveTemplate && styles.minimalInfoHeader,
                        ]}>
                          <View style={[
                            styles.anniversaryInfoMark,
                            isGoldenYearsTemplate && styles.goldenInfoMark,
                            isVintageTemplate && styles.vintageInfoMark,
                            isRoseTemplate && styles.roseInfoMark,
                            isMinimalLoveTemplate && styles.minimalInfoMark,
                          ]} />
                          <Text style={[
                            styles.anniversaryInfoKicker,
                            isGoldenYearsTemplate && styles.goldenInfoKicker,
                            isVintageTemplate && styles.vintageInfoKicker,
                            isRoseTemplate && styles.roseInfoKicker,
                            isMinimalLoveTemplate && styles.minimalInfoKicker,
                          ]}>
                            {isGoldenYearsTemplate ? 'Legacy notes' : isVintageTemplate ? 'Archive note' : isRoseTemplate ? 'Garden letter' : 'Love note'}
                          </Text>
                          <View style={[
                            styles.anniversaryInfoLine,
                            isGoldenYearsTemplate && styles.goldenInfoLine,
                            isVintageTemplate && styles.vintageInfoLine,
                            isRoseTemplate && styles.roseInfoLine,
                            isMinimalLoveTemplate && styles.minimalInfoLine,
                          ]} />
                        </View>
                      )}

                      <Text style={[
                        styles.visitorDescription,
                        { color: event.templateId === 'royal' ? selectedTemplate.accent : selectedTemplate.text },
                        isNeonTemplate && styles.neonVisitorDescription,
                        isPastelTemplate && styles.pastelVisitorDescription,
                        isPopTemplate && styles.popVisitorDescription,
                        isGoldenYearsTemplate && styles.goldenVisitorDescription,
                        isVintageTemplate && styles.vintageVisitorDescription,
                        isRoseTemplate && styles.roseVisitorDescription,
                        isMinimalLoveTemplate && styles.minimalVisitorDescription,
                        isCyberTechTemplate && styles.cyberVisitorDescription,
                        isRetroArcadeTemplate && styles.retroArcadeVisitorDescription,
                        isNeonCarnivalTemplate && styles.neonCarnivalVisitorDescription,
                        isGardenTemplate && styles.gardenVisitorDescription,
                        isMuseumTemplate && styles.museumVisitorDescription,
                        isBrutalistTemplate && styles.brutalistVisitorDescription,
                        isTechSleekTemplate && styles.techSleekVisitorDescription,
                        isExecutiveTemplate && styles.executiveVisitorDescription,
                        isSportsTemplate && [styles.sportsVisitorDescription, { color: sportsTheme.text }],
                        !isSportsTemplate && selectedTemplate.useSerif && {
                          fontFamily: isGardenTemplate ? selectedTemplate.bodyFont : selectedTemplate.serifItalic,
                          fontStyle: isGardenTemplate ? 'normal' : 'italic',
                          fontSize: isGardenTemplate ? 15 : 16,
                          lineHeight: isGardenTemplate ? 24 : 26,
                          textAlign: 'center',
                        }
                      ]}>{activeSubEvent ? activeSubEvent.description : event.description}{(isSportsTemplate || isCyberTechTemplate || isRetroArcadeTemplate || isNeonCarnivalTemplate || isMuseumTemplate || isBrutalistTemplate || isTechSleekTemplate || isExecutiveTemplate) ? '' : ' 🤍'}</Text>

                      {isScrapbookTemplate && (
                        <View style={[styles.scrapbookInfoRule, styles.scrapbookInfoRuleBottom]}>
                          <View style={styles.scrapbookInfoRuleShort} />
                          <View style={[styles.scrapbookInfoRuleLine, { backgroundColor: selectedTemplate.accent }]} />
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <ThemeDivider selectedTemplate={selectedTemplate} styles={styles} />

                {activeSubEvent?.id === 'find-you' ? (
                  <FindYouPanel
                    eventId={event.id}
                    legacyId={event.legacyId}
                    parentId={event.parentId}
                    selectedTemplate={selectedTemplate}
                    styles={styles}
                    event={event}
                    viewerIdentity={viewerIdentity}
                  />
                ) : activeSubEvent?.id === 'event-partners' ? (
                  <View style={{ paddingTop: (isPopTemplate || isRetroArcadeTemplate) ? 10 : isGardenTemplate ? 12 : 40, paddingBottom: 24, paddingHorizontal: 20 }}>
                    <View style={{ alignItems: 'center', marginBottom: 32 }}>
                      <Text style={[
                        { fontSize: 28, color: selectedTemplate.text, marginBottom: 8 },
                        isPopTemplate && { fontFamily: FunkyFonts.marker, fontSize: 32, color: '#0080ff', textTransform: 'uppercase', letterSpacing: -0.5 },
                        isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, fontSize: 32, color: '#ff3562', textTransform: 'uppercase', letterSpacing: 0.5 },
                        isCyberTechTemplate && styles.cyberPartnersTitle,
                        isNeonCarnivalTemplate && styles.neonCarnivalPartnersTitle,
                        !isSportsTemplate && selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
                      ]}>The Dream Team</Text>
                      <Text style={[
                        { fontSize: 14, color: selectedTemplate.muted, textAlign: 'center', lineHeight: 22, maxWidth: '90%' },
                        isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 13, textTransform: 'uppercase', letterSpacing: -0.2 },
                        isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.2 },
                        isCyberTechTemplate && styles.cyberPartnersSubtitle,
                        isNeonCarnivalTemplate && styles.neonCarnivalPartnersSubtitle
                      ]}>
                        {`The creative team and vendors behind this beautiful ${event?.category?.toLowerCase() || 'event'}.`}
                      </Text>
                    </View>

                    {linkedVendors.length === 0 ? (
                      <View style={[
                        { alignItems: 'center', paddingVertical: 40, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
                        isPopTemplate && {
                          backgroundColor: '#fffdf3',
                          borderWidth: 3,
                          borderColor: '#231f20',
                          borderRadius: 18,
                          shadowColor: '#ef2b3a',
                          shadowOffset: { width: 5, height: 5 },
                          shadowOpacity: 1,
                          shadowRadius: 0,
                          elevation: 4,
                        },
                        isRetroArcadeTemplate && {
                          backgroundColor: '#ffffff',
                          borderWidth: 3,
                          borderColor: '#231f20',
                          borderRadius: 18,
                          shadowColor: '#231f20',
                          shadowOffset: { width: 5, height: 5 },
                          shadowOpacity: 1,
                          shadowRadius: 0,
                          elevation: 4,
                        },
                        isCyberTechTemplate && styles.cyberPartnerCard,
                        isNeonCarnivalTemplate && styles.neonCarnivalPartnerCard,
                        isGardenTemplate && [styles.gardenPartnerCard, { backgroundColor: isDark ? '#1B3224' : '#FDFBF7', borderColor: isDark ? 'rgba(74, 222, 128, 0.15)' : 'rgba(46, 111, 64, 0.08)' }]
                      ]}>
                         <IconSymbol name={"building.2" as any} size={32} color={isPopTemplate ? '#0080ff' : (isCyberTechTemplate ? '#00f0ff' : (isRetroArcadeTemplate ? '#ff3562' : (isNeonCarnivalTemplate ? '#d946ef' : selectedTemplate.accent)))} />
                         <Text style={[
                           { color: selectedTemplate.muted, marginTop: 16, fontSize: 15, fontWeight: '500' },
                           isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', textTransform: 'uppercase', fontSize: 13 },
                           isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', textTransform: 'uppercase', fontSize: 13 },
                           isCyberTechTemplate && styles.cyberEmptyText,
                           isNeonCarnivalTemplate && styles.neonCarnivalEmptyText,
                           isGardenTemplate && { fontFamily: selectedTemplate.bodyMedium, color: selectedTemplate.muted }
                         ]}>Vendor list coming soon...</Text>
                      </View>
                    ) : (
                      <View style={{ gap: (isPopTemplate || isRetroArcadeTemplate) ? 20 : 16 }}>
                        {linkedVendors.map((biz) => (
                          <TouchableOpacity
                            key={biz.id}
                            style={[
                              { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
                              isPopTemplate && {
                                backgroundColor: '#fffdf3',
                                borderWidth: 3,
                                borderColor: '#231f20',
                                borderRadius: 18,
                                shadowColor: '#ef2b3a',
                                shadowOffset: { width: 5, height: 5 },
                                shadowOpacity: 1,
                                shadowRadius: 0,
                                elevation: 4,
                                padding: 14,
                                marginBottom: 6,
                              },
                              isRetroArcadeTemplate && {
                                backgroundColor: '#ffffff',
                                borderWidth: 3,
                                borderColor: '#231f20',
                                borderRadius: 18,
                                shadowColor: '#231f20',
                                shadowOffset: { width: 5, height: 5 },
                                shadowOpacity: 1,
                                shadowRadius: 0,
                                elevation: 4,
                                padding: 14,
                                marginBottom: 6,
                              },
                              isCyberTechTemplate && styles.cyberPartnerCard,
                              isNeonCarnivalTemplate && styles.neonCarnivalPartnerCard,
                              isGardenTemplate && [styles.gardenPartnerCard, { backgroundColor: '#FDFBF7', borderColor: 'rgba(46, 111, 64, 0.08)' }]
                            ]}
                            onPress={() => router.push(`/business/${biz.id}`)}
                          >
                            <Image
                              source={{ uri: biz.coverImage || 'https://via.placeholder.com/150' }}
                              style={[
                                { width: 64, height: 64, borderRadius: 32, marginRight: 16, borderWidth: 1, borderColor: selectedTemplate.accent },
                                isPopTemplate && { borderWidth: 2.5, borderColor: '#231f20', borderRadius: 32 },
                                isRetroArcadeTemplate && { borderWidth: 2.5, borderColor: '#231f20', borderRadius: 14 },
                                isCyberTechTemplate && { borderWidth: 1, borderColor: '#00f0ff', borderRadius: 8 },
                                isNeonCarnivalTemplate && { borderWidth: 1.5, borderColor: '#d946ef', borderRadius: 16 },
                                isGardenTemplate && [styles.gardenPartnerImage, { borderColor: '#2E6F40' }]
                              ]}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[
                                { color: selectedTemplate.text, fontSize: 18, fontWeight: '600', marginBottom: 4 },
                               isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 18, fontWeight: undefined, textTransform: 'uppercase' },
                                isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 18, fontWeight: undefined, textTransform: 'uppercase' },
                                isCyberTechTemplate && styles.cyberPartnerName,
                                isNeonCarnivalTemplate && styles.neonCarnivalPartnerName,
                                isGardenTemplate && { fontFamily: selectedTemplate.bodyBold, fontWeight: '700', color: '#1A3322' }
                              ]}>{biz.name}</Text>
                              <Text style={[
                                { color: selectedTemplate.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
                               isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#ff4fb8', fontSize: 12, fontWeight: undefined, letterSpacing: 0.5 },
                                isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#ff3562', fontSize: 12, fontWeight: undefined, letterSpacing: 0.5 },
                                isCyberTechTemplate && styles.cyberPartnerType,
                                isNeonCarnivalTemplate && styles.neonCarnivalPartnerType,
                                isGardenTemplate && { fontFamily: selectedTemplate.bodyMedium, fontWeight: '600', color: '#2E6F40' }
                              ]}>{biz.type}</Text>
                            </View>
                            <IconSymbol name="chevron.right" size={20} color={isPopTemplate ? '#231f20' : (isCyberTechTemplate ? '#00f0ff' : (isRetroArcadeTemplate ? '#231f20' : selectedTemplate.muted))} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                <View style={[
                  styles.galleryHeader,
                  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 },
                  isScrapbookTemplate && styles.scrapbookGalleryHeader,
                  isNeonTemplate && styles.neonGalleryHeader,
                  isPastelTemplate && styles.pastelGalleryHeader,
                  isPopTemplate && styles.popGalleryHeader,
                  isGoldenYearsTemplate && styles.goldenGalleryHeader,
                  isVintageTemplate && styles.vintageGalleryHeader,
                  isRoseTemplate && styles.roseGalleryHeader,
                  isMinimalLoveTemplate && styles.minimalGalleryHeader,
                  isRetroArcadeTemplate && styles.retroArcadeGalleryHeader,
                  isNeonCarnivalTemplate && styles.neonCarnivalGalleryHeader,
                  isGardenTemplate && styles.gardenGalleryHeader,
                  isMuseumTemplate && styles.museumGalleryHeader,
                  isBrutalistTemplate && styles.brutalistGalleryHeader,
                  isTechSleekTemplate && styles.techSleekGalleryHeader,
                  isExecutiveTemplate && styles.executiveGalleryHeader,
                  isSportsTemplate && styles.sportsGalleryHeader
                ]}>
                  <View>
                    {isSportsTemplate && (
                      <View style={styles.sportsGalleryKicker}>
                        <Text style={[styles.sportsGalleryKickerText, { color: sportsTheme.accent }]}>{sportsTheme.galleryLabel}</Text>
                        <View style={[styles.sportsGalleryKickerLine, { backgroundColor: `${sportsTheme.accent}45` }]} />
                      </View>
                    )}
                    {isExecutiveTemplate && (
                      <View style={styles.executiveGalleryKicker}>
                        <Text style={styles.executiveGalleryKickerText}>Leadership Moments</Text>
                        <View style={styles.executiveGalleryKickerLine} />
                      </View>
                    )}
                    {isTechSleekTemplate && (
                      <View style={styles.techSleekGalleryKicker}>
                        <Text style={styles.techSleekGalleryKickerText}>Tech Highlights</Text>
                        <View style={styles.techSleekGalleryKickerLine} />
                      </View>
                    )}
                    {isMuseumTemplate && (
                      <View style={styles.museumGalleryKicker}>
                        <Text style={styles.museumGalleryKickerText}>Featured Works</Text>
                        <View style={styles.museumGalleryKickerLine} />
                        <Text style={styles.museumGalleryKickerCode}>Gallery {String(subEvents.length + 1).padStart(2, '0')}</Text>
                      </View>
                    )}
                    {isBrutalistTemplate && (
                      <View style={styles.brutalistGalleryKicker}>
                        <Text style={styles.brutalistGalleryKickerText}>Editorial Grid</Text>
                        <View style={styles.brutalistGalleryKickerLine} />
                        <Text style={styles.brutalistGalleryKickerCode}>Set {String(photos.length || 1).padStart(2, '0')}</Text>
                      </View>
                    )}
                    {isGardenTemplate && (
                      <View style={styles.gardenGalleryKicker}>
                        <IconSymbol name="leaf.fill" size={12} color="#16a34a" />
                        <Text style={[styles.gardenGalleryKickerText, { color: '#16a34a', fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }]}>
                          organic feed
                        </Text>
                        <View style={[styles.gardenGalleryKickerLine, { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]} />
                      </View>
                    )}
                    {isCyberTechTemplate && (
                      <View style={styles.cyberGalleryKicker}>
                        <Text style={styles.cyberGalleryKickerText}>[ ARCHIVE SECTION ]</Text>
                      </View>
                    )}
                    {isNeonCarnivalTemplate && (
                      <View style={styles.neonCarnivalGalleryKicker}>
                        <View style={styles.neonCarnivalGalleryPulse} />
                        <Text style={styles.neonCarnivalGalleryKickerText}>Carnival Feed</Text>
                        <View style={styles.neonCarnivalGalleryKickerLine} />
                      </View>
                    )}
                    {isRetroArcadeTemplate && (
                      <View style={styles.retroArcadeGalleryKicker}>
                        <Text style={styles.retroArcadeGalleryKickerBadge}>ARCADE</Text>
                        <Text style={styles.retroArcadeGalleryKickerText}>Memory slot</Text>
                        <View style={styles.retroArcadeGalleryKickerBolt} />
                      </View>
                    )}
                    {isScrapbookTemplate && (
                      <View style={styles.scrapbookGalleryKicker}>
                        <View style={[styles.scrapbookGalleryKickerLine, { backgroundColor: selectedTemplate.accent }]} />
                        <Text style={[styles.scrapbookGalleryKickerText, { color: selectedTemplate.muted }]}>Memory strip</Text>
                      </View>
                    )}
                    {isNeonTemplate && (
                      <View style={styles.neonGalleryKicker}>
                        <View style={styles.neonGallerySpark} />
                        <Text style={styles.neonGalleryKickerText}>Glow reel</Text>
                        <View style={styles.neonGalleryKickerLine} />
                      </View>
                    )}
                    {isPastelTemplate && (
                      <View style={styles.pastelGalleryKicker}>
                        <View style={styles.pastelGalleryKickerDot} />
                        <Text style={styles.pastelGalleryKickerText}>Dream notes</Text>
                        <View style={styles.pastelGalleryKickerLine} />
                      </View>
                    )}
                    {isPopTemplate && (
                      <View style={styles.popGalleryKicker}>
                        <Text style={styles.popGalleryKickerBadge}>POP</Text>
                        <Text style={styles.popGalleryKickerText}>Poster reel</Text>
                        <View style={styles.popGalleryKickerBolt} />
                      </View>
                    )}
                    {isAnniversaryTemplate && (
                      <View style={[
                        styles.anniversaryGalleryKicker,
                        isVintageTemplate && styles.vintageGalleryKicker,
                        isMinimalLoveTemplate && styles.minimalGalleryKicker,
                      ]}>
                        <View style={[
                          styles.anniversaryGalleryDot,
                          isGoldenYearsTemplate && styles.goldenGalleryDot,
                          isVintageTemplate && styles.vintageGalleryDot,
                          isRoseTemplate && styles.roseGalleryDot,
                          isMinimalLoveTemplate && styles.minimalGalleryDot,
                        ]} />
                        <Text style={[
                          styles.anniversaryGalleryKickerText,
                          isGoldenYearsTemplate && styles.goldenGalleryKickerText,
                          isVintageTemplate && styles.vintageGalleryKickerText,
                          isRoseTemplate && styles.roseGalleryKickerText,
                          isMinimalLoveTemplate && styles.minimalGalleryKickerText,
                        ]}>
                          {isGoldenYearsTemplate ? 'Golden reel' : isVintageTemplate ? 'Noir frames' : isRoseTemplate ? 'Bloom reel' : 'Quiet frames'}
                        </Text>
                        <View style={[
                          styles.anniversaryGalleryLine,
                          isGoldenYearsTemplate && styles.goldenGalleryLine,
                          isVintageTemplate && styles.vintageGalleryLine,
                          isRoseTemplate && styles.roseGalleryLine,
                          isMinimalLoveTemplate && styles.minimalGalleryLine,
                        ]} />
                      </View>
                    )}
                    <Text style={[
                      styles.galleryTitle,
                      { color: selectedTemplate.text },
                      isScrapbookTemplate && styles.scrapbookGalleryTitle,
                      isNeonTemplate && styles.neonGalleryTitle,
                      isPastelTemplate && styles.pastelGalleryTitle,
                      isPopTemplate && styles.popGalleryTitle,
                      isGoldenYearsTemplate && styles.goldenGalleryTitle,
                      isVintageTemplate && styles.vintageGalleryTitle,
                      isRoseTemplate && styles.roseGalleryTitle,
                      isMinimalLoveTemplate && styles.minimalGalleryTitle,
                      isCyberTechTemplate && styles.cyberGalleryTitle,
                      isRetroArcadeTemplate && styles.retroArcadeGalleryTitle,
                      isNeonCarnivalTemplate && styles.neonCarnivalGalleryTitle,
                      isGardenTemplate && styles.gardenGalleryTitle,
                      isMuseumTemplate && styles.museumGalleryTitle,
                      isBrutalistTemplate && styles.brutalistGalleryTitle,
                      isTechSleekTemplate && styles.techSleekGalleryTitle,
                      isExecutiveTemplate && styles.executiveGalleryTitle,
                      isSportsTemplate && [styles.sportsGalleryTitle, { color: sportsTheme.text, fontFamily: sportsTheme.headingFont }],
                      !isSportsTemplate && selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifBold, fontWeight: 'bold' }
                    ]}>
                      {isSportsTemplate ? (
                        <Text style={{ color: sportsTheme.text, fontFamily: sportsTheme.headingFont }}>
                          {activeSubEvent ? activeSubEvent.title : sportsTheme.galleryTitle}
                        </Text>
                      ) : isExecutiveTemplate ? (
                        <Text style={{ color: '#f5eddc', fontFamily: Fonts.cormorant.bold }}>
                          {activeSubEvent ? activeSubEvent.title : 'Executive Highlights'}
                        </Text>
                      ) : isTechSleekTemplate ? (
                        <Text style={{ color: '#f8fafc', fontFamily: Fonts.spaceGrotesk.bold }}>
                          {activeSubEvent ? activeSubEvent.title : 'Featured Moments'}
                        </Text>
                      ) : isMuseumTemplate ? (
                        <Text style={{ color: '#17202b', fontFamily: Fonts.spaceGrotesk.bold }}>
                          {activeSubEvent ? activeSubEvent.title : 'Exhibition Highlights'}
                        </Text>
                      ) : isBrutalistTemplate ? (
                        <Text style={{ color: '#111113', fontFamily: Fonts.spaceGrotesk.bold }}>
                          {(activeSubEvent ? activeSubEvent.title : 'Featured Collection').toUpperCase()}
                        </Text>
                      ) : isGardenTemplate ? (
                        <>
                          <Text style={{ color: '#14532d', fontFamily: selectedTemplate.serifBold }}>
                            {activeSubEvent ? activeSubEvent.title : 'Highlights'}
                          </Text>
                          <Text style={{ color: '#16a34a', fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }}>
                            {` (${displayedPhotoCount})`}
                          </Text>
                        </>
                      ) : isRetroArcadeTemplate ? (
                        <>
                          <Text style={{ color: '#ff3562' }}>
                            {(activeSubEvent ? activeSubEvent.title : 'Highlights').toUpperCase()}
                          </Text>
                          <Text style={{ color: '#231f20' }}>
                            {` (${displayedPhotoCount})`}
                          </Text>
                        </>
                      ) : isPopTemplate ? (
                        <>
                          <Text style={{ color: '#0080ff' }}>
                            {activeSubEvent ? activeSubEvent.title : 'Highlights'}
                          </Text>
                          <Text style={{ color: '#ff4fb8' }}>
                            {` (${displayedPhotoCount})`}
                          </Text>
                        </>
                      ) : (
                        activeSubEvent ? activeSubEvent.title : 'Highlights'
                      )}
                    </Text>
                    {!isPopTemplate && !isRetroArcadeTemplate && !isGardenTemplate && (
                      <Text style={[
                        styles.photoCount,
                        { color: selectedTemplate.accent },
                        isCyberTechTemplate && styles.cyberPhotoCount,
                        isNeonCarnivalTemplate && styles.neonCarnivalPhotoCount,
                        isMuseumTemplate && styles.museumPhotoCount,
                        isBrutalistTemplate && styles.brutalistPhotoCount,
                        isTechSleekTemplate && styles.techSleekPhotoCount,
                        isExecutiveTemplate && styles.executivePhotoCount,
                        isSportsTemplate && [styles.sportsPhotoCount, { color: sportsTheme.accent }],
                        !isSportsTemplate && selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
                      ]}>
                        {galleryMediaTab === 'videos'
                          ? `${displayedVideoCount} ${displayedVideoCount === 1 ? 'Video' : 'Videos'}`
                          : (isSportsTemplate ? `${displayedPhotoCount} matchday ${displayedPhotoCount === 1 ? 'moment' : 'moments'}` : (isCyberTechTemplate ? `// ARCHIVED_FILES: ${displayedPhotoCount}` : (isNeonCarnivalTemplate ? `STAGE CAPTURES: ${displayedPhotoCount}` : (isMuseumTemplate ? `${displayedPhotoCount} curated ${displayedPhotoCount === 1 ? 'work' : 'works'}` : (isBrutalistTemplate ? `${displayedPhotoCount} grid ${displayedPhotoCount === 1 ? 'frame' : 'frames'}` : (isTechSleekTemplate ? `${displayedPhotoCount} captured ${displayedPhotoCount === 1 ? 'signal' : 'signals'}` : (isExecutiveTemplate ? `${displayedPhotoCount} leadership ${displayedPhotoCount === 1 ? 'moment' : 'moments'}` : `${displayedPhotoCount} ${displayedPhotoCount === 1 ? 'Photo' : 'Photos'}`)))))))}
                      </Text>
                    )}
                  </View>


                </View>

                <View style={{
                  flexDirection: 'row',
                  marginTop: 18,
                  marginBottom: 8,
                  backgroundColor: isSportsTemplate ? `${sportsTheme.darkControl}12` : 'rgba(15,23,42,0.08)',
                  borderRadius: 16,
                  padding: 4,
                  borderWidth: 1,
                  borderColor: isSportsTemplate ? `${sportsTheme.accent}35` : 'rgba(148,163,184,0.18)',
                }}>
                  {mediaTabs.map((item) => {
                    const active = galleryMediaTab === item.id;
                    const activeBg = isSportsTemplate ? sportsTheme.accent : selectedTemplate.accent;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: active ? activeBg : 'transparent',
                        }}
                        onPress={() => setGalleryMediaTab(item.id)}
                      >
                        <Text style={{
                          color: active ? '#ffffff' : (isSportsTemplate ? sportsTheme.muted : selectedTemplate.muted),
                          fontSize: 12,
                          fontFamily: Fonts.inter.bold,
                        }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {loadingPhotos ? (
                  <View style={styles.photoLoading}>
                    <ActivityIndicator color={isCyberTechTemplate ? '#00f0ff' : selectedTemplate.accent} />
                  </View>
                ) : (
                  <View style={styles.photoGrid}>
                    {activeGalleryItems.length === 0 ? (
                      <View style={styles.emptyGallery}>
                        <IconSymbol name={galleryMediaTab === 'videos' ? 'play.fill' : 'photo.on.rectangle'} size={40} color={isCyberTechTemplate ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.05)'} />
                        <Text style={[styles.emptyText, isCyberTechTemplate && styles.cyberEmptyText]}>
                          {isCyberTechTemplate ? '// NO_DATA_AVAILABLE' : (galleryMediaTab === 'videos' ? 'No videos yet.' : 'No photos yet.')}
                        </Text>
                      </View>
                    ) : galleryMediaTab === 'videos' ? (
                      <View>
                        {videoItems.map((video, idx) => (
                          <GalleryVideoCard
                            key={video.id}
                            video={video}
                            accent={isSportsTemplate ? sportsTheme.accent : selectedTemplate.accent}
                            blurred={shouldBlurMediaForPlan(video)}
                            onOpen={() => openViewer(idx)}
                          />
                        ))}
                      </View>
                    ) : (
                      (() => {
                        const leftCol: any[] = [];
                        const rightCol: any[] = [];
                        let leftHeight = 0;
                        let rightHeight = 0;

                        photoItems.forEach((photo, idx) => {
                          const ratio = photo.width && photo.height
                            ? photo.height / photo.width
                            : (idx % 3 === 0 ? 1.25 : (idx % 3 === 1 ? 0.95 : 1.45));

                          // Height-aware sorting: always place the photo in the shorter column!
                          if (leftHeight <= rightHeight) {
                            leftCol.push({ photo, idx });
                            leftHeight += ratio;
                          } else {
                            rightCol.push({ photo, idx });
                            rightHeight += ratio;
                          }
                        });

                        const renderPhotoItem = ({ photo, idx }: { photo: any; idx: number }) => {
                          const ratio = photo.width && photo.height
                            ? photo.height / photo.width
                            : (idx % 3 === 0 ? 1.25 : (idx % 3 === 1 ? 0.95 : 1.45));
                          const shouldBlurPhoto = shouldBlurMediaForPlan(photo);

                          return (
                            <Animated.View
                              key={photo.id}
                              entering={FadeInUp.delay(idx * 80).duration(600).springify().damping(14)}
                              style={[
                                styles.photoCard,
                                !isGardenTemplate && {
                                  aspectRatio: 1 / ratio,
                                }
                              ]}
                            >
                              <TouchableOpacity
                                style={isGardenTemplate ? { width: '100%' } : { flex: 1 }}
                                activeOpacity={0.9}
                                onPress={() => openViewer(idx)}
                              >
                                <View style={[
                                  styles.photoTile,
                                  {
                                    backgroundColor: selectedTemplate.tileBg,
                                    borderRadius: selectedTemplate.radius,
                                    borderWidth: event.templateId === 'polaroid' || event.templateId === 'museum' || event.templateId === 'brutalist' || event.templateId === 'royal' || event.templateId === 'classic' || event.templateId === 'ethereal' || event.templateId === 'academic_editorial' || event.templateId === 'bohemian' ? 1 : 0,
                                    borderColor: event.templateId === 'royal' ? selectedTemplate.accent : (event.templateId === 'classic' ? 'rgba(0,0,0,0.05)' : (event.templateId === 'ethereal' ? 'rgba(45, 42, 41, 0.12)' : (event.templateId === 'academic_editorial' ? selectedTemplate.text + '26' : (event.templateId === 'bohemian' ? selectedTemplate.text + '15' : selectedTemplate.accentBg)))),
                                    padding: event.templateId === 'polaroid' ? 4 : (event.templateId === 'royal' ? 3 : (event.templateId === 'classic' ? 8 : (event.templateId === 'ethereal' ? 10 : (event.templateId === 'academic_editorial' ? 6 : (event.templateId === 'bohemian' ? 8 : 0))))),
                                  },
                                  isSportsTemplate && [
                                    styles.sportsPhotoTile,
                                    {
                                      backgroundColor: sportsTheme.imageFrame,
                                      borderColor: `${sportsTheme.accent}40`,
                                      shadowColor: sportsTheme.darkControl,
                                    },
                                    idx % 3 === 0 && styles.sportsPhotoTileFeatured,
                                  ],
                                  isBohemianTemplate && [
                                    styles.bohemianPhotoTile,
                                    {
                                      backgroundColor: isDark ? '#261c16' : '#fffcf9',
                                    }
                                  ],
                                  isScrapbookTemplate && [
                                    styles.scrapbookPhotoTile,
                                    {
                                      borderColor: selectedTemplate.accentBg,
                                      shadowColor: selectedTemplate.accent,
                                    },
                                    idx % 2 === 1 && styles.scrapbookPhotoTileAlt,
                                  ],
                                  isNeonTemplate && [
                                    styles.neonPhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? selectedTemplate.accent : selectedTemplate.accentBg,
                                      shadowColor: idx % 3 === 0 ? selectedTemplate.accent : '#66e8ff',
                                    },
                                    idx % 3 === 0 && styles.neonPhotoTileFeatured,
                                  ],
                                  isPastelTemplate && [
                                    styles.pastelPhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? 'rgba(201, 118, 139, 0.26)' : selectedTemplate.accentBg,
                                      shadowColor: idx % 2 === 0 ? '#d8b4dc' : '#f4b8a8',
                                    },
                                    idx % 2 === 1 && styles.pastelPhotoTileAlt,
                                  ],
                                  isGoldenYearsTemplate && [
                                    styles.goldenPhotoTile,
                                    { shadowColor: selectedTemplate.accent },
                                    idx % 2 === 1 && styles.goldenPhotoTileAlt,
                                  ],
                                  isVintageTemplate && [
                                    styles.vintagePhotoTile,
                                    idx % 2 === 1 && styles.vintagePhotoTileAlt,
                                  ],
                                  isRoseTemplate && [
                                    styles.rosePhotoTile,
                                    { shadowColor: '#c75f72' },
                                    idx % 2 === 1 && styles.rosePhotoTileAlt,
                                  ],
                                  isMinimalLoveTemplate && [
                                    styles.minimalPhotoTile,
                                    idx % 2 === 1 && styles.minimalPhotoTileAlt,
                                  ],
                                  isPopTemplate && [
                                    styles.popPhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? '#0080ff' : '#231f20',
                                      shadowColor: idx % 2 === 0 ? '#ef2b3a' : '#0080ff',
                                    },
                                    idx % 2 === 1 && styles.popPhotoTileAlt,
                                  ],
                                  isRetroArcadeTemplate && [
                                    styles.retroArcadePhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? '#ff3562' : '#231f20',
                                      shadowColor: idx % 2 === 0 ? '#ff3562' : '#231f20',
                                    },
                                    idx % 2 === 1 && styles.retroArcadePhotoTileAlt,
                                  ],
                                  isGardenTemplate && [
                                    styles.gardenPhotoTile,
                                    {
                                      backgroundColor: isDark ? '#1B3224' : '#FDFBF7',
                                    }
                                  ],
                                  isMuseumTemplate && [
                                    styles.museumPhotoTile,
                                    idx % 3 === 0 && styles.museumPhotoTileFeatured,
                                  ],
                                  isBrutalistTemplate && [
                                    styles.brutalistPhotoTile,
                                    idx % 3 === 0 && styles.brutalistPhotoTileFeatured,
                                    idx % 3 === 1 && styles.brutalistPhotoTileNarrow,
                                  ],
                                  isTechSleekTemplate && [
                                    styles.techSleekPhotoTile,
                                    idx % 3 === 0 && styles.techSleekPhotoTileFeatured,
                                  ],
                                  isExecutiveTemplate && [
                                    styles.executivePhotoTile,
                                    idx % 3 === 0 && styles.executivePhotoTileFeatured,
                                  ],
                                  event.templateId === 'royal' && {
                                    shadowColor: selectedTemplate.accent,
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 4,
                                    elevation: 2,
                                  },
                                  event.templateId === 'classic' && {
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.06,
                                    shadowRadius: 3,
                                    elevation: 1,
                                    backgroundColor: '#ffffff',
                                  },
                                  event.templateId === 'ethereal' && {
                                    paddingBottom: 24,
                                    shadowColor: '#2d2a29',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 5,
                                    elevation: 2,
                                    backgroundColor: isDark ? '#262423' : '#ffffff',
                                  },
                                  event.templateId === 'academic_editorial' && {
                                    paddingBottom: 22,
                                    shadowColor: '#000000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 4,
                                    elevation: 1,
                                    backgroundColor: selectedTemplate.tileBg,
                                  }
                                ]}>
                                  {isScrapbookTemplate && (
                                    <>
                                      <View style={[styles.scrapbookCorner, styles.scrapbookCornerTopLeft, { borderColor: selectedTemplate.accent }]} />
                                      <View style={[styles.scrapbookCorner, styles.scrapbookCornerBottomRight, { borderColor: selectedTemplate.accent }]} />
                                    </>
                                  )}
                                  {isNeonTemplate && (
                                    <>
                                      <LinearGradient
                                        colors={['rgba(255,61,242,0.75)', 'rgba(102,232,255,0.08)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.neonPhotoGlowLine, styles.neonPhotoGlowLineTop]}
                                      />
                                      <LinearGradient
                                        colors={['rgba(102,232,255,0.7)', 'rgba(126,87,255,0.08)']}
                                        start={{ x: 1, y: 0 }}
                                        end={{ x: 0, y: 0 }}
                                        style={[styles.neonPhotoGlowLine, styles.neonPhotoGlowLineBottom]}
                                      />
                                    </>
                                  )}
                                  {isPastelTemplate && (
                                    <>
                                      <View style={[styles.pastelPhotoTape, styles.pastelPhotoTapeLeft]} />
                                      <View style={[styles.pastelPhotoTape, styles.pastelPhotoTapeRight]} />
                                      <View style={[styles.pastelPhotoDot, styles.pastelPhotoDotTop]} />
                                      <View style={[styles.pastelPhotoDot, styles.pastelPhotoDotBottom]} />
                                    </>
                                  )}
                                  {isGoldenYearsTemplate && (
                                    <>
                                      <View style={[styles.anniversaryPhotoAccent, styles.goldenPhotoAccentTop]} />
                                      <View style={[styles.anniversaryPhotoAccent, styles.goldenPhotoAccentBottom]} />
                                    </>
                                  )}
                                  {isVintageTemplate && (
                                    <>
                                      <View style={[styles.vintagePhotoFrameLine, styles.vintagePhotoFrameLineTop]} />
                                      <View style={[styles.vintagePhotoFrameLine, styles.vintagePhotoFrameLineBottom]} />
                                    </>
                                  )}
                                  {isRoseTemplate && (
                                    <>
                                      <View style={[styles.rosePhotoPetal, styles.rosePhotoPetalTop]} />
                                      <View style={[styles.rosePhotoPetal, styles.rosePhotoPetalBottom]} />
                                    </>
                                  )}
                                  {isMinimalLoveTemplate && (
                                    <View style={styles.minimalPhotoIndex}>
                                      <Text style={styles.minimalPhotoIndexText}>{String(idx + 1).padStart(2, '0')}</Text>
                                    </View>
                                  )}
                                  {isMuseumTemplate && (
                                    <View style={styles.museumPhotoLabel}>
                                      <Text style={styles.museumPhotoLabelNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                                      <Text style={styles.museumPhotoLabelText}>WORK</Text>
                                    </View>
                                  )}
                                  {isBrutalistTemplate && (
                                    <View style={styles.brutalistPhotoLabel}>
                                      <Text style={styles.brutalistPhotoLabelNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                                      <Text style={styles.brutalistPhotoLabelText}>FRAME</Text>
                                    </View>
                                  )}
                                  {isTechSleekTemplate && (
                                    <View style={styles.techSleekPhotoLabel}>
                                      <Text style={styles.techSleekPhotoLabelNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                                      <Text style={styles.techSleekPhotoLabelText}>Signal</Text>
                                    </View>
                                  )}
                                  {isExecutiveTemplate && (
                                    <View style={styles.executivePhotoLabel}>
                                      <Text style={styles.executivePhotoLabelNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                                      <Text style={styles.executivePhotoLabelText}>Brief</Text>
                                    </View>
                                  )}
                                  {isSportsTemplate && (
                                    <View style={[
                                      styles.sportsPhotoLabel,
                                      { backgroundColor: `${sportsTheme.darkControl}dd`, borderColor: `${sportsTheme.accent}55` },
                                    ]}>
                                      <Text style={[styles.sportsPhotoLabelNumber, { color: sportsTheme.imageFrame }]}>{String(idx + 1).padStart(2, '0')}</Text>
                                      <Text style={[styles.sportsPhotoLabelText, { color: sportsTheme.accent }]}>{idx % 2 === 0 ? 'Play' : 'Frame'}</Text>
                                    </View>
                                  )}
                                  <GalleryThumbnailImage
                                    url={photo.url}
                                    thumbnailUrl={photo.thumbnailUrl}
                                    style={[
                                      styles.galleryImg,
                                      isScrapbookTemplate && styles.scrapbookGalleryImg,
                                      isBohemianTemplate && styles.bohemianGalleryImg,
                                      isNeonTemplate && styles.neonGalleryImg,
                                      isPastelTemplate && styles.pastelGalleryImg,
                                      isPopTemplate && styles.popGalleryImg,
                                      isGoldenYearsTemplate && styles.goldenGalleryImg,
                                      isVintageTemplate && styles.vintageGalleryImg,
                                      isRoseTemplate && styles.roseGalleryImg,
                                      isMinimalLoveTemplate && styles.minimalGalleryImg,
                                      isRetroArcadeTemplate && styles.retroArcadeGalleryImg,
                                      isMuseumTemplate && styles.museumGalleryImg,
                                      isBrutalistTemplate && styles.brutalistGalleryImg,
                                      isTechSleekTemplate && styles.techSleekGalleryImg,
                                      isExecutiveTemplate && styles.executiveGalleryImg,
                                      isSportsTemplate && styles.sportsGalleryImg,
                                      isGardenTemplate ? {
                                        width: '100%',
                                        aspectRatio: 1 / ratio,
                                        height: undefined,
                                        borderTopLeftRadius: 22,
                                        borderTopRightRadius: 22,
                                        borderBottomLeftRadius: 0,
                                        borderBottomRightRadius: 0,
                                      } : {},
                                    ]}
                                    blurRadius={shouldBlurPhoto ? 6 : 0}
                                  />
                                  {shouldBlurPhoto && <ExpiredMediaThumbnailNotice />}
                                  {event.templateId === 'academic_editorial' && (
                                    <View style={{
                                      paddingTop: 6,
                                      paddingBottom: 2,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderTopWidth: 0.5,
                                      borderTopColor: selectedTemplate.text + '1a',
                                      marginTop: 4,
                                    }}>
                                      <Text style={{
                                        fontFamily: 'Courier',
                                        fontSize: 8,
                                        color: selectedTemplate.muted,
                                        letterSpacing: 0.5,
                                      }}>
                                        {`[IMG_${String(idx + 1).padStart(3, '0')} // CAMPUS]`}
                                      </Text>
                                    </View>
                                  )}
                                  {isBohemianTemplate && (
                                    <View style={[
                                      styles.bohemianPhotoLabelContainer,
                                      {
                                        borderTopColor: selectedTemplate.text + '10',
                                      }
                                    ]}>
                                      <Text style={[styles.bohemianPhotoLabelText, { fontFamily: selectedTemplate.serifFont, color: selectedTemplate.accent }]} numberOfLines={1}>
                                        {`TRACK #${String(idx + 1).padStart(2, '0')}`}
                                      </Text>
                                      <Text style={[styles.bohemianPhotoSubtext, { fontFamily: selectedTemplate.bodyFont, color: selectedTemplate.text }]} numberOfLines={1}>
                                        {photo.title || 'Untitled Session'}
                                      </Text>
                                    </View>
                                  )}
                                  {isGardenTemplate && (
                                    <View style={[
                                      styles.gardenPhotoLabelContainer,
                                      {
                                        backgroundColor: '#FDFBF7',
                                        borderTopColor: 'rgba(46, 111, 64, 0.08)',
                                      }
                                    ]}>
                                      <Text style={[styles.gardenPhotoLabelText, { fontFamily: selectedTemplate.serifBold, color: '#1A3322' }]} numberOfLines={1}>
                                        {photo.title || (idx % 3 === 0 ? 'Foliage Whisper' : (idx % 3 === 1 ? 'Garden Sun' : 'Botanical Frame'))}
                                      </Text>
                                      <Text style={[styles.gardenPhotoRatioText, { color: '#2E6F40' }]}>
                                        {ratio > 1.2 ? 'PORTRAIT' : ratio < 0.8 ? 'LANDSCAPE' : 'SQUARE'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          );
                        };

                        return (
                          <View style={styles.masonryContainer}>
                            <View style={styles.masonryColumn}>
                              {leftCol.map(renderPhotoItem)}
                            </View>
                            <View style={styles.masonryColumn}>
                              {rightCol.map(renderPhotoItem)}
                            </View>
                          </View>
                        );
                      })()
                    )}

                    {hasMorePhotos && activeGalleryItems.length > 0 && (
                      <TouchableOpacity
                        style={[
                          localStyles.loadMoreButton,
                          {
                            backgroundColor: selectedTemplate.accentBg || 'transparent',
                            borderColor: selectedTemplate.accent || '#CCA43B',
                            borderRadius: selectedTemplate.radius || 24,
                          },
                          isSportsTemplate && {
                            backgroundColor: sportsTheme.accent + '20',
                            borderColor: sportsTheme.accent,
                          }
                        ]}
                        onPress={handleLoadMorePhotos}
                        disabled={loadingMorePhotos}
                        activeOpacity={0.8}
                      >
                        {loadingMorePhotos ? (
                          <ActivityIndicator color={isSportsTemplate ? sportsTheme.accent : (selectedTemplate.accent || '#CCA43B')} />
                        ) : (
                          <Text
                            style={[
                              localStyles.loadMoreText,
                              {
                                color: selectedTemplate.text || '#cbd5e1',
                                fontFamily: selectedTemplate.bodyBold,
                              },
                              isSportsTemplate && {
                                color: sportsTheme.accent,
                              }
                            ]}
                          >
                            Load More
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                </>
                )}

                <ThemeDivider selectedTemplate={selectedTemplate} styles={styles} />

                {/* Join Prompt for non-logged in users */}
                {!user && (
                  <View style={styles.guestSection}>
                    <Text style={styles.guestTitle}>Enter the Celebration</Text>
                    <Text style={styles.guestSub}>Join to view all photos and interactions</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your Name"
                      placeholderTextColor={MidnightColors.slate400}
                      value={guestName}
                      onChangeText={setGuestName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number"
                      placeholderTextColor={MidnightColors.slate400}
                      keyboardType="phone-pad"
                      value={guestPhone}
                      onChangeText={setGuestPhone}
                    />
                    <TouchableOpacity style={styles.accessBtn} onPress={handleGuestAccess}>
                      <Text style={styles.accessBtnText}>Request Access</Text>
                    </TouchableOpacity>
                  </View>
                )}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── CREATE SUB-EVENT MODAL ── */}
      <SubEventModal
        visible={showSubEventModal}
        onClose={closeSubEventModal}
        newSubTitle={newSubTitle}
        setNewSubTitle={setNewSubTitle}
        subDate={newSubDate}
        subDateValue={newSubDateValue}
        showSubDatePicker={showSubDatePicker}
        setShowSubDatePicker={setShowSubDatePicker}
        onSubDateChange={handleSubEventDateChange}
        onSave={handleCreateSubEvent}
        updating={updating}
        styles={styles}
      />

      {/* ── CATEGORY MODAL ── */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCategoryModal(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, width: '100%' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 22, color: '#fff', fontFamily: Fonts.outfit.bold }}>Event Type</Text>
                <Text style={{ color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.regular, marginTop: 4 }}>
                  Choose a category for your gallery
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={{ marginTop: 2 }}
              >
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {[
                { name: 'Wedding', icon: 'heart.fill', color: '#ff4b72' },
                { name: 'Birthday', icon: 'gift.fill', color: '#3b82f6' },
                { name: 'Anniversary', icon: 'sparkles', color: '#eab308' },
                { name: 'Corporate', icon: 'briefcase.fill', color: '#10b981' },
                { name: 'Sports', icon: 'figure.run', color: '#06b6d4' },
                { name: 'College', icon: 'graduationcap.fill', color: '#6366f1' },
                { name: 'Other', icon: 'ellipsis.circle.fill', color: '#64748b' }
              ].map((cat) => {
                const isActive = event?.category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryOption,
                      isActive && styles.activeCategoryOption
                    ]}
                    onPress={() => {
                      handleUpdateCategory(cat.name);
                      setShowCategoryModal(false);
                    }}
                  >
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryIconWrapper, { backgroundColor: `${cat.color}15` }]}>
                        <IconSymbol name={cat.icon as any} size={16} color={cat.color} />
                      </View>
                      <Text style={[styles.categoryText, isActive && styles.activeCategoryText]}>
                        {cat.name}
                      </Text>
                    </View>
                    {isActive && (
                      <View style={styles.categoryCheckBadge}>
                        <IconSymbol name="checkmark" size={10} color={MidnightColors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── IMAGE VIEWER MODAL ── */}
      <PhotoViewer
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        photos={activeGalleryItems}
        initialIndex={currentPhotoIndex}
        viewerIdentity={viewerIdentity}
        event={event}
        selectedTemplate={selectedTemplate}
      />

      <Modal
        visible={!!photoActionItem}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoActionItem(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPhotoActionItem(null)} />
          <View style={[styles.modalContent, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 22, color: '#fff', fontFamily: Fonts.outfit.bold }}>Photo Actions</Text>
                <Text style={{ color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.regular, marginTop: 4 }}>
                  Choose where this photo should appear as a thumbnail.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPhotoActionItem(null)} style={{ marginTop: 2 }}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{
                width: '100%',
                minHeight: 56,
                borderRadius: 18,
                backgroundColor: MidnightColors.gold,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingHorizontal: 18,
                gap: 12,
              }}
              activeOpacity={0.85}
              disabled={updating || !photoActionItem || !event}
              onPress={() => {
                if (!photoActionItem || !event) return;
                const activeGallery = selectedAdminGallery === undefined
                  ? (activeSubEvent || event)
                  : (selectedAdminGallery || event);
                handleSetGalleryPhotoAsCover(photoActionItem.url, activeGallery.id, "Gallery");
              }}
            >
              <IconSymbol name="photo.fill" size={16} color="#050505" />
              <Text
                style={{ flex: 1, color: '#050505', fontFamily: Fonts.outfit.bold, fontSize: 15 }}
                numberOfLines={2}
              >
                Make Gallery Thumbnail
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                width: '100%',
                minHeight: 56,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(212, 175, 55, 0.28)',
                backgroundColor: 'rgba(212, 175, 55, 0.12)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingHorizontal: 18,
                gap: 12,
              }}
              activeOpacity={0.85}
              disabled={updating || !photoActionItem || !event}
              onPress={() => {
                if (!photoActionItem || !event) return;
                handleSetGalleryPhotoAsCover(photoActionItem.url, event.id, "Event");
              }}
            >
              <IconSymbol name="star.fill" size={16} color={MidnightColors.gold} />
              <Text
                style={{ flex: 1, color: MidnightColors.gold, fontFamily: Fonts.outfit.bold, fontSize: 15 }}
                numberOfLines={2}
              >
                Make Event Thumbnail
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TemplateSelectionModal
        visible={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        event={event}
        handleUpdateTemplate={handleUpdateTemplate}
        styles={styles}
      />


      {/* ── RENAME EVENT MODAL ── */}
      <RenameEventModal
        visible={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editTitleAlign={editTitleAlign}
        onSave={handleRenameEvent}
        updating={updating}
        styles={styles}
      />



      {/* ── EDIT GALLERY DESCRIPTION MODAL ── */}
      <GalleryDescriptionModal
        visible={galleryDescModalVisible}
        onClose={() => setGalleryDescModalVisible(false)}
        activeSubEvent={activeSubEvent}
        galleryDescText={galleryDescText}
        setGalleryDescText={setGalleryDescText}
        onSave={handleSaveGalleryDesc}
        selectedTemplate={selectedTemplate}
        styles={styles}
      />


      {/* ── DATE PICKER ── */}
      {showDatePicker && (() => {
        const targetDateStr = selectedAdminGallery !== undefined
          ? (selectedAdminGallery ? selectedAdminGallery.date : event?.date)
          : event?.date;
        let pickerVal = new Date();
        if (targetDateStr) {
          const parsed = Date.parse(targetDateStr);
          if (!isNaN(parsed)) {
            pickerVal = new Date(parsed);
          }
        }
        return (
          <DateTimePicker
            value={pickerVal}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
          />
        );
      })()}
      {/* ── SHARE MODAL ── */}
      <Modal visible={showShareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowShareModal(false)} />
          <View style={styles.shareModalContent}>
            <Text style={styles.modalTitle}>Share Event</Text>

            <View style={styles.qrContainer}>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://wedalbum.app/events/${event.id}` }}
                style={styles.qrCode}
              />
              <Text style={styles.qrLabel}>Scan to Join</Text>
            </View>

            <View style={styles.joinIdContainer}>
              <Text style={styles.joinIdLabel}>Unique Join ID</Text>
              <View style={styles.joinIdBox}>
                <Text style={styles.joinIdValue}>{event.joinId}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.shareActionBtn} onPress={handleShare}>
              <IconSymbol name="square.and.arrow.up" size={18} color={MidnightColors.background} />
              <Text style={styles.shareActionText}>Share Invitation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowShareModal(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── LINK VENDOR MODAL ── */}
      <Modal visible={linkingVendor} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => { setLinkingVendor(false); setVendorCode(''); }}
          />
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { borderBottomWidth: 0, paddingBottom: 8 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{
                  fontSize: 18,
                  color: '#ffffff',
                  fontFamily: Fonts.outfit.bold,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2
                }}>Link a Partner</Text>
                <Text style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  fontFamily: Fonts.inter.regular,
                  marginTop: 4,
                  lineHeight: 18
                }}>
                  Connect photographers, makeup artists, and venues from EB Business.
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setLinkingVendor(false); setVendorCode(''); }}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={{
                  fontSize: 11,
                  color: '#cbd5e1',
                  fontFamily: Fonts.inter.bold,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  marginBottom: 8
                }}>Enter Vendor Code</Text>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    color: MidnightColors.gold,
                    fontSize: 18,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(204, 164, 59, 0.4)',
                    marginBottom: 16,
                    textAlign: 'center',
                    fontFamily: Fonts.outfit.bold,
                    letterSpacing: 2,
                  }}
                  value={vendorCode}
                  onChangeText={(text) => setVendorCode(text.toUpperCase())}
                  placeholder="e.g. VEN-1234"
                  placeholderTextColor={'#64748b'}
                  autoCapitalize="characters"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    alignItems: 'center'
                  }}
                  onPress={() => { setLinkingVendor(false); setVendorCode(''); }}
                >
                  <Text style={{ color: '#cbd5e1', fontFamily: Fonts.outfit.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: MidnightColors.gold,
                    paddingVertical: 12,
                    borderRadius: 20,
                    alignItems: 'center',
                    opacity: vendorCode.length > 3 ? 1 : 0.4,
                    shadowColor: MidnightColors.gold,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                  disabled={vendorCode.length <= 3}
                  onPress={async () => {
                    const biz = await getBusinessByVendorCode(vendorCode);
                    if (biz) {
                      if (event?.vendors?.includes(biz.id)) {
                        Alert.alert("Already Linked", "This vendor is already linked to your event.");
                      } else {
                        const newVendors = [...(event?.vendors || []), biz.id];
                        await updateEvent(event!.id, { vendors: newVendors });
                        setEvent({ ...event!, vendors: newVendors });
                        setLinkedVendors([...linkedVendors, biz]);
                        Alert.alert("Vendor Linked!", `Successfully linked ${biz.name}. They will now appear on the Event Partners page.`);
                        setLinkingVendor(false);
                        setVendorCode('');
                      }
                    } else {
                      Alert.alert("Invalid Code", "No business found with this code. Please try again.");
                    }
                  }}
                >
                  <Text style={{ color: '#000', fontFamily: Fonts.outfit.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CUSTOM BOTTOM APP NAV BAR (Only visible in Host/Management View) ── */}
      {showAdminView && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 55 + insets.bottom,
          backgroundColor: '#050505',
          flexDirection: 'row',
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 5 : 10,
          zIndex: 1000,
        }}>
          {/* TAB 1: Host (Active Gold since we are in Event Management) */}
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
          >
            <IconSymbol size={28} name="calendar" color="#d4af37" />
            <Text style={{ color: '#d4af37', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Host</Text>
          </TouchableOpacity>

          {/* TAB 2: EB Business (Matches TabLayout Svg exactly) */}
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/businesses')}
            activeOpacity={0.8}
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="m11 17 2 2a1 1 0 1 0 3-3"/>
              <Path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>
              <Path d="m21 3 1 11h-2"/>
              <Path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>
              <Path d="M3 4h8"/>
            </Svg>
            <Text
              numberOfLines={2}
              style={{
                color: '#94a3b8',
                fontSize: 9,
                lineHeight: 10,
                fontFamily: Fonts.inter.medium,
                marginTop: 4,
                textAlign: 'center'
              }}
            >
              EB Business
            </Text>
          </TouchableOpacity>

          {/* TAB 3: Dashboard (Matches TabLayout Svg exactly) */}
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.8}
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Rect width="7" height="9" x="3" y="3" rx="1" />
              <Rect width="7" height="5" x="14" y="3" rx="1" />
              <Rect width="7" height="9" x="14" y="12" rx="1" />
              <Rect width="7" height="5" x="3" y="16" rx="1" />
            </Svg>
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Dashboard</Text>
          </TouchableOpacity>

          {/* TAB 4: EB Network */}
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/explore-business')}
            activeOpacity={0.8}
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
              <Path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>
              <Path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>
            </Svg>
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>EB Network</Text>
          </TouchableOpacity>

          {/* TAB 5: Profile */}
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <IconSymbol size={28} name="person.fill" color="#94a3b8" />
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* ── REPOSITION TOOLBAR OVERLAY ── */}
      {showAdminView && isRepositioning && (
        <View style={[styles.repositionToolbar, { top: insets.top > 0 ? insets.top + 8 : 16 }]}>
          <Text style={styles.repositionInstruction}>Drag image</Text>

          {/* Zoom controls */}
          <View style={styles.zoomControlRow}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setTempCoverScale(prev => Math.max(1.0, prev - 0.1))}
            >
              <IconSymbol name={"minus" as any} size={12} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.zoomText}>{Math.round(tempCoverScale * 100)}%</Text>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setTempCoverScale(prev => Math.min(2.5, prev + 0.1))}
            >
              <IconSymbol name="plus" size={12} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.repositionActions}>
            <TouchableOpacity
              style={[styles.repositionBtn, styles.repositionCancelBtn]}
              onPress={() => {
                setIsRepositioning(false);
                showToast('Positioning cancelled');
              }}
            >
              <Text style={styles.repositionBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.repositionBtn, styles.repositionSaveBtn]}
              onPress={async () => {
                const target = currentActiveEvent;
                if (!target) return;
                setIsRepositioning(false);
                setUpdating(true);
                try {
                  const updatedFields = {
                    coverOffset: tempCoverOffset,
                    coverOffsetX: tempCoverOffsetX,
                    coverScale: tempCoverScale
                  };

                  if (selectedAdminGallery) {
                    const newSub = { ...selectedAdminGallery, ...updatedFields };
                    setSelectedAdminGallery(newSub);
                    setSubEvents(prev => prev.map(sub => sub.id === selectedAdminGallery.id ? newSub : sub));
                  } else if (activeSubEvent && activeSubEvent.id === target.id) {
                    const newSub = { ...activeSubEvent, ...updatedFields };
                    setActiveSubEvent(newSub);
                    setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
                  } else if (event) {
                    setEvent({ ...event, ...updatedFields });
                  }

                  showToast('Cover position saved');
                  await updateEvent(target.id, updatedFields);
                } catch (err) {
                  console.log('Error saving cover position:', err);
                } finally {
                  setUpdating(false);
                }
              }}
            >
              <Text style={[styles.repositionBtnText, { color: '#000' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {coverUploadMessage && (
        <View style={localStyles.coverUploadOverlay} pointerEvents="auto">
          <View style={localStyles.coverUploadCard}>
            <ActivityIndicator size="small" color={MidnightColors.gold} />
            <Text style={localStyles.coverUploadText}>{coverUploadMessage}</Text>
          </View>
        </View>
      )}

      {/* ── TOAST MESSAGE FEEDBACK OVERLAY ── */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastContent}>
            <IconSymbol name={"checkmark.circle.fill" as any} size={16} color={MidnightColors.gold} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {/* ── UPLOAD PROGRESS CARD OVERLAY (Managed in Dashboard Notifications Modal) ── */}

      {/* ── CUSTOM THEME-STYLED UPLOAD COMPLETE MODAL ── */}
      <Modal
        visible={showUploadCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowUploadCompleteModal(false)} />
          <View style={[
            styles.modalContent,
            {
              padding: 24,
              borderRadius: 24,
              borderWidth: 1.5,
              backgroundColor: selectedTemplate.panel || (isDark ? '#101010' : '#ffffff'),
              borderColor: selectedTemplate.accentBg || 'rgba(212, 175, 55, 0.3)',
              alignItems: 'center',
              alignSelf: 'center',
              width: width * 0.8,
            }
          ]}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(34, 197, 94, 0.3)',
            }}>
              <IconSymbol name="checkmark.circle.fill" size={32} color="#22c55e" />
            </View>

            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: selectedTemplate.accent || MidnightColors.gold || '#CCA43B',
              marginBottom: 8,
              fontFamily: Fonts.outfit.bold,
              textAlign: 'center',
            }}>
              Upload Complete
            </Text>

            {mobileIndexingStatus ? (
              <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{
                  fontSize: 14,
                  color: isDark ? '#cbd5e1' : '#64748b',
                  textAlign: 'center',
                  marginBottom: 12,
                  fontFamily: Fonts.inter.regular,
                  lineHeight: 18,
                }}>
                  {mobileIndexingStatus.status === 'complete'
                    ? (mobileIndexingStatus.photosWithoutFaces > 0
                        ? `✓ AI face indexing complete! ${mobileIndexingStatus.photosWithFaces || 0} with faces, ${mobileIndexingStatus.photosWithoutFaces} without faces.`
                        : '✓ AI face indexing complete! All photos are searchable by guests.')
                    : `AI is indexing faces: ${mobileIndexingStatus.indexed}/${mobileIndexingStatus.total} (${mobileIndexingStatus.percentComplete}%)`}
                </Text>
                {mobileIndexingStatus.status === 'processing' && (
                  <View style={{ width: '100%', height: 4, backgroundColor: isDark ? '#202020' : '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ width: `${mobileIndexingStatus.percentComplete}%`, height: '100%', backgroundColor: selectedTemplate.accent || MidnightColors.gold || '#CCA43B' }} />
                  </View>
                )}
                {mobileIndexingStatus.status === 'processing' && (
                  <Text style={{
                    fontSize: 11,
                    color: isDark ? '#94a3b8' : '#64748b',
                    textAlign: 'center',
                    marginTop: 8,
                    fontStyle: 'italic',
                    fontFamily: Fonts.inter.regular,
                  }}>
                    You can safely close this screen; indexing runs in the background.
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{
                fontSize: 14,
                color: isDark ? '#cbd5e1' : '#64748b',
                textAlign: 'center',
                marginBottom: 20,
                fontFamily: Fonts.inter.regular,
              }}>
                Upload complete. Previews are being generated...
              </Text>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: selectedTemplate.accent || MidnightColors.gold || '#CCA43B',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 12,
                width: '100%',
                alignItems: 'center'
              }}
              onPress={() => setShowUploadCompleteModal(false)}
            >
              <Text style={{ color: isDark ? '#050505' : '#ffffff', fontWeight: 'bold', fontFamily: Fonts.outfit.semiBold }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CUSTOM THEME-STYLED UPLOAD FAILED MODAL ── */}
      <Modal
        visible={showUploadFailedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadFailedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowUploadFailedModal(false)} />
          <View style={[
            styles.modalContent,
            {
              padding: 24,
              borderRadius: 24,
              borderWidth: 1.5,
              backgroundColor: selectedTemplate.panel || (isDark ? '#101010' : '#ffffff'),
              borderColor: 'rgba(239, 68, 68, 0.3)',
              alignItems: 'center',
              alignSelf: 'center',
              width: width * 0.8,
            }
          ]}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}>
              <IconSymbol name="xmark.circle.fill" size={32} color="#ef4444" />
            </View>

            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#ef4444',
              marginBottom: 8,
              fontFamily: Fonts.outfit.bold,
              textAlign: 'center',
            }}>
              Upload Failed
            </Text>

            <Text style={{
              fontSize: 14,
              color: isDark ? '#cbd5e1' : '#64748b',
              textAlign: 'center',
              marginBottom: 20,
              fontFamily: Fonts.inter.regular,
            }}>
              Upload failed
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 12,
                width: '100%',
                alignItems: 'center'
              }}
              onPress={() => setShowUploadFailedModal(false)}
            >
              <Text style={{ color: isDark ? '#ffffff' : '#101010', fontWeight: 'bold', fontFamily: Fonts.outfit.semiBold }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  expiredMediaThumbnailNotice: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: '50%',
    transform: [{ translateY: -24 }],
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.75)',
  },
  expiredMediaThumbnailTitle: {
    color: '#f8d86a',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
    textAlign: 'center',
  },
  expiredMediaThumbnailSubtitle: {
    color: '#f8fafc',
    fontSize: 9,
    marginTop: 2,
    fontFamily: Fonts.inter.semiBold,
    textAlign: 'center',
  },
  coverUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
    elevation: 1200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
  },
  coverUploadCard: {
    minWidth: 230,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  coverUploadText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.inter.bold,
  },
  progressCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  progressCardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Fonts.inter.bold,
  },
  progressCardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    fontFamily: Fonts.inter.regular,
  },
  progressCardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  loadMoreButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    alignSelf: 'center',
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  loadMoreText: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

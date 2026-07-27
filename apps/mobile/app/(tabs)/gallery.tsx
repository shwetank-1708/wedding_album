import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Share,
  Linking,
  useColorScheme,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { formatStorageSize, getPlanDetails, getUsagePercent } from '@/lib/planLimits';
import { EVENT_PLACEHOLDER_IMAGES, resolveEventCoverImage } from '@/lib/eventCovers';
import { supabase } from '@/lib/supabase';
import { MidnightColors, Fonts } from '../../constants/theme';
import { MOBILE_TEMPLATE_THEMES, getDefaultTemplateForEventCategory } from '../../constants/templates';
import { EveBashLogoBadge } from '@/components/EveBashLogo';
import {
  Event as DatabaseEvent,
  getUserEvents,
  getApprovedSharedEventsForUser,
  getUserTotalStorage,
  getUserEventCount,
  getGuestLogs,
  updateGuestStatus,
  GuestLog,
  createEvent,
  updateEvent,
  deleteEvent,
  getUsers,
  getUserById,
  UserProfile
} from '@/lib/database';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');
const EVENT_TYPE_OPTIONS = [
  { name: 'Wedding', icon: 'heart.fill' },
  { name: 'Birthday', icon: 'gift.fill' },
  { name: 'Corporate', icon: 'briefcase.fill' },
  { name: 'Sports', icon: 'figure.run' },
  { name: 'Other', icon: 'ellipsis.circle.fill' },
] as const;

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeEventDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return formatDisplayDate(new Date());

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const parsedSlashDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsedSlashDate.getTime())) return formatDisplayDate(parsedSlashDate);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  return formatDisplayDate(parsed);
}


function createSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function PortfolioTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'my' | 'shared' | 'requests'>('my');
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [sharedEvents, setSharedEvents] = useState<DatabaseEvent[]>([]);
  const [eventOwners, setEventOwners] = useState<Record<string, Pick<UserProfile, 'name' | 'email' | 'username'>>>({});
  const [guestLogs, setGuestLogs] = useState<GuestLog[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [mainEventCount, setMainEventCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [selectedRequestProfile, setSelectedRequestProfile] = useState<any | null>(null);
  const [loadingRequestProfile, setLoadingRequestProfile] = useState(false);
  const [showRequestInfo, setShowRequestInfo] = useState(false);

  // Creation State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(formatDisplayDate(new Date()));
  const [newEventDateValue, setNewEventDateValue] = useState(new Date());
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [newEventType, setNewEventType] = useState('Wedding');
  const [targetEvent, setTargetEvent] = useState<DatabaseEvent | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // Welcome Settings State
  const [welcomeEditVisible, setWelcomeEditVisible] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);

  // Quota Modal State
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const planDetails = getPlanDetails(user?.role);
  const storagePercent = getUsagePercent(storageUsed, planDetails.storageBytes);
  const eventPercent = getUsagePercent(mainEventCount, planDetails.eventLimit);

  const fetchData = React.useCallback(async (silent = false) => {
    if (!user) {
      setEvents([]);
      setSharedEvents([]);
      setGuestLogs([]);
      setStorageUsed(0);
      setMainEventCount(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.phone) identifiers.push(user.phone);

      const [myEvts, shEvts, storage, eventCount] = await Promise.all([
        getUserEvents(identifiers, 'main'),
        getApprovedSharedEventsForUser(identifiers, true),
        getUserTotalStorage(identifiers),
        getUserEventCount(user.uid)
      ]);

      setEvents(myEvts);
      setSharedEvents(shEvts);
      setStorageUsed(storage);
      setMainEventCount(eventCount);

      if (activeTab === 'requests') {
        const logs = await getGuestLogs(user.uid);
        setGuestLogs(logs);
      }
    } catch (error) {
      console.error('[Portfolio] Fetch error:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchSharedEventOwners() {
      const ownerIds = Array.from(new Set(
        sharedEvents
          .map(event => event.createdBy)
          .filter((ownerId): ownerId is string => !!ownerId && !ownerId.includes('@'))
      ));

      if (ownerIds.length === 0) {
        setEventOwners({});
        return;
      }

      const entries = await Promise.all(ownerIds.map(async (ownerId) => {
        const owner = await getUserById(ownerId);
        return [ownerId, {
          name: owner?.name || 'Unknown owner',
          email: owner?.email || ownerId,
          username: owner?.username || 'Not set',
        }] as const;
      }));

      if (isMounted) {
        setEventOwners(Object.fromEntries(entries));
      }
    }

    fetchSharedEventOwners();

    return () => {
      isMounted = false;
    };
  }, [sharedEvents]);

  useEffect(() => {
    if (!user?.uid) return;

    const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
    const channels = identifiers.map((identifier) =>
      supabase
        .channel(`portfolio-storage-${identifier}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${identifier}` },
          () => fetchData(true)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events', filter: `created_by=eq.${identifier}` },
          () => fetchData(true)
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user?.uid, user?.email, user?.phone, fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const normalizePhoneValue = (val?: string | null) => (val || '').replace(/\D/g, '');
  const normalizeEmailValue = (val?: string | null) => (val || '').trim().toLowerCase();

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
  }, [selectedRequest]);

  const handleCreateSubmit = async () => {
    if (!user) return;
    const title = newEventTitle.trim();
    if (!title) return Alert.alert("Missing Title", "Please enter an event name.");
    if (!newEventType) return Alert.alert("Missing Event Type", "Please choose an event type.");
    if (!newEventDate) return Alert.alert("Missing Date", "Please choose an event date.");

    const baseSlug = createSlug(title);
    const id = `${baseSlug}-${Math.random().toString(36).slice(-5)}`;
    const coverImage = EVENT_PLACEHOLDER_IMAGES[0];
    const defaultTemplate = getDefaultTemplateForEventCategory(newEventType);

    setCreating(true);

    // --- ROLE-BASED LIMITS ---
    const isCreatingMainEvent = true; // Mobile tab creates main events by default
    if (isCreatingMainEvent && user.role !== "admin" && !user.delegatedBy) {
        try {
            const currentPlan = getPlanDetails(user.role);
            const maxEvents = currentPlan.eventLimit;
            
            if (mainEventCount >= maxEvents) {
                Alert.alert(
                    "Plan Limit Reached", 
                    `You've reached your ${currentPlan.eventLabel}-event limit for the ${currentPlan.name}. Upgrade your plan to create more events.`
                );
                setCreating(false);
                return;
            }
        } catch (error) {
            console.error("Error checking plan limits:", error);
        }
    }
    try {
      const success = await createEvent({
        id,
        title,
        date: normalizeEventDate(newEventDate),
        description: `Memories from ${title}`,
        coverImage,
        createdBy: user.uid,
        type: 'main',
        templateId: defaultTemplate.id,
        category: newEventType
      });

      if (success) {
        setCreateModalVisible(false);
        setNewEventTitle('');
        const today = new Date();
        setNewEventDateValue(today);
        setNewEventDate(formatDisplayDate(today));
        setNewEventType('Wedding');
        fetchData();
        Alert.alert("Success", "Your event has been created! ✨");
      }
    } catch (err) {
      console.error('[CreateEvent] Error:', err);
      Alert.alert("Error", "Failed to create event.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowCreateDatePicker(false);
    }

    if (event.type === 'dismissed') return;
    if (!selectedDate) return;

    setNewEventDateValue(selectedDate);
    setNewEventDate(formatDisplayDate(selectedDate));
  };

  const handleVisitWebsite = (event: DatabaseEvent) => {
    const url = `https://wedalbum.app/events/${event.id}`;
    Linking.openURL(url).catch(err => console.error('Could not open URL', err));
  };

  const handleShareLink = async (event: DatabaseEvent) => {
    try {
      const url = `https://wedalbum.app/events/${event.id}`;
      await Share.share({
        message: `Check out the ${event.title} gallery: ${url}`,
        url: url,
      });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  };

  const handleDeleteEvent = async (event: DatabaseEvent) => {
    Alert.alert(
      "Delete Event",
      `Are you sure you want to delete "${event.title}"? This will permanently remove all photos and sub-events.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const success = await deleteEvent(event.id);
            if (success) {
              fetchData();
              Alert.alert("Success", "Event deleted successfully.");
            } else {
              Alert.alert("Error", "Failed to delete event.");
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  const handleRenameSubmit = async () => {
    if (!targetEvent || !editTitle.trim()) return;
    setLoading(true);
    const success = await updateEvent(targetEvent.id, { title: editTitle.trim() });
    if (success) {
      setRenameVisible(false);
      setTargetEvent(null);
      fetchData();
      Alert.alert("Success", "Event renamed successfully.");
    } else {
      Alert.alert("Error", "Failed to rename event.");
    }
    setLoading(false);
  };

  const handleWelcomeEditSubmit = async () => {
    if (!targetEvent) return;
    setLoading(true);
    const success = await updateEvent(targetEvent.id, {
      description: welcomeText.trim()
    });
    if (success) {
      setWelcomeEditVisible(false);
      setTargetEvent(null);
      fetchData();
      Alert.alert("Success", "Welcome card settings updated.");
    } else {
      Alert.alert("Error", "Failed to update settings.");
    }
    setLoading(false);
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!targetEvent) return;

    const updatedEvent = { ...targetEvent, templateId };
    setTargetEvent(updatedEvent);
    setEvents((prev) => prev.map((event) => event.id === targetEvent.id ? { ...event, templateId } : event));
    setSharedEvents((prev) => prev.map((event) => event.id === targetEvent.id ? { ...event, templateId } : event));

    try {
      const success = await updateEvent(targetEvent.id, { templateId });
      if (!success) {
        Alert.alert("Error", "Failed to update template.");
        fetchData();
        return;
      }
      setTemplateVisible(false);
      setOptionsVisible(false);
      Alert.alert("Success", "Template updated!");
    } catch (error) {
      console.error('[Portfolio] Template update error:', error);
      Alert.alert("Error", "Failed to update template.");
      fetchData();
    }
  };

  const showQuotaAlert = () => setShowQuotaModal(true);
  const pendingGuestRequests = guestLogs.filter(log => log.status === 'pending');
  const pendingRequestsByEvent = Object.entries(
    pendingGuestRequests.reduce<Record<string, GuestLog[]>>((groups, log) => {
      const eventTitle = log.eventTitle || 'Untitled Event';
      groups[eventTitle] = groups[eventTitle] || [];
      groups[eventTitle].push(log);
      return groups;
    }, {})
  );

  const renderEventCard = (event: DatabaseEvent, index: number) => {
    const coverImage = resolveEventCoverImage(event.coverImage);
    const isSharedCard = activeTab === 'shared';
    const ownerDetails = event.createdBy?.includes('@')
      ? { name: 'Unknown owner', email: event.createdBy, username: 'Not set' }
      : event.createdBy
        ? eventOwners[event.createdBy] || { name: 'Unknown owner', email: event.createdBy, username: 'Not set' }
        : { name: 'Unknown owner', email: 'Unknown', username: 'Not set' };

    return (
      <TouchableOpacity
        key={event.id}
        style={[styles.eventCard, isSharedCard && styles.sharedEventCard]}
        activeOpacity={0.9}
        onPress={() => router.push(`/events/${event.id}?mode=admin`)}
      >
        {/* Top Part: Image Container */}
        <View style={[styles.cardImageWrap, isSharedCard && styles.sharedCardImageWrap]}>
          <ExpoImage
            source={{ uri: coverImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            transition={400}
          />
          <LinearGradient
            colors={['rgba(2,6,23,0.15)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          {event.category ? (
            <View style={styles.cardCategoryBadge}>
              <Text style={styles.cardCategoryText}>{event.category.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom Part: Text Details */}
        <View style={styles.cardInfoStrip}>
          <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
          <View style={styles.cardMeta}>
            <IconSymbol name="calendar" size={10} color={colors.gold} />
            <Text style={styles.cardDate}>{event.date}</Text>
          </View>
          {isSharedCard && (
            <View style={styles.sharedOwnerBlock}>
              <Text style={styles.sharedOwnerLine}>
                <Text style={styles.sharedOwnerLabel}>Owner username: </Text>{(ownerDetails.username || 'not set').toLowerCase()}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const selectedRequestName = selectedRequestProfile?.name || selectedRequest?.name || 'Not set';
  const selectedRequestUsername = selectedRequestProfile?.username ? `@${selectedRequestProfile.username}` : 'Not set';
  const selectedRequestEmail = selectedRequestProfile?.email || selectedRequest?.email || (selectedRequest?.phone?.includes('@') ? selectedRequest.phone : '') || 'Not set';
  const selectedRequestPhone = selectedRequestProfile?.phone || (!selectedRequest?.phone?.includes('@') ? selectedRequest?.phone : '') || 'Not set';
  const selectedRequestPhoto = selectedRequestProfile?.profileImage;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HEADER ── */}
        <LinearGradient
          colors={isDark ? ['#101010', '#050505'] : [colors.deepSlate, colors.background]}
          style={[styles.header, { paddingTop: insets.top + 4 }]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}
              activeOpacity={0.7}
              onPress={showQuotaAlert}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect width={20} height={8} x={2} y={2} rx={2} ry={2} />
                <Rect width={20} height={8} x={2} y={14} rx={2} ry={2} />
                <Line x1={6} x2={6.01} y1={6} y2={6} />
                <Line x1={6} x2={6.01} y1={18} y2={18} />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={styles.headingLogoRow}>
              <EveBashLogoBadge onPress={() => router.replace('/(tabs)' as any)} />
              <Text style={styles.headerName}>Host Event</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setCreateModalVisible(true)}
            >
              <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14" />
                <Path d="M12 5v14" />
              </Svg>
            </TouchableOpacity>
          </View>
        </LinearGradient>


        {/* ── TABS (Segmented Control Style) ── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'my' && styles.tabButtonActive]}
            onPress={() => setActiveTab('my')}
          >
            <IconSymbol
              name="camera.fill"
              size={14}
              color={activeTab === 'my' ? colors.gold : colors.slate400}
            />
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>Host</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'shared' && styles.tabButtonActive]}
            onPress={() => setActiveTab('shared')}
          >
            <IconSymbol
              name="person.2.fill"
              size={14}
              color={activeTab === 'shared' ? colors.gold : colors.slate400}
            />
            <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>Shared</Text>
          </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
              onPress={() => setActiveTab('requests')}
            >
              <IconSymbol
                name="envelope.fill"
                size={14}
                color={activeTab === 'requests' ? colors.gold : colors.slate400}
              />
              <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>Requests</Text>

              {pendingGuestRequests.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {pendingGuestRequests.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
        ) : (
          <View style={styles.grid}>
            {activeTab === 'my' && (
              events.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="photo.on.rectangle" size={40} color={colors.slate400} />
                  <Text style={styles.emptyTitle}>No events yet</Text>
                  <Text style={styles.emptyBody}>Create your first album to see it here.</Text>
                </View>
              ) : (
                events.map((event, index) => renderEventCard(event, index))
              )
            )}

            {activeTab === 'shared' && (
              sharedEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="person.2.fill" size={40} color={colors.slate400} />
                  <Text style={styles.emptyTitle}>Nothing shared</Text>
                  <Text style={styles.emptyBody}>Events shared with you will appear here.</Text>
                </View>
              ) : (
                sharedEvents.map((event, index) => renderEventCard(event, index))
              )
            )}

            {activeTab === 'requests' && (
              pendingGuestRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name={"checkmark.circle.fill" as any} size={40} color="rgba(16, 185, 129, 0.2)" />
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptyBody}>New access requests will appear here.</Text>
                </View>
              ) : (
                <View style={{ width: '100%', gap: 12 }}>
                  {pendingRequestsByEvent.map(([eventTitle, logs]) => (
                    <View key={eventTitle} style={styles.requestEventGroup}>
                      <View style={styles.requestGroupHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requestGroupLabel}>Event</Text>
                          <Text style={styles.requestGroupTitle} numberOfLines={2}>{eventTitle}</Text>
                        </View>
                        <View style={styles.requestGroupCount}>
                          <Text style={styles.requestGroupCountText}>{logs.length}</Text>
                        </View>
                      </View>

                      {logs.map(log => (
                        <TouchableOpacity
                          key={log.id}
                          style={styles.requestCard}
                          onPress={() => setSelectedRequest(log)}
                        >
                          <View style={styles.requestAvatar}>
                            <Text style={styles.avatarTextSmall}>{(log.name || 'G').charAt(0)}</Text>
                          </View>

                          <View style={styles.requestInfo}>
                            <Text style={styles.requestName} numberOfLines={1}>{log.name || 'Anonymous Guest'}</Text>
                            <Text style={styles.requestContact} numberOfLines={1}>{log.email || log.phone || 'No contact provided'}</Text>
                          </View>

                          <View style={styles.requestActionsMini}>
                            <TouchableOpacity
                              style={styles.miniActionBtnRed}
                              onPress={() => updateGuestStatus(log.id, 'rejected').then(fetchData)}
                            >
                              <IconSymbol name="xmark" size={12} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.miniActionBtnGreen}
                              onPress={() => updateGuestStatus(log.id, 'approved').then(fetchData)}
                            >
                              <IconSymbol name="checkmark" size={12} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )
            )}

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
                        <View style={styles.userInfoDetailRow}>
                          <Text style={styles.userInfoDetailLabel}>Target Event</Text>
                          <Text style={styles.userInfoDetailValue}>{selectedRequest?.eventTitle || 'Untitled Event'}</Text>
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
                            fetchData();
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
                            fetchData();
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
          </View>
        )}

        {/* ── HOST GUIDE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host Your Perfect Event</Text>
          <View style={styles.benefitsGrid}>
            <View style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <IconSymbol name="photo.on.rectangle" size={20} color={colors.gold} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Stunning Galleries</Text>
                <Text style={styles.benefitDesc}>Create unlimited, high-resolution albums to preserve every beautiful memory.</Text>
              </View>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <IconSymbol name="person.2.fill" size={20} color={colors.gold} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Guest Sharing</Text>
                <Text style={styles.benefitDesc}>Easily invite guests via QR codes and securely share photos directly with them.</Text>
              </View>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <IconSymbol name="video.fill" size={20} color={colors.gold} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Live Streaming</Text>
                <Text style={styles.benefitDesc}>{"Broadcast your special moments live to loved ones who couldn't attend in person."}</Text>
              </View>
            </View>
          </View>

          {/* ── HOW TO HOST — YouTube Card ── */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.howToHostCard}
            onPress={() => Linking.openURL('https://www.youtube.com/@EveBashApp')}
          >
            <LinearGradient
              colors={['#312e81', '#1e1b4b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.howToHostGradient}
            >
              {/* Left: text content */}
              <View style={{ flex: 1 }}>
                <View style={styles.howToHostBadge}>
                  <Text style={styles.howToHostBadgeText}>HOW TO HOST</Text>
                </View>
                <Text style={styles.howToHostTitle}>Watch & Learn</Text>
                <Text style={styles.howToHostSubtitle}>
                  Step-by-step video tutorials to help you host a flawless event.
                </Text>
                <TouchableOpacity
                  style={styles.howToHostYtBtn}
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL('https://www.youtube.com/@EveBashApp')}
                >
                  <IconSymbol name="play.fill" size={11} color="#ffffff" />
                  <Text style={styles.howToHostYtBtnText}>Watch on YouTube</Text>
                </TouchableOpacity>
              </View>

              {/* Right: play icon watermark */}
              <View style={{ marginLeft: 10, justifyContent: 'center', alignItems: 'center' }}>
                <View style={styles.howToHostPlayCircle}>
                  <IconSymbol name="play.fill" size={28} color="rgba(167,139,250,0.6)" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

        </View>

      </ScrollView>

      {/* ── QUOTA MODAL ── */}
      <Modal visible={showQuotaModal} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity
          style={styles.quotaOverlay}
          activeOpacity={1}
          onPress={() => setShowQuotaModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.quotaModalContent} onPress={() => {}}>

            {/* ── Hero header ── */}
            <LinearGradient
              colors={['rgba(212,175,55,0.18)', 'rgba(212,175,55,0.04)', 'transparent']}
              style={styles.quotaHero}
            >
              {/* Icon + title row */}
              <View style={styles.quotaHeroRow}>
                <View style={styles.quotaHeroIcon}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Rect width={20} height={8} x={2} y={2} rx={2} ry={2} />
                    <Rect width={20} height={8} x={2} y={14} rx={2} ry={2} />
                    <Line x1={6} x2={6.01} y1={6} y2={6} />
                    <Line x1={6} x2={6.01} y1={18} y2={18} />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quotaHeroTitle}>Storage & Quota</Text>
                  <Text style={styles.quotaHeroSub}>Your current plan usage</Text>
                </View>
                <TouchableOpacity onPress={() => setShowQuotaModal(false)} style={styles.quotaCloseBtn}>
                  <IconSymbol name="xmark" size={13} color={colors.slate400} />
                </TouchableOpacity>
              </View>

              {/* Active plan */}
              <Text style={styles.quotaActivePlanText}>
                Active plan:{' '}
                <Text style={[styles.quotaActivePlanName, { color: planDetails.accent }]}>
                  {planDetails.name}
                </Text>
              </Text>
            </LinearGradient>

            {/* ── Divider ── */}
            <View style={styles.quotaDivider} />

            {/* ── Metrics ── */}
            <View style={styles.quotaMetrics}>

              {/* Storage metric */}
              <View style={styles.quotaMetricRow}>
                <View style={styles.quotaMetricTop}>
                  <View style={styles.quotaMetricLeft}>
                    <View style={[styles.quotaDot, { backgroundColor: colors.gold }]} />
                    <Text style={styles.quotaMetricLabel}>Storage</Text>
                  </View>
                  <View style={styles.quotaMetricRight}>
                    <Text style={styles.quotaMetricValue}>{formatStorageSize(storageUsed)}</Text>
                    <Text style={styles.quotaMetricMax}> / {planDetails.storageLabel}</Text>
                    <View style={[styles.quotaPercentChip, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
                      <Text style={[styles.quotaPercentText, { color: colors.gold }]}>
                        {planDetails.storageBytes === Infinity ? '∞' : `${Math.round(storagePercent)}%`}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.quotaBarTrack}>
                  <LinearGradient
                    colors={[colors.gold, '#f5d080']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.quotaBarFill,
                      { width: `${planDetails.storageBytes === Infinity ? 5 : storagePercent}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Divider between rows */}
              <View style={styles.quotaMetricSep} />

              {/* Events metric */}
              <View style={styles.quotaMetricRow}>
                <View style={styles.quotaMetricTop}>
                  <View style={styles.quotaMetricLeft}>
                    <View style={[styles.quotaDot, { backgroundColor: '#818cf8' }]} />
                    <Text style={styles.quotaMetricLabel}>Events</Text>
                  </View>
                  <View style={styles.quotaMetricRight}>
                    <Text style={styles.quotaMetricValue}>{mainEventCount}</Text>
                    <Text style={styles.quotaMetricMax}> / {planDetails.eventLabel}</Text>
                    <View style={[styles.quotaPercentChip, { backgroundColor: 'rgba(129,140,248,0.12)' }]}>
                      <Text style={[styles.quotaPercentText, { color: '#818cf8' }]}>
                        {planDetails.eventLimit === Infinity ? '∞' : `${Math.round(eventPercent)}%`}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.quotaBarTrack}>
                  <LinearGradient
                    colors={['#818cf8', '#a5b4fc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.quotaBarFill,
                      { width: `${planDetails.eventLimit === Infinity ? 5 : eventPercent}%` },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* ── CTA ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { setShowQuotaModal(false); router.push('/(tabs)/usage'); }}
            >
              <LinearGradient
                colors={[colors.gold, '#c9960a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quotaUpgradeBtn}
              >
                <Text style={styles.quotaUpgradeBtnText}>Manage Plan</Text>
                <IconSymbol name="arrow.right" size={14} color="#000" />
              </LinearGradient>
            </TouchableOpacity>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── EVENT OPTIONS MODAL ── */}
      <Modal visible={optionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (templateVisible) return;
              setOptionsVisible(false);
            }}
          />
          <View style={[styles.modalContent, { paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{templateVisible ? 'Choose Template' : targetEvent?.title}</Text>
                <Text style={styles.headerGreeting}>{templateVisible ? '10 gallery themes' : 'Event Management'}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setTemplateVisible(false);
                setOptionsVisible(false);
              }}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={colors.slate400} />
              </TouchableOpacity>
            </View>

            {templateVisible ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.templateModalContent}>
                {MOBILE_TEMPLATE_THEMES.map((template) => {
                  const isActive = (targetEvent?.templateId || 'hero') === template.id;
                  return (
                    <TouchableOpacity
                      key={template.id}
                      style={[
                        styles.templateRowCard,
                        isActive && styles.activeTemplateRowCard,
                        { borderColor: isActive ? template.accent : 'rgba(255,255,255,0.06)' },
                      ]}
                      onPress={() => { handleTemplateSelect(template.id); setTemplateVisible(false); }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.templateRowLeft}>
                        <View style={[styles.palettePreview, { backgroundColor: isDark ? template.background.dark : template.background.light }]}>
                          <View style={[styles.paletteAccentDot, { backgroundColor: template.accent }]} />
                        </View>

                        <View style={styles.templateRowText}>
                          <Text style={[styles.templateRowName, isActive && { color: template.accent }]}>
                            {template.label}
                          </Text>
                          <Text style={styles.templateRowDesc} numberOfLines={1}>
                            {template.desc}
                          </Text>
                        </View>
                      </View>

                      {isActive && (
                        <View style={[styles.templateCheckCircle, { backgroundColor: template.accent }]}>
                          <IconSymbol name="checkmark" size={10} color="#000" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.optionsList}>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    setEditTitle(targetEvent?.title || '');
                    setRenameVisible(true);
                  }}
                >
                  <IconSymbol name="pencil" size={20} color={colors.gold} />
                  <Text style={styles.optionText}>Rename Event</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    router.push({ pathname: `/events/${targetEvent?.id}`, params: { tab: 'photos', mode: 'admin' } } as any);
                  }}
                >
                  <IconSymbol name="photo.fill" size={20} color={colors.gold} />
                  <Text style={styles.optionText}>Edit Photos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => setTemplateVisible(true)}
                >
                  <IconSymbol name="paintbrush.fill" size={20} color={colors.gold} />
                  <Text style={styles.optionText}>Change Template</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    if (targetEvent) handleVisitWebsite(targetEvent);
                  }}
                >
                  <IconSymbol name="globe" size={20} color={colors.gold} />
                  <Text style={styles.optionText}>Visit Website</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    if (targetEvent) handleShareLink(targetEvent);
                  }}
                >
                  <IconSymbol name="square.and.arrow.up" size={20} color={colors.gold} />
                  <Text style={styles.optionText}>Share Link</Text>
                </TouchableOpacity>

                <View style={styles.modalDivider} />

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    if (targetEvent) handleDeleteEvent(targetEvent);
                  }}
                >
                  <IconSymbol name="trash.fill" size={20} color="#ef4444" />
                  <Text style={[styles.optionText, { color: '#ef4444' }]}>Delete Event</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── RENAME MODAL ── */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setRenameVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Event</Text>
              <TouchableOpacity onPress={() => setRenameVisible(false)}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={colors.slate400} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Event Name</Text>
                <TextInput
                  style={styles.input}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Enter new name..."
                  placeholderTextColor={colors.slate400}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleRenameSubmit}
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleRenameSubmit}
              >
                <Text style={styles.submitBtnText}>Update Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CREATE EVENT MODAL ── */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowCreateDatePicker(false);
              setCreateModalVisible(false);
            }}
          />
          <View style={styles.createModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.createForm}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Event</Text>
                <TouchableOpacity onPress={() => {
                  setShowCreateDatePicker(false);
                  setCreateModalVisible(false);
                }}>
                  <IconSymbol name={"xmark.circle.fill" as any} size={24} color={colors.slate400} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Name</Text>
                <TextInput
                  style={styles.input}
                  value={newEventTitle}
                  onChangeText={setNewEventTitle}
                  placeholder="e.g. Wedding of John & Jane"
                  placeholderTextColor={colors.slate400}
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Type</Text>
                <View style={styles.eventTypeGrid}>
                  {EVENT_TYPE_OPTIONS.map((option) => {
                    const isSelected = newEventType === option.name;
                    return (
                      <TouchableOpacity
                        key={option.name}
                        style={[styles.eventTypeOption, isSelected && styles.eventTypeOptionActive]}
                        onPress={() => setNewEventType(option.name)}
                      >
                        <IconSymbol name={option.icon as any} size={16} color={isSelected ? MidnightColors.background : colors.gold} />
                        <Text style={[styles.eventTypeText, isSelected && styles.eventTypeTextActive]}>{option.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Date</Text>
                <TouchableOpacity
                  style={styles.dateSelectBtn}
                  onPress={() => setShowCreateDatePicker(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.dateSelectLeft}>
                    <IconSymbol name="calendar" size={18} color={colors.gold} />
                    <Text style={styles.dateSelectText}>{newEventDate}</Text>
                  </View>
                  <IconSymbol name="chevron.down" size={18} color={colors.slate400} />
                </TouchableOpacity>
                {showCreateDatePicker && (
                  <DateTimePicker
                    value={newEventDateValue}
                    mode="date"
                    display="spinner"
                    onChange={handleCreateDateChange}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateSubmit}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={'#050505'} />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Create Event</Text>
                    <IconSymbol name="sparkles" size={16} color={'#050505'} />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Guide Section
  section: {
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: colors.white,
    fontFamily: Fonts.outfit.extraBold,
    marginBottom: 16,
  },
  benefitsGrid: {
    gap: 12,
  },
  benefitCard: {
    backgroundColor: colors.deepSlate,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    color: colors.white,
    fontFamily: Fonts.outfit.bold,
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: Fonts.inter.regular,
    lineHeight: 18,
  },

  // ── How To Host Card ──
  howToHostCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 16,
    elevation: 6,
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  howToHostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  howToHostBadge: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  howToHostBadgeText: {
    color: '#c4b5fd',
    fontSize: 9,
    fontFamily: Fonts.outfit.extraBold,
    letterSpacing: 0.8,
  },
  howToHostTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: Fonts.outfit.extraBold,
    marginBottom: 4,
  },
  howToHostSubtitle: {
    color: 'rgba(196,181,253,0.85)',
    fontSize: 12,
    fontFamily: Fonts.inter.regular,
    lineHeight: 17,
    marginBottom: 14,
  },
  howToHostYtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff0000',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  howToHostYtBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Fonts.outfit.bold,
  },
  howToHostPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerLeft: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerRight: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  unreadBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  headerGreeting: { fontSize: 15, color: colors.slate400, fontFamily: 'AkayaKanadaka_400Regular', textAlign: 'center', marginTop: -18 },
  headerName: { fontSize: 28, lineHeight: 38, color: colors.white, fontFamily: 'AkayaKanadaka_400Regular', letterSpacing: 0.5, textAlign: 'center', includeFontPadding: false },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  createBtnHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  createBtnText: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: Fonts.outfit.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingBottom: 14,
    position: 'relative',
    overflow: 'visible'
  },
  tabBadge: { position: 'absolute', top: 4, right: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.background },
  tabBadgeText: { color: colors.white, fontSize: 9, fontFamily: Fonts.inter.bold },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  tabText: { fontSize: 13, color: colors.slate400, fontFamily: Fonts.inter.medium },
  tabTextActive: { color: colors.gold, fontFamily: Fonts.inter.bold },

  // Grid
  grid: { paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventCard: {
    width: (width - 44) / 2,
    height: 185,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
    backgroundColor: isDark ? '#101010' : '#ffffff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  sharedEventCard: {
    height: 260,
  },
  cardImageWrap: {
    width: '100%',
    height: 115,
    backgroundColor: isDark ? '#050505' : '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  sharedCardImageWrap: {
    height: 160,
  },
  cardCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(2,6,23,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cardCategoryText: {
    fontSize: 8,
    color: colors.gold,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 0.7,
  },
  cardInfoStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    flex: 1,
    backgroundColor: isDark ? '#000000' : '#ffffff',
  },
  cardTitle: {
    fontSize: 14,
    color: colors.white,
    fontFamily: Fonts.outfit.bold,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardDate: {
    fontSize: 11,
    color: colors.slate400,
    fontFamily: Fonts.inter.medium,
  },
  sharedOwnerBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sharedOwnerLine: {
    fontSize: 8,
    color: colors.white,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  sharedOwnerLabel: {
    color: colors.slate400,
  },
  cardContent: {},
  cardGradient: {},
  cardOpenArea: {},
  cardAction: {},

  // Empty State
  emptyState: { width: '100%', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, color: colors.white, fontFamily: Fonts.outfit.bold, marginTop: 16 },
  emptyBody: { fontSize: 12, color: colors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },

  // Requests Tab Styles
  requestEventGroup: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    padding: 12,
    gap: 10,
  },
  requestGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  requestGroupLabel: {
    color: colors.slate400,
    fontSize: 9,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  requestGroupTitle: {
    color: colors.white,
    fontSize: 16,
    fontFamily: Fonts.outfit.bold,
    marginTop: 2,
  },
  requestGroupCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  requestGroupCountText: {
    color: MidnightColors.background,
    fontSize: 12,
    fontFamily: Fonts.outfit.bold,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderRadius: 18,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 16,
  },
  requestAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  avatarTextSmall: { color: colors.gold, fontSize: 20, fontFamily: Fonts.outfit.bold },
  requestInfo: { flex: 1, gap: 2 },
  requestName: { color: colors.white, fontSize: 16, fontFamily: Fonts.outfit.bold },
  requestContact: { color: colors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium },
  requestEventRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestEventLabel: { color: colors.slate400, fontSize: 10, fontFamily: Fonts.inter.medium },
  requestEventTitle: { color: colors.gold, fontSize: 10, fontFamily: Fonts.inter.bold, flex: 1 },
  requestActionsMini: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  miniActionBtnGreen: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  miniActionBtnRed: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  // Request Modal Styles
  ironCladWrapper: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  premiumRequestModal: { width: width * 0.85, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', marginBottom: 16 },
  avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  largeAvatarText: { color: MidnightColors.background, fontSize: 32, fontFamily: Fonts.outfit.extraBold },
  modalRequestTitle: { color: colors.white, fontSize: 22, fontFamily: Fonts.outfit.bold, textAlign: 'center' },
  modalRequestSub: { color: colors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium, marginTop: 4 },
  modalBody: { gap: 16, marginBottom: 24, marginTop: 24 },
  detailRow: { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 20 },
  detailLabel: { color: colors.slate400, fontSize: 10, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { color: colors.white, fontSize: 15, fontFamily: Fonts.inter.medium },
  modalFooter: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalActionBtnApprove: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  approveGradient: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  modalActionText: { fontSize: 14, fontFamily: Fonts.outfit.bold },
  modalActionTextWhite: { color: colors.white, fontSize: 14, fontFamily: Fonts.outfit.bold },
  modalCloseLink: { marginTop: 20, alignSelf: 'center' },
  modalCloseLinkText: { color: colors.slate400, fontSize: 13, fontFamily: Fonts.inter.medium },

  // Quota Modal
  quotaOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    paddingHorizontal: 20,
  },
  quotaModalContent: {
    width: '100%',
    backgroundColor: isDark ? '#0d1526' : colors.background,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },

  // Hero section
  quotaHero: {
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  quotaHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quotaCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quotaHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  quotaHeroTitle: {
    fontSize: 17,
    color: colors.white,
    fontFamily: Fonts.outfit.extraBold,
  },
  quotaHeroSub: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: Fonts.inter.regular,
    marginTop: 1,
  },
  quotaActivePlanText: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: Fonts.inter.medium,
  },
  quotaActivePlanName: {
    color: '#4ade80',
    fontFamily: Fonts.outfit.bold,
  },

  // Divider
  quotaDivider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    marginHorizontal: 0,
  },

  // Metrics section
  quotaMetrics: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 0,
  },
  quotaMetricRow: {
    gap: 10,
  },
  quotaMetricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaMetricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quotaMetricLabel: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: Fonts.inter.medium,
  },
  quotaMetricRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quotaMetricValue: {
    fontSize: 14,
    color: colors.white,
    fontFamily: Fonts.outfit.bold,
  },
  quotaMetricMax: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: Fonts.inter.regular,
  },
  quotaPercentChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  quotaPercentText: {
    fontSize: 11,
    fontFamily: Fonts.outfit.bold,
  },
  quotaBarTrack: {
    height: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quotaBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quotaMetricSep: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    marginVertical: 16,
  },

  // CTA
  quotaUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 18,
  },
  quotaUpgradeBtnText: {
    fontSize: 14,
    color: '#000',
    fontFamily: Fonts.outfit.bold,
    letterSpacing: 0.2,
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.modalBackdrop },
  modalContent: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createModalContent: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, color: colors.white, fontFamily: Fonts.outfit.extraBold },
  form: { gap: 16 },
  createForm: { gap: 16, paddingBottom: 8 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, color: colors.gold, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    padding: 16,
    borderRadius: 16,
    color: colors.white,
    fontFamily: Fonts.inter.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  },
  eventTypeOptionActive: {
    backgroundColor: MidnightColors.gold,
    borderColor: MidnightColors.gold,
  },
  eventTypeText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: Fonts.inter.bold,
  },
  eventTypeTextActive: {
    color: MidnightColors.background,
  },
  dateSelectBtn: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateSelectText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: Fonts.inter.medium,
  },
  submitBtn: {
    backgroundColor: MidnightColors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 20,
    marginTop: 10,
    shadowColor: MidnightColors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: { color: MidnightColors.background, fontFamily: Fonts.outfit.extraBold, fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },

  modalDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },

  // Options List
  optionsList: { gap: 4, marginTop: 8 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  optionText: { fontSize: 16, color: colors.white, fontFamily: Fonts.inter.medium },
  templateModalContent: {
    maxHeight: '82%',
  },
  templateRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  },
  activeTemplateRowCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  templateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  palettePreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  paletteAccentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  templateRowText: {
    flex: 1,
    marginRight: 8,
  },
  templateRowName: {
    color: colors.white,
    fontSize: 14,
    fontFamily: Fonts.outfit.bold,
  },
  templateRowDesc: {
    color: colors.slate400,
    fontSize: 11,
    fontFamily: Fonts.inter.regular,
    marginTop: 1,
  },
  templateCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumModalBackdrop: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  premiumModalContent: {
    width: width * 0.85,
    alignSelf: 'center',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10
  },
  premiumModalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'rgba(255,255,255,0.02)' },
  premiumAvatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  premiumAvatarText: { color: MidnightColors.background, fontSize: 20, fontFamily: Fonts.outfit.extraBold },
  premiumModalTitle: { color: '#fff', fontSize: 18, fontFamily: Fonts.outfit.bold },
  premiumModalSub: { color: MidnightColors.gold, fontSize: 10, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', marginTop: 1, opacity: 0.8 },
  closeModalCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  permissionsScroll: { padding: 16 },
  userInfoToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.025)', padding: 10, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 10 },
  userInfoToggleActive: { backgroundColor: 'rgba(212, 175, 55, 0.06)', borderColor: 'rgba(212, 175, 55, 0.18)' },
  userInfoToggleIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center' },
  userInfoToggleTitle: { color: '#fff', fontSize: 13, fontFamily: Fonts.outfit.bold },
  userInfoToggleSub: { color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 1 },
  userInfoPanel: { backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 10, marginBottom: 10 },
  userInfoProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  userInfoLargeAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  memberInfoAvatarImage: { width: '100%', height: '100%' },
  userInfoName: { color: '#fff', fontSize: 14, fontFamily: Fonts.outfit.bold },
  userInfoHandle: { color: MidnightColors.gold, fontSize: 11, fontFamily: Fonts.inter.bold, marginTop: 2 },
  userInfoDetails: { gap: 6 },
  userInfoDetailRow: { backgroundColor: 'rgba(15, 23, 42, 0.7)', padding: 9, borderRadius: 12 },
  userInfoDetailLabel: { color: '#94a3b8', fontSize: 9, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.8 },
  userInfoDetailValue: { color: '#fff', fontSize: 12, fontFamily: Fonts.inter.medium },
});

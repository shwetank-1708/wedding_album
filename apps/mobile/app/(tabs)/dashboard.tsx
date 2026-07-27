import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  PanResponder,
  Animated,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { resolveEventCoverImage } from '@/lib/eventCovers';
import {
  getUserEvents,
  Event as DatabaseEvent,
  getApprovedSharedEventsForUser,
  getEventByJoinId,
  logGuestLogin,
  getNotifications,
  checkGuestRequestStatus,
} from '@/lib/database';
import { subscribeToUploadQueue } from '@/lib/uploadQueue';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import CakeIcon from '@/components/icons/CakeIcon';
import HandshakeIcon from '@/components/icons/HandshakeIcon';
import { EveBashLogoBadge } from '@/components/EveBashLogo';

const { width, height } = Dimensions.get('window');

interface SwipeableNotificationItemProps {
  children: React.ReactNode;
  onDismiss: () => void;
  colors: any;
  isDark: boolean;
}

export function SwipeableNotificationItem({ children, onDismiss, colors, isDark }: SwipeableNotificationItemProps) {
  const translateX = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -120) {
          Animated.timing(translateX, {
            toValue: -width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 12 }}>
      {/* Background delete action indicator */}
      <View style={[StyleSheet.absoluteFill, {
        backgroundColor: colors.gold || '#d4af37',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 24,
      }]}>
        <IconSymbol name="trash.fill" size={20} color="#ffffff" />
      </View>

      {/* Swipeable foreground content */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [hasUnreadChats, setHasUnreadChats] = useState(false);

  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [lastReadNotifs, setLastReadNotifs] = useState<number>(0);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set());
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);
  const [selectedRequestEvent, setSelectedRequestEvent] = useState<any | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState({ title: '', message: '', type: 'success' as 'success' | 'pending' | 'rejected', eventName: '' as string | undefined });
  const [showUploadCompleteModal, setShowUploadCompleteModal] = useState(false);

  const loadDismissedNotifs = async () => {
    if (!user?.uid) return new Set<string>();
    try {
      const stored = await AsyncStorage.getItem(`EVEBASH_NOTIFS_DISMISSED_${user.uid}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const set = new Set<string>(parsed);
        setDismissedNotifIds(set);
        return set;
      }
    } catch (e) {
      console.warn('Failed to load dismissed notifications:', e);
    }
    return new Set<string>();
  };

  const fetchNotifs = async () => {
    if (!user?.uid) return;
    setLoadingNotifications(true);
    try {
      const list = await getNotifications(user.uid);
      const dismissed = await loadDismissedNotifs();
      const filtered = list.filter(item => !dismissed.has(item.id));

      const { getUploadQueue } = require('@/lib/uploadQueue');
      const queueItems = getUploadQueue();
      const active = queueItems.filter((i: any) => i.status === 'uploading' || i.status === 'pending');
      const failed = queueItems.filter((i: any) => i.status === 'failed');
      const completed = queueItems.filter((i: any) => i.status === 'completed');

      let uploadNotif: any = null;
      const total = queueItems.length;
      const completedCount = completed.length;
      const progressSum = queueItems.reduce((sum: number, item: any) => {
        if (item.status === 'completed') return sum + 100;
        return sum + item.progress;
      }, 0);
      const overallPercentage = total > 0 ? progressSum / (total * 100) * 100 : 0;

      if (active.length > 0) {
        uploadNotif = {
          id: 'upload-active',
          title: '📤 Uploading Media',
          body: `Uploading: ${completedCount}/${total} files (${Math.round(overallPercentage)}%)`,
          createdAt: new Date(),
          type: 'upload_progress',
          targetId: 'upload_queue'
        };
      } else if (failed.length > 0) {
        uploadNotif = {
          id: 'upload-failed',
          title: '❌ Upload Halted with Issues',
          body: `Succeeded: ${completedCount}, Failed: ${failed.length}. Tap to retry.`,
          createdAt: new Date(),
          type: 'upload_failed',
          targetId: 'upload_queue'
        };
      } else if (completedCount > 0) {
        uploadNotif = {
          id: 'upload-success',
          title: '✅ Upload Complete',
          body: 'Upload complete',
          createdAt: new Date(),
          type: 'upload_success',
          targetId: 'upload_queue'
        };
      }

      const finalNotifs = [...filtered];
      if (uploadNotif && !dismissed.has(uploadNotif.id)) {
        finalNotifs.unshift(uploadNotif);
      }

      setNotifications(finalNotifs);

      const lastReadStr = await AsyncStorage.getItem(`EVEBASH_NOTIFS_LAST_READ_${user.uid}`);
      const lastReadTime = lastReadStr ? parseInt(lastReadStr, 10) : 0;
      setLastReadNotifs(lastReadTime);

      if (finalNotifs.length > 0) {
        const latestNotif = finalNotifs[0];
        const latestTime = latestNotif.createdAt?.seconds
          ? latestNotif.createdAt.seconds * 1000
          : (latestNotif.createdAt instanceof Date ? latestNotif.createdAt.getTime() : 0);

        if (latestTime > lastReadTime || (uploadNotif && (active.length > 0 || failed.length > 0 || completedCount > 0))) {
          setHasUnreadNotifications(true);
        } else {
          setHasUnreadNotifications(false);
        }
      } else {
        setHasUnreadNotifications(false);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleDismissNotification = async (notifId: string) => {
    try {
      if (notifId.startsWith('upload-')) {
        const { resetUploadQueue, clearFinishedUploads } = require('@/lib/uploadQueue');
        if (notifId === 'upload-success') {
          await clearFinishedUploads();
        } else {
          await resetUploadQueue();
        }
      }

      const updated = new Set(dismissedNotifIds);
      updated.add(notifId);
      setDismissedNotifIds(updated);

      if (user?.uid) {
        await AsyncStorage.setItem(
          `EVEBASH_NOTIFS_DISMISSED_${user.uid}`,
          JSON.stringify(Array.from(updated))
        );
      }

      setNotifications(prev => prev.filter(item => item.id !== notifId));
    } catch (e) {
      console.warn('Failed to dismiss notification:', e);
    }
  };

  const handleSendAccessRequest = async () => {
    if (!selectedRequestEvent || !user) return;
    setSendingRequest(true);
    try {
      const guestName = user.name || 'Anonymous Guest';
      const guestId = user.phone || user.email || user.uid;
      if (!guestId) {
        Alert.alert("Error", "You must be logged in to request access.");
        return;
      }

      const success = await logGuestLogin(
        guestName,
        guestId,
        selectedRequestEvent.targetId,
        selectedRequestEvent.eventParentId || undefined,
        selectedRequestEvent.eventTitle || 'Untitled Event',
        selectedRequestEvent.eventCreatorId || undefined,
        'pending'
      );

      if (success) {
        // Close Request Access Modal immediately
        setShowRequestAccessModal(false);
        // Show Status Modal with details
        setStatusModalConfig({
          title: "Request Sent",
          message: `Your request to join "${selectedRequestEvent.eventTitle || 'this private event'}" has been sent to the creator. Once approved, the event will automatically appear in your collections!`,
          type: 'success',
          eventName: selectedRequestEvent.eventTitle || undefined
        });
        setShowStatusModal(true);
      } else {
        setShowRequestAccessModal(false);
        Alert.alert("Request Failed", "Failed to submit request. Please try again later.");
      }
    } catch (err) {
      console.error("Error submitting guest request:", err);
      Alert.alert("Error", "An error occurred while sending your request.");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleOpenNotifications = async () => {
    setShowNotificationsModal(true);
    setHasUnreadNotifications(false);
    const now = Date.now();
    setLastReadNotifs(now);
    if (user?.uid) {
      await AsyncStorage.setItem(`EVEBASH_NOTIFS_LAST_READ_${user.uid}`, now.toString());
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; content: string }>({
    visible: false,
    title: '',
    content: '',
  });

  // Join Event State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [joining, setJoining] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleJoinEvent = async (code?: string) => {
    const finalCode = (code || joinCode).trim().toUpperCase();
    if (!finalCode) return;

    if (!user) {
      Alert.alert("Error", "You must be logged in to join an event.");
      return;
    }

    setJoining(true);
    try {
      console.log('[Join] Looking for event with code:', finalCode);
      const event = await getEventByJoinId(finalCode);

      if (event) {
        console.log('[Join] Event found:', event.title);

        // Submit access request
        const guestName = user.name || 'Anonymous Guest';
        const guestId = user.phone || user.email || user.uid;

        if (!guestId) {
          throw new Error("User identifier not found.");
        }

        const success = await logGuestLogin(
          guestName,
          guestId,
          event.id,
          event.parentId || undefined,
          event.title || 'Untitled Event',
          event.createdBy || undefined,
          'pending'
        );

        if (success) {
          Alert.alert(
            "Request Sent",
            "Your request to join this event has been sent to the admin. You will see the event in your collections once approved.",
            [{ text: "OK", onPress: () => {
              setShowJoinModal(false);
              setIsScanning(false);
              setJoinCode('');
            }}]
          );
        } else {
          Alert.alert("Error", "The join request could not be submitted. Please try again.");
        }
      } else {
        Alert.alert("Invalid Code", "We couldn't find an event with that Join ID. Please check the code and try again.");
      }
    } catch (err: any) {
      console.error('[Join] Error:', err);
      Alert.alert("Join Error", "An unexpected error occurred while joining. Please try again later.");
    } finally {
      setJoining(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (data.includes('wedalbum.app/events/')) {
      const parts = data.split('/');
      const eventId = parts[parts.length - 1];
      if (eventId) {
        setShowJoinModal(false);
        setIsScanning(false);
        router.push(`/events/${eventId}`);
      }
    } else {
      handleJoinEvent(data);
    }
  };

  const fetchData = async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      if (user.phone) ownIdentifiers.push(user.phone);

      const [fetchedEvents, approvedSharedEvents] = await Promise.all([
        getUserEvents(ownIdentifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
        fetchNotifs()
      ]);

      const visibleEvents = Array.from(
        new Map([...fetchedEvents, ...approvedSharedEvents].map((e) => [e.id, e])).values()
      ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setEvents(visibleEvents);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    const unsubscribe = subscribeToUploadQueue((queueItems) => {
      const active = queueItems.filter(i => i.status === 'uploading' || i.status === 'pending');
      const failed = queueItems.filter(i => i.status === 'failed');
      const completed = queueItems.filter(i => i.status === 'completed');

      const total = queueItems.length;
      const completedCount = completed.length;
      const progressSum = queueItems.reduce((sum, item) => {
        if (item.status === 'completed') return sum + 100;
        return sum + item.progress;
      }, 0);
      const overallPercentage = total > 0 ? progressSum / (total * 100) * 100 : 0;

      let uploadNotif: any = null;

      if (active.length > 0) {
        uploadNotif = {
          id: 'upload-active',
          title: '📤 Uploading Media',
          body: `Uploading: ${completedCount}/${total} files (${Math.round(overallPercentage)}%)`,
          createdAt: new Date(),
          type: 'upload_progress',
          targetId: 'upload_queue'
        };
      } else if (failed.length > 0) {
        uploadNotif = {
          id: 'upload-failed',
          title: '❌ Upload Halted with Issues',
          body: `Succeeded: ${completedCount}, Failed: ${failed.length}. Tap to retry.`,
          createdAt: new Date(),
          type: 'upload_failed',
          targetId: 'upload_queue'
        };
      } else if (completedCount > 0) {
        uploadNotif = {
          id: 'upload-success',
          title: '✅ Upload Complete',
          body: 'Upload complete',
          createdAt: new Date(),
          type: 'upload_success',
          targetId: 'upload_queue'
        };
      }

      setNotifications(prev => {
        const filtered = prev.filter(n => !n.id.startsWith('upload-'));
        if (!uploadNotif) return filtered;
        if (dismissedNotifIds.has(uploadNotif.id)) return filtered;
        return [uploadNotif, ...filtered];
      });

      if (uploadNotif && (active.length > 0 || failed.length > 0 || completedCount > 0)) {
        setHasUnreadNotifications(true);
      }
    });

    return () => unsubscribe();
  }, [dismissedNotifIds]);

  useEffect(() => {
    if (!user?.uid) {
      setHasUnreadChats(false);
      return;
    }

    let isMounted = true;

    const checkUnreadChats = async () => {
      try {
        const { data: rooms, error: roomsErr } = await supabase
          .from('chat_rooms')
          .select('id, last_read, status')
          .or(`client_uid.eq.${user.uid},vendor_uid.eq.${user.uid}`)
          .eq('status', 'active');

        if (roomsErr) throw roomsErr;
        if (!rooms || rooms.length === 0) {
          if (isMounted) setHasUnreadChats(false);
          return;
        }

        const roomIds = rooms.map(r => r.id);

        const { data: unreadMsgs, error: msgsErr } = await supabase
          .from('messages')
          .select('room_id, created_at, sender_id')
          .in('room_id', roomIds)
          .neq('sender_id', user.uid);

        if (msgsErr) throw msgsErr;

        const hasUnread = (rooms as any[]).some(room => {
          const lastReadTimeStr = room.last_read?.[user.uid];
          const lastReadTime = lastReadTimeStr ? new Date(lastReadTimeStr).getTime() : 0;

          const roomMsgs = (unreadMsgs || []).filter(m => m.room_id === room.id);
          return roomMsgs.some(msg => {
            const msgTime = new Date(msg.created_at).getTime();
            return msgTime > lastReadTime;
          });
        });

        if (isMounted) setHasUnreadChats(hasUnread);
      } catch (err) {
        console.error("Error checking unread chats:", err);
      }
    };

    checkUnreadChats();

    const roomsChannel = supabase
      .channel(`dashboard-chat-rooms-${user.uid}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        checkUnreadChats();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        checkUnreadChats();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(roomsChannel);
    };
  }, [user?.uid]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (!user) return null;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />}
      >
        {/* ── HEADER ── */}
        <LinearGradient
          colors={isDark ? ['#101010', '#050505'] : [colors.deepSlate, colors.background]}
          style={[styles.header, { paddingTop: insets.top + 4 }]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center', position: 'relative' }}
              activeOpacity={0.7}
              onPress={handleOpenNotifications}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <IconSymbol name="bell.fill" size={20} color={colors.gold} />
              {hasUnreadNotifications && <View style={styles.unreadBadge} />}
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={styles.headingLogoRow}>
              <EveBashLogoBadge onPress={() => router.replace('/(tabs)' as any)} />
              <Text style={styles.headerTitle}>Dashboard</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center', position: 'relative' }}
              activeOpacity={0.7}
              onPress={() => router.push('/customer-chats')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
              </Svg>
              {hasUnreadChats && <View style={styles.unreadBadge} />}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {loading && !refreshing
          ? <ActivityIndicator color="#d4af37" style={{ marginTop: 60 }} />
          : <>
              {/* ── SECTION 1: EVENTS (Deep Midnight) ── */}
              <View style={[styles.section, { backgroundColor: colors.background }]}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionLabel}>Events</Text>
                    <Text style={styles.sectionSub}>Memories curated for you</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.catchyActionPill}
                    activeOpacity={0.8}
                    onPress={() => setShowJoinModal(true)}
                  >
                    <IconSymbol name="plus.circle.fill" size={12} color={'#050505'} />
                    <Text style={styles.catchyActionPillText}>Join Event</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.eventsGridContainer}>
                  {events.slice(0, 3).map((event) => {
                    const coverImage = resolveEventCoverImage(event.coverImage);

                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={styles.aestheticEventCard}
                        activeOpacity={0.9}
                        onPress={() => router.push(`/events/${event.id}?mode=visitor`)}
                      >
                        {/* Top Part: Image Container */}
                        <View style={styles.aestheticImageContainer}>
                          <ExpoImage
                            source={{ uri: coverImage }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            contentPosition="center"
                            transition={400}
                          />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.1)']}
                            style={StyleSheet.absoluteFill}
                          />
                        </View>

                      {/* Bottom Part: Text Details */}
                      <View style={styles.aestheticTextContainer}>
                        <Text style={styles.aestheticEventTitle} numberOfLines={1}>{event.title}</Text>
                        <View style={styles.aestheticEventMeta}>
                          <IconSymbol name="calendar" size={10} color={colors.gold} />
                          <Text style={styles.aestheticEventDate}>{event.date}</Text>
                        </View>
                      </View>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.aestheticExploreCard}
                    activeOpacity={0.8}
                    onPress={() => router.push('/(tabs)/your-events')}
                  >
                    <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <ExpoImage
                        source={require('@/assets/images/memories_bg.png')}
                        style={StyleSheet.absoluteFill}
                        contentFit="fill"
                        transition={400}
                      />
                      <LinearGradient
                        colors={['rgba(2,6,23,0.4)', 'rgba(2,6,23,0.95)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.aestheticExploreContent}>
                         <View style={{ alignItems: 'center', gap: 4, marginBottom: 12 }}>
                           <Text style={styles.aestheticExploreTitle} numberOfLines={1}>Your memories</Text>
                           <View style={styles.aestheticCountPill}>
                             <Text style={styles.aestheticCountText}>{events.length} Collections</Text>
                           </View>
                         </View>

                         <View style={styles.aestheticExploreBtn}>
                            <Text style={styles.aestheticExploreBtnText}>Explore All</Text>
                            <IconSymbol name="arrow.right" size={12} color={'#050505'} />
                         </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── SECTION 3: HOST AN EVENT ── */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.heroCard, { marginBottom: 16 }]}
                onPress={() => router.push('/(tabs)/gallery')}
              >
                <LinearGradient
                  colors={['rgba(212, 175, 55, 0.95)', 'rgba(184, 134, 11, 1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroGradient}
                >
                  <View style={styles.heroContent}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>FOR HOSTS</Text>
                    </View>
                    <Text style={styles.heroTitle}>Host an Event</Text>
                    <Text style={styles.heroSubtitle}>
                      Create a stunning private gallery for weddings, parties or corporate meets.
                    </Text>
                    <View style={styles.heroBtn}>
                      <Text style={styles.heroBtnText}>Create Now</Text>
                      <IconSymbol name="chevron.right" size={12} color="#ffffff" />
                    </View>
                  </View>
                  <View style={styles.heroIconContainer}>
                    <IconSymbol name="calendar.badge.plus" size={60} color="rgba(255,255,255,0.2)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* ── HOST YOUR PERFECT EVENT — HOW TO HOST ── */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.heroCard, { marginBottom: 80 }]}
                onPress={() => Linking.openURL('https://www.youtube.com/@EveBashApp')}
              >
                <LinearGradient
                  colors={['#312e81', '#1e1b4b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroGradient}
                >
                  <View style={styles.heroContent}>
                    <View style={[styles.heroBadge, { backgroundColor: 'rgba(167,139,250,0.25)' }]}>
                      <Text style={[styles.heroBadgeText, { color: '#c4b5fd' }]}>HOW TO HOST</Text>
                    </View>
                    <Text style={[styles.heroTitle, { color: '#ffffff' }]}>Host Your Perfect Event</Text>
                    <Text style={[styles.heroSubtitle, { color: 'rgba(196,181,253,0.85)' }]}>
                      Watch our step-by-step tutorials and host your event like a pro.
                    </Text>
                    <View style={styles.howToHostBtn}>
                      <IconSymbol name="play.fill" size={10} color="#ffffff" />
                      <Text style={styles.howToHostBtnText}>Watch on YouTube</Text>
                    </View>
                  </View>
                  <View style={styles.heroIconContainer}>
                    <IconSymbol name="play.rectangle.fill" size={60} color="rgba(167,139,250,0.25)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* ── INFO MODAL ── */}
              <Modal
                animationType="fade"
                transparent={true}
                visible={infoModal.visible}
                onRequestClose={() => setInfoModal({ ...infoModal, visible: false })}
              >
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{infoModal.title}</Text>
                    <Text style={styles.modalText}>{infoModal.content}</Text>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => setInfoModal({ ...infoModal, visible: false })}
                    >
                      <Text style={styles.modalCloseBtnText}>Got it</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* ── JOIN EVENT MODAL ── */}
              <Modal visible={showJoinModal} transparent animationType="slide">
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.joinModalOverlay}
                >
                  <TouchableOpacity
                    style={styles.joinModalBackdrop}
                    activeOpacity={1}
                    onPress={() => { setShowJoinModal(false); setIsScanning(false); }}
                  />
                  <View style={styles.joinModalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Join Event</Text>
                      <TouchableOpacity onPress={() => { setShowJoinModal(false); setIsScanning(false); }}>
                        <IconSymbol name="xmark.circle.fill" size={24} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    {isScanning ? (
                      <View style={styles.scannerContainer}>
                        {!permission?.granted ? (
                          <View style={styles.centered}>
                            <Text style={styles.permissionText}>Camera permission is required</Text>
                            <TouchableOpacity style={styles.viewAllPill} onPress={requestPermission}>
                              <Text style={styles.viewAllLabel}>Grant Permission</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <CameraView
                            style={styles.scanner}
                            onBarcodeScanned={handleBarCodeScanned}
                            barcodeScannerSettings={{
                              barcodeTypes: ['qr'],
                            }}
                          />
                        )}
                        <TouchableOpacity
                          style={styles.scannerCloseBtn}
                          onPress={() => setIsScanning(false)}
                        >
                          <Text style={styles.scannerCloseText}>Use Code Instead</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.form}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Enter Join ID</Text>
                          <TextInput
                            style={[styles.input, { letterSpacing: 4, fontSize: 20, textAlign: 'center', fontFamily: 'Outfit_700Bold' }]}
                            value={joinCode}
                            onChangeText={setJoinCode}
                            placeholder="E.G. A1B2C3"
                            placeholderTextColor="#334155"
                            autoCapitalize="characters"
                          />
                        </View>

                        <TouchableOpacity
                          style={[styles.submitBtn, joining && { opacity: 0.7 }]}
                          onPress={() => handleJoinEvent()}
                          disabled={joining}
                        >
                          {joining ? (
                            <ActivityIndicator color="#101010" />
                          ) : (
                            <Text style={styles.submitBtnText}>Join with Code</Text>
                          )}
                        </TouchableOpacity>

                        <View style={styles.modalDivider}>
                          <View style={styles.dividerLine} />
                          <Text style={styles.dividerText}>OR</Text>
                          <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                          style={styles.scanBtn}
                          onPress={() => setIsScanning(true)}
                        >
                          <IconSymbol name="qrcode.viewfinder" size={20} color="#d4af37" />
                          <Text style={styles.scanBtnText}>Scan QR Code</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </KeyboardAvoidingView>
              </Modal>

              {/* ── NOTIFICATIONS MODAL ── */}
              <Modal visible={showNotificationsModal} transparent animationType="slide">
                <View style={styles.joinModalOverlay}>
                  <TouchableOpacity
                    style={styles.joinModalBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowNotificationsModal(false)}
                  />
                  <View style={[styles.joinModalContent, { maxHeight: height * 0.85 }]}>
                    <View style={styles.modalHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <IconSymbol name="bell.fill" size={22} color={colors.gold} />
                        <Text style={styles.modalTitle}>Notifications</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                        <IconSymbol name="xmark.circle.fill" size={24} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    {loadingNotifications ? (
                      <View style={{ paddingVertical: 40, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator color={colors.gold} size="large" />
                      </View>
                    ) : notifications.length === 0 ? (
                      <View style={styles.emptyNotifContainer}>
                        <View style={styles.emptyNotifRing}>
                          <IconSymbol name="bell.slash.fill" size={32} color={colors.gold} />
                        </View>
                        <Text style={styles.emptyNotifTitle}>All caught up! ✨</Text>
                        <Text style={styles.emptyNotifBody}>
                          Follow users, join events, or shortlist businesses to receive real-time updates here.
                        </Text>
                      </View>
                    ) : (
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 30 }}
                      >
                        {notifications.map((item) => {
                          const formatTimeAgo = (timestamp: any) => {
                            if (!timestamp) return 'Recent';
                            let date: Date;
                            if (timestamp.toDate) {
                              date = timestamp.toDate();
                            } else if (timestamp instanceof Date) {
                              date = timestamp;
                            } else if (typeof timestamp === 'number') {
                              date = new Date(timestamp);
                            } else if (timestamp.seconds) {
                              date = new Date(timestamp.seconds * 1000);
                            } else {
                              date = new Date(timestamp);
                            }

                            if (isNaN(date.getTime())) return 'Recent';

                            const diffMs = Date.now() - date.getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            if (diffMins < 1) return 'Just now';
                            if (diffMins < 60) return `${diffMins}m ago`;

                            const diffHours = Math.floor(diffMins / 60);
                            if (diffHours < 24) return `${diffHours}h ago`;

                            const diffDays = Math.floor(diffHours / 24);
                            if (diffDays === 1) return 'Yesterday';
                            if (diffDays < 7) return `${diffDays}d ago`;

                            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                          };

                          return (
                            <SwipeableNotificationItem
                              key={item.id}
                              onDismiss={() => handleDismissNotification(item.id)}
                              colors={colors}
                              isDark={isDark}
                            >
                              <TouchableOpacity
                                style={[styles.notificationItem, { marginBottom: 0 }]}
                                activeOpacity={0.85}
                                onPress={async () => {
                                  if (item.id === 'upload-failed') {
                                    Alert.alert(
                                      "Upload Halted",
                                      "Would you like to retry the failed uploads or clear the queue?",
                                      [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                          text: "Clear Queue",
                                          style: "destructive",
                                          onPress: async () => {
                                            const { resetUploadQueue } = require('@/lib/uploadQueue');
                                            await resetUploadQueue();
                                          }
                                        },
                                        {
                                          text: "Retry All",
                                          onPress: async () => {
                                            const { getUploadQueue, retryUploadItem } = require('@/lib/uploadQueue');
                                            const qItems = getUploadQueue();
                                            const failedItems = qItems.filter((i: any) => i.status === 'failed');
                                            for (const f of failedItems) {
                                              await retryUploadItem(f.id);
                                            }
                                          }
                                        }
                                      ]
                                    );
                                    return;
                                  }
                                  if (item.id === 'upload-active') {
                                    Alert.alert(
                                      "Upload Active",
                                      "Would you like to cancel all ongoing uploads?",
                                      [
                                        { text: "No", style: "cancel" },
                                        {
                                          text: "Yes, Cancel All",
                                          style: "destructive",
                                          onPress: async () => {
                                            const { resetUploadQueue } = require('@/lib/uploadQueue');
                                            await resetUploadQueue();
                                          }
                                        }
                                      ]
                                    );
                                    return;
                                  }
                                  if (item.id === 'upload-success') {
                                    setShowNotificationsModal(false);
                                    setShowUploadCompleteModal(true);
                                    return;
                                  }

                                  setShowNotificationsModal(false);
                                  if (item.type === 'followed_event') {
                                    // 1. Check local dashboard list
                                    const hasLocalAccess = events.some(e => e.id === item.targetId);
                                    if (hasLocalAccess) {
                                      router.push(`/events/${item.targetId}?mode=visitor`);
                                      return;
                                    }

                                    // 2. Query Supabase database check for latest guest log status
                                    const guestId = user?.phone || user?.email || user?.uid;
                                    if (guestId) {
                                      const dbStatus = await checkGuestRequestStatus(guestId, item.targetId);
                                      if (dbStatus === 'approved') {
                                        router.push(`/events/${item.targetId}?mode=visitor`);
                                        return;
                                      } else if (dbStatus === 'pending') {
                                        setStatusModalConfig({
                                          title: "Request Pending",
                                          message: `You have already sent an access request. Please wait for the creator to approve it.`,
                                          type: 'pending',
                                          eventName: item.eventTitle || undefined
                                        });
                                        setShowStatusModal(true);
                                        return;
                                      } else if (dbStatus === 'rejected') {
                                        setStatusModalConfig({
                                          title: "Access Declined",
                                          message: `Your request to join this private event was declined by the creator. Please get in touch with them directly.`,
                                          type: 'rejected',
                                          eventName: item.eventTitle || undefined
                                        });
                                        setShowStatusModal(true);
                                        return;
                                      }
                                    }

                                    // 3. If no prior request exists, open custom Request Access Modal
                                    setSelectedRequestEvent(item);
                                    setShowRequestAccessModal(true);
                                  } else {
                                    router.push(`/business/${item.targetId}`);
                                  }
                                }}
                              >
                                <View style={styles.notificationIconWrapper}>
                                  <Text style={styles.notificationIconText}>
                                    {item.type === 'followed_event' ? '🎉' :
                                     item.type === 'followed_business' ? '💼' :
                                     item.type === 'shortlist_creation' ? '✨' :
                                     item.type === 'shortlist_faq' ? '❓' :
                                     item.type === 'shortlist_portfolio' ? '📸' :
                                     item.type === 'upload_progress' ? '📤' :
                                     item.type === 'upload_success' ? '✅' :
                                     item.type === 'upload_failed' ? '❌' : '📢'}
                                  </Text>
                                </View>
                                <View style={styles.notificationTextWrapper}>
                                  <View style={styles.notificationHeaderRow}>
                                    <Text style={styles.notificationItemTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
                                  </View>
                                  <Text style={styles.notificationItemBody} numberOfLines={2}>{item.body}</Text>
                                </View>
                              </TouchableOpacity>
                            </SwipeableNotificationItem>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                </View>
              </Modal>

              {/* ── CUSTOM REQUEST ACCESS MODAL ── */}
              <Modal
                visible={showRequestAccessModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRequestAccessModal(false)}
              >
                <View style={styles.modalBackdrop}>
                  <View style={[styles.modalContent, { padding: 24, borderRadius: 24, borderWidth: 1.5, borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.15)' }]}>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={[styles.emptyNotifRing, { width: 60, height: 60, borderRadius: 30, marginBottom: 12, borderWidth: 1, borderColor: colors.border }]}>
                        <IconSymbol name="lock.fill" size={24} color={colors.gold} />
                      </View>
                      <Text style={[styles.modalTitle, { textAlign: 'center', fontSize: 20, marginBottom: 4 }]}>
                        Private Event
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.gold, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                        Access Protected
                      </Text>
                    </View>

                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Inter_400Regular',
                      color: colors.slate400 || '#cbd5e1',
                      textAlign: 'center',
                      lineHeight: 22,
                      marginBottom: 24
                    }}>
                      <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.gold }}>
                        {`"${selectedRequestEvent?.eventTitle || 'This event'}"`}
                      </Text> is private. Would you like to request access from the creator? Once approved, it will automatically appear in your collections dashboard.
                    </Text>

                    <View style={{ gap: 12 }}>
                      <TouchableOpacity
                        style={[styles.modalCloseBtn, { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }]}
                        onPress={handleSendAccessRequest}
                        disabled={sendingRequest}
                      >
                        {sendingRequest ? (
                          <ActivityIndicator color="#101010" />
                        ) : (
                          <>
                            <IconSymbol name="paperplane.fill" size={14} color="#101010" />
                            <Text style={styles.modalCloseBtnText}>Send Join Request</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ paddingVertical: 12, alignItems: 'center' }}
                        onPress={() => setShowRequestAccessModal(false)}
                        disabled={sendingRequest}
                      >
                        <Text style={{ color: colors.slate400, fontFamily: 'Outfit_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* ── DYNAMIC STATUS MODAL ── */}
              <Modal
                visible={showStatusModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowStatusModal(false)}
              >
                <View style={styles.modalBackdrop}>
                  <View style={[
                    styles.modalContent,
                    {
                      padding: 24,
                      borderRadius: 28,
                      borderWidth: 1.5,
                      backgroundColor: isDark ? '#101010' : '#ffffff',
                      borderColor: statusModalConfig.type === 'success'
                        ? (isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.2)')
                        : statusModalConfig.type === 'pending'
                        ? (isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(212, 175, 55, 0.2)')
                        : (isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)'),
                      shadowColor: statusModalConfig.type === 'success' ? '#22c55e' : statusModalConfig.type === 'pending' ? colors.gold : '#ef4444',
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: isDark ? 0.15 : 0.08,
                      shadowRadius: 20,
                      elevation: 10,
                    }
                  ]}>
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                      {/* Icon Ring */}
                      <View style={{
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: statusModalConfig.type === 'success'
                          ? (isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.25)')
                          : statusModalConfig.type === 'pending'
                          ? (isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(212, 175, 55, 0.25)')
                          : (isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.25)'),
                        backgroundColor: statusModalConfig.type === 'success'
                          ? (isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.05)')
                          : statusModalConfig.type === 'pending'
                          ? (isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.05)')
                          : (isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.05)'),
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <IconSymbol
                          name={statusModalConfig.type === 'success'
                            ? "checkmark.circle.fill"
                            : statusModalConfig.type === 'pending'
                            ? "clock.fill"
                            : "xmark.circle.fill"}
                          size={32}
                          color={statusModalConfig.type === 'success'
                            ? "#22c55e"
                            : statusModalConfig.type === 'pending'
                            ? colors.gold
                            : "#ef4444"}
                        />
                      </View>

                      <Text style={[
                        styles.modalTitle,
                        {
                          textAlign: 'center',
                          fontSize: 22,
                          color: isDark ? '#ffffff' : '#101010',
                          fontFamily: 'Outfit_800ExtraBold',
                          marginBottom: 8
                        }
                      ]}>
                        {statusModalConfig.title}
                      </Text>
                    </View>

                    {statusModalConfig.eventName ? (
                      <Text style={{
                        fontSize: 16,
                        fontFamily: 'Outfit_700Bold',
                        color: statusModalConfig.type === 'success'
                          ? "#22c55e"
                          : statusModalConfig.type === 'pending'
                          ? colors.gold
                          : "#ef4444",
                        textAlign: 'center',
                        marginBottom: 16,
                        paddingHorizontal: 16
                      }}>
                        {`"${statusModalConfig.eventName}"`}
                      </Text>
                    ) : null}

                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Inter_400Regular',
                      color: isDark ? colors.slate400 : '#475569',
                      textAlign: 'center',
                      lineHeight: 22,
                      marginBottom: statusModalConfig.type === 'pending' ? 28 : 20
                    }}>
                      {statusModalConfig.message}
                    </Text>

                    {/* Informative Pill (Only for Success/Rejected states) */}
                    {statusModalConfig.type !== 'pending' && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 16,
                        padding: 14,
                        width: '100%',
                        marginBottom: 24,
                      }}>
                        <IconSymbol
                          name="info.circle"
                          size={18}
                          color={statusModalConfig.type === 'success'
                            ? "#22c55e"
                            : "#ef4444"}
                        />
                        <Text style={{
                          fontSize: 12,
                          fontFamily: 'Inter_500Medium',
                          color: isDark ? colors.slate400 : '#475569',
                          flex: 1,
                          lineHeight: 16
                        }}>
                          {statusModalConfig.type === 'success'
                            ? "The creator has been notified. You can find this event in your dashboard as soon as they accept."
                            : "If this is an error, please reach out to the event host or organizer directly to ask for an invite."}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.modalCloseBtn,
                        {
                          backgroundColor: statusModalConfig.type === 'success'
                            ? "#22c55e"
                            : statusModalConfig.type === 'pending'
                            ? colors.gold
                            : "#ef4444",
                          shadowColor: statusModalConfig.type === 'success'
                            ? "#22c55e"
                            : statusModalConfig.type === 'pending'
                            ? colors.gold
                            : "#ef4444",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 8,
                          elevation: 4
                        }
                      ]}
                      onPress={() => setShowStatusModal(false)}
                    >
                      <Text style={[
                        styles.modalCloseBtnText,
                        {
                          color: statusModalConfig.type === 'pending' ? '#101010' : '#ffffff'
                        }
                      ]}>
                        Got It!
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* ── CUSTOM THEME-STYLED UPLOAD COMPLETE MODAL ── */}
              <Modal
                visible={showUploadCompleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowUploadCompleteModal(false)}
              >
                <View style={styles.modalBackdrop}>
                  <View style={[
                    styles.modalContent,
                    {
                      padding: 24,
                      borderRadius: 24,
                      borderWidth: 1.5,
                      backgroundColor: isDark ? '#101010' : '#ffffff',
                      borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.15)',
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
                      color: colors.gold || '#CCA43B',
                      marginBottom: 8,
                      fontFamily: 'Outfit_700Bold',
                      textAlign: 'center',
                    }}>
                      Upload Complete
                    </Text>

                    <Text style={{
                      fontSize: 14,
                      color: isDark ? '#cbd5e1' : '#64748b',
                      textAlign: 'center',
                      marginBottom: 20,
                      fontFamily: 'Inter_400Regular',
                    }}>
                      Upload complete
                    </Text>

                    <TouchableOpacity
                      style={[styles.modalCloseBtn, { width: '100%' }]}
                      onPress={async () => {
                        setShowUploadCompleteModal(false);
                        const { clearFinishedUploads } = require('@/lib/uploadQueue');
                        await clearFinishedUploads();
                      }}
                    >
                      <Text style={styles.modalCloseBtnText}>
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </>
        }
      </ScrollView>
    </View>
  );
}

const CARD_W = width * 0.55;
const CARD_H = 155;
const GRID_ITEM_W = (width - 48 - 12) / 2;

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.background,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 13, color: colors.slate400, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1.2 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.04)',
    borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.1)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  datePillText: { fontSize: 10, color: colors.gold, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
  headerTitle: { fontSize: 28, lineHeight: 38, fontFamily: 'AkayaKanadaka_400Regular', color: colors.white, letterSpacing: 0.5, textAlign: 'center', includeFontPadding: false },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  avatarRingHeader: {
    padding: 3, borderRadius: 30,
    borderWidth: 1.5, borderColor: colors.gold,
  },
  avatarHeader: { width: 54, height: 54, borderRadius: 27 },
  avatarFallbackHeader: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 22, color: colors.gold, fontFamily: 'Outfit_800ExtraBold',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: colors.background,
  },

  // ── Sections ──
  section: { paddingTop: 8, paddingBottom: 16 },
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, marginBottom: 18,
  },
  sectionLabel: { fontSize: 22, color: colors.white, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: colors.slate400, fontFamily: 'Inter_400Regular', marginTop: -2 },
  viewAllPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.04)',
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
  },
  viewAllLabel: { fontSize: 11, color: colors.gold, fontFamily: 'Outfit_700Bold' },
  catchyActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  catchyActionPillText: {
    fontSize: 10,
    color: '#050505',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Event/Biz Card ──
  eventCard: {
    width: CARD_W, height: CARD_H,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 16,
    elevation: 12,
  },
  vignetteTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 70 },
  vignetteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  eventCardBody: { position: 'absolute', bottom: 14, left: 18, right: 18 },
  eventCardTitle: {
    fontSize: 16, color: colors.white,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eventCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  eventCardDate: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_500Medium' },
  ratingBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  ratingText: { fontSize: 10, color: colors.gold, fontFamily: 'Outfit_700Bold' },

  // ── Empty State ──
  emptySlate: {
    marginHorizontal: 24, paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.slate800,
    borderRadius: 20, borderStyle: 'dashed',
  },
  emptyIconRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 15, color: colors.white, fontFamily: 'Outfit_700Bold' },
  emptyBody: { fontSize: 12, color: colors.slate400, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },

  // ── Divider ──
  hairline: { marginHorizontal: 24, height: 1, backgroundColor: colors.slate900 },

  // ── CTA ──
  // Hero Banner Styles
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
  },
  heroGradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContent: {
    flex: 1,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroBadgeText: {
    color: isDark ? '#ffffff' : '#101010',
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: isDark ? '#ffffff' : '#101010',
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    lineHeight: 16,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.slate900,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: isDark ? '#ffffff' : '#101010',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  // ── How to Host Button ──
  howToHostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff0000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  howToHostBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  heroIconContainer: {
    marginLeft: 8,
  },

  // ── Modal Styles ──
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.slate900, width: '100%', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 24, color: colors.white, fontFamily: 'Outfit_800ExtraBold', marginBottom: 12, letterSpacing: -0.5 },
  modalText: { fontSize: 16, color: colors.slate400, fontFamily: 'Inter_400Regular', lineHeight: 26, marginBottom: 28 },
  modalCloseBtn: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalCloseBtnText: { color: '#101010', fontFamily: 'Outfit_800ExtraBold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.8 },

  // ── Join Event Modal Specific ──
  joinModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  joinModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.8)' },
  joinModalContent: {
    backgroundColor: colors.slate900,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, color: colors.gold, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    padding: 16,
    borderRadius: 16,
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  submitBtn: {
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 20,
    marginTop: 10,
  },
  submitBtnText: { color: '#101010', fontFamily: 'Outfit_800ExtraBold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  modalDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: '#475569', fontSize: 12, fontFamily: 'Inter_700Bold' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.02)'
  },
  scanBtnText: { color: colors.gold, fontSize: 16, fontFamily: 'Outfit_700Bold' },
  scannerContainer: { width: '100%', height: 350, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center' },
  scanner: { flex: 1 },
  scannerCloseBtn: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  scannerCloseText: { color: colors.white, fontFamily: 'Inter_700Bold', fontSize: 12 },
  permissionText: { color: colors.white, textAlign: 'center', marginBottom: 20, fontFamily: 'Inter_500Medium' },

  // ── All Events Card Styles ──
  allEventsCard: {
    marginHorizontal: 24,
    backgroundColor: colors.slate900,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  allEventsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  allEventsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allEventsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  countBadge: {
    backgroundColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBadgeText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  allEventsTitle: {
    fontSize: 18,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  allEventsSub: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cardActionBtnMain: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.gold,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtnMainText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
  cardActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActionBtnSecondaryText: {
    color: colors.gold,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },

  // ── Recent Events Scroll ──
  eventsScrollContainer: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 10,
  },
  eventsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  recentBusinessCard: {
    width: CARD_W,
    height: 165,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.slate900,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 12,
  },
  recentEventCard: {
    width: CARD_W,
    height: 165,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.slate900,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 12,
  },
  recentEventInfo: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  recentEventTitle: {
    fontSize: 16,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  recentEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  recentEventDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_500Medium',
  },
  viewAllMemoriesCard: {
    width: width * 0.45,
    height: 165,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.slate900,
    borderWidth: 1.5,
    borderColor: colors.border,
    elevation: 12,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 16,
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
    filter: 'blur(30px)',
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    transform: [{ rotate: '-15deg' }],
  },
  viewAllMemoriesContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  viewAllIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 8,
  },
  viewAllMemoriesText: {
    fontSize: 16,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  viewAllMemoriesSub: {
    fontSize: 10,
    color: colors.gold,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    width: '100%',
  },
  miniGalleryBtnText: {
    fontSize: 12,
    color: '#050505',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold || '#d4af37',
  },
  aestheticEventCard: {
    width: GRID_ITEM_W,
    height: 185,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: isDark ? '#101010' : '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  aestheticImageContainer: {
    width: '100%',
    height: 115,
    backgroundColor: colors.slate900,
    position: 'relative',
  },
  aestheticTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    flex: 1,
  },
  aestheticEventTitle: {
    fontSize: 14,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  aestheticEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  aestheticEventDate: {
    fontSize: 11,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },

  // Explore Card
  aestheticExploreCard: {
    width: GRID_ITEM_W,
    height: 185,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.slate900,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.15 : 0.03,
    shadowRadius: 10,
    elevation: 6,
  },
  aestheticExploreContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  aestheticExploreTitle: {
    fontSize: 15,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
  },
  aestheticCountPill: {
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  aestheticCountText: {
    fontSize: 10,
    color: colors.gold,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aestheticExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
  },
  aestheticExploreBtnText: {
    fontSize: 11,
    color: '#050505',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyNotifContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyNotifRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(212, 175, 55, 0.15)',
  },
  emptyNotifTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
    marginBottom: 6,
  },
  emptyNotifBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    textAlign: 'center',
    lineHeight: 18,
  },
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: isDark ? '#101010' : '#ffffff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  notificationIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  notificationIconText: {
    fontSize: 18,
  },
  notificationTextWrapper: {
    flex: 1,
  },
  notificationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationItemTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
  },
  notificationTime: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: colors.gold,
  },
  notificationItemBody: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    lineHeight: 16,
  },
});

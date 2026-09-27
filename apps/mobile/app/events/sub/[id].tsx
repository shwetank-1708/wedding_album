import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert, useWindowDimensions, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getEventPhotos, toggleLike, addComment, onPhotoInteractions, deletePhotoComment, logGuestLogin, onGuestStatusChange, Event as DatabaseEvent, Photo } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import { getGridThumbnail, getImageUrl } from '@/lib/imageUrl';
import { subscribeToUploadQueue, clearFinishedUploads } from '@/lib/uploadQueue';




const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = (SCREEN_WIDTH - 24) / COLUMN_COUNT;

export default function SubEventPhotosScreen() {
  const { width } = useWindowDimensions();
  const { id, shared } = useLocalSearchParams<{ id: string; shared?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isShared = shared === 'true';
  
  const [subEvent, setSubEvent] = useState<DatabaseEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestStatus, setGuestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [submittingGuest, setSubmittingGuest] = useState(false);
  const completedIdsRef = useRef<string[]>([]);
  const loggedInGuestIdentifier = user ? (user.email || user.phone || user.uid) : '';
  const parentEventId = subEvent?.parentId || subEvent?.id;
  const isPrivilegedViewer = !!user && !!subEvent && (
    user.role === 'admin' ||
    user.uid === subEvent.createdBy ||
    (user.roleType === 'primary' && user.delegatedBy === subEvent.createdBy) ||
    !!user.assignedEvents?.some((eventId) =>
      eventId === subEvent.id ||
      eventId === subEvent.legacyId ||
      eventId === subEvent.parentId
    )
  );
  


  // Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const openViewer = (index: number) => {
    setInitialIndex(index);
    setViewerVisible(true);
  };

  const navigateViewer = (dir: 'prev' | 'next') => {
    if (dir === 'prev') {
      setInitialIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
    } else {
      setInitialIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  };

  useEffect(() => {
    if (!id) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const eventData = await getEventById(id);
        const photosData = eventData ? await getEventPhotos(id, eventData.legacyId) : [];
        setSubEvent(eventData);
        setPhotos(photosData);
      } catch (err) {
        console.error("Error fetching photos:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToUploadQueue((items) => {
      const filtered = items.filter(item => item.eventId === id);
      const activeItems = filtered.filter(item => item.status === 'uploading' || item.status === 'pending');
      const completedItems = filtered.filter(item => item.status === 'completed');

      // Reload photos if any upload just finished successfully (one-by-one check)
      const newlyCompleted = completedItems.filter(item => !completedIdsRef.current.includes(item.id));
      if (newlyCompleted.length > 0) {
        completedIdsRef.current = [...completedIdsRef.current, ...newlyCompleted.map(item => item.id)];
        const loadFresh = async () => {
          try {
            const eventData = await getEventById(id);
            const photosData = eventData ? await getEventPhotos(id, eventData.legacyId) : [];
            setPhotos(photosData);
          } catch (e) {
            console.error("[SubEventPhotosScreen] Error refreshing photos:", e);
          }
        };
        loadFresh();
      }

      if (activeItems.length === 0 && completedItems.length > 0) {
        clearFinishedUploads();
        completedIdsRef.current = [];
      }
    });

    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!isShared || isPrivilegedViewer || !id) return;
    const guestIdentifier = user ? loggedInGuestIdentifier : guestPhone.trim() ? guestPhone.replace(/\D/g, '') : '';
    if (!guestIdentifier) return;
    const logId = `${guestIdentifier}_${id}`;
    const unsubscribe = onGuestStatusChange(logId, (status) => {
      setGuestStatus(status as any);
    });
    return unsubscribe;
  }, [guestPhone, id, isPrivilegedViewer, isShared, loggedInGuestIdentifier, user]);

  useEffect(() => {
    if (!isShared || !user || !subEvent || !id || isPrivilegedViewer || guestStatus !== 'idle' || !loggedInGuestIdentifier) return;

    let cancelled = false;
    const requestGuestAccess = async () => {
      setSubmittingGuest(true);
      const success = await logGuestLogin(
        user.name || 'Guest',
        loggedInGuestIdentifier,
        id,
        parentEventId,
        subEvent.title,
        subEvent.createdBy
      );
      if (!cancelled) {
        if (success) setGuestStatus('pending');
        setSubmittingGuest(false);
      }
    };

    requestGuestAccess();
    return () => {
      cancelled = true;
    };
  }, [guestStatus, id, isPrivilegedViewer, isShared, loggedInGuestIdentifier, parentEventId, subEvent, user]);

  const accessGranted = !isShared || isPrivilegedViewer || guestStatus === 'approved';

  const submitGuestRequest = async () => {
    if (!subEvent || !id || !guestName.trim() || !guestPhone.trim()) return;
    const normalizedPhone = guestPhone.replace(/\D/g, '');
    setSubmittingGuest(true);
    await logGuestLogin(
      guestName.trim(),
      normalizedPhone,
      id,
      subEvent.parentId || subEvent.id,
      subEvent.title,
      subEvent.createdBy
    );
    setGuestPhone(normalizedPhone);
    setGuestStatus('pending');
    setSubmittingGuest(false);
  };

  const goBackToParentEvent = useCallback(() => {
    const parentId = subEvent?.parentId;

    if (parentId) {
      const params: Record<string, string> = {};
      if (isPrivilegedViewer) params.mode = 'admin';
      if (isShared) params.shared = 'true';

      router.replace({
        pathname: `/events/${parentId}`,
        params,
      } as any);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }, [isPrivilegedViewer, isShared, router, subEvent?.parentId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!subEvent?.parentId) return false;
      goBackToParentEvent();
      return true;
    });

    return () => subscription.remove();
  }, [goBackToParentEvent, subEvent?.parentId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#906D4B" />
      </SafeAreaView>
    );
  }

  if (!subEvent) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Gallery not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBackToParentEvent}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={goBackToParentEvent}
              style={styles.nativeBackButton}
              hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
            >
              <IconSymbol name="chevron.left" size={28} color="#ffffff" />
            </TouchableOpacity>
          )
        }} 
      />
      <View style={styles.container}>

        {!accessGranted ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="shield.fill" size={64} color="#594C3D" />
            <Text style={styles.emptyText}>Access approval required.</Text>
            <Text style={styles.emptySubText}>Send a request to unlock this shared gallery.</Text>
          </View>
        ) : photos.length > 0 ? (
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
            renderItem={({ item, index }) => (
              <TouchableOpacity activeOpacity={0.8} onPress={() => openViewer(index)}>
                <Image 
                  source={{ uri: getGridThumbnail(item.url, item.thumbnailUrl) }} 
                  style={styles.gridImage} 
                />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <IconSymbol name="photo" size={64} color="#594C3D" />
            <Text style={styles.emptyText}>No photos uploaded yet.</Text>
            <Text style={styles.emptySubText}>Use the web dashboard to upload photos to this gallery.</Text>
          </View>
        )}
      </View>

      <Modal
        visible={viewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
      >
        <PhotoViewer 
          photos={photos} 
          initialIndex={initialIndex} 
          onClose={() => setViewerVisible(false)} 
          user={user} 
        />
      </Modal>
      <GuestAccessModal
        visible={!!subEvent && isShared && !accessGranted && (!user || guestStatus !== 'idle')}
        guestStatus={guestStatus}
        guestName={guestName}
        guestPhone={guestPhone}
        submitting={submittingGuest}
        onNameChange={setGuestName}
        onPhoneChange={setGuestPhone}
        onSubmit={submitGuestRequest}
        onRetry={() => setGuestStatus('idle')}
      />
    </>
  );
}

function GuestAccessModal({
  visible,
  guestStatus,
  guestName,
  guestPhone,
  submitting,
  onNameChange,
  onPhoneChange,
  onSubmit,
  onRetry,
}: {
  visible: boolean;
  guestStatus: 'idle' | 'pending' | 'approved' | 'rejected';
  guestName: string;
  guestPhone: string;
  submitting: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.guestModalOverlay}>
        <View style={styles.guestModal}>
          <View style={styles.guestModalIcon}>
            <IconSymbol name={guestStatus === 'pending' ? 'clock.fill' : 'shield.fill'} size={30} color="#CA9C68" />
          </View>
          {guestStatus === 'pending' ? (
            <>
              <Text style={styles.guestModalTitle}>Waiting for approval</Text>
              <Text style={styles.guestModalText}>Your request has been sent to the event admin. This gallery will unlock after approval.</Text>
            </>
          ) : guestStatus === 'rejected' ? (
            <>
              <Text style={styles.guestModalTitle}>Access restricted</Text>
              <Text style={styles.guestModalText}>The admin declined this request. You can try again with different details.</Text>
              <TouchableOpacity style={styles.guestSubmitBtn} onPress={onRetry}>
                <Text style={styles.guestSubmitText}>Try Again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.guestModalTitle}>Request gallery access</Text>
              <Text style={styles.guestModalText}>Enter your details so the host can approve this shared gallery.</Text>
              <TextInput style={styles.guestInput} value={guestName} onChangeText={onNameChange} placeholder="Your name" placeholderTextColor="#CDB89E" />
              <TextInput style={styles.guestInput} value={guestPhone} onChangeText={onPhoneChange} placeholder="Phone number" placeholderTextColor="#CDB89E" keyboardType="phone-pad" />
              <TouchableOpacity style={[styles.guestSubmitBtn, submitting && { opacity: 0.7 }]} onPress={onSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.guestSubmitText}>Send Request</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// --- PHOTO VIEWER COMPONENT ---
function PhotoViewer({ photos, initialIndex, onClose, user }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { width, height: screenHeight } = useWindowDimensions();

  const goToNext = () => {
    setCurrentIndex((prev: number) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const goToPrev = () => {
    setCurrentIndex((prev: number) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  return (
    <View style={styles.viewerContainer}>
      <TouchableOpacity style={styles.viewerClose} onPress={onClose}>
        <IconSymbol name="xmark" size={28} color="#fff" />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navBtnLeft} onPress={goToPrev}>
        <IconSymbol name="chevron.left" size={32} color="#fff" />
      </TouchableOpacity>
      
      {photos[currentIndex] && (
        <Image 
          source={{ uri: getImageUrl(photos[currentIndex].url, { width: 900 }, photos[currentIndex].thumbnailUrl) }} 
          style={styles.fullImage} 
          resizeMode="contain" 
        />
      )}
      
      <TouchableOpacity style={styles.navBtnRight} onPress={goToNext}>
        <IconSymbol name="chevron.right" size={32} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.viewerFooter}>
        <Text style={styles.viewerText}>{currentIndex + 1} / {photos.length}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B211F',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1B211F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#cbd5e1',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2B2F2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2B2F2E',
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#CDB89E',
    marginTop: 2,
  },
  gridContainer: {
    paddingBottom: 40,
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: 4,
    backgroundColor: '#2B2F2E',
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#FFF7EB',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    color: '#CDB89E',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -50,
    zIndex: 100,
  },
  navArrowLeft: {
    left: 0,
  },
  navArrowRight: {
    right: 0,
  },
  interactionsOverlay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 80,
    paddingVertical: 20,
    backgroundColor: '#000000',
  },
  actionButton: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
  },
  commentsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.5,
    backgroundColor: '#2B2F2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: -24,
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  commentsTitle: {
    color: '#1B211F',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  commentsSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  closeCommentsBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  commentsList: {
    flex: 1,
  },
  commentThread: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF7EB',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    color: '#1B211F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
  },
  commentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentName: {
    color: '#1B211F',
    fontSize: 13,
    fontWeight: 'bold',
  },
  commentTime: {
    color: '#CDB89E',
    fontSize: 11,
  },
  commentBubble: {
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  commentText: {
    color: '#594C3D',
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  replyBtnText: {
    color: '#CA9C68',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  replyItem: {
    flexDirection: 'row',
    marginLeft: 48,
    marginTop: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  replyAvatarText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replyName: {
    color: '#475569',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replyBubble: {
    backgroundColor: '#FFF7EB',
    padding: 10,
    borderRadius: 12,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  replyText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#ffffff',
  },
  emptyComments: {
    color: '#1B211F',
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 16,
  },
  emptyCommentsSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  commentInputContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  replyingToBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  replyingToText: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFF7EB',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#1B211F',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B211F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 33, 31,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  guestModal: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  guestModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  guestModalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1B211F',
    textAlign: 'center',
    marginBottom: 8,
  },
  guestModalText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  guestInput: {
    width: '100%',
    backgroundColor: '#FFF7EB',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#1B211F',
    marginBottom: 12,
  },
  guestSubmitBtn: {
    width: '100%',
    backgroundColor: '#1B211F',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  guestSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  navBtnLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -25,
    zIndex: 10,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30,
  },
  navBtnRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -25,
    zIndex: 10,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30,
  },
  viewerFooter: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 20,
  },
  viewerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  getEventById,
  getSubEvents,
  Event as DatabaseEvent,
  updateEvent,
  createEvent,
  getGuestLogs,
  deleteEvent,
  getBusinessById,
  Business,
  updatePhotosOrder,
  updateSubEventsOrder,
  getEventPhotos,
  generateEventJoinId
} from '@/lib/database';
import { uploadEventImage } from '@/lib/storage';
import { getDefaultTemplateForEventCategory } from '@/constants/templates';
import * as ImageManipulator from 'expo-image-manipulator';

export function useEventState(id: string, user: any) {
  const router = useRouter();

  const [event, setEvent] = useState<DatabaseEvent | null>(null);
  const [subEvents, setSubEvents] = useState<DatabaseEvent[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [guestLogs, setGuestLogs] = useState<any[]>([]);
  const [linkedVendors, setLinkedVendors] = useState<Business[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cover Reposition / Scale State
  const [tempCoverOffset, setTempCoverOffset] = useState(0);
  const [tempCoverOffsetX, setTempCoverOffsetX] = useState(0);
  const [tempCoverScale, setTempCoverScale] = useState(1.0);
  const offsetRef = useRef(0);
  const offsetXRef = useRef(0);
  const scaleRef = useRef(1.0);

  useEffect(() => {
    offsetRef.current = tempCoverOffset;
  }, [tempCoverOffset]);

  useEffect(() => {
    offsetXRef.current = tempCoverOffsetX;
  }, [tempCoverOffsetX]);

  useEffect(() => {
    scaleRef.current = tempCoverScale;
  }, [tempCoverScale]);

  // Gallery Description State
  const [galleryDescModalVisible, setGalleryDescModalVisible] = useState(false);
  const [galleryDescText, setGalleryDescText] = useState('');

  // Admin Selected Gallery
  const [selectedAdminGallery, setSelectedAdminGallery] = useState<DatabaseEvent | null | undefined>(undefined);

  // Visitor Active Sub-event
  const [activeSubEvent, setActiveSubEvent] = useState<DatabaseEvent | null>(null);

  const currentActiveEvent = selectedAdminGallery !== undefined
    ? (selectedAdminGallery || event)
    : (activeSubEvent || event);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const loadPhotos = async (eventId: string, legacyId?: string) => {
    setLoadingPhotos(true);
    const perfPhotosStart = Date.now();
    try {
      const eventPhotos = await getEventPhotos(eventId, legacyId);
      setPhotos(eventPhotos);
      console.log(`[PERF] loadPhotos completed in ${Date.now() - perfPhotosStart}ms`);
    } catch (err) {
      console.error('[EventDetail] Photos load error:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadEvent = useCallback(async () => {
    setLoading(true);
    const perfStart = Date.now();
    console.log('[PERF] Starting loadEvent fetching pipeline...');
    try {
      const eventData = await getEventById(id);
      if (eventData) {
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

        setEvent(eventData);
        setIsOwner(user?.uid === eventData.createdBy);

        const [subs, vendorsData, logs, eventPhotos] = await Promise.all([
          getSubEvents(id, eventData.legacyId),
          eventData.vendors && eventData.vendors.length > 0
            ? Promise.all(eventData.vendors.map((vid: string) => getBusinessById(vid)))
            : Promise.resolve([]),
          user && user.uid === eventData.createdBy
            ? getGuestLogs([user.uid])
            : Promise.resolve([]),
          getEventPhotos(eventData.id, eventData.legacyId)
        ]);

        setSubEvents(subs);
        setLinkedVendors(vendorsData.filter(v => v !== null) as Business[]);
        setPhotos(eventPhotos);

        if (user && user.uid === eventData.createdBy) {
          setGuestLogs(logs.filter(l => l.eventId === id || l.parentEventId === id));
        }

        console.log(`[PERF] loadEvent pipeline completed in ${Date.now() - perfStart}ms`);
      }
    } catch (err) {
      console.error('[EventDetail] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, user, loadEvent]);

  const handleSubEventChange = (sub: DatabaseEvent | null) => {
    setActiveSubEvent(sub);
    if (sub) {
      loadPhotos(sub.id, sub.legacyId);
    } else if (event) {
      loadPhotos(event.id, event.legacyId);
    }
  };

  const handleEventBack = useCallback(() => {
    if (selectedAdminGallery !== undefined) {
      setSelectedAdminGallery(undefined);
      if (event) {
        loadPhotos(event.id, event.legacyId);
      }
      return;
    }

    if (activeSubEvent) {
      setActiveSubEvent(null);
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

  const handleUploadGalleryPhoto = async () => {
    if (!event) return;
    const activeId = selectedAdminGallery !== undefined
      ? (selectedAdminGallery ? selectedAdminGallery.id : event.id)
      : (activeSubEvent ? activeSubEvent.id : event.id);
    const activeLegacyId = selectedAdminGallery !== undefined
      ? (selectedAdminGallery ? selectedAdminGallery.legacyId : event.legacyId)
      : (activeSubEvent ? activeSubEvent.legacyId : event.legacyId);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setUpdating(true);
      try {
        const file = { uri: result.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' } as any;
        const upload = await uploadEventImage(file, activeId, user?.uid || 'anon');

        const { addPhoto } = await import('@/lib/database');
        await addPhoto({
          eventId: activeId,
          url: upload.url,
          storageKey: '',
          uploadedAt: new Date(),
          userId: user?.uid || 'anon'
        });

        loadPhotos(activeId, activeLegacyId);
        Alert.alert("Success", "Photo uploaded successfully!");
      } catch (err: any) {
        console.error('[EventUpload] Error:', err);
        Alert.alert("Error", `Failed to upload photo: ${err.message || err}`);
      } finally {
        setUpdating(false);
      }
    }
  };

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
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to permanently delete this photo from the gallery?",
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
              Alert.alert("Success", "Photo removed from gallery.");
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

  const handleOpenGalleryImmersive = (sub: DatabaseEvent | null) => {
    try {
      handleSubEventChange(sub);
    } catch (error) {
      console.error('[GalleryOpen] Error in handleOpenGalleryImmersive:', error);
    }
  };

  const handleChangeCover = async () => {
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
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        const file = { uri: manipulated.uri, name: 'cover.jpg', type: 'image/jpeg' } as any;
        const upload = await uploadEventImage(file, event?.id || target.id, user?.uid || 'anon');
        
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
        showToast("Cover image updated successfully!");
      } catch (err) {
        Alert.alert("Error", "Failed to update cover.");
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleCreateSubEvent = async (title: string) => {
    if (!title.trim() || !event) return;
    setUpdating(true);
    try {
      const subId = `${title.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(-4)}`;
      const success = await createEvent({
        id: subId,
        title,
        date: event.date,
        coverImage: event.coverImage,
        description: `Welcome to the ${title} gallery! Share your beautiful moments and thoughts here.`,
        createdBy: user?.uid,
        type: 'sub',
        parentId: event.id,
        templateId: event.templateId || 'hero',
        order: subEvents.length
      });
      if (!success) {
        Alert.alert("Error", "Failed to create gallery. Please try again.");
        return;
      }
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
    } catch (err) {
      Alert.alert("Error", "Failed to update theme.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCategory = async (category: string, defaultTemplate?: any) => {
    if (!event) return;
    setUpdating(true);
    try {
      const categoryDefaultTemplate = defaultTemplate || getDefaultTemplateForEventCategory(category);
      const updates = {
        category,
        ...(categoryDefaultTemplate ? { templateId: categoryDefaultTemplate.id } : {}),
      };

      setEvent({ ...event, ...updates });
      await updateEvent(event.id, updates);
    } catch (err) {
      Alert.alert("Error", "Failed to update event type.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRenameEvent = async (title: string, align: 'left' | 'center' | 'right') => {
    const target = currentActiveEvent;
    if (!target || !title.trim()) return;
    setUpdating(true);
    try {
      const success = await updateEvent(target.id, { title: title.trim(), titleAlign: align });
      if (success) {
        const updated = { title: title.trim(), titleAlign: align };
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

  const handleDateChange = async (formattedDate: string) => {
    const target = currentActiveEvent;
    if (formattedDate && target) {
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
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
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

  return {
    event,
    setEvent,
    subEvents,
    setSubEvents,
    photos,
    setPhotos,
    loading,
    loadingPhotos,
    updating,
    setUpdating,
    isOwner,
    guestLogs,
    setGuestLogs,
    linkedVendors,
    setLinkedVendors,
    toastMessage,
    showToast,
    tempCoverOffset,
    setTempCoverOffset,
    tempCoverOffsetX,
    setTempCoverOffsetX,
    tempCoverScale,
    setTempCoverScale,
    offsetRef,
    offsetXRef,
    scaleRef,
    galleryDescModalVisible,
    setGalleryDescModalVisible,
    galleryDescText,
    setGalleryDescText,
    selectedAdminGallery,
    setSelectedAdminGallery,
    activeSubEvent,
    setActiveSubEvent,
    currentActiveEvent,
    activeCoverMode: currentActiveEvent?.coverMode as ('fit' | 'fill' | undefined),
    activeCoverOffset: currentActiveEvent?.coverOffset ?? 0,
    activeCoverOffsetX: currentActiveEvent?.coverOffsetX ?? 0,
    activeCoverScale: currentActiveEvent?.coverScale ?? 1.0,
    handleSubEventChange,
    handleEventBack,
    handleOpenEditWelcomeModal,
    handleSaveGalleryDesc,
    handleUploadGalleryPhoto,
    handleReorderPhotos,
    handleReorderSubEvents,
    handleDeleteGalleryPhoto,
    handleOpenGalleryImmersive,
    handleChangeCover,
    handleCreateSubEvent,
    handleUpdateTemplate,
    handleUpdateCategory,
    handleRenameEvent,
    handleDateChange,
    handleDeleteMainEvent,
    handleDeleteSubGallery,
    loadPhotos,
    loadEvent,
  };
}

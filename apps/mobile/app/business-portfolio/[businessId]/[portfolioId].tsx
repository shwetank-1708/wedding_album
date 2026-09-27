import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { Business, BusinessPortfolioMedia, getBusinessById, updateBusiness } from '@/lib/database';
import { uploadEventImage } from '@/lib/storage';
import { DEFAULT_EVENT_COVER_IMAGE } from '@/lib/eventCovers';
import { MOBILE_TEMPLATE_THEMES, getTemplatesForEventCategory } from '@/constants/templates';

const { width, height } = Dimensions.get('window');
const PORTFOLIO_MEDIA_COLUMNS = 3;
const PORTFOLIO_MEDIA_GAP = 8;
const PORTFOLIO_MEDIA_HORIZONTAL_SPACE = 72;
const PORTFOLIO_MEDIA_THUMB_SIZE = Math.floor(
  (width - PORTFOLIO_MEDIA_HORIZONTAL_SPACE - PORTFOLIO_MEDIA_GAP * (PORTFOLIO_MEDIA_COLUMNS - 1)) /
    PORTFOLIO_MEDIA_COLUMNS
);
const PORTFOLIO_COVER_HEIGHT = 360;
const PORTFOLIO_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Sports', 'Other'];

export default function BusinessPortfolioDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const businessId = Array.isArray(params.businessId) ? params.businessId[0] : params.businessId;
  const portfolioId = Array.isArray(params.portfolioId) ? params.portfolioId[0] : params.portfolioId;
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('Wedding');
  const [editDate, setEditDate] = useState('');
  const [editTemplateId, setEditTemplateId] = useState('hero');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [tempCoverOffset, setTempCoverOffset] = useState(0);
  const [tempCoverOffsetX, setTempCoverOffsetX] = useState(0);
  const [tempCoverScale, setTempCoverScale] = useState(1);
  const offsetRef = useRef(0);
  const offsetXRef = useRef(0);
  const scaleRef = useRef(1);

  const portfolio = business?.portfolioEvents?.find((item) => item.id === portfolioId);
  const mediaItems = portfolio?.media || [];
  const selectedMedia = selectedMediaIndex !== null ? mediaItems[selectedMediaIndex] : null;
  const availableTemplates = getTemplatesForEventCategory(portfolio?.type);
  const currentTemplate = MOBILE_TEMPLATE_THEMES.find((template) => template.id === (portfolio?.templateId || editTemplateId));
  const canManage = Boolean(user && business && (
    business.createdBy === user.uid ||
    business.admins?.includes(user.uid) ||
    business.ownerEmail === user.email
  ));
  const activeTemplate = currentTemplate || MOBILE_TEMPLATE_THEMES.find((template) => template.id === 'hero') || MOBILE_TEMPLATE_THEMES[0];
  const templateBackground = activeTemplate.background.dark;
  const templatePanel = activeTemplate.panel.dark;
  const templateTile = activeTemplate.tileBg.dark;
  const templateText = activeTemplate.text.dark;
  const templateMuted = activeTemplate.muted.dark;
  const templateRadius = activeTemplate.radius;
  const templateBorder = `${activeTemplate.accent}55`;

  useEffect(() => {
    offsetRef.current = tempCoverOffset;
  }, [tempCoverOffset]);

  useEffect(() => {
    offsetXRef.current = tempCoverOffsetX;
  }, [tempCoverOffsetX]);

  useEffect(() => {
    scaleRef.current = tempCoverScale;
  }, [tempCoverScale]);

  const panResponder = useMemo(() => {
    let startOffsetY = 0;
    let startOffsetX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startOffsetY = offsetRef.current;
        startOffsetX = offsetXRef.current;
      },
      onPanResponderMove: (_event, gestureState) => {
        const coverWidth = width - 40;
        const limitY = 50 + (PORTFOLIO_COVER_HEIGHT * scaleRef.current - PORTFOLIO_COVER_HEIGHT) / 2;
        const limitX = (coverWidth * scaleRef.current - coverWidth) / 2;
        setTempCoverOffset(Math.min(Math.max(startOffsetY + gestureState.dy, -limitY), limitY));
        setTempCoverOffsetX(Math.min(Math.max(startOffsetX + gestureState.dx, -limitX), limitX));
      },
      onPanResponderRelease: () => {},
    });
  }, []);

  const goBack = () => {
    if (returnTo === 'manage' && businessId) {
      router.replace({ pathname: '/(tabs)/manage-business', params: { id: businessId, tab: 'Portfolio' } } as any);
      return;
    }
    if (returnTo === 'public' && businessId) {
      router.replace(`/(tabs)/business/${encodeURIComponent(businessId)}?tab=Portfolio` as any);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (businessId) {
      router.replace(canManage
        ? ({ pathname: '/(tabs)/manage-business', params: { id: businessId, tab: 'Portfolio' } } as any)
        : (`/(tabs)/business/${encodeURIComponent(businessId)}?tab=Portfolio` as any));
      return;
    }
    router.replace('/(tabs)/businesses');
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!businessId) return;
      setLoading(true);
      const data = await getBusinessById(businessId);
      if (!cancelled) {
        setBusiness(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (!portfolio) return;
    setEditName(portfolio.name || '');
    setEditType(portfolio.type || 'Wedding');
    setEditDate(portfolio.date || new Date().toISOString().slice(0, 10));
    setEditTemplateId(portfolio.templateId || 'hero');
  }, [portfolio?.id]);

  const updatePortfolioEvents = async (updater: (items: NonNullable<Business['portfolioEvents']>) => NonNullable<Business['portfolioEvents']>) => {
    if (!business || !business.portfolioEvents) return false;
    const nextPortfolioEvents = updater(business.portfolioEvents);
    const success = await updateBusiness(business.id, { portfolioEvents: nextPortfolioEvents });
    if (success) {
      setBusiness({ ...business, portfolioEvents: nextPortfolioEvents });
    }
    return success;
  };

  const pickCover = async () => {
    if (!business || !portfolio || !canManage) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled) return;

    setUploading(true);
    setUploadStatus('uploading');
    setUploadMessage('Uploading cover image...');
    try {
      const asset = result.assets[0];
      const upload = await uploadEventImage(
        { uri: asset.uri, name: `portfolio-cover-${portfolio.id}-${Date.now()}.jpg`, type: 'image/jpeg' },
        `business-${business.id}`,
        user?.uid || 'anon'
      );
      const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
        ...item,
        coverImage: upload.url,
        coverMode: 'fill',
        coverOffset: 0,
        coverOffsetX: 0,
        coverScale: 1,
      } : item));
      setUploadStatus(success ? 'success' : 'error');
      setUploadMessage(success ? 'Cover image uploaded successfully! ✨' : 'Could not update cover image.');
      if (!success) Alert.alert('Error', 'Could not update cover image.');
    } catch (error) {
      console.error('Portfolio cover upload failed:', error);
      setUploadStatus('error');
      setUploadMessage('Could not upload cover image.');
      Alert.alert('Error', 'Could not upload cover image.');
    } finally {
      setUploading(false);
    }
  };

  const pickMedia = async () => {
    if (!business || !portfolio || !canManage) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled) return;

    setUploading(true);
    setUploadStatus('uploading');
    setUploadMessage('Uploading portfolio image...');
    try {
      const asset = result.assets[0];
      const upload = await uploadEventImage(
        { uri: asset.uri, name: `portfolio-media-${portfolio.id}-${Date.now()}.jpg`, type: 'image/jpeg' },
        `business-${business.id}`,
        user?.uid || 'anon'
      );
      const media: BusinessPortfolioMedia = {
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url: upload.url,
        type: 'image',
        createdAt: new Date().toISOString(),
      };
      const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? { ...item, media: [...(item.media || []), media] } : item));
      setUploadStatus(success ? 'success' : 'error');
      setUploadMessage(success ? 'Portfolio image uploaded successfully! ✨' : 'Could not save uploaded image.');
      if (!success) Alert.alert('Error', 'Could not save uploaded image.');
    } catch (error) {
      console.error('Portfolio media upload failed:', error);
      setUploadStatus('error');
      setUploadMessage('Could not upload image.');
      Alert.alert('Error', 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (mediaId: string) => {
    if (!portfolio || !canManage) return;
    await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? { ...item, media: (item.media || []).filter((media) => media.id !== mediaId) } : item));
  };

  const setMediaAsCover = async (media: BusinessPortfolioMedia) => {
    if (!portfolio || !canManage || media.type === 'video') return;
    const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      coverImage: media.url,
      coverMode: 'fill',
      coverOffset: 0,
      coverOffsetX: 0,
      coverScale: 1,
      updatedAt: new Date().toISOString(),
    } : item));
    Alert.alert(success ? 'Updated' : 'Error', success ? 'Portfolio cover updated.' : 'Could not update portfolio cover.');
  };

  const toggleCoverMode = async () => {
    if (!portfolio || !canManage) return;
    const nextMode: 'fit' | 'fill' = (portfolio.coverMode || 'fill') === 'fill' ? 'fit' : 'fill';
    const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      coverMode: nextMode,
      coverOffset: 0,
      coverOffsetX: 0,
      coverScale: 1,
      updatedAt: new Date().toISOString(),
    } : item));
    if (!success) Alert.alert('Error', 'Could not update cover mode.');
  };

  const startCoverPositioning = () => {
    if (!portfolio) return;
    setTempCoverOffset(portfolio.coverOffset || 0);
    setTempCoverOffsetX(portfolio.coverOffsetX || 0);
    setTempCoverScale(portfolio.coverScale || 1);
    setIsRepositioning(true);
  };

  const saveCoverPosition = async () => {
    if (!portfolio || !canManage) return;
    const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      coverMode: 'fill',
      coverOffset: tempCoverOffset,
      coverOffsetX: tempCoverOffsetX,
      coverScale: tempCoverScale,
      updatedAt: new Date().toISOString(),
    } : item));
    if (success) {
      setIsRepositioning(false);
      Alert.alert('Saved', 'Cover position saved.');
    } else {
      Alert.alert('Error', 'Could not save cover position.');
    }
  };

  const openDetailsModal = () => {
    if (!portfolio) return;
    setEditName(portfolio.name || '');
    setEditType(portfolio.type || 'Wedding');
    setEditDate(portfolio.date || new Date().toISOString().slice(0, 10));
    setShowDetailsModal(true);
  };

  const saveDetails = async () => {
    if (!portfolio || !editName.trim() || !canManage) return;
    const templatesForType = getTemplatesForEventCategory(editType);
    const nextTemplateId = templatesForType.some((template) => template.id === editTemplateId)
      ? editTemplateId
      : templatesForType[0]?.id || 'hero';
    setEditTemplateId(nextTemplateId);
    const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      name: editName.trim(),
      type: editType,
      date: editDate,
      templateId: nextTemplateId,
      updatedAt: new Date().toISOString(),
    } : item));
    if (success) setShowDetailsModal(false);
    Alert.alert(success ? 'Saved' : 'Error', success ? 'Portfolio details updated.' : 'Could not update portfolio details.');
  };

  const handleUpdateTemplate = async (templateId: string) => {
    if (!portfolio || !canManage) return;
    setEditTemplateId(templateId);
    const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      templateId,
      updatedAt: new Date().toISOString(),
    } : item));
    if (success) setShowTemplateModal(false);
    if (!success) Alert.alert('Error', 'Could not update portfolio template.');
  };

  const handleUpdateType = async (type: string) => {
    if (!portfolio || !canManage) return;
    const templatesForType = getTemplatesForEventCategory(type);
    const currentTemplateId = portfolio.templateId || editTemplateId;
    const nextTemplateId = templatesForType.some((template) => template.id === currentTemplateId)
      ? currentTemplateId
      : templatesForType[0]?.id || 'hero';
    setEditType(type);
    setEditTemplateId(nextTemplateId);
    const success = await updatePortfolioEvents((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      type,
      templateId: nextTemplateId,
      updatedAt: new Date().toISOString(),
    } : item));
    if (success) setShowTypeModal(false);
    if (!success) Alert.alert('Error', 'Could not update portfolio event type.');
  };

  const deletePortfolioEvent = async () => {
    if (!business || !portfolio || !canManage || deleting) return;
    setDeleting(true);
    const nextPortfolioEvents = (business.portfolioEvents || []).filter((item) => item.id !== portfolio.id);
    const success = await updateBusiness(business.id, { portfolioEvents: nextPortfolioEvents });
    setDeleting(false);
    if (success) {
      router.replace({ pathname: '/(tabs)/manage-business', params: { id: business.id, tab: 'Portfolio' } } as any);
      return;
    }
    Alert.alert('Error', 'Could not delete portfolio event.');
  };

  const confirmDeletePortfolio = () => {
    if (!portfolio || !canManage) return;
    Alert.alert(
      'Delete Portfolio Event',
      `Delete "${portfolio.name}"? This will remove this portfolio event from your business.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deletePortfolioEvent },
      ]
    );
  };

  const openMediaViewer = (index: number) => {
    setSelectedMediaIndex(index);
  };

  const closeMediaViewer = () => {
    setSelectedMediaIndex(null);
  };

  const showPreviousMedia = () => {
    if (!mediaItems.length) return;
    setSelectedMediaIndex((current) => {
      const index = current ?? 0;
      return (index - 1 + mediaItems.length) % mediaItems.length;
    });
  };

  const showNextMedia = () => {
    if (!mediaItems.length) return;
    setSelectedMediaIndex((current) => {
      const index = current ?? 0;
      return (index + 1) % mediaItems.length;
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#818cf8" />
      </View>
    );
  }

  if (!business || !portfolio) {
    return (
      <View style={[styles.container, styles.center, { padding: 24 }]}>
        <Text style={styles.emptyTitle}>Portfolio event not found.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={goBack}>
          <Text style={styles.primaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: templateBackground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView scrollEnabled={!isRepositioning} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: templatePanel, borderColor: templateBorder }]} onPress={goBack}>
            <IconSymbol name="chevron.left" size={20} color={templateText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: templateText }]} numberOfLines={1}>{canManage ? 'Manage Portfolio' : business.name}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={[styles.coverCard, { backgroundColor: templateTile, borderRadius: templateRadius + 10 }]} {...(isRepositioning ? panResponder.panHandlers : {})}>
          <ExpoImage
            source={{ uri: portfolio.coverImage || DEFAULT_EVENT_COVER_IMAGE }}
            style={[
              (portfolio.coverMode || 'fill') === 'fit'
                ? [styles.coverImageFit, { backgroundColor: templateTile }]
                : [
                    styles.coverImageFill,
                    {
                      transform: [
                        { translateY: isRepositioning ? tempCoverOffset : (portfolio.coverOffset || 0) },
                        { translateX: isRepositioning ? tempCoverOffsetX : (portfolio.coverOffsetX || 0) },
                        { scale: isRepositioning ? tempCoverScale : (portfolio.coverScale || 1) },
                      ],
                    },
                  ],
            ]}
            contentFit={(portfolio.coverMode || 'fill') === 'fit' ? 'contain' : 'cover'}
          />
          <LinearGradient colors={['transparent', `${templateBackground}88`, templateBackground]} style={StyleSheet.absoluteFill} />
          <View style={[styles.typeBadge, { backgroundColor: `${templateBackground}cc`, borderColor: templateBorder }]}>
            <Text style={[styles.typeBadgeText, { color: activeTemplate.accent }]}>{portfolio.type}</Text>
          </View>
          {isRepositioning && (
            <View style={styles.dragHint}>
              <Text style={styles.dragHintText}>Drag image</Text>
            </View>
          )}
          {canManage && !isRepositioning && (
            <View style={styles.coverControls}>
              <TouchableOpacity style={styles.coverControlBtn} onPress={toggleCoverMode} disabled={uploading}>
                <IconSymbol name={'arrow.down.right.and.arrow.up.left' as any} size={14} color="#ffffff" />
                <Text style={styles.coverControlText}>{(portfolio.coverMode || 'fill') === 'fill' ? 'Fit' : 'Fill'}</Text>
              </TouchableOpacity>
              {(portfolio.coverMode || 'fill') === 'fill' && (
                <TouchableOpacity style={styles.coverControlBtn} onPress={startCoverPositioning} disabled={uploading}>
                  <IconSymbol name={'arrow.up.and.down' as any} size={14} color="#ffffff" />
                  <Text style={styles.coverControlText}>Position</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.coverIconBtn} onPress={pickCover} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color="#1B211F" /> : <IconSymbol name="camera.fill" size={16} color="#1B211F" />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.coverDarkIconBtn} onPress={openDetailsModal}>
                <IconSymbol name="pencil" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.coverStrip, { backgroundColor: templateBackground }]}>
            <Text style={[styles.title, { color: templateText }]}>{portfolio.name}</Text>
            <View style={styles.metaRow}>
              <IconSymbol name="calendar" size={13} color={activeTemplate.accent} />
              <Text style={[styles.dateText, { color: templateMuted }]}>{new Date(portfolio.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
          </View>
        </View>

        {isRepositioning && (
          <View style={styles.repositionToolbar}>
            <Text style={styles.repositionInstruction}>Drag image</Text>
            <View style={styles.zoomControlRow}>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => setTempCoverScale((prev) => Math.max(1, Number((prev - 0.1).toFixed(2))))}>
                <IconSymbol name={'minus' as any} size={12} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.zoomText}>{Math.round(tempCoverScale * 100)}%</Text>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => setTempCoverScale((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}>
                <IconSymbol name="plus" size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.repositionActions}>
              <TouchableOpacity style={[styles.repositionBtn, styles.repositionCancelBtn]} onPress={() => setIsRepositioning(false)}>
                <Text style={styles.repositionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.repositionBtn, styles.repositionSaveBtn]} onPress={saveCoverPosition}>
                <Text style={[styles.repositionBtnText, { color: '#1B211F' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {canManage && (
          <View style={[styles.section, { backgroundColor: templatePanel, borderColor: templateBorder, borderRadius: templateRadius + 8 }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: templateText }]}>Design</Text>
                <Text style={[styles.sectionSub, { color: templateMuted }]}>Choose a template for this portfolio</Text>
              </View>
            </View>
            <View style={styles.designRows}>
              <TouchableOpacity style={styles.designRow} onPress={() => setShowTypeModal(true)}>
                <View>
                  <Text style={styles.designRowLabel}>Event Type</Text>
                  <Text style={styles.designRowValue}>{portfolio.type || 'Select Type'}</Text>
                </View>
                <IconSymbol name="chevron.right" size={17} color="#facc15" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.designRow} onPress={() => setShowTemplateModal(true)}>
                <View>
                  <Text style={styles.designRowLabel}>Change Template</Text>
                  <Text style={styles.designRowValue}>{currentTemplate?.label || 'Hero (Default)'}</Text>
                </View>
                <IconSymbol name="chevron.right" size={17} color="#facc15" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: templatePanel, borderColor: templateBorder, borderRadius: templateRadius + 8 }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: templateText }]}>Gallery</Text>
              <Text style={[styles.sectionSub, { color: templateMuted }]}>{portfolio.media?.length || 0} images</Text>
            </View>
            {canManage && (
              <TouchableOpacity style={styles.uploadBtn} onPress={pickMedia} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color="#1B211F" /> : <IconSymbol name="plus" size={16} color="#1B211F" />}
                <Text style={styles.uploadBtnText}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>

          {uploadMessage ? (
            <View style={[
              styles.uploadStatusBox,
              uploadStatus === 'success' && styles.uploadStatusSuccess,
              uploadStatus === 'error' && styles.uploadStatusError,
            ]}>
              {uploadStatus === 'uploading' && <ActivityIndicator size="small" color="#bae6fd" />}
              <Text style={[
                styles.uploadStatusText,
                uploadStatus === 'success' && styles.uploadStatusSuccessText,
                uploadStatus === 'error' && styles.uploadStatusErrorText,
              ]}>{uploadMessage}</Text>
            </View>
          ) : null}

          {mediaItems.length > 0 ? (
            <View style={styles.mediaGrid}>
              {mediaItems.map((media, index) => {
                const isLastInRow = index % PORTFOLIO_MEDIA_COLUMNS === PORTFOLIO_MEDIA_COLUMNS - 1;
                return (
                  <TouchableOpacity
                    key={media.id}
                    style={[
                      styles.mediaThumb,
                      !isLastInRow && { marginRight: PORTFOLIO_MEDIA_GAP },
                      { marginBottom: PORTFOLIO_MEDIA_GAP, backgroundColor: templateTile, borderRadius: templateRadius || 14 },
                    ]}
                    activeOpacity={0.9}
                    onPress={() => openMediaViewer(index)}
                  >
                    <ExpoImage source={{ uri: media.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {canManage && (
                      <>
                        {media.type !== 'video' && (
                          <TouchableOpacity style={styles.coverMediaBtn} onPress={() => setMediaAsCover(media)}>
                            <IconSymbol name="camera.fill" size={13} color="#c7d2fe" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedia(media.id)}>
                          <IconSymbol name="trash.fill" size={13} color="#ef4444" />
                        </TouchableOpacity>
                      </>
                    )}
                    {portfolio.coverImage === media.url && (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>Cover</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity style={[styles.emptyBox, { borderColor: templateBorder, borderRadius: templateRadius + 4 }]} onPress={canManage ? pickMedia : undefined}>
              <IconSymbol name="photo.on.rectangle.angled" size={36} color={templateMuted} />
              <Text style={[styles.emptyText, { color: templateMuted }]}>{canManage ? 'Upload images for this portfolio event' : 'No images uploaded yet.'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {canManage && (
          <View style={styles.deleteSection}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteTitle}>Delete Portfolio Event</Text>
              <Text style={styles.deleteSub}>This removes the portfolio event from your business.</Text>
            </View>
            <TouchableOpacity style={[styles.deleteBtn, deleting && { opacity: 0.6 }]} onPress={confirmDeletePortfolio} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color="#fecaca" /> : <IconSymbol name="trash.fill" size={15} color="#fecaca" />}
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showDetailsModal} transparent animationType="fade" onRequestClose={() => setShowDetailsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Portfolio</Text>
                <Text style={styles.modalSub}>Update the event name, type, and date</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDetailsModal(false)}>
                <IconSymbol name="xmark" size={18} color="#CDB89E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Event Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholderTextColor="#475569" />
            <Text style={styles.fieldLabel}>Event Type</Text>
            <View style={styles.chipGrid}>
              {PORTFOLIO_TYPES.map((type) => {
                const active = editType === type;
                return (
                  <TouchableOpacity key={type} style={[styles.typeChip, active && styles.typeChipActive]} onPress={() => setEditType(type)}>
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Event Date</Text>
            <TextInput style={styles.input} value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveDetails}>
              <IconSymbol name="checkmark" size={16} color="#1B211F" />
              <Text style={styles.uploadBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTypeModal} transparent animationType="fade" onRequestClose={() => setShowTypeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Event Type</Text>
                <Text style={styles.modalSub}>Choose the portfolio event type</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowTypeModal(false)}>
                <IconSymbol name="xmark" size={18} color="#CDB89E" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalOptionList}>
              {PORTFOLIO_TYPES.map((type) => {
                const active = portfolio.type === type;
                return (
                  <TouchableOpacity key={type} style={[styles.modalOptionRow, active && styles.modalOptionRowActive]} onPress={() => handleUpdateType(type)}>
                    <Text style={styles.modalOptionText}>{type}</Text>
                    {active && <IconSymbol name="checkmark" size={16} color="#facc15" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTemplateModal} transparent animationType="fade" onRequestClose={() => setShowTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Choose Style</Text>
                <Text style={styles.modalSub}>Templates shown for {portfolio.type || 'this event type'}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowTemplateModal(false)}>
                <IconSymbol name="xmark" size={18} color="#CDB89E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalOptionList}>
                {availableTemplates.map((template) => {
                  const active = (portfolio.templateId || editTemplateId || 'hero') === template.id;
                  return (
                    <TouchableOpacity key={template.id} style={[styles.templateModalRow, active && { borderColor: template.accent }]} onPress={() => handleUpdateTemplate(template.id)}>
                      <View style={[styles.templateModalSwatch, { backgroundColor: template.background.dark }]}>
                        <View style={[styles.templateModalDot, { backgroundColor: template.accent }]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.templateModalTitle, active && { color: template.accent }]}>{template.label}</Text>
                        <Text style={styles.templateModalSub} numberOfLines={1}>{template.desc}</Text>
                      </View>
                      {active && <IconSymbol name="checkmark" size={16} color={template.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedMedia)} transparent animationType="fade" onRequestClose={closeMediaViewer}>
        <View style={styles.mediaViewerOverlay}>
          <TouchableOpacity style={styles.mediaViewerClose} onPress={closeMediaViewer}>
            <IconSymbol name="xmark" size={20} color="#ffffff" />
          </TouchableOpacity>
          {mediaItems.length > 1 && (
            <>
              <TouchableOpacity style={[styles.mediaViewerNav, styles.mediaViewerPrev]} onPress={showPreviousMedia}>
                <IconSymbol name="chevron.left" size={26} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mediaViewerNav, styles.mediaViewerNext]} onPress={showNextMedia}>
                <IconSymbol name="chevron.right" size={26} color="#ffffff" />
              </TouchableOpacity>
            </>
          )}
          {selectedMedia && (
            <>
              <ExpoImage source={{ uri: selectedMedia.url }} style={styles.mediaViewerImage} contentFit="contain" />
              <Text style={styles.mediaViewerCount}>{(selectedMediaIndex ?? 0) + 1} / {mediaItems.length}</Text>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#13191F',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B211F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
  },
  coverCard: {
    height: PORTFOLIO_COVER_HEIGHT,
    marginHorizontal: 20,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1B211F',
  },
  coverImageFit: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#13191F',
  },
  coverImageFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -50,
    height: PORTFOLIO_COVER_HEIGHT + 100,
  },
  typeBadge: {
    position: 'absolute',
    left: 16,
    top: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeBadgeText: {
    color: '#facc15',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  coverControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    left: 16,
  },
  coverControlBtn: {
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  coverControlText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coverIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#818cf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverDarkIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dragHint: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingVertical: 9,
    alignItems: 'center',
  },
  dragHintText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  repositionToolbar: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(27, 33, 31,0.96)',
    padding: 12,
    gap: 10,
  },
  repositionInstruction: {
    color: '#c7d2fe',
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    textAlign: 'center',
  },
  zoomControlRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 4,
  },
  zoomBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    minWidth: 48,
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
  },
  repositionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  repositionBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repositionCancelBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  repositionSaveBtn: {
    backgroundColor: '#818cf8',
  },
  repositionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  coverStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    padding: 18,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: 'Outfit_800ExtraBold',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#CDB89E',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  section: {
    margin: 20,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#1B211F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
  },
  sectionSub: {
    marginTop: 3,
    color: '#CDB89E',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 8,
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#13191F',
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#13191F',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeChipActive: {
    borderColor: '#818cf8',
    backgroundColor: '#818cf8',
  },
  typeChipText: {
    color: '#CDB89E',
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
  },
  typeChipTextActive: {
    color: '#1B211F',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#13191F',
    padding: 12,
  },
  templateCardActive: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129,140,248,0.12)',
  },
  templateAccent: {
    height: 7,
    borderRadius: 999,
    marginBottom: 12,
  },
  templateTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
  },
  templateId: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  designRows: {
    gap: 10,
  },
  designRow: {
    minHeight: 74,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#13191F',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  designRowLabel: {
    marginBottom: 5,
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  designRowValue: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_800ExtraBold',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    backgroundColor: '#818cf8',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  uploadBtnText: {
    color: '#1B211F',
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
  },
  uploadStatusBox: {
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadStatusSuccess: {
    borderColor: 'rgba(52,211,153,0.25)',
    backgroundColor: 'rgba(52,211,153,0.1)',
  },
  uploadStatusError: {
    borderColor: 'rgba(251,113,133,0.25)',
    backgroundColor: 'rgba(251,113,133,0.1)',
  },
  uploadStatusText: {
    flex: 1,
    color: '#bae6fd',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  uploadStatusSuccessText: {
    color: '#bbf7d0',
  },
  uploadStatusErrorText: {
    color: '#fecaca',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  mediaThumb: {
    width: PORTFOLIO_MEDIA_THUMB_SIZE,
    height: PORTFOLIO_MEDIA_THUMB_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#13191F',
  },
  removeBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverMediaBtn: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 999,
    backgroundColor: '#34d399',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverBadgeText: {
    color: '#1B211F',
    fontSize: 8,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mediaViewerImage: {
    width: width - 32,
    height: height * 0.76,
    borderRadius: 20,
  },
  mediaViewerClose: {
    position: 'absolute',
    right: 18,
    top: 56,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaViewerNav: {
    position: 'absolute',
    top: '50%',
    zIndex: 20,
    width: 48,
    height: 48,
    marginTop: -24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaViewerPrev: {
    left: 16,
  },
  mediaViewerNext: {
    right: 16,
  },
  mediaViewerCount: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  emptyBox: {
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deleteSection: {
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(244,63,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteTitle: {
    color: '#fecaca',
    fontSize: 17,
    fontFamily: 'Outfit_800ExtraBold',
  },
  deleteSub: {
    marginTop: 4,
    color: 'rgba(254,202,202,0.62)',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  deleteBtn: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.35)',
    backgroundColor: 'rgba(244,63,94,0.14)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  deleteBtnText: {
    color: '#fecaca',
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#CDB89E',
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: '#818cf8',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: '#1B211F',
    fontFamily: 'Outfit_800ExtraBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#1B211F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 6,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
  },
  modalSub: {
    marginTop: 4,
    color: '#CDB89E',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#13191F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalSaveBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#818cf8',
    paddingVertical: 14,
  },
  modalOptionList: {
    gap: 10,
  },
  modalOptionRow: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#13191F',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionRowActive: {
    borderColor: '#facc15',
    backgroundColor: 'rgba(250,204,21,0.08)',
  },
  modalOptionText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
  templateModalRow: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  templateModalSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateModalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  templateModalTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
  },
  templateModalSub: {
    marginTop: 3,
    color: '#CDB89E',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { createBusiness, getUserBusinesses, Business, generateShortId, getBusinessTypeColor, getUserTotalStorage } from '@/lib/database';
import { uploadEventImage } from '@/lib/storage';
import { EveBashLogoBadge } from '@/components/EveBashLogo';

const { width } = Dimensions.get('window');

const INDIGO = '#818cf8';
const INDIGO_LIGHT = '#a5b4fc';
const INDIGO_DARK = '#6366f1';
const INDIGO_BORDER = 'rgba(99, 102, 241, 0.25)';
const INDIGO_BG_LIGHT = 'rgba(99, 102, 241, 0.1)';
const INDIGO_BG_SUPER_LIGHT = 'rgba(99, 102, 241, 0.05)';

const BUSINESS_TYPES = [
  'Anchors', 'Apparel', 'Catering', 'Decor', 'Event Planner',
  'Food Stalls', 'Gifts', 'Invitations', 'Lighting', 'Makeup',
  'Music & DJ', 'Photography', 'Security', 'Staff', 'Travel',
  'Trophies', 'Venue', 'Videography'
];
const EVENT_TAGS = ['Wedding', 'Birthdays', 'Sports', 'Corporate', 'Cultural', 'Private'];
const DEFAULT_BUSINESS_COVER = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800';

const BENEFITS = [
  { id: '1', title: 'Reach Event Organizers', desc: 'Connect with professionals planning sports tournaments, corporate meets, and celebrations.', icon: 'person.2.fill' },
  { id: '2', title: 'Smart Analytics', desc: 'Track your profile views, inquiries, and growth in real-time.', icon: 'chart.bar.fill' },
  { id: '3', title: 'Premium Portfolio', desc: 'Showcase your work to a diverse audience with high-resolution galleries.', icon: 'photo.on.rectangle.fill' },
];

export default function BusinessLandingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  
  const [showListingForm, setShowListingForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingBusinesses, setFetchingBusinesses] = useState(true);
  const [userBusinesses, setUserBusinesses] = useState<Business[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [ownerEmail, setOwnerEmail] = useState(user?.email || '');
  const [ownerPhone, setOwnerPhone] = useState(user?.phoneNumber || '');
  const [businessType, setBusinessType] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [capturedAddress, setCapturedAddress] = useState('');
  
  // New profile fields
  const [description, setDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [startedDate, setStartedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [eventsHosted, setEventsHosted] = useState('');
  const [coverImageUri, setCoverImageUri] = useState('');

  useEffect(() => {
    fetchUserBusinesses();
  }, [user]);

  const fetchUserBusinesses = async () => {
    if (!user) return;
    setFetchingBusinesses(true);
    try {
      const biz = await getUserBusinesses(user.uid);
      setUserBusinesses(biz);
      
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.phone) identifiers.push(user.phone);
      const storage = await getUserTotalStorage(identifiers);
      setStorageUsed(storage);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setFetchingBusinesses(false);
    }
  };

  const handleGetLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to pinpoint your business.');
        return;
      }

      if (Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
        } catch (providerError) {
          console.warn('[Business] Location provider prompt skipped:', providerError);
        }
      }

      let loc: Location.LocationObject | null = null;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
        });
      } catch (currentError) {
        console.warn('[Business] Current location failed, trying last known location:', currentError);
        loc = await Location.getLastKnownPositionAsync({
          maxAge: 1000 * 60 * 30,
          requiredAccuracy: 5000,
        });
      }

      if (!loc) {
        throw new Error('No location fix is available.');
      }

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);
      
      try {
        const reverse = await Location.reverseGeocodeAsync(coords);
        if (reverse && reverse.length > 0) {
          const first = reverse[0];
          const shortAddress = [
            first.district || first.name || '',
            first.city || first.subregion || '',
            first.region || ''
          ].filter(Boolean).join(', ');
          
          setCapturedAddress(shortAddress || `${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`);
        } else {
          setCapturedAddress(`${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`);
        }
      } catch (err) {
        setCapturedAddress(`${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`);
      }
    } catch (error: any) {
      console.warn('[Business] Could not fetch location:', error);
      Alert.alert(
        'Location unavailable',
        error?.message || 'Could not fetch your location. Please check location services and try again.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const pickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library permission is required to select a business cover.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setCoverImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!name || !ownerName || !ownerEmail || !ownerPhone || !businessType) {
      Alert.alert('Missing Info', 'Please fill in all basic fields.');
      return;
    }

    if (!user) {
      Alert.alert('Auth Required', 'Please login to create a business.');
      return;
    }

    setLoading(true);
    try {
      let coverImage = DEFAULT_BUSINESS_COVER;
      if (coverImageUri) {
        const file = {
          uri: coverImageUri,
          name: `business-cover-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        const upload = await uploadEventImage(file, `business-cover-${Date.now()}`, user.uid);
        coverImage = upload.url;
      }

      const businessData: Omit<Business, 'id' | 'createdAt'> = {
        name,
        ownerName,
        ownerEmail,
        ownerPhone,
        type: businessType,
        tags: selectedTags,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
        } : { latitude: 0, longitude: 0 },
        description,
        startedDate: startedDate,
        experience: Math.floor((new Date().getTime() - startedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
        eventsHosted: parseInt(eventsHosted) || 0,
        rating: 0,
        coverImage,
        coverImages: [coverImage],
        createdBy: user.uid,
        status: 'created',
        shortId: generateShortId(),
      };

      const result = await createBusiness(businessData);
      if (result) {
        Alert.alert('Success', 'Your business has been created! You can now manage it from the Partner Hub.');
        setShowListingForm(false);
        // Reset form
        setName('');
        setOwnerName(user?.displayName || '');
        setBusinessType('');
        setSelectedTags([]);
        setLocation(null);
        setCapturedAddress('');
        setDescription('');
        setExperience('');
        setStartedDate(new Date());
        setEventsHosted('');
        setCoverImageUri('');
        // Refresh list
        fetchUserBusinesses();
      } else {
        Alert.alert('Error', 'Failed to create business. Please try again.');
      }
    } catch (error) {
      console.error('Error creating business:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── HEADER ── */}
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }} 
              activeOpacity={0.7}
              onPress={() => setShowQuotaModal(true)}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
              <Text style={styles.headerTitle}>EB Business</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }} 
              onPress={() => setShowListingForm(true)}
            >
              <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14" />
                <Path d="M12 5v14" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
        


        {/* ── YOUR BUSINESSES SECTION ── */}
        {fetchingBusinesses ? (
          <View style={[styles.section, { alignItems: 'center' }]}>
            <ActivityIndicator color={INDIGO} />
          </View>
        ) : userBusinesses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your EB Business Profiles</Text>
            {userBusinesses.map((biz) => (
              <TouchableOpacity 
                key={biz.id} 
                style={styles.bizManageCard}
                onPress={() => router.push({ pathname: '/manage-business', params: { id: biz.id } })}
              >
                <View style={styles.bizManageImageContainer}>
                  {/* Ambient Blurred Backdrop */}
                  <ExpoImage 
                    source={{ uri: biz.coverImage }} 
                    style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} 
                    contentFit="cover"
                    blurRadius={15}
                  />
                  {/* Sharp Contain Foreground */}
                  <ExpoImage 
                    source={{ uri: biz.coverImage }} 
                    style={StyleSheet.absoluteFill} 
                    contentFit="contain"
                    transition={300}
                  />
                </View>
                <View style={styles.bizManageInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.bizManageName}>{biz.name}</Text>
                  </View>
                  {(() => {
                    const typeColors = getBusinessTypeColor(biz.type);
                    return (
                      <View style={[styles.bizTypeBadge, { backgroundColor: typeColors.bg, borderColor: typeColors.border }]}>
                        <Text style={[styles.bizTypeText, { color: typeColors.text }]}>{biz.type}</Text>
                      </View>
                    );
                  })()}
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: biz.status === 'published' ? '#22c55e' : '#f59e0b' }]} />
                    <Text style={styles.statusText}>{biz.status.toUpperCase()}</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#475569" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── HERO SECTION ── */}
        {!fetchingBusinesses && userBusinesses.length === 0 && (
          <View style={styles.heroSection}>
            <LinearGradient
              colors={isDark ? ['#101010', '#050505'] : [colors.deepSlate, colors.background]}
              style={styles.heroGradient}
            >
              <View style={styles.heroBadge}>
                <IconSymbol name="briefcase.fill" size={14} color={INDIGO_LIGHT} />
                <Text style={styles.heroBadgeText}>PARTNER HUB</Text>
              </View>
              <Text style={styles.heroTitle}>Grow Your Business</Text>
              <Text style={styles.heroSubtitle}>
                Connect with event organizers, showcase your premium portfolio, and track your growth with elite analytics.
              </Text>
              
              <View style={styles.heroActions}>
                <TouchableOpacity 
                  style={styles.primaryBtn} 
                  onPress={() => setShowListingForm(true)}
                >
                  <LinearGradient
                    colors={[INDIGO_LIGHT, INDIGO_DARK]}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.primaryBtnText}>List New Business</Text>
                    <IconSymbol name="plus" size={18} color="#ffffff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ── BENEFITS SECTION ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Partner With Us?</Text>
          <View style={styles.benefitsGrid}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.id} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <IconSymbol name={benefit.icon as any} size={20} color={INDIGO_LIGHT} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                </View>
              </View>
            ))}
          </View>
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

            {/* Hero header */}
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.18)', 'rgba(99, 102, 241, 0.04)', 'transparent']}
              style={styles.quotaHero}
            >
              <View style={styles.quotaHeroRow}>
                <View style={styles.quotaHeroIcon}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
                <Text style={styles.quotaActivePlanName}>
                  {(() => {
                    const role = user?.role ?? 'free';
                    if (role === 'free' || role === 'freemium') return 'Freemium';
                    return role.charAt(0).toUpperCase() + role.slice(1);
                  })()}
                </Text>
              </Text>
            </LinearGradient>

            {/* Divider */}
            <View style={styles.quotaDivider} />

            {/* Metrics */}
            <View style={styles.quotaMetrics}>

              {/* Storage */}
              <View style={styles.quotaMetricRow}>
                <View style={styles.quotaMetricTop}>
                  <View style={styles.quotaMetricLeft}>
                    <View style={[styles.quotaDot, { backgroundColor: INDIGO }]} />
                    <Text style={styles.quotaMetricLabel}>Storage</Text>
                  </View>
                  <View style={styles.quotaMetricRight}>
                    <Text style={styles.quotaMetricValue}>{(storageUsed / (1024 * 1024)).toFixed(1)} MB</Text>
                    <Text style={styles.quotaMetricMax}> / 5 GB</Text>
                    <View style={[styles.quotaPercentChip, { backgroundColor: INDIGO_BG_LIGHT }]}>
                      <Text style={[styles.quotaPercentText, { color: INDIGO }]}>
                        {Math.round((storageUsed / (5 * 1024 * 1024 * 1024)) * 100)}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.quotaBarTrack}>
                  <LinearGradient
                    colors={[INDIGO, '#a5b4fc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.quotaBarFill, { width: `${Math.min((storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }]}
                  />
                </View>
              </View>

              <View style={styles.quotaMetricSep} />

              {/* Businesses */}
              {(() => {
                const maxBiz = user?.role === 'premium' || user?.role === 'elite' ? null
                  : user?.role === 'standard' ? 5 : 1;
                const pct = maxBiz ? Math.round((userBusinesses.length / maxBiz) * 100) : 0;
                return (
                  <View style={styles.quotaMetricRow}>
                    <View style={styles.quotaMetricTop}>
                      <View style={styles.quotaMetricLeft}>
                        <View style={[styles.quotaDot, { backgroundColor: '#818cf8' }]} />
                        <Text style={styles.quotaMetricLabel}>Businesses</Text>
                      </View>
                      <View style={styles.quotaMetricRight}>
                        <Text style={styles.quotaMetricValue}>{userBusinesses.length}</Text>
                        <Text style={styles.quotaMetricMax}> / {maxBiz ?? '∞'}</Text>
                        <View style={[styles.quotaPercentChip, { backgroundColor: 'rgba(129,140,248,0.12)' }]}>
                          <Text style={[styles.quotaPercentText, { color: '#818cf8' }]}>
                            {maxBiz ? `${pct}%` : '∞'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.quotaBarTrack}>
                      <LinearGradient
                        colors={['#818cf8', '#a5b4fc']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.quotaBarFill, { width: `${maxBiz ? Math.min(pct, 100) : 0}%` }]}
                      />
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* CTA */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => { setShowQuotaModal(false); router.push('/(tabs)/usage'); }}>
              <LinearGradient
                colors={[INDIGO_LIGHT, INDIGO_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quotaUpgradeBtn}
              >
                <Text style={styles.quotaUpgradeBtnText}>Manage Plan</Text>
                <IconSymbol name="arrow.right" size={14} color="#ffffff" />
              </LinearGradient>
            </TouchableOpacity>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── CREATE BUSINESS MODAL ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showListingForm}
        onRequestClose={() => setShowListingForm(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.formContainer}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formBody}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Business Details</Text>
                <TouchableOpacity onPress={() => setShowListingForm(false)}>
                  <IconSymbol name="xmark" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Name *</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="e.g. Royal Photography" 
                  placeholderTextColor="#475569"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Owner Name *</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="e.g. John Doe" 
                  placeholderTextColor="#475569"
                  value={ownerName}
                  onChangeText={setOwnerName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="email@example.com" 
                  placeholderTextColor="#475569"
                  value={ownerEmail}
                  onChangeText={setOwnerEmail}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone *</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="+91..." 
                  placeholderTextColor="#475569"
                  value={ownerPhone}
                  onChangeText={setOwnerPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Type *</Text>
                <TouchableOpacity 
                  style={styles.dropdownBtn} 
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={[styles.dropdownBtnText, !businessType && { color: '#475569' }]}>
                    {businessType || 'Select Category'}
                  </Text>
                  <IconSymbol name="chevron.down" size={16} color={INDIGO_LIGHT} />
                </TouchableOpacity>


              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Cover Image</Text>
                <View style={styles.coverPickerCard}>
                  <TouchableOpacity
                    style={styles.coverPickerPreview}
                    onPress={pickCoverImage}
                    activeOpacity={0.86}
                  >
                    {coverImageUri ? (
                      <>
                        <ExpoImage
                          source={{ uri: coverImageUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                        <View style={styles.coverPreviewOverlay} />
                        <ExpoImage
                          source={{ uri: coverImageUri }}
                          style={styles.coverPreviewImage}
                          contentFit="contain"
                        />
                      </>
                    ) : (
                      <View style={styles.coverPlaceholder}>
                        <IconSymbol name="photo.on.rectangle.angled" size={34} color={INDIGO_LIGHT} />
                        <Text style={styles.coverPlaceholderText}>Add a cover image for your business</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.coverPickerActions}>
                    <Text style={styles.coverPickerHint} numberOfLines={1}>
                      {coverImageUri ? 'Selected business cover' : 'Optional. Used as the business thumbnail.'}
                    </Text>
                    <View style={styles.coverActionRow}>
                      {coverImageUri ? (
                        <TouchableOpacity
                          style={[styles.coverActionBtn, styles.coverRemoveBtn]}
                          onPress={() => setCoverImageUri('')}
                        >
                          <Text style={[styles.coverActionText, styles.coverRemoveText]}>Remove</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={styles.coverActionBtn} onPress={pickCoverImage}>
                        <Text style={styles.coverActionText}>{coverImageUri ? 'Change' : 'Add'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Experience</Text>
                <View style={styles.row}>
                  <TouchableOpacity 
                    style={[styles.formInput, { flex: 1, marginRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }]} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <IconSymbol name="calendar" size={16} color={INDIGO_LIGHT} />
                    <Text style={{ color: colors.white, fontFamily: 'Inter_400Regular' }}>
                      Started: {startedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  
                  {showDatePicker && (
                    <DateTimePicker
                      value={startedDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setStartedDate(selectedDate);
                          const years = Math.floor((new Date().getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                          setExperience(years.toString());
                        }
                      }}
                      maximumDate={new Date()}
                    />
                  )}

                  <TextInput 
                    style={[styles.formInput, { flex: 1, marginLeft: 6 }]} 
                    placeholder="Events Done" 
                    placeholderTextColor="#475569"
                    value={eventsHosted}
                    onChangeText={setEventsHosted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>About Business</Text>
                <TextInput 
                  style={[styles.formInput, { height: 120, textAlignVertical: 'top' }]} 
                  placeholder="Short description of your services..." 
                  placeholderTextColor="#475569"
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pinpoint Location (Optional)</Text>
                <TouchableOpacity 
                  style={[styles.locationBtn, location && styles.locationBtnActive]} 
                  onPress={handleGetLocation}
                  disabled={isLocating}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color={INDIGO_LIGHT} />
                  ) : (
                    <>
                      <IconSymbol name="location.fill" size={18} color={location ? "#101010" : INDIGO_LIGHT} />
                      <Text style={[styles.locationBtnText, location && styles.locationBtnTextActive]} numberOfLines={1}>
                        {location ? `Captured: ${capturedAddress || 'Location Captured'}` : 'Use Current GPS'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.submitFormBtn, loading && styles.submitBtnDisabled]} 
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#101010" />
                ) : (
                  <Text style={styles.submitFormText}>Create Business</Text>
                )}
              </TouchableOpacity>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── CATEGORY PICKER MODAL (Moved outside to prevent Android nested modal bug) ── */}
      <Modal
        visible={showCategoryPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableOpacity 
          style={styles.pickerOverlay} 
          activeOpacity={1} 
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <IconSymbol name="xmark" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View>
              <ScrollView 
                style={styles.pickerList}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {BUSINESS_TYPES.map((item) => (
                  <TouchableOpacity 
                    key={item} 
                    style={[styles.pickerItem, businessType === item && styles.pickerItemActive]}
                    onPress={() => {
                      setBusinessType(item);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, businessType === item && styles.pickerItemTextActive]}>
                      {item}
                    </Text>
                    {businessType === item && (
                      <IconSymbol name="checkmark" size={16} color={INDIGO_LIGHT} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <LinearGradient
                colors={isDark ? ['transparent', 'rgba(15, 23, 42, 0.9)', '#101010'] : ['transparent', 'rgba(255, 255, 255, 0.9)', colors.background]}
                style={styles.pickerFade}
                pointerEvents="none"
              />
            </View>
            <View style={styles.pickerFooter}>
              <IconSymbol name="chevron.down" size={12} color="#475569" />
              <Text style={styles.pickerFooterText}>Scroll for more</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 40,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    backgroundColor: INDIGO,
  },
  newBizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INDIGO,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  newBizBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 38,
    color: colors.white,
    fontFamily: 'AkayaKanadaka_400Regular',
    textAlign: 'center',
    includeFontPadding: false,
  },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? INDIGO_BG_LIGHT : INDIGO_BG_SUPER_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
  },
  heroGradient: {
    padding: 32,
    paddingTop: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? INDIGO_BG_LIGHT : INDIGO_BG_SUPER_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
  },
  heroBadgeText: {
    color: INDIGO_LIGHT,
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 36,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 42,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 32,
  },
  heroActions: {
    gap: 16,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
  },
  section: {
    paddingHorizontal: 24,
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 20,
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
    backgroundColor: isDark ? INDIGO_BG_LIGHT : INDIGO_BG_SUPER_LIGHT,
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
    fontFamily: 'Outfit_700Bold',
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  bizManageCard: {
    backgroundColor: isDark ? '#101010' : '#ffffff',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  bizManageImageContainer: {
    width: 96,
    height: 96,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: isDark ? '#050505' : '#f1f5f9',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  bizManageInfo: {
    flex: 1,
    marginLeft: 16,
  },
  bizManageName: {
    fontSize: 18,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  bizManageType: {
    fontSize: 14,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: colors.slate400,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdrop || 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  formContainer: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    width: '100%',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  formBody: {
    gap: 20,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: INDIGO_LIGHT,
    fontFamily: 'Outfit_700Bold',
  },
  formInput: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    fontSize: 16,
    minHeight: 56,
  },
  coverPickerCard: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    backgroundColor: colors.background,
  },
  coverPickerPreview: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: isDark ? '#050505' : '#f8fafc',
  },
  coverPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
  },
  coverPreviewImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  coverPlaceholderText: {
    color: colors.slate400,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  coverPickerActions: {
    borderTopWidth: 1,
    borderTopColor: INDIGO_BORDER,
    padding: 12,
    gap: 10,
  },
  coverPickerHint: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  coverActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  coverActionBtn: {
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coverRemoveBtn: {
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  coverActionText: {
    color: INDIGO_LIGHT,
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coverRemoveText: {
    color: '#fb7185',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
  },
  typeChipActive: {
    backgroundColor: isDark ? INDIGO_BG_LIGHT : INDIGO_BG_SUPER_LIGHT,
    borderColor: INDIGO,
  },
  typeChipText: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  typeChipTextActive: {
    color: INDIGO,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: isDark ? INDIGO_BG_SUPER_LIGHT : 'rgba(99, 102, 241, 0.02)',
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    borderStyle: 'dashed',
    paddingVertical: 16,
    borderRadius: 16,
  },
  locationBtnActive: {
    backgroundColor: INDIGO,
    borderStyle: 'solid',
    borderColor: INDIGO,
  },
  locationBtnText: {
    color: INDIGO_LIGHT,
    fontFamily: 'Outfit_700Bold',
  },
  locationBtnTextActive: {
    color: '#101010',
  },
  submitFormBtn: {
    backgroundColor: INDIGO,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitFormText: {
    color: '#101010',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
  },
  dropdownBtn: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    minHeight: 56,
  },
  dropdownBtnText: {
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdrop || 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContainer: {
    backgroundColor: colors.deepSlate,
    width: '85%',
    maxHeight: '70%',
    minHeight: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: INDIGO_BORDER,
  },
  pickerTitle: {
    fontSize: 18,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pickerItemActive: {
    backgroundColor: isDark ? INDIGO_BG_SUPER_LIGHT : 'rgba(99, 102, 241, 0.02)',
  },
  pickerItemText: {
    fontSize: 15,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  pickerItemTextActive: {
    color: INDIGO,
    fontFamily: 'Inter_600SemiBold',
  },
  pickerFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  pickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: INDIGO_BORDER,
  },
  pickerFooterText: {
    fontSize: 11,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  shortIdBadge: {
    fontSize: 10,
    color: colors.slate400,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontFamily: 'Outfit_700Bold',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bizTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 6,
  },
  bizTypeText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Quota Modal
  quotaOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.85)',
    paddingHorizontal: 20,
  },
  quotaModalContent: {
    width: '100%',
    backgroundColor: isDark ? '#0d1526' : colors.background,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
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
  quotaHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quotaCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quotaHeroTitle: {
    fontSize: 17,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  quotaHeroSub: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  quotaActivePlanText: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  quotaActivePlanName: {
    color: '#4ade80',
    fontFamily: 'Outfit_700Bold',
  },
  quotaDivider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  quotaMetrics: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  quotaMetricRow: { gap: 10 },
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
  quotaDot: { width: 8, height: 8, borderRadius: 4 },
  quotaMetricLabel: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  quotaMetricRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quotaMetricValue: {
    fontSize: 14,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  quotaMetricMax: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
  },
  quotaPercentChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  quotaPercentText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  quotaBarTrack: {
    height: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quotaBarFill: { height: '100%', borderRadius: 4 },
  quotaMetricSep: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    marginVertical: 16,
  },
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
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
});

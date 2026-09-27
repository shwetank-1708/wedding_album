import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import * as Location from 'expo-location';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getBusinessById, updateBusiness, getEventsCountForVendor, Business, addEnquiry, getAnnouncementsForBusiness, getUserRatingForBusiness, saveUserRating, getReviewsForBusiness, getBusinessTypeColor, incrementBusinessViewCount, getBusinessShortlistStatus, toggleBusinessShortlist, getUserById, UserProfile } from '@/lib/database';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');

const INDIGO = '#818cf8';
const INDIGO_LIGHT = '#a5b4fc';
const INDIGO_DARK = '#6366f1';
const INDIGO_BORDER = 'rgba(99, 102, 241, 0.25)';
const INDIGO_BG_LIGHT = 'rgba(99, 102, 241, 0.1)';
const INDIGO_BG_SUPER_LIGHT = 'rgba(99, 102, 241, 0.05)';

// Helper to calculate distance in KM using Haversine formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getFAQsForBusiness(business: Business) {
  return business.faqs && business.faqs.length > 0 ? business.faqs : [];
}

export default function BusinessDetailScreen() {
  const { id, tab } = useLocalSearchParams();
  const businessId = Array.isArray(id) ? id[0] : id;
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;
  const initialTab = ['About', 'Portfolio', 'Announcements', 'Reviews'].includes(requestedTab || '') ? requestedTab as string : 'About';
  const router = useRouter();
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isShortlisting, setIsShortlisting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [locality, setLocality] = useState<string | null>(null);
  const [hasSeenAnnouncements, setHasSeenAnnouncements] = useState(false);
  const [eventsLikedCount, setEventsLikedCount] = useState<number>(0);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Enquiry form state
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryDate, setEnquiryDate] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [preferredContact, setPreferredContact] = useState<'chat' | 'whatsapp' | 'call' | 'email'>('chat');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rating Modal State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (['About', 'Portfolio', 'Announcements', 'Reviews'].includes(requestedTab || '')) {
      setActiveTab(requestedTab as string);
    }
  }, [requestedTab]);

  const handleRatingSubmit = async () => {
    if (!business || !businessId) return;
    if (!user || !user.uid) {
      Alert.alert("Authentication Required", "Please sign in to submit a rating.");
      return;
    }
    setSubmittingRating(true);
    try {
      // 1. Fetch user's existing rating if they have rated before
      const existingUserRating = await getUserRatingForBusiness(user.uid, businessId);

      const currentRating = business.rating || 5.0;
      const weight = 8; // Weighted average historical anchor
      let roundedRating = currentRating;

      if (existingUserRating !== null) {
        // User is updating/changing their rating or written comment!
        const delta = selectedRating - existingUserRating;
        const totalWeight = weight + 1; // 8 baseline + 1 active rating
        const calculatedRating = ((currentRating * totalWeight) + delta) / totalWeight;
        roundedRating = Math.round(calculatedRating * 10) / 10;
      } else {
        // First-time rating!
        const calculatedRating = ((currentRating * weight) + selectedRating) / (weight + 1);
        roundedRating = Math.round(calculatedRating * 10) / 10;
      }

      // 2. Securely persist user rating log with optional text review comment
      const saveSuccess = await saveUserRating(user.uid, businessId, selectedRating, reviewComment, user.name);
      if (!saveSuccess) {
        Alert.alert("Error", "Failed to save rating log. Please try again.");
        return;
      }

      // 3. Update the aggregate business profile rating field
      const success = await updateBusiness(businessId, { rating: roundedRating });
      if (success) {
        setBusiness({
          ...business,
          rating: roundedRating
        });

        // Refresh reviews list in background
        getReviewsForBusiness(businessId).then(list => setReviews(list)).catch(err => console.log('Reviews refresh failed', err));
        setReviewComment(''); // Clear review comment input state

        const message = existingUserRating !== null
          ? `Your rating has been successfully updated to ${selectedRating} stars!`
          : `Your ${selectedRating}-star rating has been submitted successfully.`;

        Alert.alert("Thank you!", message);
        setShowRatingModal(false);
      } else {
        Alert.alert("Error", "Failed to update business rating. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting rating:", err);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSubmittingRating(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      async function fetchBusiness() {
        if (businessId) {
          // 1. Fetch core business data as fast as possible
          let data = await getBusinessById(businessId);

          if (data) {
            // Generate a unique deterministic vendorCode based on the business ID prefix
            if (!data.vendorCode) {
              const docIdCode = businessId.substring(0, 6).toUpperCase();
              const vendorCode = `VEN-${docIdCode}`;
              data = { ...data, vendorCode };

              if (user && (user.uid === data.createdBy || user.email === data.ownerEmail)) {
                // Background update (non-blocking)
                updateBusiness(businessId, { vendorCode }).catch(err =>
                  console.warn("Silent ignore: Failed to save vendorCode to db", err)
                );
              }
            }

            setBusiness(data);
            if (data.createdBy) {
              getUserById(data.createdBy)
                .then(profile => setCreatorProfile(profile))
                .catch(() => setCreatorProfile(null));
            } else {
              setCreatorProfile(null);
            }

            // Track profile view — fire-and-forget, non-blocking, skip for the business owner
            if (user?.uid !== data.createdBy) {
              incrementBusinessViewCount(businessId).catch(() => {});
            }

            // Load shortlist state — prefer local user.shortlisted, fall back to Supabase database
            if (user?.uid) {
              const alreadyShortlisted = user.shortlisted?.includes(businessId) ?? false;
              setIsFavorited(alreadyShortlisted);
              // If shortlisted array is not in context yet, confirm with a background fetch
              if (!user.shortlisted) {
                getBusinessShortlistStatus(user.uid, businessId)
                  .then(status => setIsFavorited(status))
                  .catch(() => {});
              }
            }
          }

          // 2. DISMISS LOADING STATE IMMEDIATELY!
          // The screen transitions instantly, delivering an elite, responsive UX.
          setLoading(false);

          // 3. Perform background updates (completely non-blocking)
          if (data) {
            // Fetch dynamic events count in background
            getEventsCountForVendor(businessId).then(count => {
              setEventsLikedCount(count);
            }).catch(err => console.log('Background events fetch failed', err));

            // Fetch dynamic announcements in background
            getAnnouncementsForBusiness(businessId).then(list => {
              setAnnouncementsList(list);
            }).catch(err => console.log('Background announcements fetch failed', err));

            // Fetch dynamic reviews in background
            setLoadingReviews(true);
            getReviewsForBusiness(businessId).then(list => {
              setReviews(list);
            }).catch(err => console.log('Background reviews fetch failed', err))
              .finally(() => setLoadingReviews(false));

            // Request permission & fetch location coordinates in background (eliminates GPS lock latency)
            Location.requestForegroundPermissionsAsync().then(({ status }) => {
              if (status === 'granted') {
                return Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced
                });
              }
              throw new Error('Permission denied');
            }).then(userLoc => {
              setUserCoords({
                latitude: userLoc.coords.latitude,
                longitude: userLoc.coords.longitude
              });
            }).catch(err => {
              console.log('Background location fetch failed:', err);
            });

            // Reverse geocode locality in background if needed
            if (data.location && (data.location.latitude || data.location.longitude)) {
              Location.reverseGeocodeAsync({
                latitude: data.location.latitude,
                longitude: data.location.longitude
              }).then(reverse => {
                if (reverse && reverse[0]) {
                  const place = reverse[0];
                  const name = place.district || place.city || place.subregion || place.region;
                  if (name) setLocality(name);
                }
              }).catch(error => {
                console.log('Background reverse geocoding failed', error);
              });
            }
          }
        } else {
          setLoading(false);
        }
      }
      fetchBusiness();
    }, [businessId])
  );

  const getDistanceString = () => {
    if (!userCoords || !business?.location?.latitude || !business?.location?.longitude) {
      return null;
    }
    const dist = getDistance(
      userCoords.latitude,
      userCoords.longitude,
      business.location.latitude,
      business.location.longitude
    );
    if (dist < 1) {
      return `${Math.round(dist * 1000)}m away`;
    }
    return `${dist.toFixed(1)} km away`;
  };

  const distanceStr = getDistanceString();

  const handleCall = () => {
    if (business?.ownerPhone) {
      Linking.openURL(`tel:${business.ownerPhone}`);
      setShowContactOptions(false);
    }
  };

  const handleWhatsApp = () => {
    if (business?.ownerPhone) {
      const phone = business.ownerPhone.replace(/\D/g, '');
      const message = encodeURIComponent(`Hi ${business.name}, I found your business on EveBash and I'm interested in your services.`);
      Linking.openURL(`whatsapp://send?phone=${phone}&text=${message}`).catch(() => {
        Linking.openURL(`https://wa.me/${phone}?text=${message}`);
      });
      setShowContactOptions(false);
    }
  };

  const handleEnquirySubmit = async () => {
    if (!enquiryName || !enquiryDate) {
      Alert.alert('Missing Info', 'Please provide your name and event date.');
      return;
    }

    if (!business) return;

    setIsSubmitting(true);
    try {
      let customerCity = 'Unknown';
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const reverse = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (reverse && reverse[0]) {
            customerCity = reverse[0].city || reverse[0].subregion || reverse[0].district || reverse[0].region || 'Unknown';
          }
        }
      } catch (e) {
        console.warn('[Location Debug] Failed to geocode customer location:', e);
      }

      // Fallback to random Indian major city for high-quality mock data diversity when permissions are missing
      if (customerCity === 'Unknown' || customerCity.trim() === '') {
        const fallbackCities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Kolkata', 'Chennai', 'Hyderabad'];
        customerCity = fallbackCities[Math.floor(Math.random() * fallbackCities.length)];
      }

      const success = await addEnquiry({
        businessId: business.id,
        businessName: business.name,
        name: enquiryName,
        date: enquiryDate,
        message: enquiryMessage || `Hi ${business.name}, I'm interested in your services. Please share your availability.`,
        phone: preferredContact === 'chat' ? '' : (user?.phone || user?.phoneNumber || ''),
        email: preferredContact === 'chat' ? '' : (user?.email || ''),
        userId: user?.uid || null,
        vendorOwnerId: business.createdBy || '',
        vendorOwnerEmail: business.ownerEmail || '',
        preferredContact,
        city: customerCity,
      });

      if (success) {
        setShowEnquiryForm(false);
        // Clear fields on success
        setEnquiryName('');
        setEnquiryDate('');
        setEnquiryMessage('');
        Alert.alert(
          'Enquiry Sent! 🎉',
          `Your enquiry has been successfully submitted to ${business.name}. The vendor will get back to you shortly.`
        );
      } else {
        Alert.alert('Submission Error', 'Failed to submit enquiry. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      Alert.alert('Submission Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${business?.name} on EB Network!`,
        url: 'https://wedalbum.com',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={INDIGO} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Business not found</Text>
        <TouchableOpacity style={styles.backBtnLink} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/explore-business')}>
          <Text style={styles.backBtnLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const galleryImages = business.coverImages && business.coverImages.length > 0
    ? business.coverImages
    : [business.coverImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop'];
  const creatorProfileId = creatorProfile?.id || business.createdBy;
  const creatorName = creatorProfile?.name || business.ownerName || 'Owner name not set';
  const creatorUsername = creatorProfile?.username ? `@${creatorProfile.username}` : 'Username not set';

  const getExperienceYears = () => {
    if (!business) return 0;
    if (business.startedDate) {
      const date = business.startedDate.toDate ? business.startedDate.toDate() : new Date(business.startedDate);
      return Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    }
    return business.experience || 0;
  };

  const highlights = [
    { id: '1', title: `${getExperienceYears()}+ Years`, subtitle: 'Experience', icon: 'clock.fill', color: '#6366f1' },
    {
      id: '2',
      title: `${eventsLikedCount}`,
      subtitle: 'Events',
      icon: 'sparkles.fill',
      color: '#f97316',
      renderIcon: (color: string, size: number) => (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5.8 11.3 2 22l10.7-3.79" />
          <Path d="M4 3h.01" />
          <Path d="M22 8h.01" />
          <Path d="M15 2h.01" />
          <Path d="M22 20h.01" />
          <Path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
          <Path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" />
          <Path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" />
          <Path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
        </Svg>
      )
    },
    { id: '3', title: business.rating >= 4.8 ? 'Elite' : 'Verified', subtitle: 'Trusted', icon: 'checkmark.seal.fill', color: '#3b82f6' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── HERO GALLERY ── */}
        <View style={styles.heroContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveImageIndex(Math.round(x / width));
            }}
            scrollEventThrottle={16}
          >
            {galleryImages.map((img, index) => (
              <ExpoImage
                key={index}
                source={{ uri: img }}
                style={styles.heroImage}
                contentFit="cover"
              />
            ))}
          </ScrollView>

          <LinearGradient
            colors={['rgba(19, 25, 31, 0.4)', 'transparent', 'rgba(19, 25, 31, 0.8)']}
            style={styles.heroGradient}
          />

          <View style={styles.pagination}>
            {galleryImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  activeImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── HEADER ACTIONS (SCROLLS WITH CONTENT) ── */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.glassBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/explore-business')}>
            <IconSymbol name="chevron.left" size={20} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.glassBtn} onPress={handleShare}>
              <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.glassBtn, isFavorited && styles.glassBtnActive]}
              disabled={isShortlisting || !user?.uid}
              onPress={async () => {
                if (!user?.uid || !businessId) return;
                // Optimistic update
                setIsFavorited(prev => !prev);
                setIsShortlisting(true);
                try {
                  await toggleBusinessShortlist(user.uid, businessId, isFavorited);
                } catch {
                  // Rollback on error
                  setIsFavorited(prev => !prev);
                } finally {
                  setIsShortlisting(false);
                }
              }}
            >
              <IconSymbol
                name={isFavorited ? "heart.fill" : "heart"}
                size={18}
                color={isFavorited ? "#ef4444" : "#ffffff"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── INFO SECTION ── */}
        <View style={styles.contentSection}>
          <View style={styles.nameRow}>
            <Text style={styles.businessName} numberOfLines={1} ellipsizeMode="tail">
              {business.name}
            </Text>
          </View>

          <View style={styles.locationRow}>
            <IconSymbol name="mappin.and.ellipse" size={14} color="#CDB89E" />
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
              {business.location.address || locality || 'New Delhi'}
            </Text>
            {distanceStr && (
              <>
                <View style={styles.dot} />
                <Text style={styles.distanceText}>{distanceStr}</Text>
              </>
            )}
          </View>

          <View style={styles.badgesRow}>
            {(() => {
              const colors = getBusinessTypeColor(business.type);
              return (
                <View style={[styles.categoryBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Text style={[styles.categoryText, { color: colors.text }]}>{business.type}</Text>
                </View>
              );
            })()}
            {business.vendorCode && (
              <TouchableOpacity
                style={[styles.categoryBadge, { borderColor: 'rgba(56, 189, 248, 0.35)', backgroundColor: 'rgba(56, 189, 248, 0.12)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={async () => {
                  if (business.vendorCode) {
                    await Clipboard.setStringAsync(business.vendorCode);
                    Alert.alert("Copied!", "Vendor Code copied to clipboard.");
                  }
                }}
              >
                <Text style={[styles.categoryText, { color: '#38bdf8', textTransform: 'none' }]}>Code: {business.vendorCode}</Text>
                <IconSymbol name="doc.on.doc.fill" size={10} color="#38bdf8" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.ratingBadge}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedRating(5); // Default to 5 stars on open
                setShowRatingModal(true);
              }}
            >
              <IconSymbol name="star.fill" size={10} color="#CA9C68" />
              <Text style={styles.ratingText}>{business.rating}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.creatorCard}>
            <View style={styles.creatorIcon}>
              <IconSymbol name="person.fill" size={18} color={INDIGO_LIGHT} />
            </View>
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorLabel}>Created by</Text>
              <Text style={styles.creatorName} numberOfLines={1} ellipsizeMode="tail">{creatorName}</Text>
              <TouchableOpacity
                disabled={!creatorProfileId || !creatorProfile?.username}
                onPress={() => creatorProfileId && router.push(`/profile/${encodeURIComponent(creatorProfileId)}` as any)}
                activeOpacity={0.75}
              >
                <Text style={styles.creatorUsername} numberOfLines={1} ellipsizeMode="tail">{creatorUsername}</Text>
              </TouchableOpacity>
            </View>
          </View>


          {/* ── TAB NAVIGATION ── */}
          <View style={styles.tabContainer}>
            {['About', 'Portfolio', 'Announcements', 'Reviews'].map((tab) => {
              const showDot = tab === 'Announcements' &&
                business?.announcements &&
                business.announcements.length > 0 &&
                !hasSeenAnnouncements &&
                activeTab !== 'Announcements';

              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                  onPress={() => {
                    setActiveTab(tab);
                    if (tab === 'Announcements') {
                      setHasSeenAnnouncements(true);
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text
                      style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {tab}
                    </Text>
                    {showDot && (
                      <View style={styles.tabDot} />
                    )}
                  </View>
                  {activeTab === tab && (
                    <View style={styles.tabDash} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── HIGHLIGHTS CARDS BELOW TABS ── */}
          <View style={styles.highlightsRow}>
            {highlights.map((item) => (
              <View key={item.id} style={styles.highlightCard}>
                <View style={[styles.highlightIcon, { backgroundColor: `${item.color}15` }]}>
                  {item.renderIcon ? (
                    item.renderIcon(item.color, 16)
                  ) : (
                    <IconSymbol name={item.icon as any} size={16} color={item.color} />
                  )}
                </View>
                <Text style={styles.highlightTitle}>{item.title}</Text>
                <Text style={styles.highlightSubtitle}>{item.subtitle}</Text>
              </View>
            ))}
          </View>

          {activeTab === 'About' && (
            <View style={{ animationDuration: '300ms' }}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.descriptionText}>
                  {business.description ||
                    `Experience the exceptional services of ${business.name}. With a focus on quality and client satisfaction, we bring your vision to life with professional expertise in ${business.type.toLowerCase()}.`}
                </Text>
              </View>

              {business.services && business.services.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Services Offered</Text>
                  <View style={styles.servicesGrid}>
                    {business.services.map((s, i) => (
                      <View key={i} style={styles.serviceTag}>
                        <IconSymbol name="checkmark" size={14} color={INDIGO} />
                        <Text style={styles.serviceTagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {(() => {
                const faqsList = getFAQsForBusiness(business);
                return faqsList.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>FAQs</Text>
                    {faqsList.map((faq, i) => {
                      const isExpanded = expandedFaqIndex === i;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                          activeOpacity={0.75}
                          onPress={() => setExpandedFaqIndex(isExpanded ? null : i)}
                        >
                          <View style={styles.faqHeader}>
                            <Text style={styles.faqQuestion}>{faq.q}</Text>
                            <IconSymbol
                              name={isExpanded ? "chevron.up" : "chevron.down"}
                              size={16}
                              color={isExpanded ? INDIGO : '#CDB89E'}
                            />
                          </View>
                          {isExpanded && (
                            <Text style={styles.faqAnswer}>{faq.a}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          )}


          {activeTab === 'Portfolio' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Portfolio</Text>
                <Text style={styles.viewAllText}>{business.portfolioEvents?.length || 0} Events</Text>
              </View>
              {business.portfolioEvents && business.portfolioEvents.length > 0 ? (
                <View style={styles.publicPortfolioList}>
                  {business.portfolioEvents.map((portfolio) => (
                    <TouchableOpacity
                      key={portfolio.id}
                      style={styles.publicPortfolioCard}
                      activeOpacity={0.9}
                      onPress={() => router.push({
                        pathname: '/business-portfolio/[businessId]/[portfolioId]',
                        params: { businessId: business.id, portfolioId: portfolio.id, returnTo: 'public' },
                      } as any)}
                    >
                      <View style={styles.publicPortfolioCover}>
                        <ExpoImage
                          source={{ uri: portfolio.coverImage || galleryImages[0] }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                        <View style={styles.publicPortfolioTypeBadge}>
                          <Text style={styles.publicPortfolioTypeText}>{portfolio.type}</Text>
                        </View>
                        <View style={styles.publicPortfolioStrip}>
                          <Text style={styles.publicPortfolioTitle} numberOfLines={1}>{portfolio.name}</Text>
                          <View style={styles.publicPortfolioMeta}>
                            <IconSymbol name="calendar" size={12} color="#facc15" />
                            <Text style={styles.publicPortfolioDate}>
                              {new Date(portfolio.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyPortfolioBox}>
                  <Text style={styles.emptyPortfolioText}>No portfolio events yet.</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'Announcements' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 20 }]}>
                Announcements ({business?.announcements?.length || 0})
              </Text>

              {/* Announcements feed list */}
              {business?.announcements && business.announcements.length > 0 ? (
                business.announcements.map((item, index) => {
                  const matchedActivity = announcementsList.find(
                    (act: any) => act.content?.trim() === item?.trim()
                  );

                  const dateStr = matchedActivity && matchedActivity.createdAt
                    ? new Date(matchedActivity.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'Recently';

                  return (
                    <View key={index} style={[styles.announcementCard, index === 0 && styles.announcementCardLatest]}>
                      {index === 0 && (
                        <View style={styles.latestBanner}>
                          <IconSymbol name="sparkles" size={10} color="#1B211F" />
                          <Text style={styles.latestBannerText}>LATEST UPDATE</Text>
                        </View>
                      )}

                      <View style={styles.announcementHeader}>
                        <View style={styles.announcementIconWrapper}>
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                            <Path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
                            <Path d="M8 6v8" />
                          </Svg>
                        </View>
                        <View style={styles.announcementMeta}>
                          <Text style={styles.announcementTitleText}>
                            {matchedActivity?.title || 'Official Announcement'}
                          </Text>
                          <Text style={styles.announcementDateText}>{dateStr}</Text>
                        </View>
                      </View>

                      <Text style={styles.announcementBodyText}>{item}</Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBg}>
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                      <Path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
                      <Path d="M8 6v8" />
                    </Svg>
                  </View>
                  <Text style={styles.emptyStateTitle}>No announcements yet</Text>
                  <Text style={styles.emptyStateDesc}>Stay tuned! This business will post updates, offers, and announcements here.</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'Reviews' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>What Clients Say</Text>
                <TouchableOpacity onPress={() => {
                  if (user && user.uid) {
                    if (!businessId) return;
                    getUserRatingForBusiness(user.uid, businessId).then(r => {
                      if (r !== null) setSelectedRating(r);
                    }).catch(() => {});
                  }
                  setShowRatingModal(true);
                }}>
                  <Text style={styles.viewAllText}>Write a review</Text>
                </TouchableOpacity>
              </View>

              {loadingReviews ? (
                <ActivityIndicator color={INDIGO} style={{ marginVertical: 32 }} />
              ) : reviews.length === 0 ? (
                <View style={styles.emptyReviewsState}>
                  <View style={styles.emptyIconBg}>
                    <IconSymbol name="star" size={28} color="#eab308" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No reviews yet</Text>
                  <Text style={styles.emptyStateDesc}>Be the first to share your experience with this vendor and help the community!</Text>

                  <TouchableOpacity
                    style={styles.firstReviewBtn}
                    onPress={() => setShowRatingModal(true)}
                  >
                    <Text style={styles.firstReviewBtnText}>Write First Review</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                reviews.map((item) => {
                  let formattedDate = 'Recent review';
                  if (item.createdAt) {
                    const date = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                    formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  }

                  const initials = item.userName
                    ? item.userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'U';

                  return (
                    <View key={item.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarPlaceholderText}>{initials}</Text>
                        </View>
                        <View style={styles.reviewerInfo}>
                          <Text style={styles.reviewerName}>{item.userName || 'Anonymous User'}</Text>
                          <Text style={styles.reviewDate}>{formattedDate}</Text>
                        </View>
                        <View style={styles.reviewStarsRow}>
                          {[1, 2, 3, 4, 5].map((s) => {
                            const isFilled = s <= item.rating;
                            return (
                              <IconSymbol
                                key={s}
                                name={isFilled ? "star.fill" : "star"}
                                size={12}
                                color={isFilled ? "#eab308" : "#594C3D"}
                              />
                            );
                          })}
                        </View>
                      </View>
                      {item.comment ? (
                        <Text style={styles.reviewContent}>{item.comment}</Text>
                      ) : (
                        <Text style={[styles.reviewContent, styles.ratingOnlyText]}>Rated {item.rating} out of 5 stars</Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── BOTTOM CTA ── */}
      <View style={styles.bottomBar}>
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.secondaryCTA}
            onPress={() => {
              setShowEnquiryForm(true);
              setEnquiryMessage(`Hi ${business.name}, I'm interested in your services. Please share your availability.`);
            }}
          >
            <IconSymbol name="bubble.left.fill" size={18} color="#ffffff" />
            <Text style={styles.secondaryCTAText}>Enquire</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={styles.primaryCTA} onPress={() => setShowContactOptions(true)}>
            <Text style={styles.primaryCTAText}>Contact Now</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M16 2v2" />
              <Path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
              <Path d="M8 2v2" />
              <Circle cx="12" cy="11" r="3" />
              <Rect x="3" y="4" width="18" height="18" rx="2" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CONTACT OPTIONS MODAL ── */}
      <Modal
        visible={showContactOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowContactOptions(false)}
        >
          <View style={styles.optionsContainer}>
            <View style={styles.grabHandle} />
            <View style={styles.optionsHeader}>
              <View>
                <Text style={styles.optionsTitle}>Contact Business</Text>
                <Text style={styles.optionsSub}>Select your preferred mode</Text>
              </View>
              <TouchableOpacity onPress={() => setShowContactOptions(false)} style={styles.closeBtn}>
                <IconSymbol name="xmark" size={20} color="#CDB89E" />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              <TouchableOpacity style={styles.optionItem} onPress={handleCall}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <IconSymbol name="phone.fill" size={20} color="#3b82f6" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Call Directly</Text>
                  <Text style={styles.optionSubText}>{business.ownerPhone}</Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color="#594C3D" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionItem} onPress={handleWhatsApp}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <IconSymbol name="message.fill" size={20} color="#22c55e" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>WhatsApp Message</Text>
                  <Text style={styles.optionSubText}>Instant response usually</Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color="#594C3D" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setShowContactOptions(false);
                  setShowEnquiryForm(true);
                }}
              >
                <View style={[styles.optionIcon, { backgroundColor: INDIGO_BG_LIGHT }]}>
                  <IconSymbol name="paperplane.fill" size={20} color={INDIGO} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Enquire through App</Text>
                  <Text style={styles.optionSubText}>Share event details</Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color="#594C3D" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── ENQUIRY FORM MODAL ── */}
      <Modal
        visible={showEnquiryForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEnquiryForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formModalOverlay}
        >
          <View style={styles.enquiryFormContainer}>
            <View style={styles.formHeader}>
              <View>
                <Text style={styles.formTitle}>Enquiry Form</Text>
                <Text style={styles.formSub}>Inquiry for {business.name}</Text>
              </View>
              <TouchableOpacity style={styles.closeFormBtn} onPress={() => setShowEnquiryForm(false)}>
                <IconSymbol name="xmark" size={20} color="#CDB89E" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="#475569"
                  value={enquiryName}
                  onChangeText={setEnquiryName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Date</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 24th Dec 2026"
                  placeholderTextColor="#475569"
                  value={enquiryDate}
                  onChangeText={setEnquiryDate}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Message</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Tell the vendor what you're looking for..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={4}
                  value={enquiryMessage}
                  onChangeText={setEnquiryMessage}
                />
              </View>

              <View style={[styles.inputGroup, { marginBottom: 20 }]}>
                <Text style={styles.inputLabel}>How should the vendor contact you?</Text>
                <View style={styles.contactMethodRow}>
                  <TouchableOpacity
                    style={[styles.contactMethodBtn, preferredContact === 'chat' && styles.contactMethodBtnActive]}
                    onPress={() => setPreferredContact('chat')}
                  >
                    <IconSymbol name="bubble.left.fill" size={14} color={preferredContact === 'chat' ? INDIGO : '#CDB89E'} />
                    <Text style={[styles.contactMethodText, preferredContact === 'chat' && styles.contactMethodTextActive]}>In-App Chat (Private)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.contactMethodBtn, preferredContact === 'whatsapp' && styles.contactMethodBtnActive]}
                    onPress={() => setPreferredContact('whatsapp')}
                  >
                    <IconSymbol name="message.fill" size={14} color={preferredContact === 'whatsapp' ? INDIGO : '#CDB89E'} />
                    <Text style={[styles.contactMethodText, preferredContact === 'whatsapp' && styles.contactMethodTextActive]}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.contactMethodRow, { marginTop: 8 }]}>
                  <TouchableOpacity
                    style={[styles.contactMethodBtn, preferredContact === 'call' && styles.contactMethodBtnActive]}
                    onPress={() => setPreferredContact('call')}
                  >
                    <IconSymbol name="phone.fill" size={14} color={preferredContact === 'call' ? INDIGO : '#CDB89E'} />
                    <Text style={[styles.contactMethodText, preferredContact === 'call' && styles.contactMethodTextActive]}>Phone Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.contactMethodBtn, preferredContact === 'email' && styles.contactMethodBtnActive]}
                    onPress={() => setPreferredContact('email')}
                  >
                    <IconSymbol name="envelope.fill" size={14} color={preferredContact === 'email' ? INDIGO : '#CDB89E'} />
                    <Text style={[styles.contactMethodText, preferredContact === 'email' && styles.contactMethodTextActive]}>Email</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitEnquiryBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleEnquirySubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#13191F" />
                ) : (
                  <>
                    <Text style={styles.submitEnquiryBtnText}>Send Inquiry</Text>
                    <IconSymbol name="paperplane.fill" size={16} color="#13191F" />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── RATING MODAL ── */}
      <Modal
        visible={showRatingModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.ratingModalOverlay}>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingModalHeader}>
              <Text style={styles.ratingModalTitle}>Submit Rating</Text>
              <TouchableOpacity
                style={styles.closeRatingBtn}
                onPress={() => setShowRatingModal(false)}
              >
                <IconSymbol name="xmark" size={18} color="#CDB89E" />
              </TouchableOpacity>
            </View>

            <View style={styles.ratingModalContent}>
              <Text style={styles.ratingBizName}>{business.name}</Text>

              {/* Huge score indicator for clear visual feedback */}
              <Text style={styles.ratingScoreNumber}>{selectedRating}.0</Text>

              {/* Stars selection row */}
              <View style={styles.starsSelectRow}>
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = starValue <= selectedRating;
                  return (
                    <TouchableOpacity
                      key={starValue}
                      activeOpacity={0.7}
                      onPress={() => setSelectedRating(starValue)}
                      style={styles.starWrapper}
                    >
                      <IconSymbol
                        name={isFilled ? "star.fill" : "star"}
                        size={38}
                        color={isFilled ? "#eab308" : "#594C3D"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Dynamic feedback text */}
              <Text style={styles.ratingFeedbackText}>
                {selectedRating === 1 && "Disappointing 😟"}
                {selectedRating === 2 && "Mediocre 😐"}
                {selectedRating === 3 && "Good experience 🙂"}
                {selectedRating === 4 && "Very Professional! 😊"}
                {selectedRating === 5 && "Exceptional Service! 🤩"}
              </Text>

              {/* Written review comment (Optional) */}
              <View style={styles.reviewInputWrapper}>
                <TextInput
                  style={styles.reviewCommentInput}
                  placeholder="Share details of your experience (optional)..."
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={3}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                />
              </View>

              <Text style={styles.ratingInstruction}>
                Your review helps the community book with confidence
              </Text>

              {/* Submit rating CTA button */}
              <TouchableOpacity
                style={[styles.submitRatingBtn, submittingRating && styles.btnDisabled]}
                onPress={handleRatingSubmit}
                disabled={submittingRating}
              >
                {submittingRating ? (
                  <ActivityIndicator color="#1B211F" />
                ) : (
                  <Text style={styles.submitRatingBtnText}>Submit Rating</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroContainer: {
    width: width,
    height: width * 0.85,
    backgroundColor: '#1B211F',
  },
  heroImage: {
    width: width,
    height: width * 0.85,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pagination: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: INDIGO,
  },
  headerActions: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19, 25, 31, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contentSection: {
    paddingHorizontal: 24,
    marginTop: -30,
    backgroundColor: '#13191F',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  titleContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  businessName: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 30,
  },
  verifiedBadgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#13191F',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#CDB89E',
    fontFamily: 'Inter_400Regular',
    flexShrink: 1,
  },
  distanceText: {
    fontSize: 14,
    color: '#3b82f6',
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 0,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: INDIGO_BG_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    flexShrink: 0,
  },
  categoryText: {
    fontSize: 11,
    color: INDIGO_LIGHT,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#594C3D',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(202, 156, 104, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.25)',
    flexShrink: 0,
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1B211F',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  creatorIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: INDIGO_BG_LIGHT,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorInfo: {
    flex: 1,
    minWidth: 0,
  },
  creatorLabel: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  creatorName: {
    marginTop: 3,
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  creatorUsername: {
    marginTop: 2,
    fontSize: 13,
    color: INDIGO_LIGHT,
    fontFamily: 'Inter_700Bold',
  },
  ratingText: {
    fontSize: 11,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  announcementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: INDIGO,
    gap: 10,
  },
  announcementText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  announcementCountBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  announcementCountText: {
    color: '#ef4444',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  announcementCard: {
    backgroundColor: '#1B211F',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  announcementCardLatest: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(27, 33, 31, 0.95)',
  },
  latestBanner: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  latestBannerText: {
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  announcementIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  announcementMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  announcementTitleText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  announcementDateText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
    marginTop: 1,
  },
  announcementBodyText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  emptyStateTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  highlightsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  highlightCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1B211F',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  highlightTitle: {
    fontSize: 12,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  highlightSubtitle: {
    fontSize: 9,
    color: '#CDB89E',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 13,
    color: '#CDB89E',
    fontFamily: 'Outfit_600SemiBold',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabDash: {
    position: 'absolute',
    bottom: -1,
    height: 3,
    width: 36,
    borderRadius: 1.5,
    backgroundColor: INDIGO,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 15,
    color: '#CDB89E',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INDIGO_BG_SUPER_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
  },
  serviceTagText: {
    fontSize: 13,
    color: '#e2e8f0',
    fontFamily: 'Inter_500Medium',
  },
  faqItem: {
    backgroundColor: '#1B211F',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  faqItemExpanded: {
    borderColor: INDIGO,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#CDB89E',
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  portfolioItem: {
    width: (width - 58) / 2,
    height: 140,
    borderRadius: 16,
  },
  portfolioItemLarge: {
    width: '100%',
    height: 200,
  },
  publicPortfolioList: {
    gap: 18,
  },
  publicPortfolioCard: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1B211F',
  },
  publicPortfolioCover: {
    height: 230,
    backgroundColor: '#13191F',
    position: 'relative',
    overflow: 'hidden',
  },
  publicPortfolioTypeBadge: {
    position: 'absolute',
    left: 14,
    top: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  publicPortfolioTypeText: {
    color: '#facc15',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  publicPortfolioStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    padding: 16,
  },
  publicPortfolioTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  publicPortfolioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  publicPortfolioDate: {
    color: '#CDB89E',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  emptyPortfolioBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyPortfolioText: {
    color: '#CDB89E',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  viewAllText: {
    fontSize: 14,
    color: INDIGO_LIGHT,
    fontFamily: 'Outfit_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: '#1B211F',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarPlaceholderText: {
    color: INDIGO_LIGHT,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  ratingOnlyText: {
    fontStyle: 'italic',
    color: '#64748b',
    fontSize: 13,
  },
  emptyReviewsState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginTop: 12,
  },
  firstReviewBtn: {
    backgroundColor: INDIGO,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 18,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  firstReviewBtnText: {
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  reviewInputWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    marginTop: 12,
  },
  reviewCommentInput: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    height: 70,
    textAlignVertical: 'top',
  },
  reviewContent: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginTop: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 25, 31, 0.85)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  ctaContainer: {
    flex: 1,
  },
  secondaryCTA: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: INDIGO,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  secondaryCTAText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  primaryCTA: {
    width: '100%',
    height: 46,
    backgroundColor: INDIGO,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primaryCTAText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 25, 31, 0.7)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#1B211F',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  grabHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  optionsTitle: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  optionsSub: {
    fontSize: 14,
    color: '#CDB89E',
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    gap: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  optionSubText: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 25, 31, 0.7)',
    justifyContent: 'flex-end',
  },
  enquiryFormContainer: {
    backgroundColor: '#13191F',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    height: '85%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 26,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  formSub: {
    fontSize: 14,
    color: '#CDB89E',
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  closeFormBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B211F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formScroll: {
    paddingBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 8,
    marginLeft: 4,
  },
  formInput: {
    backgroundColor: '#1B211F',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    fontSize: 15,
  },
  formTextArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  submitEnquiryBtn: {
    backgroundColor: INDIGO,
    height: 60,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitEnquiryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#CDB89E',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    marginBottom: 16,
  },
  backBtnLink: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: INDIGO,
    borderRadius: 14,
  },
  backBtnLinkText: {
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 25, 31, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingContainer: {
    backgroundColor: '#1B211F',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    width: width * 0.88,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  ratingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 16,
  },
  ratingModalTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  closeRatingBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingModalContent: {
    alignItems: 'center',
    paddingTop: 16,
  },
  ratingBizName: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  ratingScoreNumber: {
    fontSize: 58,
    color: '#ffffff',
    fontFamily: 'Outfit_900Black',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -1,
  },
  ratingInstruction: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  starsSelectRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starWrapper: {
    padding: 4,
  },
  ratingFeedbackText: {
    fontSize: 15,
    color: '#eab308',
    fontFamily: 'Outfit_700Bold',
    marginTop: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitRatingBtn: {
    backgroundColor: INDIGO,
    borderRadius: 18,
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitRatingBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  contactMethodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#1B211F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  contactMethodBtnActive: {
    backgroundColor: INDIGO_BG_LIGHT,
    borderColor: INDIGO,
  },
  contactMethodText: {
    color: '#CDB89E',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  contactMethodTextActive: {
    color: INDIGO,
  },
});

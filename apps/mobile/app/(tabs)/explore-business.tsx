import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ImageBackground,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { onTopRatedBusinesses, getTopRatedBusinesses, toggleShortlistBusiness, Business, getBusinessTypeColor } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { EveBashLogoBadge } from '@/components/EveBashLogo';

const { width } = Dimensions.get('window');

// Removed dummy FEATURED_VENDORS


const CATEGORIES = [
  { id: '1', name: 'All', icon: 'square.grid.2x2.fill' },
  { id: '2', name: 'Weddings', icon: 'heart.fill' },
  { id: '3', name: 'Birthday', icon: 'gift.fill' },
  { id: '4', name: 'Corporate', icon: 'briefcase.fill' },
  { id: '5', name: 'Sports', icon: 'trophy.fill' },
  { id: '6', name: 'Venue', icon: 'mappin.and.ellipse' },
  { id: '7', name: 'Photo', icon: 'camera.fill' },
  { id: '8', name: 'Food', icon: 'fork.knife' },
  { id: '9', name: 'Decor', icon: 'sparkles' },
  { id: '10', name: 'Fashion', icon: 'tshirt.fill' },
];

const CATEGORY_MATCHERS: Record<string, string[]> = {
  Weddings: ['Wedding', 'Weddings'],
  Birthday: ['Birthday', 'Birthdays'],
  Corporate: ['Corporate'],
  Sports: ['Sports'],
  Venue: ['Venue'],
  Photo: ['Photography', 'Videography', 'Photo', 'Video'],
  Food: ['Catering', 'Food Stalls', 'Food'],
  Decor: ['Decor', 'Lighting'],
  Fashion: ['Apparel', 'Makeup'],
};

// Removed dummy ALL_VENDORS


// Helper to calculate distance in KM
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

export default function ExploreBusinessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState('Rating'); // Rating, Distance, Price
  const [selectedLocation, setSelectedLocation] = useState('All Cities');
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [maxDistance, setMaxDistance] = useState(100); // in KM
  const [isDetecting, setIsDetecting] = useState(false);
  const [dbVendors, setDbVendors] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isShortlisted = (vendorId: string) => user?.shortlisted?.includes(vendorId) || false;

  const handleShortlistToggle = async (vendorId: string) => {
    if (!user?.uid) {
      Alert.alert("Login Required", "Please log in to shortlist vendors.");
      return;
    }
    try {
      await toggleShortlistBusiness(user.uid, vendorId);
    } catch (error) {
      console.error("Error toggling shortlist:", error);
    }
  };

  const openBusinessDetail = (businessId: string) => {
    router.push(`/(tabs)/business/${encodeURIComponent(businessId)}` as any);
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onTopRatedBusinesses(50, (businesses) => {
      setDbVendors(businesses);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const businesses = await getTopRatedBusinesses(50);
      setDbVendors(businesses);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const detectLocation = async () => {
    setIsDetecting(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
        setIsDetecting(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserCoords({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      setSelectedLocation('Near Me');
    } catch (error) {
      Alert.alert('Error', 'Could not fetch location.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Only use database vendors
  const allAvailableVendors = dbVendors.map(b => ({
    id: b.id,
    name: b.name,
    category: b.type,
    eventTypes: b.tags,
    rating: b.rating,
    location: b.location.address || 'Local',
    lat: b.location.latitude,
    lng: b.location.longitude,
    image: b.coverImage,
    verified: true, // All listed businesses on EveBash are verified
    experience: b.experience,
  }));

  const filteredVendors = allAvailableVendors.filter((v) => {
    const selectedCategoryMatches = CATEGORY_MATCHERS[selectedCategory] || [selectedCategory];
    const matchesCategory = selectedCategory === 'All' ||
      selectedCategoryMatches.includes(v.category) ||
      v.eventTypes.some((eventType) => selectedCategoryMatches.includes(eventType));
    const matchesLocation = selectedLocation === 'All Cities' || 
                           (selectedLocation === 'Near Me' && userCoords ? true : v.location === selectedLocation);
    
    // Distance filtering
    let isWithinDistance = true;
    if (selectedLocation === 'Near Me' && userCoords) {
      const dist = getDistance(userCoords.lat, userCoords.lng, v.lat, v.lng);
      isWithinDistance = dist <= maxDistance;
    }

    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) || 
                         v.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesLocation && matchesSearch && isWithinDistance;
  });

  // Featured vendors are just the top 3 from the filtered list
  const featuredFiltered = filteredVendors.slice(0, 3);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#818cf8"
            colors={["#818cf8"]}
          />
        }
      >
        {/* ── HEADER ── */}
        <LinearGradient
          colors={isDark ? ['#101010', '#050505'] : [colors.deepSlate, colors.background]}
          style={[styles.header, { paddingTop: insets.top + 4 }]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.push('/shortlist')} style={styles.backBtn}>
              <IconSymbol name="heart.fill" size={20} color={isDark ? '#818cf8' : '#6366f1'} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={styles.headingLogoRow}>
              <EveBashLogoBadge />
              <Text style={styles.headerTitle}>EB Network</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.iconBtn}
              onPress={() => setShowFilterModal(true)}
            >
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#818cf8' : '#6366f1'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M10 5H3"/><Path d="M12 19H3"/><Path d="M14 3v4"/><Path d="M16 17v4"/><Path d="M21 12h-9"/><Path d="M21 19h-5"/><Path d="M21 5h-7"/><Path d="M8 10v4"/><Path d="M8 12H3"/>
              </Svg>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        {/* ── SEARCH BAR ── */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <IconSymbol name="magnifyingglass" size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search photographers, venues..."
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* ── CATEGORIES ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.name && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <IconSymbol
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.name ? (isDark ? '#101010' : '#ffffff') : colors.slate400}
              />
              <Text style={[styles.categoryText, selectedCategory === cat.name && styles.categoryTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── PROMOTE BUSINESS HERO ── */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          style={styles.heroCard}
          onPress={() => router.push('/(tabs)/businesses')}
        >
          <LinearGradient
            colors={['#4f46e5', '#3730a3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>FOR OWNERS</Text>
              </View>
              <Text style={styles.heroTitle}>Promote Your Business</Text>
              <Text style={styles.heroSubtitle}>
                Reach thousands of event organizers and grow your brand today.
              </Text>
              <View style={[styles.heroBtn, { backgroundColor: '#1e1b4b' }]}>
                <Text style={styles.heroBtnText}>Get Started</Text>
                <IconSymbol name="chevron.right" size={12} color="#ffffff" />
              </View>
            </View>
            <View style={styles.heroIconContainer}>
              <IconSymbol name="briefcase.fill" size={60} color="rgba(255,255,255,0.15)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── FEATURED VENDORS ── */}
        {featuredFiltered.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Vendors</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredContainer}
            >
              {featuredFiltered.map((vendor) => (
                <TouchableOpacity 
                  key={vendor.id} 
                  style={styles.featuredCard} 
                  activeOpacity={0.9}
                  onPress={() => openBusinessDetail(vendor.id)}
                >
                  {/* Top Part: Image Container with Ambient Blurred Backdrop */}
                  <View style={styles.featuredImageContainer}>
                    {/* Ambient Blurred Backdrop */}
                    <ExpoImage 
                      source={{ uri: vendor.image }} 
                      style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} 
                      contentFit="cover"
                      blurRadius={20}
                    />
                    {/* Sharp Contain Foreground */}
                    <ExpoImage 
                      source={{ uri: vendor.image }} 
                      style={StyleSheet.absoluteFill} 
                      contentFit="contain"
                      transition={400}
                    />
                    <LinearGradient
                      colors={['rgba(2,6,23,0.15)', 'transparent']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Shortlist Heart Button - floated on image */}
                    <TouchableOpacity 
                      style={styles.shortlistHeartBtn} 
                      onPress={(e) => {
                        e.stopPropagation();
                        handleShortlistToggle(vendor.id);
                      }}
                    >
                      <IconSymbol 
                        name={isShortlisted(vendor.id) ? "heart.fill" : "heart"} 
                        size={16} 
                        color={isShortlisted(vendor.id) ? "#ef4444" : colors.white} 
                      />
                    </TouchableOpacity>

                    {/* Rating Badge - floated on image */}
                    <View style={styles.featuredBadge}>
                      <IconSymbol name="star.fill" size={10} color="#d4af37" />
                      <Text style={styles.featuredBadgeText}>{vendor.rating}</Text>
                    </View>
                  </View>

                  {/* Bottom Part: Text Details */}
                  <View style={styles.featuredInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.featuredName} numberOfLines={1}>{vendor.name}</Text>
                      {vendor.verified && (
                        <IconSymbol name="checkmark.seal.fill" size={12} color="#3b82f6" />
                      )}
                    </View>

                    <View style={styles.metaRow}>
                      {(() => {
                        const typeColors = getBusinessTypeColor(vendor.category);
                        return (
                          <View style={[styles.featuredCategoryBadge, { backgroundColor: typeColors.bg, borderColor: typeColors.border }]}>
                            <Text style={[styles.featuredCategoryText, { color: typeColors.text }]}>{vendor.category}</Text>
                          </View>
                        );
                      })()}
                      <View style={styles.locationRow}>
                        <IconSymbol name="mappin.and.ellipse" size={10} color="#94a3b8" />
                        <Text style={styles.locationText} numberOfLines={1}>{vendor.location}</Text>
                      </View>
                    </View>

                    <View style={styles.experienceBadge}>
                      <IconSymbol name="clock.fill" size={10} color={isDark ? colors.gold : '#4f46e5'} />
                      <Text style={styles.experienceText}>
                        {(vendor.experience !== undefined && vendor.experience !== null && vendor.experience !== 0)
                          ? `${vendor.experience}+ Yrs Exp`
                          : 'Established'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── EXPLORE ALL ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'All' ? 'Explore All' : `Best ${selectedCategory}`}
          </Text>
          {filteredVendors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="magnifyingglass" size={40} color="#334155" />
              <Text style={styles.emptyText}>No vendors found in this category</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredVendors.map((vendor) => (
                <TouchableOpacity 
                  key={vendor.id} 
                  style={styles.listCard} 
                  activeOpacity={0.9}
                  onPress={() => openBusinessDetail(vendor.id)}
                >
                  <View style={styles.listImageContainer}>
                    {/* Ambient Blurred Backdrop */}
                    <ExpoImage 
                      source={{ uri: vendor.image }} 
                      style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} 
                      contentFit="cover"
                      blurRadius={15}
                    />
                    {/* Sharp Contain Foreground */}
                    <ExpoImage 
                      source={{ uri: vendor.image }} 
                      style={StyleSheet.absoluteFill} 
                      contentFit="contain"
                      transition={300}
                    />
                  </View>
                  
                  <View style={styles.listInfo}>
                    <View style={styles.listHeaderRow}>
                      <View style={styles.listNameRow}>
                        <Text style={styles.listName} numberOfLines={1}>{vendor.name}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.listHeartBtn} 
                        onPress={(e) => {
                          e.stopPropagation();
                          handleShortlistToggle(vendor.id);
                        }}
                      >
                        <IconSymbol 
                          name={isShortlisted(vendor.id) ? "heart.fill" : "heart"} 
                          size={14} 
                          color={isShortlisted(vendor.id) ? "#ef4444" : colors.white} 
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      {(() => {
                        const typeColors = getBusinessTypeColor(vendor.category);
                        return (
                          <View style={[styles.listCategoryBadge, { backgroundColor: typeColors.bg, borderColor: typeColors.border, marginBottom: 0 }]}>
                            <Text style={[styles.listCategoryText, { color: typeColors.text }]}>{vendor.category}</Text>
                          </View>
                        );
                      })()}
                      {vendor.verified && (
                        <IconSymbol name="checkmark.seal.fill" size={14} color="#3b82f6" />
                      )}
                    </View>

                    <View style={styles.listMetaRow}>
                      <View style={styles.listMetaItem}>
                        <IconSymbol name="mappin.fill" size={10} color="#64748b" />
                        <Text style={styles.listMetaText} numberOfLines={1}>{vendor.location}</Text>
                      </View>
                      <View style={styles.listMetaItem}>
                        <IconSymbol name="clock.fill" size={10} color="#d4af37" />
                        <Text style={styles.listMetaText}>
                          {(vendor.experience !== undefined && vendor.experience !== null && vendor.experience !== 0)
                            ? `${vendor.experience}+ Yrs`
                            : 'Established'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.listFooterRow}>
                      <View style={styles.listRatingBadge}>
                        <IconSymbol name="star.fill" size={10} color="#d4af37" />
                        <Text style={styles.listRatingText}>{vendor.rating}</Text>
                      </View>
                      <View style={styles.listActionBtn}>
                        <Text style={styles.listActionBtnText}>View Details</Text>
                        <IconSymbol name="chevron.right" size={10} color="#818cf8" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>



      {/* ── LIST YOUR BUSINESS MODAL ── */}
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
            <ScrollView contentContainerStyle={styles.formBody}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>List Your Business</Text>
                <TouchableOpacity onPress={() => setShowListingForm(false)}>
                  <IconSymbol name="xmark" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Business Name</Text>
              <TextInput style={styles.formInput} placeholder="e.g. Royal Photography" placeholderTextColor="#475569" />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryPicker}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat.id} style={styles.pickerChip}>
                    <Text style={styles.pickerChipText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.formInput} placeholder="+91 98765 43210" placeholderTextColor="#475569" keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>About Your Business</Text>
              <TextInput 
                style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]} 
                placeholder="Tell us about your services..." 
                placeholderTextColor="#475569"
                multiline
              />

              <TouchableOpacity style={styles.submitFormBtn} onPress={() => {
                setShowListingForm(false);
                Alert.alert("Success", "Your business listing has been submitted for review!");
              }}>
                <Text style={styles.submitFormText}>Submit Listing</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* ── FILTER MODAL ── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[styles.formContainer, { height: '85%' }]}>
            <View style={styles.grabHandle} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <IconSymbol name="xmark" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.formBody}
            >
              <View style={styles.locationHeaderRow}>
                <Text style={styles.inputLabel}>Select City</Text>
                <TouchableOpacity 
                  style={styles.detectBtn} 
                  onPress={detectLocation}
                  disabled={isDetecting}
                >
                  <IconSymbol name="mappin.and.ellipse" size={12} color={isDark ? '#818cf8' : '#6366f1'} />
                  <Text style={styles.detectBtnText}>{isDetecting ? 'Detecting...' : 'Near Me'}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.categoryPicker}>
                {['All Cities', 'Near Me', 'Dehradun', 'Delhi', 'Chennai'].map((city) => (
                  <TouchableOpacity 
                    key={city} 
                    style={[styles.pickerChip, selectedLocation === city && styles.categoryChipActive]}
                    onPress={() => setSelectedLocation(city)}
                  >
                    <Text style={[styles.pickerChipText, selectedLocation === city && styles.categoryTextActive]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedLocation === 'Near Me' && (
                <>
                  <Text style={styles.inputLabel}>Distance Radius (km)</Text>
                  <View style={styles.categoryPicker}>
                    {[5, 10, 20, 50, 100].map((radius) => (
                      <TouchableOpacity 
                        key={radius} 
                        style={[styles.pickerChip, maxDistance === radius && styles.categoryChipActive]}
                        onPress={() => setMaxDistance(radius)}
                      >
                        <Text style={[styles.pickerChipText, maxDistance === radius && styles.categoryTextActive]}>
                          {radius}km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Sort By</Text>
              <View style={styles.categoryPicker}>
                {['Rating', 'Price: Low to High', 'Price: High to Low', 'Distance'].map((option) => (
                  <TouchableOpacity 
                    key={option} 
                    style={[styles.pickerChip, sortBy === option && styles.categoryChipActive]}
                    onPress={() => setSortBy(option)}
                  >
                    <Text style={[styles.pickerChipText, sortBy === option && styles.categoryTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.submitFormBtn} 
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.submitFormText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 8,
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 38,
    color: colors.white,
    fontFamily: 'AkayaKanadaka_400Regular',
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(129, 140, 248, 0.1)' : 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(129, 140, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: isDark ? '#818cf8' : '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.deepSlate,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  categoryChipActive: {
    backgroundColor: isDark ? '#818cf8' : '#6366f1',
    borderColor: isDark ? '#818cf8' : '#6366f1',
  },
  categoryText: {
    color: colors.slate400,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  categoryTextActive: {
    color: isDark ? '#101010' : '#ffffff',
  },
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: isDark ? '#818cf8' : '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
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
    color: colors.white,
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.white,
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
    backgroundColor: colors.deepSlate,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  heroIconContainer: {
    marginLeft: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    paddingHorizontal: 24,
  },
  viewAllText: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  featuredContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  featuredCard: {
    width: width * 0.64,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: isDark ? '#101010' : '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  featuredImageContainer: {
    width: '100%',
    height: 125,
    backgroundColor: isDark ? '#050505' : '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featuredBadgeText: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  featuredInfo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: isDark ? 'transparent' : '#ffffff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  featuredName: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
  },
  featuredCategory: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: colors.slate400,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  gridCard: {
    width: (width - 48) / 2,
    backgroundColor: colors.deepSlate,
    borderRadius: 20,
    marginHorizontal: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortlistHeartBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
  },
  gridImage: {
    width: '100%',
    height: 120,
  },
  gridInfo: {
    padding: 12,
  },
  gridName: {
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
  },
  verifiedIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  gridRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  gridCategory: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridRating: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  modalHeroImage: {
    width: '100%',
    height: 300,
  },
  modalBody: {
    padding: 24,
    flex: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalVendorName: {
    fontSize: 28,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  modalVendorCat: {
    fontSize: 16,
    color: isDark ? '#818cf8' : '#6366f1',
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 4,
  },
  modalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  modalRatingText: {
    color: colors.gold,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  modalDesc: {
    fontSize: 15,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#818cf8' : '#6366f1',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  secondaryActionText: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  // ── Form Styles ──
  formContainer: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    width: '100%',
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
    paddingTop: 10,
    gap: 20,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  detectBtnText: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  inputLabel: {
    fontSize: 14,
    color: isDark ? '#818cf8' : '#6366f1',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    minHeight: 56,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  pickerChip: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerChipText: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  submitFormBtn: {
    backgroundColor: isDark ? '#818cf8' : '#6366f1',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitFormText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 16,
  },
  emptyText: {
    color: colors.slate400,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 4,
  },
  experienceText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  gridExperienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  gridExperienceText: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  listContainer: {
    marginTop: 16,
    gap: 16,
  },
  listCard: {
    backgroundColor: isDark ? '#101010' : '#ffffff',
    borderRadius: 20,
    marginHorizontal: 24,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.25 : 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  listImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: isDark ? '#050505' : '#f1f5f9',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  listInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  listName: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  listHeartBtn: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  listCategory: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 8,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  listMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listMetaText: {
    color: colors.slate400,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    maxWidth: 100,
  },
  listFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listRatingText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  listActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listActionBtnText: {
    color: isDark ? '#818cf8' : '#6366f1',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  featuredCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  featuredCategoryText: {
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  listCategoryText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

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
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../../constants/theme';
import { getUserEvents, getApprovedSharedEventsForUser, Event as DatabaseEvent } from '@/lib/database';
import { resolveEventCoverImage } from '@/lib/eventCovers';
import { EveBashLogoBadge } from '@/components/EveBashLogo';

const { width } = Dimensions.get('window');

export default function YourEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      
      const [fetchedMy, fetchedShared] = await Promise.all([
        getUserEvents(ownIdentifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
      ]);

      const allEvents = Array.from(
        new Map([...fetchedMy, ...fetchedShared].map((e) => [e.id, e])).values()
      );
      setEvents(allEvents);
    } catch (err) {
      console.error('[YourEvents] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      return;
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderEventCard = (event: DatabaseEvent) => {
    const coverImage = resolveEventCoverImage(event.coverImage);

    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        activeOpacity={0.9}
        onPress={() => router.push(`/events/${event.id}?mode=visitor`)}
      >
        <ExpoImage
          source={{ uri: coverImage }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
      <LinearGradient
        colors={['rgba(2,6,23,0.3)', 'rgba(2,6,23,0.85)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{event.date}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.avatarStack}>
             {/* Placeholder for participant count if available */}
             <IconSymbol name="person.2.fill" size={10} color={MidnightColors.gold} />
             <Text style={styles.participantText}>Memories</Text>
          </View>
          <View style={styles.arrowIcon}>
            <IconSymbol name="chevron.right" size={10} color="#000" />
          </View>
        </View>
      </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MidnightColors.gold} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#101010', '#050505']}
          style={[styles.header, { paddingTop: insets.top + 4 }]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/dashboard');
                }
              }} 
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <IconSymbol name="chevron.left" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={styles.headingLogoRow}>
              <EveBashLogoBadge onPress={() => router.replace('/(tabs)' as any)} />
              <Text style={styles.headerTitle}>Gallery</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => {
                Alert.alert("Filters", "Filter and sorting options coming soon!");
              }}
              style={styles.headerFilterBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M10 5H3"/><Path d="M12 19H3"/><Path d="M14 3v4"/><Path d="M16 17v4"/><Path d="M21 12h-9"/><Path d="M21 19h-5"/><Path d="M21 5h-7"/><Path d="M8 10v4"/><Path d="M8 12H3"/>
              </Svg>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        {/* ── SEARCH ── */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <IconSymbol name="magnifyingglass" size={18} color="#64748b" />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search memories..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* ── HOST CTA BANNER ── */}
        <TouchableOpacity 
          style={styles.heroCard}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/gallery')}
        >
          <LinearGradient
            colors={['rgba(212,175,55,0.95)', 'rgba(184,134,11,1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>FOR HOSTS</Text>
              </View>
              <Text style={styles.heroTitle}>Host Your Own Event</Text>
              <Text style={styles.heroSubtitle}>
                Create a stunning private gallery for any occasion and collect memories.
              </Text>
              <View style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>Create Now</Text>
                <IconSymbol name="plus" size={12} color="#ffffff" />
              </View>
            </View>
            <View style={styles.heroIconContainer}>
              <IconSymbol name="calendar.badge.plus" size={60} color="rgba(255,255,255,0.2)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {loading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={MidnightColors.gold} size="large" />
            <Text style={styles.loadingText}>Fetching your memories...</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <IconSymbol name="photo.on.rectangle.angled" size={48} color={MidnightColors.slate700} />
                </View>
                <Text style={styles.emptyTitle}>No Memories Found</Text>
                <Text style={styles.emptyBody}>
                  {searchQuery 
                    ? `No events matching "${searchQuery}" found in your collection.`
                    : "The events you host or join will appear here as beautiful digital albums."}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity 
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/(tabs)/dashboard')}
                  >
                    <Text style={styles.emptyActionText}>Join an Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.cardsWrapper}>
                {filteredEvents.map(renderEventCard)}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050505' },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60, paddingTop: 0 },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#050505',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
  headerFilterBtn: {
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
    color: '#ffffff',
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
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },

  // Host Banner
  // Hero Banner Styles
  heroCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    color: '#ffffff',
    fontSize: 9,
    fontFamily: Fonts.outfit.extraBold,
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: Fonts.outfit.extraBold,
    marginBottom: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: Fonts.inter.regular,
    marginBottom: 12,
    lineHeight: 16,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#050505',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Fonts.outfit.bold,
  },
  heroIconContainer: {
    marginLeft: 8,
  },

  // Search & Filter
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101010',
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.inter.regular,
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Grid / Layout
  grid: { paddingHorizontal: 20 },
  cardsWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  // Event Card
  eventCard: {
    width: (width - 54) / 2, height: 260,
    borderRadius: 28, overflow: 'hidden',
    backgroundColor: '#101010',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
    marginBottom: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardContent: { flex: 1, padding: 16, justifyContent: 'flex-end' },
  cardHeader: { position: 'absolute', top: 16, left: 16 },
  dateBadge: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateBadgeText: { fontSize: 10, color: '#fff', fontFamily: Fonts.inter.bold, textTransform: 'uppercase' },
  cardTitle: { fontSize: 18, color: '#fff', fontFamily: Fonts.outfit.bold, marginBottom: 12, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantText: { fontSize: 10, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium },
  arrowIcon: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: MidnightColors.gold,
    alignItems: 'center', justifyContent: 'center',
  },

  // States
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  loadingText: { marginTop: 16, color: MidnightColors.slate400, fontSize: 14, fontFamily: Fonts.inter.medium },
  emptyState: { width: '100%', alignItems: 'center', paddingTop: 80 },
  emptyIconContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(212,175,55,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)',
  },
  emptyTitle: { fontSize: 24, color: '#fff', fontFamily: Fonts.outfit.bold },
  emptyBody: { fontSize: 15, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 12, paddingHorizontal: 30, lineHeight: 22 },
  emptyActionBtn: {
    marginTop: 32,
    backgroundColor: MidnightColors.gold,
    paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 16,
  },
  emptyActionText: { color: '#050505', fontFamily: Fonts.outfit.extraBold, fontSize: 16 },
});

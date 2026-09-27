import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getTopRatedBusinesses, toggleShortlistBusiness, Business } from '@/lib/database';
import { Image as ExpoImage } from 'expo-image';

const { width } = Dimensions.get('window');

export default function ShortlistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [vendors, setVendors] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShortlist();
  }, [user?.shortlisted]);

  const fetchShortlist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allBusinesses = await getTopRatedBusinesses(100);
      const shortlisted = allBusinesses.filter(b => user.shortlisted?.includes(b.id));
      setVendors(shortlisted);
    } catch (error) {
      console.error("Error fetching shortlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (vendorId: string) => {
    if (!user?.uid) return;
    try {
      await toggleShortlistBusiness(user.uid, vendorId);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={['#1B211F', '#13191F']}
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
          <Text style={styles.headerTitle}>My Shortlist</Text>
          <Text style={styles.tagline}>
            {loading ? 'Updating list...' : `${vendors.length} Saved Vendors ✨`}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </LinearGradient>

      <View style={{ flex: 1 }}>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#818cf8" />
          </View>
        ) : vendors.length === 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContentEmpty}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <IconSymbol name="heart.fill" size={40} color="#818cf8" />
              </View>
              <Text style={styles.emptyTitle}>Your shortlist is empty</Text>
              <Text style={styles.emptySubtitle}>
                Save your favorite photographers, venues, and vendors to view them here later.
              </Text>
              <TouchableOpacity 
                style={styles.exploreBtn}
                onPress={() => router.push('/(tabs)/explore-business')}
              >
                <Text style={styles.exploreBtnText}>Explore EB Network</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContentList}>
            <View style={styles.listContainer}>
              {vendors.map((vendor) => (
                <TouchableOpacity 
                  key={vendor.id} 
                  style={styles.listCard} 
                  activeOpacity={0.9}
                  onPress={() => router.push(`/business/${vendor.id}`)}
                >
                  <View style={styles.listImageContainer}>
                    {/* Ambient Blurred Backdrop */}
                    <ExpoImage 
                      source={{ uri: vendor.coverImage }} 
                      style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} 
                      contentFit="cover"
                      blurRadius={15}
                    />
                    {/* Sharp Contain Foreground */}
                    <ExpoImage 
                      source={{ uri: vendor.coverImage }} 
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
                          handleRemove(vendor.id);
                        }}
                      >
                        <IconSymbol name="heart.fill" size={12} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <View style={[styles.listCategoryBadge, styles.indigoBadgeChip, { marginBottom: 0 }]}>
                        <Text style={styles.listCategoryText}>{vendor.type}</Text>
                      </View>
                      {vendor.rating >= 4.0 && (
                        <IconSymbol name="checkmark.seal.fill" size={12} color="#3b82f6" />
                      )}
                    </View>

                    <View style={styles.listMetaRow}>
                      <View style={styles.listMetaItem}>
                        <IconSymbol name="mappin.fill" size={9} color="#64748b" />
                        <Text style={styles.listMetaText} numberOfLines={1}>
                          {vendor.location?.address || 'Local'}
                        </Text>
                      </View>
                      <View style={styles.listMetaItem}>
                        <IconSymbol name="clock.fill" size={9} color="#CA9C68" />
                        <Text style={styles.listMetaText}>
                          {(vendor.experience !== undefined && vendor.experience !== null && String(vendor.experience) !== '')
                            ? `${vendor.experience}+ Yrs`
                            : (vendor.startedDate
                              ? `Est. ${new Date(vendor.startedDate?.seconds ? vendor.startedDate.seconds * 1000 : vendor.startedDate).getFullYear()}`
                              : 'Established')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.listFooterRow}>
                      <View style={styles.listRatingBadge}>
                        <IconSymbol name="star.fill" size={9} color="#CA9C68" />
                        <Text style={styles.listRatingText}>{vendor.rating || '5.0'}</Text>
                      </View>
                      <View style={styles.listActionBtn}>
                        <Text style={styles.listActionBtnText}>View Portfolio</Text>
                        <IconSymbol name="chevron.right" size={9} color="#818cf8" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13191F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#13191F',
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
  headerTitle: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'AkayaKanadaka_400Regular',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: '#CDB89E',
    fontFamily: 'AkayaKanadaka_400Regular',
    textAlign: 'center',
    marginTop: -18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollContentList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
  },
  emptyTitle: {
    fontSize: 22,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#CDB89E',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  exploreBtn: {
    backgroundColor: '#818cf8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  listContainer: {
    marginTop: 16,
    gap: 16,
  },
  listCard: {
    backgroundColor: '#1B211F',
    borderRadius: 16,
    marginHorizontal: 0,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.15)',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  listImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#13191F',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: 'rgba(129, 140, 248, 0.15)',
  },
  listInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  listNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  listName: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  listHeartBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  listCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  indigoBadgeChip: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  listCategoryText: {
    color: '#818cf8',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  listMetaText: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  listFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 6,
  },
  listRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listRatingText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  listActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listActionBtnText: {
    color: '#818cf8',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
});

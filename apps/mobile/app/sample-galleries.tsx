import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors, Fonts } from '../constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { Event, getSampleGalleryEvents } from '@/lib/database';

export default function SampleGalleriesScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const [albums, setAlbums] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getSampleGalleryEvents().then((events) => {
      if (!mounted) return;
      setAlbums(events);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.safeArea}>
      <Stack.Screen options={{ 
        headerShown: true,
        headerTransparent: true,
        headerTitle: '',
        headerTintColor: colors.white,
        headerStyle: { backgroundColor: colors.background },
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
            }}
            style={styles.backBtn}
            hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
          >
            <IconSymbol name="chevron.left" size={28} color={colors.gold} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Masterpieces</Text>
          <Text style={styles.heroSub}>Explore our curated collection of professional galleries.</Text>
        </View>

        <View style={styles.grid}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.emptyText}>Loading sample galleries...</Text>
            </View>
          ) : albums.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No samples yet</Text>
              <Text style={styles.emptyText}>Sample galleries will appear here once selected by the admin.</Text>
            </View>
          ) : albums.map((album) => (
            <TouchableOpacity 
              key={album.id} 
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/events/${album.id}`)}
            >
              <Image source={{ uri: album.coverImage }} style={styles.cardImage} />
              <LinearGradient
                colors={['transparent', 'rgba(2, 6, 23, 0.9)']}
                style={styles.cardGradient}
              />
              <View style={styles.cardContent}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{album.category || 'Event'}</Text>
                </View>
                <Text style={styles.cardTitle}>{album.title}</Text>
                <Text style={styles.cardYear}>{album.date}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MidnightColors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, color: colors.white, fontFamily: Fonts.outfit.bold },

  hero: { padding: 24, paddingBottom: 10 },
  heroTitle: { fontSize: 32, color: colors.white, fontFamily: Fonts.outfit.extraBold, letterSpacing: 0 },
  heroSub: { fontSize: 14, color: colors.slate400, fontFamily: Fonts.inter.regular, marginTop: 6 },

  grid: { padding: 20 },
  card: {
    width: '100%', height: 240,
    borderRadius: 28, overflow: 'hidden',
    backgroundColor: colors.deepSlate,
    borderWidth: 1, borderColor: colors.cardBorder,
    marginBottom: 20,
  },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  cardContent: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  categoryText: { fontSize: 10, color: colors.gold, fontFamily: Fonts.inter.bold, textTransform: 'uppercase' },
  cardTitle: { fontSize: 20, color: '#fff', fontFamily: Fonts.outfit.bold },
  cardYear: { fontSize: 12, color: colors.slate400, fontFamily: Fonts.inter.medium, marginTop: 2 },
  emptyState: {
    minHeight: 180,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { fontSize: 18, color: colors.white, fontFamily: Fonts.outfit.bold },
  emptyText: { marginTop: 8, fontSize: 13, color: colors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center' },
});

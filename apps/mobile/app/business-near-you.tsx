import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';

const ALL_BUSINESSES = [
  { id: '1', name: 'Elite Photography', type: 'Studio', img: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=400&auto=format&fit=crop', rating: 4.9, reviews: 128, price: '$$$' },
  { id: '2', name: 'Royal Caterers', type: 'Food', img: 'https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=400&auto=format&fit=crop', rating: 4.7, reviews: 95, price: '$$' },
  { id: '3', name: 'Magic Decor', type: 'Decor', img: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=400&auto=format&fit=crop', rating: 4.8, reviews: 210, price: '$$$' },
  { id: '4', name: 'Luxe Venues', type: 'Venue', img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=400&auto=format&fit=crop', rating: 5.0, reviews: 54, price: '$$$$' },
  { id: '5', name: 'Starlight Music', type: 'DJ', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop', rating: 4.6, reviews: 82, price: '$$' },
  { id: '6', name: 'Petal & Stem', type: 'Florist', img: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?q=80&w=400&auto=format&fit=crop', rating: 4.9, reviews: 115, price: '$$' },
];

export default function BusinessNearYouScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredBiz = ALL_BUSINESSES.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: true, 
        headerTransparent: true,
        headerTitle: '',
        headerTintColor: '#1B211F',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
            }}
            style={styles.backButton}
            hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#1B211F" />
          </TouchableOpacity>
        ),
      }} />

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <IconSymbol name="magnifyingglass" size={18} color="#CDB89E" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search photographers, caterers..."
            placeholderTextColor="#CDB89E"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bizGrid}>
          {filteredBiz.map((biz) => (
            <TouchableOpacity key={biz.id} style={styles.bizCard}>
              <ExpoImage source={{ uri: biz.img }} style={styles.bizImage} contentFit="cover" />
              <View style={styles.bizInfo}>
                <View style={styles.bizHeaderRow}>
                  <Text style={styles.bizName}>{biz.name}</Text>
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>{biz.price}</Text>
                  </View>
                </View>
                
                <View style={styles.bizMetaRow}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{biz.type}</Text>
                  </View>
                  <View style={styles.ratingBox}>
                    <IconSymbol name="star.fill" size={12} color="#f59e0b" />
                    <Text style={styles.ratingText}>{biz.rating}</Text>
                    <Text style={styles.reviewText}>({biz.reviews})</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF7EB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B211F' },
  searchContainer: { padding: 16, paddingTop: 80, backgroundColor: '#ffffff' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#2B2F2E' },
  container: { flex: 1 },
  content: { padding: 16 },
  bizGrid: { gap: 16 },
  bizCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  bizImage: { width: '100%', height: 180 },
  bizInfo: { padding: 16 },
  bizHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bizName: { fontSize: 18, fontWeight: 'bold', color: '#2B2F2E' },
  priceBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priceText: { color: '#16a34a', fontSize: 12, fontWeight: 'bold' },
  bizMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { backgroundColor: '#FFF7EB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  typeText: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#2B2F2E' },
  reviewText: { fontSize: 12, color: '#CDB89E' },
});

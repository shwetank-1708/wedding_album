import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { EveBashLogoBadge } from '@/components/EveBashLogo';
import { useAppTheme } from '@/context/ThemeContext';
import { MidnightColors } from '@/constants/theme';

const packages = [
  {
    id: "tier_1gb",
    name: "Free Plan",
    capacity: "1 GB",
    photos: "~200 photos",
    prices: {
      monthly: { price: "₹0", period: "forever", save: null },
      quarterly: { price: "₹0", period: "/ 3 mo", save: null },
      semiannual: { price: "₹0", period: "/ 6 mo", save: null },
      yearly: { price: "₹0", period: "/ yr", save: null },
    },
    features: [
      "1 Active Event",
      "1 GB Cloud Storage",
      "Image Upload",
      "Video Upload up to 200 MB",
      "1 Standard Template Only",
      "Guest Sharing via Link",
      "Basic Gallery View",
      "Standard Support",
    ],
    cta: "Select Free",
    accentColor: "rgba(148, 163, 184, 0.2)",
    checkColor: "#94a3b8",
  },
  {
    id: "tier_10gb",
    name: "Starter",
    capacity: "10 GB",
    photos: "~2,000 photos",
    prices: {
      monthly: { price: "₹150", period: "/ month", save: null },
      quarterly: { price: "₹400", period: "/ 3 mo", save: null },
      semiannual: { price: "₹700", period: "/ 6 mo", save: null },
      yearly: { price: "₹1,000", period: "/ yr", save: null },
    },
    features: [
      "10 Active Events",
      "10 GB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Standard Support",
    ],
    cta: "Select Starter",
    accentColor: "rgba(20, 184, 166, 0.2)",
    checkColor: "#14b8a6",
  },
  {
    id: "tier_25gb",
    name: "Basic",
    capacity: "25 GB",
    photos: "~5,000 photos",
    prices: {
      monthly: { price: "₹300", period: "/ month", save: null },
      quarterly: { price: "₹800", period: "/ 3 mo", save: null },
      semiannual: { price: "₹1,400", period: "/ 6 mo", save: null },
      yearly: { price: "₹2,000", period: "/ yr", save: null },
    },
    features: [
      "25 Active Events",
      "25 GB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Guest Approval System",
      "Face Recognition Search",
      "Standard Support",
      "Optimized Image Delivery (JPG)",
    ],
    cta: "Select Growth",
    accentColor: "rgba(20, 184, 166, 0.2)",
    checkColor: "#14b8a6",
  },
  {
    id: "tier_50gb",
    name: "Standard",
    capacity: "50 GB",
    photos: "~10,000 photos",
    prices: {
      monthly: { price: "₹450", period: "/ month", save: null },
      quarterly: { price: "₹1,200", period: "/ 3 mo", save: null },
      semiannual: { price: "₹2,100", period: "/ 6 mo", save: null },
      yearly: { price: "₹3,000", period: "/ yr", save: null },
    },
    features: [
      "50 Active Events",
      "50 GB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Guest Approval + Traffic Logs",
      "Face Recognition Search",
      "Standard Support",
      "Optimized Image Delivery (JPG)",
    ],
    cta: "Select Rise",
    accentColor: "rgba(14, 165, 233, 0.2)",
    checkColor: "#0ea5e9",
  },
  {
    id: "tier_100gb",
    name: "Premium",
    capacity: "100 GB",
    photos: "~20,000 photos",
    prices: {
      monthly: { price: "₹750", period: "/ month", save: null },
      quarterly: { price: "₹2,000", period: "/ 3 mo", save: null },
      semiannual: { price: "₹3,500", period: "/ 6 mo", save: null },
      yearly: { price: "₹5,000", period: "/ yr", save: null },
    },
    isPopular: true,
    features: [
      "100 Active Events",
      "100 GB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Guest Approval + Traffic Logs",
      "Face Recognition Search",
      "Custom Subdomain Support",
      "Priority Support & Faster CDN",
    ],
    cta: "Select Scale",
    accentColor: "#d4af37",
    checkColor: "#d4af37",
  },
  {
    id: "tier_200gb",
    name: "Pro",
    capacity: "200 GB",
    photos: "~40,000 photos",
    prices: {
      monthly: { price: "₹1,200", period: "/ month", save: null },
      quarterly: { price: "₹3,200", period: "/ 3 mo", save: null },
      semiannual: { price: "₹5,600", period: "/ 6 mo", save: null },
      yearly: { price: "₹8,000", period: "/ yr", save: null },
    },
    features: [
      "200 Active Events",
      "200 GB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Face Recognition Search",
      "Custom Subdomain Support",
      "Dedicated Support Manager",
      "RAW + JPG Download Options",
      "Delegate 5 Team Members",
    ],
    cta: "Select Pro",
    accentColor: "rgba(139, 92, 246, 0.3)",
    checkColor: "#8b5cf6",
  },
  {
    id: "tier_500gb",
    name: "Elite",
    capacity: "500 GB",
    photos: "~100,000 photos",
    prices: {
      monthly: { price: "₹2,200", period: "/ month", save: null },
      quarterly: { price: "₹6,000", period: "/ 3 mo", save: null },
      semiannual: { price: "₹10,500", period: "/ 6 mo", save: null },
      yearly: { price: "₹15,000", period: "/ yr", save: null },
    },
    features: [
      "500 Active Events",
      "500 GB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Face Recognition Search",
      "Custom Subdomain Support",
      "Dedicated Account Manager",
      "RAW + JPG Download Options",
      "Unlimited Team Members",
      "White-Label Branding & API Access",
    ],
    cta: "Select Elite",
    accentColor: "rgba(236, 72, 153, 0.3)",
    checkColor: "#ec4899",
  },
  {
    id: "tier_1tb",
    name: "Ultimate",
    capacity: "1 TB",
    photos: "~200,000 photos",
    prices: {
      monthly: { price: "₹3,750", period: "/ month", save: null },
      quarterly: { price: "₹10,000", period: "/ 3 mo", save: null },
      semiannual: { price: "₹17,500", period: "/ 6 mo", save: null },
      yearly: { price: "₹25,000", period: "/ yr", save: null },
    },
    features: [
      "1000 Active Events",
      "1 TB Cloud Storage",
      "Image Upload",
      "Video Upload",
      "All Premium Templates",
      "Authorized Guest Sign-In",
      "Face Recognition Search",
      "Custom Subdomain Support",
      "Dedicated Account Manager",
      "RAW + JPG Download Options",
      "Unlimited Team Members",
      "White-Label Branding & API Access",
    ],
    cta: "Select Ultimate",
    accentColor: "rgba(249, 115, 22, 0.3)",
    checkColor: "#f97316",
  },
];

export default function PricingScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'semiannual' | 'yearly'>('monthly');
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(4); // Default to 100 GB (index 4)

  const activePackage = packages[selectedTierIndex];
  const activePlanData = activePackage.prices[billingCycle];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Navigation Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/dashboard');
            }
          }} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.gold} />
        </TouchableOpacity>
        <View style={styles.headingLogoRow}>
          <EveBashLogoBadge onPress={() => router.replace('/(tabs)' as any)} />
          <Text style={styles.headerTitle}>Upgrade Plan</Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Simple, Transparent Pricing</Text>
          <Text style={styles.subtitle}>Find the exact storage tier that fits your story.</Text>
        </View>

        {/* Dynamic Billing Filter Selector */}
        <View style={styles.filterContainer}>
          {[
            { id: 'monthly', label: '1 Month' },
            { id: 'quarterly', label: '3 Months' },
            { id: 'semiannual', label: '6 Months' },
            { id: 'yearly', label: 'Yearly' },
          ].map((tab) => {
            const isActive = billingCycle === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setBillingCycle(tab.id as any)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dynamic Storage Tier Selection Pills */}
        <Text style={styles.sectionLabel}>Select Storage Tier</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.pillsScrollContainer}
          style={styles.pillsScroll}
        >
          {packages.map((pkg, idx) => {
            const isSelected = selectedTierIndex === idx;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.tierPill,
                  isSelected && styles.tierPillActive,
                  pkg.isPopular && !isSelected && styles.tierPillPopularBorder
                ]}
                onPress={() => setSelectedTierIndex(idx)}
                activeOpacity={0.85}
              >
                {pkg.isPopular && (
                  <View style={styles.popularBadgeMini}>
                    <Text style={styles.popularBadgeMiniText}>POPULAR</Text>
                  </View>
                )}
                <Text style={[styles.tierPillTitle, isSelected && styles.tierPillTitleActive]}>
                  {pkg.capacity}
                </Text>
                <Text style={styles.tierPillSubtitle}>
                  {pkg.photos.split(" ")[0] + " " + pkg.photos.split(" ")[1]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Detail Plan Dynamic Card */}
        <View 
          style={[
            styles.detailCard, 
            activePackage.isPopular && styles.cardPopularBorder,
          ]}
        >
          {activePackage.isPopular && (
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.25)', 'rgba(212, 175, 55, 0.02)']}
              style={StyleSheet.absoluteFill}
            />
          )}

          <View style={styles.planHeaderRow}>
            <View>
              <Text style={styles.planName}>{activePackage.name}</Text>
              <Text style={styles.planCapacityLabel}>
                {activePackage.capacity} cloud space ({activePackage.photos})
              </Text>
            </View>
            {activePlanData.save && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>{activePlanData.save}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceRow}>
            <Text style={styles.planPrice}>{activePlanData.price}</Text>
            <Text style={styles.planPeriod}>{activePlanData.period}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            {activePackage.features.map((feature, fIndex) => (
              <View key={fIndex} style={styles.featureRow}>
                <View style={[styles.iconBox, { backgroundColor: `${activePackage.checkColor}20` }]}>
                  <IconSymbol 
                    name="checkmark" 
                    size={12} 
                    color={activePackage.checkColor} 
                  />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={[
              styles.ctaButton, 
              { backgroundColor: activePackage.isPopular ? '#d4af37' : '#1e293b' }
            ]}
            onPress={() => {
              router.push('/contact');
            }}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.ctaText, 
              activePackage.isPopular && { color: '#050505', fontFamily: 'Outfit_800ExtraBold' }
            ]}>{activePackage.cta}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <IconSymbol name="info.circle" size={18} color={colors.slate400} />
          <Text style={styles.footerText}>
            Fair Usage Policy: Bandwidth usage beyond fair limits may incur additional charges. Extra Storage: ₹5/GB • Extra Bandwidth: ₹7–₹10/GB.
          </Text>
        </View>

        <View style={styles.customPlanCard}>
          <Text style={styles.customPlanTitle}>Need a custom plan?</Text>
          <Text style={styles.customPlanDesc}>
            {`Running a large studio or enterprise operation? Let's build a plan tailored to your exact needs.`}
          </Text>
          <TouchableOpacity onPress={() => router.push('/contact')} activeOpacity={0.7}>
            <Text style={styles.customPlanLink}>Contact Us for Custom Quote →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.06)',
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 38,
    fontFamily: 'Inter_700Bold',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 2,
    includeFontPadding: false,
  },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.deepSlate,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  filterTabActive: {
    backgroundColor: '#d4af37',
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.slate400,
  },
  filterTabTextActive: {
    color: '#050505',
    fontFamily: 'Outfit_800ExtraBold',
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pillsScroll: {
    marginBottom: 24,
  },
  pillsScrollContainer: {
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  tierPill: {
    width: 90,
    height: 75,
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tierPillActive: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  tierPillPopularBorder: {
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  popularBadgeMini: {
    position: 'absolute',
    top: -6,
    backgroundColor: '#d4af37',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  popularBadgeMiniText: {
    fontSize: 8,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#050505',
  },
  tierPillTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.ghostWhite,
  },
  tierPillTitleActive: {
    color: '#d4af37',
  },
  tierPillSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    padding: 24,
  },
  cardPopularBorder: {
    borderColor: '#d4af37',
    borderWidth: 1.5,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planName: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.white,
  },
  planCapacityLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
    marginTop: 2,
  },
  saveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  saveBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  planPrice: {
    fontSize: 42,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.white,
  },
  planPeriod: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.1)',
    marginBottom: 20,
  },
  featuresList: {
    gap: 14,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.ghostWhite,
    flex: 1,
  },
  ctaButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.deepSlate,
    padding: 16,
    borderRadius: 16,
    marginTop: 32,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    marginLeft: 12,
    lineHeight: 18,
  },
  customPlanCard: {
    backgroundColor: colors.deepSlate,
    padding: 24,
    borderRadius: 20,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  customPlanTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
    marginBottom: 8,
  },
  customPlanDesc: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  customPlanLink: {
    color: '#d4af37',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
});

import React from 'react';
import {
  Dimensions,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { EveBashLogoBadge } from '@/components/EveBashLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/context/ThemeContext';
import { Fonts, MidnightColors } from '@/constants/theme';

const { height } = Dimensions.get('window');

const HERO_IMAGE = 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1400&auto=format&fit=crop';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.36)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.heroContent}>
            <View style={styles.brandRow}>
              <EveBashLogoBadge size={42} logoSize={26} />
              <Text style={styles.brandName}>EveBash</Text>
            </View>

            <View style={styles.heroChip}>
              <IconSymbol name="sparkles.fill" size={14} color={colors.gold} />
              <Text style={styles.heroChipText}>Premium Wedding Photography</Text>
            </View>

            <Text style={styles.heroTitle}>
              Capturing <Text style={styles.heroTitleAccent}>Timeless</Text> Moments
            </Text>
            <Text style={styles.heroSubtitle}>
              Where every frame tells a story of elegance, and every moment becomes a masterpiece.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.primaryButton}
                onPress={() => router.push('/sample-galleries')}
              >
                <IconSymbol name="camera" size={18} color="#0f172a" />
                <Text style={styles.primaryButtonText}>View Portfolio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.secondaryButton}
                onPress={() => router.push('/contact')}
              >
                <Text style={styles.secondaryButtonText}>Book a Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.aboutSection}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.aboutImage} contentFit="cover" />

          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kickerText}>About The Artist</Text>
          </View>

          <Text style={styles.aboutTitle}>
            Preserving Your <Text style={styles.aboutTitleAccent}>Legacy</Text>
          </Text>
          <Text style={styles.aboutText}>
            With over a decade of experience in capturing the grandest celebrations, EveBash turns wedding memories into elegant, lasting stories.
          </Text>
          <Text style={styles.aboutText}>
            Our royal aesthetic blends warm storytelling with modern fine-art precision, so every celebration feels personal, polished, and timeless.
          </Text>

          <TouchableOpacity
            activeOpacity={0.84}
            style={styles.aboutButton}
            onPress={() => router.push('/contact')}
          >
            <Text style={styles.aboutButtonText}>Discover Our Journey</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerSection}>
            <View style={styles.footerBrandRow}>
              <EveBashLogoBadge size={34} logoSize={21} />
              <Text style={styles.footerBrandName}>EveBash</Text>
            </View>
            <Text style={styles.footerDescription}>
              Capturing the most precious moments of your life with elegance and style. We believe every picture tells a story, and we are here to tell yours.
            </Text>
            <View style={styles.socialRow}>
              <Text style={styles.socialIcon}>Instagram</Text>
              <Text style={styles.socialIcon}>Facebook</Text>
              <Text style={styles.socialIcon}>Twitter</Text>
            </View>
          </View>

          <View style={styles.footerSection}>
            <Text style={styles.footerHeading}>Explore</Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>About Us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/sample-galleries')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Sample Galleries</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/pricing')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Pricing</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/contact')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Contact Us</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerSection}>
            <Text style={styles.footerHeading}>Legal</Text>
            <TouchableOpacity onPress={() => router.push('/privacy-policy')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/terms-and-conditions')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Terms & Conditions</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/cancellation-refund-policy')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Cancellation & Refund</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/shipping-delivery-policy')} activeOpacity={0.75} style={styles.footerLink}>
              <Text style={styles.footerBullet}>•</Text>
              <Text style={styles.footerLinkText}>Shipping & Delivery</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerSection}>
            <Text style={styles.footerHeading}>Contact Us</Text>
            <View style={styles.contactRow}>
              <IconSymbol name="mappin.fill" size={17} color="#38bdf8" />
              <Text style={styles.contactText}>Dehradun, Uttarakhand, India - 248001</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL('tel:+919871264964')} activeOpacity={0.75} style={styles.contactRow}>
              <IconSymbol name="phone.fill" size={17} color="#38bdf8" />
              <Text style={styles.contactText}>+91 98712 64964</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('tel:+918535029872')} activeOpacity={0.75} style={styles.contactRow}>
              <IconSymbol name="phone.fill" size={17} color="#38bdf8" />
              <Text style={styles.contactText}>+91 85350 29872</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:support@evebash.com')} activeOpacity={0.75} style={styles.contactRow}>
              <IconSymbol name="envelope.fill" size={17} color="#38bdf8" />
              <Text style={styles.contactText}>support@evebash.com</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerDivider} />
          <Text style={styles.footerCopyright}>
            © 2026 EveBash. All rights reserved.
          </Text>
          <Text style={styles.footerCredit}>
            Designed with <Text style={styles.footerHeart}>♥</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 92,
  },
  hero: {
    minHeight: Math.max(620, height * 0.86),
    justifyContent: 'flex-end',
    backgroundColor: colors.background,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.92,
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 54,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 34,
  },
  brandName: {
    color: MidnightColors.white,
    fontFamily: 'AkayaKanadaka_400Regular',
    fontSize: 34,
    lineHeight: 42,
    includeFontPadding: false,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 24,
  },
  heroChipText: {
    color: MidnightColors.white,
    fontFamily: Fonts.outfit.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: MidnightColors.white,
    fontFamily: Fonts.playfair.bold,
    fontSize: 47,
    lineHeight: 54,
    textAlign: 'center',
    letterSpacing: 0,
    marginBottom: 18,
  },
  heroTitleAccent: {
    color: colors.gold,
    fontFamily: Fonts.playfair.bold,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: Fonts.outfit.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 330,
    marginBottom: 30,
  },
  heroActions: {
    width: '100%',
    gap: 13,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: MidnightColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontFamily: Fonts.outfit.extraBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: MidnightColors.white,
    fontFamily: Fonts.outfit.extraBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  aboutSection: {
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 36,
    backgroundColor: colors.background,
  },
  aboutImage: {
    width: '100%',
    aspectRatio: 0.82,
    borderRadius: 28,
    marginBottom: 34,
    borderWidth: 6,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.76)',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  kickerLine: {
    width: 42,
    height: 1,
    backgroundColor: colors.gold,
  },
  kickerText: {
    color: colors.gold,
    fontFamily: Fonts.outfit.extraBold,
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  aboutTitle: {
    color: colors.white,
    fontFamily: Fonts.playfair.bold,
    fontSize: 38,
    lineHeight: 45,
    letterSpacing: 0,
    marginBottom: 18,
  },
  aboutTitleAccent: {
    color: colors.gold,
    fontFamily: Fonts.playfair.bold,
  },
  aboutText: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 14,
  },
  aboutButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(212,175,55,0.45)',
    paddingBottom: 6,
  },
  aboutButtonText: {
    color: colors.white,
    fontFamily: Fonts.outfit.extraBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 42,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.14)',
    backgroundColor: colors.background,
  },
  footerSection: {
    marginBottom: 34,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  footerBrandName: {
    color: colors.white,
    fontFamily: Fonts.playfair.bold,
    fontSize: 24,
    lineHeight: 34,
    includeFontPadding: false,
  },
  footerDescription: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 15,
    lineHeight: 25,
    maxWidth: 310,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 24,
  },
  socialIcon: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.semiBold,
    fontSize: 12,
  },
  footerHeading: {
    color: colors.white,
    fontFamily: Fonts.playfair.bold,
    fontSize: 19,
    marginBottom: 18,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
  },
  footerBullet: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.bold,
    fontSize: 18,
    marginRight: 9,
  },
  footerLinkText: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 15,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  contactText: {
    flex: 1,
    color: colors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  footerDivider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
    marginTop: 6,
    marginBottom: 28,
  },
  footerCopyright: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 12,
    marginBottom: 12,
  },
  footerCredit: {
    color: colors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 12,
  },
  footerHeart: {
    color: '#fb7185',
  },
});

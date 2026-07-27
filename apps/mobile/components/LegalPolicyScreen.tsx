import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, MidnightColors } from '@/constants/theme';

type PolicySection = {
  title: string;
  paragraphs: string[];
};

type LegalPolicyScreenProps = {
  title: string;
  description: string;
  sections: PolicySection[];
};

export function LegalPolicyScreen({ title, description, sections }: LegalPolicyScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: MidnightColors.white,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))}
              style={styles.backButton}
              hitSlop={12}
            >
              <IconSymbol name="chevron.left" size={26} color={MidnightColors.white} />
            </TouchableOpacity>
          ),
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>EveBash Policy</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.updated}>Last updated: July 25, 2026</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View style={styles.article}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}

          <View style={styles.supportBox}>
            <Text style={styles.supportText}>
              For questions about these policies, contact us at{' '}
              <Text style={styles.supportEmail}>support@evebash.com</Text>.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: MidnightColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: MidnightColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 110,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    marginBottom: 22,
  },
  eyebrow: {
    color: '#38bdf8',
    fontFamily: Fonts.outfit.extraBold,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    color: MidnightColors.white,
    fontFamily: Fonts.playfair.bold,
    fontSize: 38,
    lineHeight: 45,
    letterSpacing: 0,
  },
  updated: {
    color: MidnightColors.slate400,
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    marginTop: 10,
  },
  description: {
    color: '#cbd5e1',
    fontFamily: Fonts.outfit.regular,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 20,
  },
  article: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: MidnightColors.deepSlate,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18,
  },
  section: {
    paddingTop: 22,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    color: MidnightColors.white,
    fontFamily: Fonts.playfair.bold,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 10,
  },
  paragraph: {
    color: '#b6c4d6',
    fontFamily: Fonts.outfit.regular,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 7,
  },
  supportBox: {
    marginTop: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  supportText: {
    color: '#b6c4d6',
    fontFamily: Fonts.outfit.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  supportEmail: {
    color: '#38bdf8',
    fontFamily: Fonts.outfit.bold,
  },
});

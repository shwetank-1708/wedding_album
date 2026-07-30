import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, LogBox, Platform, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LoadingScreen from '@/components/LoadingScreen';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import * as SplashScreen from 'expo-splash-screen';
import { initUploadQueue } from '@/lib/uploadQueue';
import { registerDeviceForPushNotifications } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { 
  useFonts, 
  Outfit_400Regular, 
  Outfit_600SemiBold, 
  Outfit_700Bold, 
  Outfit_800ExtraBold 
} from '@expo-google-fonts/outfit';
import { 
  Inter_400Regular, 
  Inter_500Medium, 
  Inter_600SemiBold, 
  Inter_700Bold 
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold
} from '@expo-google-fonts/playfair-display';
import {
  VT323_400Regular
} from '@expo-google-fonts/vt323';
import {
  TiltNeon_400Regular
} from '@expo-google-fonts/tilt-neon';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_600SemiBold,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import {
  Syne_700Bold
} from '@expo-google-fonts/syne';
import {
  CinzelDecorative_400Regular,
  CinzelDecorative_700Bold
} from '@expo-google-fonts/cinzel-decorative';
import {
  Cinzel_400Regular,
  Cinzel_700Bold
} from '@expo-google-fonts/cinzel';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

const IS_STAGING_BUILD = process.env.EXPO_PUBLIC_API_BASE_URL?.includes('api-staging.evebash.com') ?? false;

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
  'AuthRetryableFetchError',
  'network_request_failed',
  'Could not reach Supabase backend',
  'Backend didn\'t respond within 10 seconds',
  'backTitle prop is not available on Android',
  'backTitleFontFamily prop is not available on Android',
  'backTitleVisible prop is not available on Android',
  'disableBackButtonMenu prop is not available on Android',
  'largeTitleFontFamily prop is not available on Android',
  'largeTitleFontWeight prop is not available on Android',
  'largeTitleHideShadow prop is not available on Android',
  'topInsetEnabled prop is not available on Android',
  'userInterfaceStyle prop is not available on Android',
]);

export const unstable_settings = {
  // Ensure any route can link back to `/`
  initialRouteName: 'dashboard',
};

// Auth gate: redirects unauthenticated users to /login
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (loading || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === 'login';
    const root = segments[0] as string | undefined;
    const tab = segments[1] as string | undefined;
    
    // Improved public route check
    const isPublicRoute =
      root === undefined ||
      root === 'login' ||
      (root === '(tabs)' && (tab === undefined || tab === 'gallery' || tab === 'menu' || tab === 'business')) ||
      root === 'business' ||
      root === 'profile' ||
      root === 'pricing' ||
      root === 'contact' ||
      root === 'sample-galleries' ||
      root === 'events';

    if (!user && !inAuthGroup && !isPublicRoute) {
      const timeoutId = setTimeout(() => router.replace('/login'), 1);
      return () => clearTimeout(timeoutId);
    } else if (user && inAuthGroup) {
      const timeoutId = setTimeout(() => router.replace('/(tabs)/dashboard'), 1);
      return () => clearTimeout(timeoutId);
    }
  }, [user, loading, segments, rootNavigationState?.key, router]);

  // Register push notifications when user is signed in
  useEffect(() => {
    if (user?.uid) {
      registerDeviceForPushNotifications(user.uid);
    }
  }, [user?.uid]);

  // Handle notification taps — route user to the right screen
  useEffect(() => {
    // Handle tap when app is already open
    const tapSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.roomId) {
        router.push(`/chat/${data.roomId}` as any);
      } else if (data?.eventId) {
        router.push(`/events/${data.eventId}` as any);
      } else if (data?.enquiryId) {
        router.push(`/enquiries` as any);
      }
    });

    // Handle tap when app was closed / in background
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.roomId) {
        router.push(`/chat/${data.roomId}` as any);
      } else if (data?.eventId) {
        router.push(`/events/${data.eventId}` as any);
      } else if (data?.enquiryId) {
        router.push(`/enquiries` as any);
      }
    });

    return () => tapSubscription.remove();
  }, [router]);

  if (loading || !rootNavigationState?.key) {
    return <LoadingScreen message="Loading your account" />;
  }

  return <>{children}</>;
}

function RootLayoutContent() {
  const { isDark, colors } = useAppTheme();

  useEffect(() => {
    initUploadQueue().catch(err => console.error('[RootLayout] Queue init failed:', err));
  }, []);

  const customTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.gold,
      background: colors.background,
      card: colors.deepSlate,
      text: colors.white,
      border: colors.cardBorder,
    }
  };

  return (
    <ThemeProvider value={customTheme}>
      <AuthGate>
        <Stack screenOptions={{
          ...(Platform.OS === 'ios' ? { headerBackTitle: '' } : {}),
          headerTintColor: colors.white,
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTransparent: true,
        }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack>
      </AuthGate>
      <StatusBar style={isDark ? "light" : "dark"} />
      {IS_STAGING_BUILD && (
        <View pointerEvents="none" style={styles.stagingBadge}>
          <Text style={styles.stagingBadgeText}>STAGING</Text>
        </View>
      )}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    VT323_400Regular,
    TiltNeon_400Regular,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Lora_700Bold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    Syne_700Bold,
    CinzelDecorative_400Regular,
    CinzelDecorative_700Bold,
    Cinzel_400Regular,
    Cinzel_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    'AkayaKanadaka_400Regular': require('../assets/fonts/AkayaKanadaka-Regular.ttf'),
    'Monofett_400Regular': require('../assets/fonts/Monofett-Regular.ttf'),
    'BubblegumSans_400Regular': require('../assets/fonts/BubblegumSans-Regular.ttf'),
    'PermanentMarker_400Regular': require('../assets/fonts/PermanentMarker-Regular.ttf'),
    'Yellowtail_400Regular': require('../assets/fonts/Yellowtail-Regular.ttf'),
    'AlexBrush_400Regular': require('../assets/fonts/AlexBrush-Regular.ttf'),
    'Cookie_400Regular': require('../assets/fonts/Cookie-Regular.ttf'),
    'GrandHotel_400Regular': require('../assets/fonts/GrandHotel-Regular.ttf'),
  });

  console.log('--- Font Diagnostics ---');
  console.log('fontsLoaded:', fontsLoaded);
  console.log('fontError:', fontError);
  console.log('------------------------');

  const [minLoadingDone, setMinLoadingDone] = useState(false);

  // Guarantee at least 3 seconds of loading screen on app open
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadingDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const isReady = (fontsLoaded || !!fontError) && minLoadingDone;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return <LoadingScreen message="Starting up" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider>
          <RootLayoutContent />
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  stagingBadge: {
    position: 'absolute',
    top: Platform.select({ ios: 56, android: 34, default: 34 }),
    right: 12,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#92400e',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  stagingBadgeText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
});

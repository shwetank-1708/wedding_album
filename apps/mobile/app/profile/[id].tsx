import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getUserById, UserProfile } from '@/lib/database';

function formatJoinedDate(value: any) {
  if (!value) return 'Not available';
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getPersonaLabel(value: any) {
  if (!value) return 'Member';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || 'Member';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).join(', ') || 'Member';
    } catch {
      return value;
    }
  }
  return String(value);
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await getUserById(userId);
      if (!cancelled) {
        setProfile(data);
        setLoading(false);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/explore-business');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#818cf8" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title}>Profile not found.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goBack}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const username = profile.username ? `@${profile.username}` : 'Username not set';
  const isPrivate = Boolean(profile.isPrivate);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <IconSymbol name="chevron.left" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}>
          {profile.profileImage ? (
            <Image source={{ uri: profile.profileImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <IconSymbol name="person.fill" size={42} color="#a5b4fc" />
          )}
        </View>

        <Text style={styles.title}>{profile.name || 'Name not set'}</Text>
        <Text style={styles.username}>{username}</Text>

        {isPrivate ? (
          <View style={styles.privateBox}>
            <IconSymbol name="lock.fill" size={22} color="#CDB89E" />
            <Text style={styles.privateText}>This profile is private.</Text>
          </View>
        ) : (
          <View style={styles.infoGrid}>
            <InfoTile label="Joined" value={formatJoinedDate(profile.createdAt)} icon="calendar" />
            <InfoTile label="Role" value={getPersonaLabel(profile.persona)} icon="person.fill" />
            <InfoTile label="Location" value={profile.location || 'Not set'} icon="mappin.and.ellipse" />
            <InfoTile label="Plan" value={profile.role || 'free'} icon="sparkles.fill" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.infoTile}>
      <View style={styles.infoIcon}>
        <IconSymbol name={icon} size={16} color="#a5b4fc" />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#13191F',
    paddingHorizontal: 18,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: 10,
  },
  backButton: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: '#1B211F',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#1B211F',
    padding: 22,
    alignItems: 'center',
  },
  avatar: {
    height: 112,
    width: 112,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 18,
    color: '#ffffff',
    fontSize: 26,
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
  },
  username: {
    marginTop: 6,
    color: '#a5b4fc',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  privateBox: {
    marginTop: 24,
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#13191F',
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  privateText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  infoGrid: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  infoTile: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#13191F',
    padding: 14,
  },
  infoIcon: {
    height: 34,
    width: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  infoValue: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: '#818cf8',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#1B211F',
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
});

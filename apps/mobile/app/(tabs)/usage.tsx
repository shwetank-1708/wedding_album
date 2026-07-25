import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getUserEventCount, getUserTotalStorage, getUserBusinesses } from '@/lib/database';
import { getPlanDetails, getUsagePercent } from '@/lib/planLimits';
import { getSubscriptionStatus } from '@/lib/subscriptionStatus';
import { supabase } from '@/lib/supabase';
import { EveBashLogoBadge } from '@/components/EveBashLogo';

const { width } = Dimensions.get('window');

export default function UsageScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ eventCount: 0, storageUsed: 0, businessCount: 0 });

  const plan = getPlanDetails(user?.role);
  const planColor = plan.accent;
  const subscriptionStatus = getSubscriptionStatus({
    role: user?.role,
    planStartDate: user?.planStartDate,
    planEndDate: user?.planEndDate,
  });
  const statusColor = subscriptionStatus.tone === 'danger'
    ? '#f87171'
    : subscriptionStatus.tone === 'warning'
      ? '#fbbf24'
      : planColor;
  const statusBackground = subscriptionStatus.tone === 'danger'
    ? 'rgba(248, 113, 113, 0.12)'
    : subscriptionStatus.tone === 'warning'
      ? 'rgba(251, 191, 36, 0.12)'
      : plan.accentSoft;

  const fetchStats = React.useCallback(async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const identifiers = [user.uid];
        if (user.email) identifiers.push(user.email);
        if (user.phone) identifiers.push(user.phone);

        const [count, storage, businesses] = await Promise.all([
          getUserEventCount(user.uid),
          getUserTotalStorage(identifiers),
          getUserBusinesses(user.uid)
        ]);
        setStats({ 
          eventCount: count, 
          storageUsed: storage,
          businessCount: businesses.length 
        });
      } catch (error) {
        console.error("Error fetching usage stats:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    React.useCallback(() => {
      fetchStats(true);
    }, [fetchStats])
  );

  useEffect(() => {
    if (!user?.uid) return;

    const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
    const channels = identifiers.map((identifier) =>
      supabase
        .channel(`usage-storage-${identifier}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${identifier}` },
          () => fetchStats(true)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events', filter: `created_by=eq.${identifier}` },
          () => fetchStats(true)
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user?.uid, user?.email, user?.phone, fetchStats]);

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 0.1) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${gb.toFixed(2)} GB`;
  };

  const storageProgress = getUsagePercent(stats.storageUsed, plan.storageBytes) / 100;
  const eventProgress = getUsagePercent(stats.eventCount, plan.eventLimit) / 100;
  const businessLimit = user?.role === 'admin'
    ? Infinity
    : user?.role === 'elite'
      ? 10
      : user?.role === 'premium'
        ? 3
        : 0;
  const businessLabel = businessLimit === Infinity ? 'Unlimited' : String(businessLimit);
  const businessProgress = getUsagePercent(stats.businessCount, businessLimit) / 100;
  const isStorageOver = stats.storageUsed > plan.storageBytes && plan.storageBytes !== Infinity;
  const isEventsOver = stats.eventCount > plan.eventLimit && plan.eventLimit !== Infinity;
  const isBizOver = stats.businessCount > businessLimit && businessLimit !== Infinity;

  const usageData = [
    { 
      label: 'Storage Used', 
      value: formatStorage(stats.storageUsed), 
      limit: plan.storageLabel,
      progress: storageProgress,
      icon: 'cloud.fill',
      isOver: isStorageOver
    },
    { 
      label: 'Active Events', 
      value: stats.eventCount.toString(), 
      limit: plan.eventLabel,
      progress: eventProgress,
      icon: 'calendar.fill',
      isOver: isEventsOver
    },
    { 
      label: 'Active Businesses', 
      value: stats.businessCount.toString(), 
      limit: businessLabel,
      progress: businessProgress,
      icon: 'briefcase.fill',
      isOver: isBizOver
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#101010', '#050505']}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={24} color="#d4af37" />
          </TouchableOpacity>
          <View style={styles.headingLogoRow}>
            <EveBashLogoBadge />
            <Text style={styles.headerTitle}>Plan & Usage</Text>
          </View>
          <View style={{ width: 40 }} /> 
        </View>
      </LinearGradient>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Current Plan Card */}
        <View style={styles.planCard}>
          <LinearGradient 
            colors={[plan.accentSoft, 'rgba(15,23,42,0.8)']}
            style={StyleSheet.absoluteFill} 
          />
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Text style={styles.planName}>{plan.name}</Text>
            </View>
            <View style={[styles.planBadge, { backgroundColor: statusBackground, borderColor: statusColor }]}>
              <Text style={[styles.planBadgeText, { color: statusColor }]}>{subscriptionStatus.label}</Text>
            </View>
          </View>

          {subscriptionStatus.message ? (
            <View style={[
              styles.planStatusBox,
              {
                borderColor: subscriptionStatus.tone === 'danger' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(251, 191, 36, 0.35)',
                backgroundColor: subscriptionStatus.tone === 'danger' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(251, 191, 36, 0.1)',
              }
            ]}>
              <Text style={[
                styles.planStatusTitle,
                { color: subscriptionStatus.tone === 'danger' ? '#fca5a5' : '#fde68a' }
              ]}>
                {subscriptionStatus.label}
              </Text>
              <Text style={styles.planStatusText}>{subscriptionStatus.message}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={{ height: 200, justifyContent: 'center' }}>
              <ActivityIndicator color="#d4af37" />
            </View>
          ) : (
            <View style={styles.usageContainer}>
              {usageData.map((item, idx) => (
                <View key={idx} style={styles.usageItem}>
                  <View style={styles.usageInfo}>
                    <View style={styles.usageLabelRow}>
                      <IconSymbol name={item.icon as any} size={14} color={item.isOver ? '#f87171' : '#94a3b8'} />
                      <Text style={[styles.usageLabel, item.isOver && { color: '#f87171' }]}>{item.label}</Text>
                    </View>
                    <Text style={[styles.usageValue, item.isOver && { color: '#f87171' }]}>
                      {item.value} <Text style={styles.usageLimit}>/ {item.limit}</Text>
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={item.isOver ? ['#ef4444', '#b91c1c'] : ['#d4af37', '#b49430']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${item.progress * 100}%` }]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Plan Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Management</Text>
          <View style={styles.listContainer}>
            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/pricing')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                  <IconSymbol name="sparkles.fill" size={18} color="#d4af37" />
                </View>
                <Text style={styles.itemText}>Upgrade Plan</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/pricing')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="creditcard.fill" size={18} color="#94a3b8" />
                </View>
                <Text style={styles.itemText}>Billing History</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Feedback</Text>
          <View style={styles.listContainer}>
            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/contact')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="message.fill" size={18} color="#94a3b8" />
                </View>
                <Text style={styles.itemText}>Support Chat</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/contact')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="questionmark.circle.fill" size={18} color="#94a3b8" />
                </View>
                <Text style={styles.itemText}>Help Center</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>EveBash v1.0.4</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050505' },
  container: { flex: 1 },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 20, 
    paddingBottom: 24, 
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  headerTitle: { 
    fontSize: 28, 
    lineHeight: 38,
    fontFamily: 'Inter_700Bold', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    letterSpacing: 2,
    includeFontPadding: false,
  },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  planCard: {
    backgroundColor: '#101010',
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    overflow: 'hidden',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  planLabel: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  planName: {
    fontSize: 24,
    color: '#f8fafc',
    fontFamily: 'Outfit_800ExtraBold',
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
  },
  planStatusBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
  },
  planStatusTitle: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  planStatusText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#e2e8f0',
    fontFamily: 'Inter_500Medium',
  },
  usageContainer: {
    gap: 20,
  },
  usageItem: {
    gap: 8,
  },
  usageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  usageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  usageValue: {
    fontSize: 14,
    color: '#f1f5f9',
    fontFamily: 'Outfit_700Bold',
  },
  usageLimit: {
    color: '#475569',
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  listIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    color: '#f1f5f9',
    fontFamily: 'Outfit_600SemiBold',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'Inter_400Regular',
  },
});

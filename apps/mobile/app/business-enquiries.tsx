import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { getBusinessById, getEnquiriesForBusiness, getOrCreateChatRoom, Enquiry, Business } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';

export default function BusinessEnquiriesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);

  // Modal State
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'closed'>('all');

  const filteredEnquiries = enquiries.filter(enquiry => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return enquiry.status !== 'ended';
    if (activeFilter === 'closed') return enquiry.status === 'ended';
    return true;
  });

  useFocusEffect(
    React.useCallback(() => {
      if (id && user) {
        const bizId = Array.isArray(id) ? id[0] : id;
        fetchBusinessAndEnquiries(bizId);
      }
    }, [id, user])
  );

  const fetchBusinessAndEnquiries = async (bizId: string) => {
    if (!business) {
      setLoading(true);
    }
    setLoadingEnquiries(true);
    try {
      const biz = await getBusinessById(bizId);
      if (biz) {
        setBusiness(biz);
      }
      if (user) {
        const data = await getEnquiriesForBusiness(bizId, user.uid);
        setEnquiries(data);
        // Refresh selectedEnquiry details in the modal if it's currently open
        setSelectedEnquiry(current => {
          if (!current) return null;
          return data.find(e => e.id === current.id) || current;
        });
      }
    } catch (error) {
      console.error('Error fetching enquiries:', error);
    } finally {
      setLoading(false);
      setLoadingEnquiries(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#CA9C68" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: '#ffffff' }}>Business not found</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')} style={{ marginTop: 20 }}>
          <Text style={{ color: '#CA9C68' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Enquiries</Text>
        </View>

        <View style={styles.headerRightBadgeContainer}>
          <View style={styles.headerLeadsCountBadge}>
            <Text style={styles.headerLeadsCountText}>
              {filteredEnquiries.length}
            </Text>
          </View>
        </View>
      </View>

      {/* ── FILTER SELECTION BAR ── */}
      <View style={styles.filterContainer}>
        {(['all', 'active', 'closed'] as const).map((filter) => {
          const isActive = activeFilter === filter;
          
          let count = 0;
          if (filter === 'all') {
            count = enquiries.length;
          } else if (filter === 'active') {
            count = enquiries.filter(e => e.status !== 'ended').length;
          } else if (filter === 'closed') {
            count = enquiries.filter(e => e.status === 'ended').length;
          }

          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                isActive && styles.activeFilterTab
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive && styles.activeFilterTabText
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.tabContent}>
          {loadingEnquiries ? (
            <View style={[styles.center, { paddingVertical: 40 }]}>
              <ActivityIndicator size="large" color="#CA9C68" />
            </View>
          ) : enquiries.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <IconSymbol name="bubble.right" size={48} color="#CA9C68" />
              </View>
              <Text style={styles.emptyStateTitle}>No Enquiries Yet</Text>
              <Text style={styles.emptyStateDesc}>
                Once event planners or couples contact you from the EB Network, their leads will show up here instantly!
              </Text>
            </View>
          ) : (
            <View style={{ gap: 16, paddingBottom: 20 }}>

              {filteredEnquiries.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBg}>
                    <IconSymbol name="bubble.right" size={48} color="#CA9C68" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No {activeFilter} Leads</Text>
                  <Text style={styles.emptyStateDesc}>
                    There are no customer leads matching this status filter.
                  </Text>
                </View>
              ) : (
                filteredEnquiries.map((enquiry, index) => {
                  const formattedDate = enquiry.createdAt?.toDate 
                    ? enquiry.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Just now';

                  return (
                    <TouchableOpacity 
                      key={enquiry.id} 
                      style={styles.leadCardCompact}
                      onPress={() => {
                        setSelectedEnquiry(enquiry);
                        setModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.leadUserMeta}>
                        <Text style={styles.leadIndexText}>{index + 1}</Text>
                        <View style={styles.leadUserAvatar}>
                          <Text style={styles.leadAvatarText}>
                            {enquiry.name ? enquiry.name.charAt(0).toUpperCase() : 'C'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.leadClientName} numberOfLines={1}>{enquiry.name}</Text>
                            {enquiry.status === 'ended' ? (
                              <View style={styles.closedTagCompact}>
                                <Text style={styles.closedTagTextCompact}>CLOSED</Text>
                              </View>
                            ) : (
                              <View style={styles.activeTagCompact}>
                                <Text style={styles.activeTagTextCompact}>ACTIVE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.leadTimestamp}>Sent: {formattedDate}</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color="#CDB89E" />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── ENQUIRY DETAIL MODAL ── */}
      {selectedEnquiry && (
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
          >
            <View 
              style={styles.modalContent} 
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {/* Modal Drag Handle Line */}
              <View style={styles.grabHandle} />

              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enquiry Details</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <IconSymbol name="xmark" size={20} color="#CDB89E" />
                </TouchableOpacity>
              </View>

              {/* Enquirer Meta info */}
              <View style={[styles.leadUserMeta, { marginBottom: 20 }]}>
                <View style={[styles.leadUserAvatar, { width: 48, height: 48, borderRadius: 24 }]}>
                  <Text style={[styles.leadAvatarText, { fontSize: 20 }]}>
                    {selectedEnquiry.name ? selectedEnquiry.name.charAt(0).toUpperCase() : 'C'}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.leadClientName, { fontSize: 18 }]}>{selectedEnquiry.name}</Text>
                  <Text style={styles.leadTimestamp}>
                    Sent: {selectedEnquiry.createdAt?.toDate 
                      ? selectedEnquiry.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Just now'}
                  </Text>
                </View>
              </View>

              {/* Event details */}
              <View style={styles.leadDetailsRow}>
                <View style={styles.leadDetailPill}>
                  <IconSymbol name="calendar" size={14} color="#CA9C68" />
                  <Text style={styles.leadDetailPillText}>Event Date: {selectedEnquiry.date}</Text>
                </View>
              </View>

              {/* Message block */}
              <View style={[styles.leadMessageContainer, { marginVertical: 20 }]}>
                <Text style={styles.leadMessageLabel}>Customer Message:</Text>
                <Text style={styles.leadMessageContent}>{"\""}{selectedEnquiry.message}{"\""}</Text>
              </View>

              {/* Contact / Action buttons */}
              <View style={styles.leadActionsRow}>
                {selectedEnquiry.preferredContact === 'chat' && selectedEnquiry.userId ? (
                  selectedEnquiry.status === 'ended' ? (
                    <View style={[styles.leadActionBtn, styles.endedChatBadge]}>
                      <IconSymbol name="lock.fill" size={14} color="#64748b" />
                      <Text style={styles.endedChatBadgeText}>Chat Ended & Lead Closed</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.leadActionBtn, styles.chatBtn]}
                      onPress={async () => {
                        if (!user) return;
                        try {
                          setModalVisible(false);
                          const roomId = await getOrCreateChatRoom(
                            selectedEnquiry.userId!,
                            selectedEnquiry.name,
                            user.uid,
                            business.name,
                            business.id,
                            selectedEnquiry.id
                          );
                          router.push({
                            pathname: '/chat',
                            params: { roomId, otherUserName: selectedEnquiry.name }
                          });
                        } catch (err) {
                          console.error('Error starting chat:', err);
                        }
                      }}
                    >
                      <IconSymbol name="bubble.left.fill" size={14} color="#1B211F" />
                      <Text style={styles.leadActionBtnTextDark}>Reply via In-App Chat</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <>
                    {selectedEnquiry.phone ? (
                      <>
                        <TouchableOpacity 
                          style={[styles.leadActionBtn, styles.callBtn]}
                          onPress={() => Linking.openURL(`tel:${selectedEnquiry.phone}`)}
                        >
                          <IconSymbol name="phone.fill" size={14} color="#ffffff" />
                          <Text style={styles.leadActionBtnText}>Call Client</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.leadActionBtn, styles.whatsappBtn]}
                          onPress={() => {
                            const cleanedPhone = selectedEnquiry.phone ? selectedEnquiry.phone.replace(/[^0-9]/g, '') : '';
                            const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(`Hi ${selectedEnquiry.name}, thank you for your enquiry on EveBash. We'd love to help you plan your event!`)}`;
                            Linking.openURL(waUrl);
                          }}
                        >
                          <IconSymbol name="message.fill" size={14} color="#ffffff" />
                          <Text style={styles.leadActionBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    
                    {selectedEnquiry.email ? (
                      <TouchableOpacity 
                        style={[styles.leadActionBtn, styles.emailBtn, !selectedEnquiry.phone && { flex: 1 }]}
                        onPress={() => Linking.openURL(`mailto:${selectedEnquiry.email}?subject=${encodeURIComponent(`Enquiry Response - ${business.name}`)}`)}
                      >
                        <IconSymbol name="envelope.fill" size={14} color="#ffffff" />
                        <Text style={styles.leadActionBtnText}>Email</Text>
                      </TouchableOpacity>
                    ) : null}

                    {!selectedEnquiry.phone && !selectedEnquiry.email && (
                      <View style={styles.noContactBadge}>
                        <Text style={styles.noContactText}>No direct contact info provided</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#13191F',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  tabContent: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(202, 156, 104, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  leadsOverviewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(202, 156, 104, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  leadsOverviewTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  leadsCountBadge: {
    backgroundColor: '#CA9C68',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  leadsCountText: {
    color: '#1B211F',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  leadCardCompact: {
    backgroundColor: '#1B211F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  leadUserMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(202, 156, 104, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadAvatarText: {
    color: '#CA9C68',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  leadIndexText: {
    color: '#64748b',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    minWidth: 18,
    textAlign: 'center',
  },
  leadClientName: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  leadTimestamp: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  leadDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leadDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(202, 156, 104, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leadDetailPillText: {
    color: '#CA9C68',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  leadMessageContainer: {
    backgroundColor: '#13191F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2B2F2E',
  },
  leadMessageLabel: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  leadMessageContent: {
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  leadActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leadActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  callBtn: {
    backgroundColor: '#2563eb',
  },
  whatsappBtn: {
    backgroundColor: '#16a34a',
  },
  emailBtn: {
    backgroundColor: '#475569',
  },
  chatBtn: {
    backgroundColor: '#CA9C68',
  },
  leadActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  leadActionBtnTextDark: {
    color: '#13191F',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  noContactBadge: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  noContactText: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 25, 31, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1B211F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#594C3D',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endedChatBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
  },
  endedChatBadgeText: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  closedTagCompact: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  closedTagTextCompact: {
    color: '#f87171',
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  activeTagCompact: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeTagTextCompact: {
    color: '#4ade80',
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#1B211F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterTab: {
    backgroundColor: 'rgba(202, 156, 104, 0.1)',
    borderColor: 'rgba(202, 156, 104, 0.25)',
  },
  filterTabText: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  activeFilterTabText: {
    color: '#CA9C68',
    fontFamily: 'Outfit_700Bold',
  },
  headerRightBadgeContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeadsCountBadge: {
    backgroundColor: '#CA9C68',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeadsCountText: {
    color: '#1B211F',
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
  },
});

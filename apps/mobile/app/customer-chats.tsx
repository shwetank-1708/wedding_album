import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, Stack } from 'expo-router';
import { getUserChatRooms, ChatRoom, deleteChatRoom } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';

export default function CustomerChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [chatRoomToDelete, setChatRoomToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      fetchChatRooms();
    }
  }, [user]);

  const fetchChatRooms = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [clientData, vendorData] = await Promise.all([
        getUserChatRooms(user.uid, 'client'),
        getUserChatRooms(user.uid, 'vendor'),
      ]);

      const combined = [...clientData, ...vendorData];

      // Deduplicate by room ID (e.g. self-chat test cases)
      const seen = new Set<string>();
      const unique = combined.filter(room => {
        if (!room.id) return true;
        if (seen.has(room.id)) return false;
        seen.add(room.id);
        return true;
      });

      // Sort by lastMessageAt descending
      unique.sort((a, b) => {
        const timeA = a.lastMessageAt?.seconds || 0;
        const timeB = b.lastMessageAt?.seconds || 0;
        return timeB - timeA;
      });

      setChatRooms(unique);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = (roomId: string | undefined) => {
    if (!roomId) return;
    setChatRoomToDelete(roomId);
    setDeleteModalVisible(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatRoomToDelete) return;
    setDeleting(true);
    try {
      const room = chatRooms.find(r => r.id === chatRoomToDelete);
      const role = room?.vendorUid === user?.uid ? 'vendor' : 'client';

      const success = await deleteChatRoom(chatRoomToDelete, role);
      if (success) {
        setChatRooms(prev => prev.filter(r => r.id !== chatRoomToDelete));
        setDeleteModalVisible(false);
        setChatRoomToDelete(null);
      } else {
        Alert.alert("Error", "Failed to delete the chat room. Please try again.");
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
      Alert.alert("Error", "An unexpected error occurred while deleting the chat.");
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#CA9C68" />
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
          <Text style={styles.headerTitle}>Messages</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {chatRooms.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <IconSymbol name="bubble.left.fill" size={36} color="#CA9C68" />
            </View>
            <Text style={styles.emptyStateTitle}>No Messages Yet</Text>
            <Text style={styles.emptyStateDesc}>
              Your enquiries and business chat threads will appear here once started. Explore vendors to connect!
            </Text>
            <TouchableOpacity 
              style={styles.exploreBtn} 
              onPress={() => router.push('/(tabs)/explore-business')}
            >
              <Text style={styles.exploreBtnText}>Browse Vendors</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {chatRooms.map((room) => {
              const dateStr = room.lastMessageAt?.toDate 
                ? room.lastMessageAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Recent';

              const isClosed = room.status === 'closed';
              const getIsExpired = () => {
                if (!room.createdAt) return false;
                let createdTime = 0;
                if (typeof room.createdAt.toDate === 'function') {
                  createdTime = room.createdAt.toDate().getTime();
                } else if (room.createdAt.seconds) {
                  createdTime = room.createdAt.seconds * 1000;
                } else if (room.createdAt instanceof Date) {
                  createdTime = room.createdAt.getTime();
                } else {
                  createdTime = new Date().getTime();
                }
                return (new Date().getTime() - createdTime) > 48 * 60 * 60 * 1000;
              };
              const isExpired = getIsExpired();

              const getTimeRemainingStr = () => {
                if (!room.createdAt || isClosed || isExpired) return '';
                let createdTime = 0;
                if (typeof room.createdAt.toDate === 'function') {
                  createdTime = room.createdAt.toDate().getTime();
                } else if (room.createdAt.seconds) {
                  createdTime = room.createdAt.seconds * 1000;
                } else if (room.createdAt instanceof Date) {
                  createdTime = room.createdAt.getTime();
                } else {
                  createdTime = new Date().getTime();
                }
                const elapsed = new Date().getTime() - createdTime;
                const remainingMs = 48 * 60 * 60 * 1000 - elapsed;
                if (remainingMs <= 0) return '';
                
                const remainingHrs = Math.floor(remainingMs / (1000 * 60 * 60));
                const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                
                if (remainingHrs > 0) {
                  return `${remainingHrs}h ${remainingMins}m left`;
                }
                return `${remainingMins}m left`;
              };
              const timeRemainingStr = getTimeRemainingStr();

              const isBusinessChat = room.vendorUid === user?.uid;
              const partnerName = isBusinessChat ? room.clientName : room.vendorName;
              const partnerAvatarChar = partnerName ? partnerName.charAt(0).toUpperCase() : (isBusinessChat ? 'C' : 'V');

              return (
                <TouchableOpacity 
                  key={room.id}
                  style={[
                    styles.chatCard, 
                    isBusinessChat ? styles.businessCardBorder : styles.clientCardBorder,
                    (isClosed || isExpired) && styles.inactiveCard
                  ]}
                  onPress={() => router.push({
                    pathname: '/chat',
                    params: { roomId: room.id, otherUserName: partnerName }
                  })}
                  onLongPress={() => {
                    if (isClosed || isExpired) {
                      handleDeleteChat(room.id);
                    }
                  }}
                  delayLongPress={500}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, isBusinessChat ? styles.businessAvatar : styles.clientAvatar]}>
                      <Text style={[styles.avatarText, isBusinessChat ? styles.businessAvatarText : styles.clientAvatarText]}>
                        {partnerAvatarChar}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.vendorName} numberOfLines={1}>{partnerName}</Text>
                        <View style={styles.dateContainer}>
                          <Text style={styles.dateText}>{dateStr}</Text>
                          {timeRemainingStr ? (
                            <Text style={styles.timeLeftText}>{timeRemainingStr}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.badgeRow}>
                        <View style={isBusinessChat ? styles.businessBadge : styles.normalBadge}>
                          <Text style={isBusinessChat ? styles.businessBadgeText : styles.normalBadgeText}>
                            {isBusinessChat ? 'Business' : 'Enquiry'}
                          </Text>
                        </View>
                        {isClosed && (
                          <View style={styles.closedBadge}>
                            <Text style={styles.endedBadgeText}>Ended</Text>
                          </View>
                        )}
                        {!isClosed && isExpired && (
                          <View style={styles.expiredBadge}>
                            <Text style={styles.expiredBadgeText}>Expired</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => {
          if (!deleting) {
            setDeleteModalVisible(false);
            setChatRoomToDelete(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <IconSymbol name="trash.fill" size={28} color="#ef4444" />
            </View>
            
            <Text style={styles.modalTitle}>Delete Conversation?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete this closed chat? This will permanently remove the conversation for both you and the other participant.
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setChatRoomToDelete(null);
                }}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmDeleteChat}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  exploreBtn: {
    backgroundColor: '#CA9C68',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#13191F',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  listContainer: {
    gap: 12,
  },
  chatCard: {
    backgroundColor: '#1B211F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(202, 156, 104, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#CA9C68',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dateContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeLeftText: {
    color: '#10b981',
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  vendorName: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  lastMessage: {
    color: '#CDB89E',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  inactiveCard: {
    opacity: 0.6,
  },
  closedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  expiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#cbd5e1',
  },
  endedBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#fca5a5',
  },
  expiredBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#fca5a5',
  },
  businessCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  clientCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#CA9C68',
  },
  businessAvatar: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  businessAvatarText: {
    color: '#818cf8',
  },
  clientAvatar: {
    backgroundColor: 'rgba(202, 156, 104, 0.1)',
    borderColor: 'rgba(202, 156, 104, 0.2)',
  },
  clientAvatarText: {
    color: '#CA9C68',
  },
  businessBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  businessBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#a5b4fc',
  },
  normalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(202, 156, 104, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(202, 156, 104, 0.3)',
  },
  normalBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#fef08a',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 25, 31, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1B211F',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#CDB89E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButtonText: {
    color: '#CDB89E',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
});

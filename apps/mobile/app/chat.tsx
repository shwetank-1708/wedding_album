import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { onChatMessages, sendMessage, ChatMessage, closeChatRoom, ChatRoom } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function ChatScreen() {
  const router = useRouter();
  const { roomId, otherUserName } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!roomId) return;
    
    setLoading(true);
    const unsubscribe = onChatMessages(roomId as string, (data) => {
      const filtered = data.filter(msg => msg.text !== 'Chat ended by customer');
      setMessages(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    
    const fetchAndSetRoom = async () => {
      try {
        const { data: r, error } = await supabase
          .from('chat_rooms')
          .select('*, profiles(name)')
          .eq('id', roomId as string)
          .maybeSingle();

        if (error) throw error;
        if (r) {
          setChatRoom({
            id: r.id,
            clientUid: r.client_uid,
            clientName: r.profiles?.name || 'Client',
            vendorUid: r.vendor_uid,
            vendorName: r.profiles?.name || 'Vendor',
            businessId: 'vendor-listing',
            createdAt: r.created_at,
            status: r.status,
            clientDeleted: r.client_deleted,
            vendorDeleted: r.vendor_deleted,
            lastRead: r.last_read
          } as any);
        }
      } catch (err) {
        console.error("Error fetching chat room:", err);
      }
    };

    fetchAndSetRoom();

    const channel = supabase
      .channel(`chat-room-doc-${roomId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chat_rooms', 
        filter: `id=eq.${roomId}` 
      }, () => {
        fetchAndSetRoom();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !user?.uid) return;
    
    const markAsRead = async () => {
      try {
        const { data: currentRoom } = await supabase
          .from('chat_rooms')
          .select('last_read')
          .eq('id', roomId as string)
          .maybeSingle();

        const updatedLastRead = {
          ...(currentRoom?.last_read || {}),
          [user.uid]: new Date().toISOString()
        };

        await supabase
          .from('chat_rooms')
          .update({
            last_read: updatedLastRead
          })
          .eq('id', roomId as string);
      } catch (err) {
        console.error("Error marking chat as read:", err);
      }
    };
    markAsRead();
  }, [roomId, user?.uid]);

  const getIsExpired = () => {
    if (!chatRoom?.createdAt) return false;
    let createdTime = 0;
    if (typeof chatRoom.createdAt === 'string') {
      createdTime = new Date(chatRoom.createdAt).getTime();
    } else if (typeof chatRoom.createdAt.toDate === 'function') {
      createdTime = chatRoom.createdAt.toDate().getTime();
    } else if (chatRoom.createdAt.seconds) {
      createdTime = chatRoom.createdAt.seconds * 1000;
    } else if (chatRoom.createdAt instanceof Date) {
      createdTime = chatRoom.createdAt.getTime();
    } else {
      createdTime = new Date(chatRoom.createdAt).getTime();
    }
    return (new Date().getTime() - createdTime) > 48 * 60 * 60 * 1000;
  };

  const isExpired = getIsExpired();
  const isClosed = chatRoom?.status === 'closed';
  const isClient = user && chatRoom && chatRoom.clientUid === user.uid;
  const canSend = !isClosed && !isExpired;

  const handleEndChat = async () => {
    if (!roomId || !user) return;
    try {
      await closeChatRoom(roomId as string);
    } catch (err) {
      console.error('Error closing chat room:', err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user || !roomId) return;
    const textToSend = inputText.trim();
    setInputText('');
    
    await sendMessage(
      roomId as string,
      user.uid,
      user.name || 'User',
      textToSend
    );
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.uid;
    const rawDate = item.createdAt;
    let dateStr = 'Just now';
    if (rawDate) {
      try {
        const date = new Date(rawDate);
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {
        console.warn("Failed to parse message date:", rawDate);
      }
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.senderName ? item.senderName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isMe ? styles.myTime : styles.otherTime]}>
            {dateStr}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/customer-chats')} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.otherName} numberOfLines={1}>{otherUserName || 'Chat'}</Text>
          {isClosed ? (
            <Text style={styles.closedText}>Ended</Text>
          ) : isExpired ? (
            <Text style={styles.expiredText}>Expired</Text>
          ) : (
            <Text style={styles.activeText}>Active Now</Text>
          )}
        </View>

        {isClient && !isClosed && !isExpired ? (
          <TouchableOpacity onPress={handleEndChat} style={styles.endChatBtn}>
            <Text style={styles.endChatBtnText}>End Chat</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* ── MESSAGES LIST ── */}
      {loading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#CA9C68" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* ── INPUT BOX / BANNER ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {!canSend ? (
          <View style={styles.blockedBanner}>
            <IconSymbol 
              name={isClosed ? "lock.fill" : "clock.fill"} 
              size={16} 
              color="#64748b" 
            />
            <Text style={styles.blockedText}>
              {isClosed 
                ? "This chat has been closed by the customer." 
                : "This chat has expired (lasts 48 hours)."}
            </Text>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor="#475569"
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <IconSymbol name="paperplane.fill" size={16} color="#13191F" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerInfo: {
    alignItems: 'center',
    flex: 1,
  },
  otherName: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  activeText: {
    color: '#10b981',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '80%',
  },
  myRow: {
    alignSelf: 'flex-end',
  },
  otherRow: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'relative',
  },
  myBubble: {
    backgroundColor: '#CA9C68',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#1B211F',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  myText: {
    color: '#13191F',
  },
  otherText: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: 'rgba(19, 25, 31, 0.5)',
  },
  otherTime: {
    color: '#64748b',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#13191F',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1B211F',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CA9C68',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  endChatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  endChatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  closedText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  expiredText: {
    color: '#ef4444',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#1B211F',
  },
  blockedText: {
    color: '#CDB89E',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});

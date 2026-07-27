import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useRouter } from 'expo-router';
import { EveBashLogoBadge } from '@/components/EveBashLogo';
import { 
  getUsers, 
  followUser, 
  unfollowUser, 
  getFollowing, 
  getSocialFeed,
  toggleEventPostLike,
  isEventPostLikedByUser,
  getEventPostLikes,
  addEventPostComment,
  getEventPostComments,
  getTopRatedBusinesses,
  toggleShortlistBusiness,
  getBusinessActivities,
  logGuestLogin,
  checkGuestRequestStatus,
} from '@/lib/database';

const { width } = Dimensions.get('window');

const formatInstagramDate = (createdAt: any) => {
  if (!createdAt?.seconds) return '1s';
  const now = Date.now();
  const postTime = createdAt.seconds * 1000;
  const diffMs = now - postTime;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin}m`;
  } else if (diffHour < 24) {
    return `${diffHour}h`;
  } else if (diffDay < 7) {
    return `${diffDay}d`;
  } else {
    return new Date(postTime).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
};

export default function SocialScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Access modal state
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [accessStatus, setAccessStatus] = useState<'none' | 'pending' | 'rejected'>('none');
  const [checkingAccess, setCheckingAccess] = useState<string | null>(null);
  const [requestingAccess, setRequestingAccess] = useState(false);

  // Like & Comment state
  const [likedEvents, setLikedEvents] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [showAllComments, setShowAllComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const mountedRef = React.useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (user?.uid) {
      initFeed();
    }
  }, [user]);

  const initFeed = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allUsers, following] = await Promise.all([
        getUsers(),
        getFollowing(user.uid)
      ]);
      if (!mountedRef.current) return;
      setUsersList(allUsers);
      const ids = following || [];
      setFollowingIds(ids);

      console.log('[initFeed] currentUser uid:', user.uid);
      console.log('[initFeed] followingIds:', ids);

      // Now fetch feed with the fresh IDs (always include self)
      const queryIds = [user.uid, ...ids];
      const feed = await getSocialFeed(queryIds);
      
      console.log('[initFeed] raw feed returned:', feed.length, 'items');
      feed.forEach((item, i) => console.log(`  feed[${i}] id=${item.id} type=${item.type} title=${item.title} createdBy=${item.createdBy}`));

      if (!mountedRef.current) return;
      const eventOnlyFeed = feed.filter(item => item.type === 'event');
      const mappedEvents = eventOnlyFeed.map(item => ({ ...item, feedType: 'event' }));

      // Fetch and filter businesses
      let combinedBizList: any[] = [];
      let activitiesList: any[] = [];
      try {
        const allBusinesses = await getTopRatedBusinesses(100);
        const followedBiz = allBusinesses.filter(b => b.createdBy && ids.includes(b.createdBy));
        const shortlistedBiz = allBusinesses.filter(b => b.id && user.shortlisted?.includes(b.id));
        const selfBiz = allBusinesses.filter(b => b.createdBy === user.uid);

        const combinedBizMap = new Map<string, any>();
        followedBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'followed' }));
        shortlistedBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'shortlisted' }));
        selfBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'self' }));
        combinedBizList = Array.from(combinedBizMap.values());
      } catch (bizErr) {
        console.error("Error fetching businesses for feed:", bizErr);
      }

      try {
        const rawActivities = await getBusinessActivities(queryIds);
        activitiesList = rawActivities.map(act => ({ ...act, feedType: 'activity' }));
      } catch (actErr) {
        console.error("Error fetching business activities in initFeed:", actErr);
      }

      const fullFeed = [...mappedEvents, ...combinedBizList, ...activitiesList];
      fullFeed.sort((a, b) => {
        const dateA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const dateB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return dateB - dateA;
      });

      console.log('[initFeed] after combining businesses & activities & sorting:', fullFeed.length, 'items');
      setFeedItems(fullFeed);

      // Load interactions in background
      loadInteractions(fullFeed);
    } catch (error) {
      console.error("Error in initFeed:", error);
      if (mountedRef.current) setFeedItems([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };


  const fetchFeed = async () => {
    if (!user?.uid) return;
    try {
      const queryIds = [user.uid, ...followingIds];
      const feed = await getSocialFeed(queryIds);
      const eventOnlyFeed = feed.filter(item => item.type === 'event');
      const mappedEvents = eventOnlyFeed.map(item => ({ ...item, feedType: 'event' }));

      let combinedBizList: any[] = [];
      let activitiesList: any[] = [];
      try {
        const allBusinesses = await getTopRatedBusinesses(100);
        const followedBiz = allBusinesses.filter(b => b.createdBy && followingIds.includes(b.createdBy));
        const shortlistedBiz = allBusinesses.filter(b => b.id && user.shortlisted?.includes(b.id));
        const selfBiz = allBusinesses.filter(b => b.createdBy === user.uid);

        const combinedBizMap = new Map<string, any>();
        followedBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'followed' }));
        shortlistedBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'shortlisted' }));
        selfBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'self' }));
        combinedBizList = Array.from(combinedBizMap.values());
      } catch (bizErr) {
        console.error("Error fetching businesses in fetchFeed:", bizErr);
      }

      try {
        const rawActivities = await getBusinessActivities(queryIds);
        activitiesList = rawActivities.map(act => ({ ...act, feedType: 'activity' }));
      } catch (actErr) {
        console.error("Error fetching business activities in fetchFeed:", actErr);
      }

      const fullFeed = [...mappedEvents, ...combinedBizList, ...activitiesList];
      fullFeed.sort((a, b) => {
        const dateA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const dateB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return dateB - dateA;
      });

      setFeedItems(fullFeed);
      loadInteractions(fullFeed);
    } catch (error) {
      console.error("Error fetching feed:", error);
    }
  };

  const refreshFeedWithIds = async (currentFollowingIds: string[]) => {
    if (!user?.uid) return;
    try {
      const queryIds = [user.uid, ...currentFollowingIds];
      const feed = await getSocialFeed(queryIds);
      const eventOnlyFeed = feed.filter(item => item.type === 'event');
      const mappedEvents = eventOnlyFeed.map(item => ({ ...item, feedType: 'event' }));

      let combinedBizList: any[] = [];
      let activitiesList: any[] = [];
      try {
        const allBusinesses = await getTopRatedBusinesses(100);
        const followedBiz = allBusinesses.filter(b => b.createdBy && currentFollowingIds.includes(b.createdBy));
        const shortlistedBiz = allBusinesses.filter(b => b.id && user.shortlisted?.includes(b.id));
        const selfBiz = allBusinesses.filter(b => b.createdBy === user.uid);

        const combinedBizMap = new Map<string, any>();
        followedBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'followed' }));
        shortlistedBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'shortlisted' }));
        selfBiz.forEach(b => combinedBizMap.set(b.id, { ...b, feedType: 'business', feedSubType: 'self' }));
        combinedBizList = Array.from(combinedBizMap.values());
      } catch (bizErr) {
        console.error("Error fetching businesses in refreshFeedWithIds:", bizErr);
      }

      try {
        const rawActivities = await getBusinessActivities(queryIds);
        activitiesList = rawActivities.map(act => ({ ...act, feedType: 'activity' }));
      } catch (actErr) {
        console.error("Error fetching business activities in refreshFeedWithIds:", actErr);
      }

      const fullFeed = [...mappedEvents, ...combinedBizList, ...activitiesList];
      fullFeed.sort((a, b) => {
        const dateA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const dateB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return dateB - dateA;
      });

      setFeedItems(fullFeed);
      loadInteractions(fullFeed);
    } catch (error) {
      console.error("Error refreshing feed:", error);
    }
  };

  const handleCloseSearchModal = () => {
    setSearchModalVisible(false);
    setSearchQuery('');
  };

  const loadInteractions = async (events: any[]) => {
    if (!user?.uid) return;
    for (const item of events) {
      if (!mountedRef.current) break;
      try {
        const liked = await isEventPostLikedByUser(item.id, user.uid);
        if (mountedRef.current) setLikedEvents(prev => ({ ...prev, [item.id]: liked }));
      } catch (e) {}
      if (!mountedRef.current) break;
      try {
        const likesData = await getEventPostLikes(item.id);
        if (mountedRef.current) setLikeCounts(prev => ({ ...prev, [item.id]: likesData.count }));
      } catch (e) {}
      if (!mountedRef.current) break;
      try {
        const commentsData = await getEventPostComments(item.id);
        if (mountedRef.current) setCommentCounts(prev => ({ ...prev, [item.id]: commentsData.length }));
      } catch (e) {}
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initFeed();
    setRefreshing(false);
  };

  const handleLike = async (eventId: string) => {
    if (!user?.uid) return;
    
    // Optimistic update
    const wasLiked = likedEvents[eventId] || false;
    setLikedEvents(prev => ({ ...prev, [eventId]: !wasLiked }));
    setLikeCounts(prev => ({ ...prev, [eventId]: (prev[eventId] || 0) + (wasLiked ? -1 : 1) }));
    
    try {
      await toggleEventPostLike(eventId, user.uid);
    } catch (error) {
      // Revert on error
      setLikedEvents(prev => ({ ...prev, [eventId]: wasLiked }));
      setLikeCounts(prev => ({ ...prev, [eventId]: (prev[eventId] || 0) + (wasLiked ? 1 : -1) }));
    }
  };

  const handleToggleComments = async (eventId: string) => {
    if (expandedComments === eventId) {
      setExpandedComments(null);
      setShowAllComments(prev => ({ ...prev, [eventId]: false }));
      return;
    }
    setExpandedComments(eventId);
    try {
      const eventComments = await getEventPostComments(eventId);
      setComments(prev => ({ ...prev, [eventId]: eventComments }));
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handlePostComment = async (eventId: string) => {
    if (!user?.uid || !commentText.trim() || postingComment) return;
    setPostingComment(true);
    
    const userName = usersList.find(u => u.id === user.uid)?.name || 'You';
    try {
      await addEventPostComment(eventId, user.uid, userName, commentText.trim());
      
      // Add to local state immediately
      const newComment = { id: Date.now().toString(), userId: user.uid, userName, text: commentText.trim(), createdAt: { seconds: Date.now() / 1000 } };
      setComments(prev => ({ ...prev, [eventId]: [newComment, ...(prev[eventId] || [])] }));
      setCommentCounts(prev => ({ ...prev, [eventId]: (prev[eventId] || 0) + 1 }));
      setCommentText('');
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setPostingComment(false);
    }
  };

  const handleFollowToggle = async (targetUser: any) => {
    if (!user || actionLoading) return;
    setActionLoading(targetUser.id);
    try {
      if (followingIds.includes(targetUser.id)) {
        await unfollowUser(user.uid, targetUser.id);
        const updatedFollowing = followingIds.filter(id => id !== targetUser.id);
        setFollowingIds(updatedFollowing);
        refreshFeedWithIds(updatedFollowing);
      } else {
        const result = await followUser(user.uid, targetUser.id);
        if (result.success && result.status === 'accepted') {
          const updatedFollowing = [...followingIds, targetUser.id];
          setFollowingIds(updatedFollowing);
          refreshFeedWithIds(updatedFollowing);
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const navigateToDetail = async (item: any) => {
    if (!user?.uid) {
      Alert.alert("Login Required", "Please log in to view event details.");
      return;
    }
    const eventId = item.eventId || item.id;
    if (!eventId) return;

    setCheckingAccess(eventId);

    try {
      // 1. Check if user is owner of the event
      const isOwner = item.createdBy === user.uid || item.userId === user.uid;

      // 2. Check if user is privileged viewer
      const isPrivileged = 
        user.role === 'admin' ||
        (user.roleType === 'primary' && user.delegatedBy === item.createdBy) ||
        !!user.assignedEvents?.some((id: string) => id === eventId || id === item.legacyId || id === item.parentId);

      if (isOwner || isPrivileged) {
        router.push(`/events/${eventId}`);
        setCheckingAccess(null);
        return;
      }

      // 3. Check guest status
      const identifiers: string[] = [];
      if (user.phone) identifiers.push(user.phone);
      if (user.email) identifiers.push(user.email);
      if (user.uid) identifiers.push(user.uid);

      let foundStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none';

      for (const identifier of identifiers) {
        const status = await checkGuestRequestStatus(identifier, eventId);
        if (status) {
          foundStatus = status;
          break;
        }
      }

      if (foundStatus === 'approved') {
        router.push(`/events/${eventId}`);
      } else {
        setSelectedEvent(item);
        setAccessStatus(foundStatus);
        setAccessModalVisible(true);
      }
    } catch (error) {
      console.error("Error checking event access:", error);
      Alert.alert("Error", "Unable to verify event access. Please try again.");
    } finally {
      setCheckingAccess(null);
    }
  };

  const handleSendJoinRequest = async () => {
    if (!selectedEvent || !user || requestingAccess) return;
    setRequestingAccess(true);
    try {
      const nameToSubmit = user.name || user.email?.split('@')[0] || 'Guest';
      const rawPhone = user.phone || user.email || user.uid;
      
      const success = await logGuestLogin(
        nameToSubmit,
        rawPhone,
        selectedEvent.id,
        selectedEvent.parentId || selectedEvent.id,
        selectedEvent.title,
        selectedEvent.createdBy,
        'pending'
      );

      if (success) {
        setAccessStatus('pending');
        Alert.alert("Request Sent", "Your request to join the event has been sent to the creator.");
      } else {
        Alert.alert("Error", "Failed to send request. Please try again.");
      }
    } catch (err) {
      console.error("Error sending join request:", err);
      Alert.alert("Error", "An error occurred while sending the request.");
    } finally {
      setRequestingAccess(false);
    }
  };

  const renderFeedItem = (item: any) => {
    const formattedDate = formatInstagramDate(item.createdAt);

    if (item.feedType === 'activity') {
      const isLiked = likedEvents[item.id] || false;
      const likeCount = likeCounts[item.id] || 0;
      const commentCount = commentCounts[item.id] || 0;
      const isCommentsOpen = expandedComments === item.id;
      const actComments = comments[item.id] || [];

      const isSelf = item.createdBy === user?.uid;
      const ownerName = item.businessName || 'Premium Vendor';
      const ownerCover = item.businessCover || null;

      // Determine pill text & color
      let pillText = 'UPDATE';
      let pillIcon: IconSymbolName = 'sparkles';
      if (item.activityType === 'announcement') {
        pillText = 'ANNOUNCEMENT';
        pillIcon = 'megaphone.fill';
      } else if (item.activityType === 'faq') {
        pillText = 'NEW FAQ';
        pillIcon = 'questionmark.circle.fill';
      } else if (item.activityType === 'portfolio_photo') {
        pillText = 'PORTFOLIO UPDATE';
        pillIcon = 'photo.fill';
      }

      return (
        <View key={item.id} style={[styles.postContainer, styles.bizPostContainer]}>
          {/* Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity style={styles.postUserInfo} onPress={() => router.push(`/business/${item.businessId}`)}>
              <View style={[styles.postAvatarRing, styles.bizAvatarRing]}>
                <View style={styles.postAvatarPlaceholder}>
                  {ownerCover ? (
                    <Image source={{ uri: ownerCover }} style={styles.postAvatar} />
                  ) : (
                    <Text style={[styles.postAvatarText, styles.bizAvatarText]}>{ownerName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
              </View>
              <View>
                <View style={styles.bizHeaderNameRow}>
                  <Text style={styles.postUserName}>{ownerName}</Text>
                  <IconSymbol name="checkmark.seal.fill" size={14} color="#818cf8" />
                </View>
                <View style={styles.bizSubtitleRow}>
                  <IconSymbol name={isSelf ? "briefcase.fill" : "person.2.fill"} size={11} color="#818cf8" />
                  <Text style={styles.followedBadgeText}>
                    {isSelf ? 'Your Business Update' : 'Followed Business Update'} • {formattedDate}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Activity Body */}
          <View style={styles.activityBodyContainer}>
            {/* Pill Type Badge */}
            <View style={styles.activityBadgeRow}>
              <View style={[styles.postGlassBadge, styles.bizGlassBadge, { marginHorizontal: 0, alignSelf: 'flex-start' }]}>
                <IconSymbol name={pillIcon} size={10} color="#818cf8" />
                <Text style={[styles.postGlassBadgeText, styles.bizGlassBadgeText]}>{pillText}</Text>
              </View>
            </View>

            {/* Content branch */}
            {item.activityType === 'announcement' ? (
              <View style={styles.announcementBubble}>
                <IconSymbol name="quote.opening" size={18} color="rgba(129, 140, 248, 0.4)" style={styles.quoteIconLeft} />
                <Text style={styles.announcementText}>{item.content}</Text>
              </View>
            ) : item.activityType === 'faq' ? (
              <View style={styles.faqBubble}>
                <Text style={styles.faqQuestion}>
                  ❓ {item.content.split('\nA: ')[0]?.replace('Q: ', '') || 'Question'}
                </Text>
                <View style={styles.faqDivider} />
                <Text style={styles.faqAnswer}>
                  💡 {item.content.split('\nA: ')[1] || 'Answer'}
                </Text>
              </View>
            ) : (
              // Portfolio Photo
              <View style={styles.portfolioPhotoContainer}>
                {item.photoUrl ? (
                  <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/business/${item.businessId}`)}>
                    <Image source={{ uri: item.photoUrl }} style={styles.portfolioPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.portfolioPhoto, styles.postImagePlaceholder]}>
                    <IconSymbol name="photo" size={32} color="#334155" />
                  </View>
                )}
                <Text style={styles.portfolioPhotoCaption}>{item.content}</Text>
              </View>
            )}
          </View>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <View style={styles.actionLeft}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
                <IconSymbol
                  name={isLiked ? 'heart.fill' : 'heart'}
                  size={22}
                  color={isLiked ? '#ef4444' : '#94a3b8'}
                />
                {likeCount > 0 && <Text style={[styles.actionCount, isLiked && { color: '#ef4444' }]}>{likeCount}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleComments(item.id)}>
                <IconSymbol name="bubble.right" size={21} color={isCommentsOpen ? '#818cf8' : '#94a3b8'} />
                {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.actionRight}>
              <TouchableOpacity style={styles.actionBtn}>
                <IconSymbol name="square.and.arrow.up" size={20} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <IconSymbol name="bookmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Expanded Comments Section */}
          {isCommentsOpen && (
            <View style={styles.commentsSection}>
              {actComments.length > 3 && !showAllComments[item.id] && (
                <TouchableOpacity 
                  style={styles.viewAllCommentsBtn} 
                  onPress={() => setShowAllComments(prev => ({ ...prev, [item.id]: true }))}
                >
                  <Text style={[styles.viewAllCommentsText, styles.bizViewAllCommentsText]}>View all {commentCount} comments</Text>
                </TouchableOpacity>
              )}

              {(showAllComments[item.id] ? actComments : actComments.slice(0, 3)).map((c: any) => (
                <View key={c.id} style={styles.commentRow}>
                  <Text style={[styles.commentUser, styles.bizCommentUser]}>{c.userName}</Text>
                  <Text style={styles.commentBody}>{c.text}</Text>
                </View>
              ))}

              {actComments.length > 3 && showAllComments[item.id] && (
                <TouchableOpacity 
                  style={styles.viewAllCommentsBtn} 
                  onPress={() => setShowAllComments(prev => ({ ...prev, [item.id]: false }))}
                >
                  <Text style={[styles.viewAllCommentsText, styles.bizViewAllCommentsText]}>Show less</Text>
                </TouchableOpacity>
              )}

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment…"
                  placeholderTextColor="#334155"
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={() => handlePostComment(item.id)}
                />
                <TouchableOpacity
                  style={[styles.postBtn, !commentText.trim() && { opacity: 0.35 }]}
                  onPress={() => handlePostComment(item.id)}
                  disabled={!commentText.trim() || postingComment}
                >
                  {postingComment ? (
                    <ActivityIndicator size="small" color="#818cf8" />
                  ) : (
                    <Text style={[styles.postBtnText, styles.bizPostBtnText]}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }

    if (item.feedType === 'business') {
      const ownerUser = usersList.find(u => u.id === item.createdBy);
      const ownerName = ownerUser?.name || item.ownerName || 'Premium Vendor';
      const ownerProfileImage = ownerUser?.profileImage || null;
      const isShortlisted = user?.shortlisted?.includes(item.id) || false;

      const isLiked = likedEvents[item.id] || false;
      const likeCount = likeCounts[item.id] || 0;
      const commentCount = commentCounts[item.id] || 0;
      const isCommentsOpen = expandedComments === item.id;
      const bizComments = comments[item.id] || [];

      return (
        <View key={item.id} style={[styles.postContainer, styles.bizPostContainer]}>
          {/* Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity style={styles.postUserInfo} onPress={() => router.push(`/business/${item.id}`)}>
              <View style={[styles.postAvatarRing, styles.bizAvatarRing]}>
                <View style={styles.postAvatarPlaceholder}>
                  {ownerProfileImage ? (
                    <Image source={{ uri: ownerProfileImage }} style={styles.postAvatar} />
                  ) : (
                    <Text style={[styles.postAvatarText, styles.bizAvatarText]}>{ownerName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
              </View>
              <View>
                <View style={styles.bizHeaderNameRow}>
                  <Text style={styles.postUserName}>{item.name}</Text>
                  <IconSymbol name="checkmark.seal.fill" size={14} color="#818cf8" />
                </View>
                <View style={styles.bizSubtitleRow}>
                  {item.feedSubType === 'shortlisted' ? (
                    <>
                      <IconSymbol name="heart.fill" size={11} color="#ef4444" />
                      <Text style={styles.shortlistedBadgeText}>Your Shortlisted Vendor • {formattedDate}</Text>
                    </>
                  ) : item.feedSubType === 'self' ? (
                    <>
                      <IconSymbol name="briefcase.fill" size={11} color="#818cf8" />
                      <Text style={styles.selfBadgeText}>Your Business Listing • {formattedDate}</Text>
                    </>
                  ) : (
                    <>
                      <IconSymbol name="person.2.fill" size={11} color="#818cf8" />
                      <Text style={styles.followedBadgeText}>Followed Business • {formattedDate}</Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.bizHeartToggle}
              onPress={() => {
                if (user?.uid) {
                  toggleShortlistBusiness(user.uid, item.id);
                } else {
                  Alert.alert("Login Required", "Please log in to shortlist businesses.");
                }
              }}
            >
              <IconSymbol 
                name={isShortlisted ? "heart.fill" : "heart"} 
                size={20} 
                color={isShortlisted ? "#ef4444" : "#94a3b8"} 
              />
            </TouchableOpacity>
          </View>

          {/* Business Image & Badge Overlay */}
          <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/business/${item.id}`)}>
            <View style={styles.postImageContainer}>
              {item.coverImage ? (
                <Image source={{ uri: item.coverImage }} style={styles.postMainImage} resizeMode="cover" />
              ) : (
                <View style={[styles.postMainImage, styles.postImagePlaceholder]}>
                  <IconSymbol name="photo" size={32} color="#334155" />
                </View>
              )}
              {/* Gradient Overlay bottom strip */}
              <View style={[styles.postGlassOverlay, styles.bizGlassOverlay]}>
                <View style={styles.bizGlassHeader}>
                  <View style={[styles.postGlassBadge, styles.bizGlassBadge]}>
                    <IconSymbol name="tag.fill" size={10} color="#818cf8" />
                    <Text style={[styles.postGlassBadgeText, styles.bizGlassBadgeText]}>{item.type?.toUpperCase() || 'VENDOR'}</Text>
                  </View>
                  <View style={styles.bizRatingBadge}>
                    <IconSymbol name="star.fill" size={10} color="#d4af37" />
                    <Text style={styles.bizRatingText}>{item.rating || '5.0'}</Text>
                  </View>
                </View>
                <Text style={styles.postEventTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.postEventSubtitle} numberOfLines={1}>
                  📍 {item.location?.address || 'Mumbai, India'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Quick Info & Experience */}
          <View style={styles.bizBottomContainer}>
            {!!item.description && (
              <Text style={styles.bizDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.bizFeaturesRow}>
              {!!item.experience && (
                <View style={styles.bizTagChip}>
                  <IconSymbol name="clock.fill" size={11} color="#818cf8" />
                  <Text style={styles.bizTagChipText}>{item.experience}+ Years Exp</Text>
                </View>
              )}
              {!!item.ownerName && (
                <View style={styles.bizTagChip}>
                  <IconSymbol name="person.fill" size={11} color="#818cf8" />
                  <Text style={styles.bizTagChipText}>Owner: {item.ownerName}</Text>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.bizActionRow}>
              <TouchableOpacity 
                style={styles.bizViewProfileBtn}
                onPress={() => router.push(`/business/${item.id}`)}
              >
                <Text style={styles.bizViewProfileText}>View Portfolio</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.bizInquireBtn}
                onPress={() => {
                  Alert.alert(
                    `Inquire - ${item.name}`,
                    `Would you like to send an inquiry to ${item.name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Send Inquiry', 
                        onPress: () => Alert.alert("Success", "Inquiry sent successfully! The vendor will reach out to you shortly.") 
                      }
                    ]
                  );
                }}
              >
                <LinearGradient
                  colors={['#818cf8', '#4f46e5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bizInquireGradient}
                >
                  <IconSymbol name="paperplane.fill" size={12} color="#ffffff" />
                  <Text style={styles.bizInquireText}>Quick Inquire</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <View style={styles.actionLeft}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
                <IconSymbol
                  name={isLiked ? 'heart.fill' : 'heart'}
                  size={22}
                  color={isLiked ? '#ef4444' : '#94a3b8'}
                />
                {likeCount > 0 && <Text style={[styles.actionCount, isLiked && { color: '#ef4444' }]}>{likeCount}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleComments(item.id)}>
                <IconSymbol name="bubble.right" size={21} color={isCommentsOpen ? '#818cf8' : '#94a3b8'} />
                {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.actionRight}>
              <TouchableOpacity style={styles.actionBtn}>
                <IconSymbol name="square.and.arrow.up" size={20} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <IconSymbol name="bookmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Expanded Comments Section */}
          {isCommentsOpen && (
            <View style={styles.commentsSection}>
              {bizComments.length > 3 && !showAllComments[item.id] && (
                <TouchableOpacity 
                  style={styles.viewAllCommentsBtn} 
                  onPress={() => setShowAllComments(prev => ({ ...prev, [item.id]: true }))}
                >
                  <Text style={[styles.viewAllCommentsText, styles.bizViewAllCommentsText]}>View all {commentCount} comments</Text>
                </TouchableOpacity>
              )}

              {(showAllComments[item.id] ? bizComments : bizComments.slice(0, 3)).map((c: any) => (
                <View key={c.id} style={styles.commentRow}>
                  <Text style={[styles.commentUser, styles.bizCommentUser]}>{c.userName}</Text>
                  <Text style={styles.commentBody}>{c.text}</Text>
                </View>
              ))}

              {bizComments.length > 3 && showAllComments[item.id] && (
                <TouchableOpacity 
                  style={styles.viewAllCommentsBtn} 
                  onPress={() => setShowAllComments(prev => ({ ...prev, [item.id]: false }))}
                >
                  <Text style={[styles.viewAllCommentsText, styles.bizViewAllCommentsText]}>Show less</Text>
                </TouchableOpacity>
              )}

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment…"
                  placeholderTextColor="#334155"
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={() => handlePostComment(item.id)}
                />
                <TouchableOpacity
                  style={[styles.postBtn, !commentText.trim() && { opacity: 0.35 }]}
                  onPress={() => handlePostComment(item.id)}
                  disabled={!commentText.trim() || postingComment}
                >
                  {postingComment ? (
                    <ActivityIndicator size="small" color="#818cf8" />
                  ) : (
                    <Text style={[styles.postBtnText, styles.bizPostBtnText]}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }

    const itemUser = usersList.find(u => u.id === (item.userId || item.createdBy));
    const date = formattedDate;
    const coverImage = item.coverImage || item.imageUrl;
    const isLiked = likedEvents[item.id] || false;
    const likeCount = likeCounts[item.id] || 0;
    const commentCount = commentCounts[item.id] || 0;
    const isCommentsOpen = expandedComments === item.id;
    const eventComments = comments[item.id] || [];

    // Use fallback values if user profile isn't found
    const userName = itemUser?.name || item.userName || 'Someone';
    const profileImage = itemUser?.profileImage || null;

    return (
      <View key={item.id} style={styles.postContainer}>
        {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity style={styles.postUserInfo} onPress={() => navigateToDetail(item)}>
            <View style={styles.postAvatarRing}>
              <View style={styles.postAvatarPlaceholder}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.postAvatar} />
                ) : (
                  <Text style={styles.postAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
            </View>
            <View>
              <Text style={styles.postUserName}>{userName}</Text>
              <Text style={styles.postTimeText}>{date}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn}>
            <IconSymbol name="ellipsis" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Image */}
        <TouchableOpacity activeOpacity={0.92} onPress={() => navigateToDetail(item)}>
          <View style={styles.postImageContainer}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.postMainImage} resizeMode="cover" />
            ) : (
              <View style={[styles.postMainImage, styles.postImagePlaceholder]}>
                <IconSymbol name="photo" size={32} color="#334155" />
              </View>
            )}
            {checkingAccess === item.id && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(2, 6, 23, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 20 }]}>
                <ActivityIndicator size="large" color="#d4af37" />
              </View>
            )}
            {/* Gradient overlay bottom strip */}
            <View style={styles.postGlassOverlay}>
              <View style={styles.postGlassBadge}>
                <IconSymbol name="sparkles" size={10} color="#d4af37" />
                <Text style={styles.postGlassBadgeText}>EVENT</Text>
              </View>
              <Text style={styles.postEventTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.postEventSubtitle} numberOfLines={1}>
                {typeof item.location === 'string' ? item.location : (item.locationName || '')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.actionLeft}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
              <IconSymbol
                name={isLiked ? 'heart.fill' : 'heart'}
                size={22}
                color={isLiked ? '#ef4444' : '#94a3b8'}
              />
              {likeCount > 0 && <Text style={[styles.actionCount, isLiked && { color: '#ef4444' }]}>{likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleComments(item.id)}>
              <IconSymbol name="bubble.right" size={21} color={isCommentsOpen ? '#d4af37' : '#94a3b8'} />
              {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.actionRight}>
            <TouchableOpacity style={styles.actionBtn}>
              <IconSymbol name="square.and.arrow.up" size={20} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <IconSymbol name="bookmark" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expanded Comments Section */}
        {isCommentsOpen && (
          <View style={styles.commentsSection}>
            {eventComments.length > 3 && !showAllComments[item.id] && (
              <TouchableOpacity 
                style={styles.viewAllCommentsBtn} 
                onPress={() => setShowAllComments(prev => ({ ...prev, [item.id]: true }))}
              >
                <Text style={styles.viewAllCommentsText}>View all {commentCount} comments</Text>
              </TouchableOpacity>
            )}

            {(showAllComments[item.id] ? eventComments : eventComments.slice(0, 3)).map((c: any) => (
              <View key={c.id} style={styles.commentRow}>
                <Text style={styles.commentUser}>{c.userName}</Text>
                <Text style={styles.commentBody}>{c.text}</Text>
              </View>
            ))}

            {eventComments.length > 3 && showAllComments[item.id] && (
              <TouchableOpacity 
                style={styles.viewAllCommentsBtn} 
                onPress={() => setShowAllComments(prev => ({ ...prev, [item.id]: false }))}
              >
                <Text style={styles.viewAllCommentsText}>Show less</Text>
              </TouchableOpacity>
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment…"
                placeholderTextColor="#334155"
                value={commentText}
                onChangeText={setCommentText}
                returnKeyType="send"
                onSubmitEditing={() => handlePostComment(item.id)}
              />
              <TouchableOpacity
                style={[styles.postBtn, !commentText.trim() && { opacity: 0.35 }]}
                onPress={() => handlePostComment(item.id)}
                disabled={!commentText.trim() || postingComment}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Text style={styles.postBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const getFilteredUsers = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      // Suggestion mode: return users we are not following (excluding ourselves)
      return usersList.filter(u => u.id !== user?.uid && !followingIds.includes(u.id));
    }
    // Search mode: return users matching name, username or email (excluding ourselves)
    return usersList.filter(u => 
      u.id !== user?.uid && (
        u.name?.toLowerCase().includes(query) || 
        (u.username && u.username.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query))
      )
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* Header */}
        <LinearGradient colors={isDark ? ['#101010', '#050505'] : [colors.deepSlate, colors.background]} style={styles.header}>
          <View style={styles.topRow}>
            <View style={styles.headingLogoRow}>
              <EveBashLogoBadge onPress={() => router.replace('/(tabs)' as any)} />
              <Text style={styles.headerTitle}>Social Hub</Text>
            </View>
            <TouchableOpacity 
              style={styles.searchHeaderBtn}
              onPress={() => setSearchModalVisible(true)}
            >
              <IconSymbol name="magnifyingglass" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          keyboardShouldPersistTaps="handled"
        >
          {loading && feedItems.length === 0 ? (
            <View style={styles.centerContainer}><ActivityIndicator color={colors.gold} size="large" /></View>
          ) : (
            <View style={styles.feedList}>
              {feedItems.length > 0 ? (
                feedItems.map(renderFeedItem)
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="sparkles" size={48} color="#1e293b" />
                  <Text style={styles.emptyTitle}>Feed is empty</Text>
                  <Text style={styles.emptySubtitle}>Follow users who have created events to see them here.</Text>
                  <TouchableOpacity style={styles.discoverBtn} onPress={() => setSearchModalVisible(true)}>
                    <Text style={styles.discoverBtnText}>Discover People</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Instagram-Style Search/Discover Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={searchModalVisible}
          onRequestClose={handleCloseSearchModal}
        >
          <SafeAreaView style={styles.searchModalOverlay} edges={['top', 'bottom']}>
            <KeyboardAvoidingView 
              style={styles.searchModalContainer} 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              {/* Header Search Bar */}
              <View style={styles.searchModalHeader}>
                <View style={styles.searchBarContainer}>
                  <IconSymbol name="magnifyingglass" size={18} color={colors.slate400} style={styles.searchBarIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
                    placeholderTextColor={colors.slate400}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                      <IconSymbol name="xmark.circle.fill" size={16} color={colors.slate400} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={handleCloseSearchModal} style={styles.cancelSearchBtn}>
                  <Text style={styles.cancelSearchText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable list of suggestions / search results */}
              <ScrollView 
                style={styles.searchScroll}
                contentContainerStyle={styles.searchScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.searchSectionTitle}>
                  {searchQuery.trim() ? 'Search Results' : 'Suggested for You'}
                </Text>

                {getFilteredUsers().length > 0 ? (
                  getFilteredUsers().map((item) => {
                    const isFollowing = followingIds.includes(item.id);
                    return (
                      <View key={item.id} style={styles.searchUserCard}>
                        <View style={styles.searchUserInfoSimple}>
                          <View style={styles.searchAvatarSimple}>
                            {item.profileImage ? (
                              <Image source={{ uri: item.profileImage }} style={styles.searchAvatarImg} />
                            ) : (
                              <Text style={styles.searchAvatarChar}>{item.name?.charAt(0).toUpperCase()}</Text>
                            )}
                          </View>
                          <View style={styles.searchUserInfoText}>
                            <Text style={styles.searchUserNameText} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.username && (
                              <Text style={styles.searchUserHandleText} numberOfLines={1}>
                                @{item.username}
                              </Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={[styles.searchFollowBtn, isFollowing && styles.searchFollowingBtn]}
                          onPress={() => handleFollowToggle(item)}
                          disabled={actionLoading === item.id}
                        >
                          {actionLoading === item.id ? (
                            <ActivityIndicator size="small" color={isFollowing ? colors.slate400 : '#050505'} />
                          ) : (
                            <Text style={[styles.searchFollowBtnText, isFollowing && styles.searchFollowingBtnText]}>
                              {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.searchEmptyContainer}>
                    <IconSymbol name="person.2.fill" size={40} color={colors.slate800} />
                    <Text style={styles.searchEmptyText}>No users found</Text>
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Event Join Request Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={accessModalVisible}
          onRequestClose={() => setAccessModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalCloseBtn} 
                onPress={() => setAccessModalVisible(false)}
              >
                <IconSymbol name="xmark" size={18} color={colors.slate400} />
              </TouchableOpacity>

              <View style={styles.modalHeader}>
                <IconSymbol name="lock.fill" size={28} color="#d4af37" />
                <Text style={styles.modalTitle}>Private Event</Text>
              </View>
              
              <Text style={styles.modalSubtitle}>
                {selectedEvent?.title ? `"${selectedEvent.title}"` : 'This event'} is private.
              </Text>

              {accessStatus === 'none' ? (
                <>
                  <Text style={styles.modalMessage}>
                    You must request access to join this event and view its content. A request will be sent to the creator.
                  </Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalBtn, styles.modalBtnSecondary]} 
                      onPress={() => setAccessModalVisible(false)}
                      disabled={requestingAccess}
                    >
                      <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalBtn, styles.modalBtnPrimary]} 
                      onPress={handleSendJoinRequest}
                      disabled={requestingAccess}
                    >
                      {requestingAccess ? (
                        <ActivityIndicator size="small" color="#050505" />
                      ) : (
                        <Text style={styles.modalBtnPrimaryText}>Send Request</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : accessStatus === 'pending' ? (
                <>
                  <Text style={styles.modalMessage}>
                    Your request to join this event is currently pending approval from the creator.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.modalBtn, styles.modalBtnSingle]} 
                    onPress={() => setAccessModalVisible(false)}
                  >
                    <Text style={styles.modalBtnPrimaryText}>OK</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalMessage}>
                    Your request to join this event has been declined.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.modalBtn, styles.modalBtnSingle]} 
                    onPress={() => setAccessModalVisible(false)}
                  >
                    <Text style={styles.modalBtnPrimaryText}>OK</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, lineHeight: 38, fontFamily: 'Outfit_800ExtraBold', color: colors.white, letterSpacing: -1, includeFontPadding: false },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  content: { flex: 1 },
  centerContainer: { paddingTop: 100, alignItems: 'center', justifyContent: 'center' },
  feedList: { paddingTop: 8 },

  // === Post Card ===
  postContainer: {
    backgroundColor: colors.deepSlate,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    // Subtle elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  postAvatarRing: {
    padding: 1.5,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#d4af37',
  },
  postAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.slate800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  postAvatarText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  postUserName: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
  },
  postTimeText: {
    color: colors.slate400,
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  moreBtn: {
    padding: 4,
  },
  postImageContainer: {
    width: '100%',
    height: 210,
    overflow: 'hidden',
  },
  postMainImage: {
    width: '100%',
    height: '100%',
  },
  postImagePlaceholder: {
    backgroundColor: colors.slate800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postGlassOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(255,255,255,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.1)',
  },
  postGlassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  postGlassBadgeText: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  postEventTitle: {
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
  },
  postEventSubtitle: {
    color: colors.slate400,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },

  // === Action Bar ===
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 2,
  },
  actionCount: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },

  // === Comments ===
  commentsSection: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  viewAllCommentsBtn: {
    paddingVertical: 4,
    marginBottom: 6,
  },
  viewAllCommentsText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  commentUser: {
    color: colors.white,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    marginRight: 5,
  },
  commentBody: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0, 0, 0, 0.02)',
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  commentInput: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 9,
  },
  postBtn: {
    paddingLeft: 10,
  },
  postBtnText: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },

  // === Empty State ===
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { color: colors.white, fontSize: 20, fontFamily: 'Outfit_700Bold', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { color: colors.slate400, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  discoverBtn: { marginTop: 24, backgroundColor: '#d4af37', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  discoverBtnText: { color: '#050505', fontSize: 15, fontFamily: 'Outfit_700Bold' },

  // === User List ===
  userList: { padding: 16 },
  sectionTitle: { fontSize: 13, color: colors.slate400, fontFamily: 'Inter_800ExtraBold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20, marginTop: 24 },
  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0, 0, 0, 0.02)', borderRadius: 20, padding: 16, marginBottom: 12 },
  userInfoSimple: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarSimple: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.slate800, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarChar: { color: colors.gold, fontSize: 18, fontFamily: 'Outfit_700Bold' },
  userNameText: { color: colors.white, fontSize: 16, fontFamily: 'Outfit_700Bold' },
  userRoleText: { color: colors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular' },
  followBtn: { backgroundColor: '#d4af37', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.slate800 },
  followBtnText: { color: '#050505', fontSize: 13, fontFamily: 'Outfit_700Bold' },
  followingBtnText: { color: colors.slate400 },

  // === Business Card Feed Styles ===
  bizPostContainer: {
    borderColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
  },
  bizAvatarRing: {
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  bizAvatarText: {
    color: isDark ? '#818cf8' : '#4f46e5',
  },
  bizHeaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bizSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  shortlistedBadgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  followedBadgeText: {
    color: isDark ? '#818cf8' : '#4f46e5',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  bizHeartToggle: {
    padding: 6,
  },
  bizGlassOverlay: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(129, 140, 248, 0.2)',
  },
  bizGlassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bizGlassBadge: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  bizGlassBadgeText: {
    color: isDark ? '#818cf8' : '#4f46e5',
  },
  bizRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bizRatingText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  bizBottomContainer: {
    padding: 14,
    backgroundColor: isDark ? 'rgba(2, 6, 23, 0.4)' : 'rgba(255, 255, 255, 0.4)',
  },
  bizDescription: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 10,
  },
  bizFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  bizTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(129, 140, 248, 0.15)',
  },
  bizTagChipText: {
    color: isDark ? '#a5b4fc' : '#4f46e5',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  bizActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bizViewProfileBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(129, 140, 248, 0.04)',
  },
  bizViewProfileText: {
    color: isDark ? '#a5b4fc' : '#4f46e5',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  bizInquireBtn: {
    flex: 1.2,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bizInquireGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bizInquireText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  selfBadgeText: {
    color: isDark ? '#818cf8' : '#4f46e5',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    marginLeft: 2,
  },
  bizViewAllCommentsText: {
    color: isDark ? '#818cf8' : '#4f46e5',
  },
  bizCommentUser: {
    color: isDark ? '#a5b4fc' : '#4f46e5',
  },
  bizPostBtnText: {
    color: isDark ? '#818cf8' : '#4f46e5',
  },
  activityBodyContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  activityBadgeRow: {
    marginBottom: 8,
  },
  announcementBubble: {
    backgroundColor: 'rgba(129, 140, 248, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#818cf8',
    padding: 12,
    borderRadius: 8,
    position: 'relative',
  },
  announcementText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  quoteIconLeft: {
    position: 'absolute',
    top: 4,
    left: 4,
    opacity: 0.1,
  },
  faqBubble: {
    backgroundColor: 'rgba(129, 140, 248, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(129, 140, 248, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  faqQuestion: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    lineHeight: 20,
  },
  faqDivider: {
    height: 0.5,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    marginVertical: 8,
  },
  faqAnswer: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  portfolioPhotoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(129, 140, 248, 0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(129, 140, 248, 0.15)',
  },
  portfolioPhoto: {
    width: '100%',
    height: 180,
  },
  portfolioPhotoCaption: {
    color: colors.slate400,
    fontSize: 12,
    padding: 10,
    fontFamily: 'Inter_500Medium',
  },
  // === Modal Styles ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    padding: 6,
    zIndex: 10,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    marginTop: 4,
  },
  modalSubtitle: {
    color: '#d4af37',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: '#d4af37',
  },
  modalBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnSingle: {
    backgroundColor: '#d4af37',
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  modalBtnSecondaryText: {
    color: colors.slate400,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },

  // === Search Header Button ===
  searchHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // === Instagram-style Search Modal Styles ===
  searchModalOverlay: {
    flex: 1,
    backgroundColor: isDark ? '#050505' : colors.background,
  },
  searchModalContainer: {
    flex: 1,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 4,
  },
  cancelSearchBtn: {
    paddingVertical: 8,
    paddingLeft: 4,
  },
  cancelSearchText: {
    color: colors.gold,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  searchScroll: {
    flex: 1,
  },
  searchScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchSectionTitle: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginTop: 8,
  },
  searchUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchUserInfoSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  searchAvatarSimple: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.slate800,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  searchAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchAvatarChar: {
    color: colors.gold,
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  searchUserInfoText: {
    flex: 1,
    justifyContent: 'center',
  },
  searchUserNameText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  searchUserHandleText: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  searchFollowBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 85,
    alignItems: 'center',
  },
  searchFollowingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.slate800,
  },
  searchFollowBtnText: {
    color: '#050505',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  searchFollowingBtnText: {
    color: colors.slate400,
  },
  searchEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  searchEmptyText: {
    color: colors.slate400,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});

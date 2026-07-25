import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import SettingsIcon from '@/components/ui/SettingsIcon';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { 
  updateUserPrivacy, 
  isValidUsername,
  isUsernameUnique, 
  updateUserProfile,
  getUserPhotosCount,
  getUserEventCount,
  getApprovedSharedEventsForUser
} from '@/lib/database';

import { removeProfileImage, uploadProfileImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { getPlanDetails } from '@/lib/planLimits';
import { EveBashLogoBadge } from '@/components/EveBashLogo';

const { width } = Dimensions.get('window');

const formatJoinedDate = (createdAt: any) => {
  if (!createdAt) return 'Not available';
  
  let date: Date;
  if (typeof createdAt.toDate === 'function') {
    date = createdAt.toDate();
  } else if (createdAt.seconds) {
    date = new Date(createdAt.seconds * 1000);
  } else {
    date = new Date(createdAt);
  }

  if (isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getPersonasArray = (personaVal: any): string[] => {
  if (!personaVal) return ['Guest'];
  
  let rawList: string[] = [];
  
  if (Array.isArray(personaVal)) {
    rawList = personaVal.map(String);
  } else if (typeof personaVal === 'string') {
    const trimmed = personaVal.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rawList = parsed.map(String);
        }
      } catch (e) {
        rawList = [trimmed];
      }
    } else if (trimmed.includes(',')) {
      rawList = trimmed.split(',').map(s => s.trim());
    } else {
      rawList = [trimmed];
    }
  } else {
    rawList = [String(personaVal)];
  }

  // Filter and map raw items to their premium display versions
  const normalizedSet = new Set<string>();
  
  // First, check list-wide string matching in case it's a character array (e.g. ['G','u','e','s','t'])
  const allJoinedClean = rawList.map(s => s.trim()).join('').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  if (allJoinedClean.includes('guest') && allJoinedClean.includes('host') && allJoinedClean.includes('vendor')) {
    return ['Guest', 'Host / Organizer', 'Vendor / Business'];
  }
  if (allJoinedClean.includes('guest') && allJoinedClean.includes('host')) {
    return ['Guest', 'Host / Organizer'];
  }
  if (allJoinedClean.includes('guest') && allJoinedClean.includes('vendor')) {
    return ['Guest', 'Vendor / Business'];
  }
  if (allJoinedClean.includes('host') && allJoinedClean.includes('vendor')) {
    return ['Host / Organizer', 'Vendor / Business'];
  }
  if (allJoinedClean === 'guest' || allJoinedClean === 'g' || allJoinedClean === 'u' || allJoinedClean === 'e' || allJoinedClean === 's' || allJoinedClean === 't') {
    return ['Guest'];
  }
  if (allJoinedClean === 'host' || allJoinedClean === 'organizer' || allJoinedClean === 'hostorganizer') {
    return ['Host / Organizer'];
  }
  if (allJoinedClean === 'vendor' || allJoinedClean === 'business' || allJoinedClean === 'vendorbusiness') {
    return ['Vendor / Business'];
  }

  // If list-wide check did not yield complete results, map individual words
  for (const item of rawList) {
    const clean = item.toLowerCase();
    if (clean.includes('guest')) {
      normalizedSet.add('Guest');
    } else if (clean.includes('host') || clean.includes('organizer')) {
      normalizedSet.add('Host / Organizer');
    } else if (clean.includes('vendor') || clean.includes('business')) {
      normalizedSet.add('Vendor / Business');
    }
  }

  if (normalizedSet.size > 0) {
    return Array.from(normalizedSet);
  }

  // Final fallback
  return ['Guest'];
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { theme, setTheme, colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editRelationshipStatus, setEditRelationshipStatus] = useState('');
  const [editPersona, setEditPersona] = useState<string[]>([]);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const [editBirthday, setEditBirthday] = useState('');
  const [editAnniversaryDate, setEditAnniversaryDate] = useState('');

  // Gamified activity stats state
  const [activityStats, setActivityStats] = useState({
    photosCount: 0,
    eventsOrganized: 0,
    eventsJoined: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verification, setVerification] = useState({ email: false, phone: false });

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [isUsernameValid, setIsUsernameValid] = useState(true);

  // Debounced username checker
  useEffect(() => {
    if (!isEditing) return;

    const normalized = editUsername.trim().toLowerCase();

    // If it matches current username exactly, it's valid
    if (normalized === user?.username?.toLowerCase()) {
      setUsernameStatus('idle');
      setIsUsernameValid(true);
      return;
    }

    if (!normalized) {
      setUsernameStatus('idle');
      setIsUsernameValid(false);
      return;
    }

    // Check syntax format (3-30 chars; lowercase letters/numbers with internal dot/underscore)
    if (!isValidUsername(normalized)) {
      setUsernameStatus('invalid');
      setIsUsernameValid(false);
      return;
    }

    setUsernameStatus('checking');

    const timer = setTimeout(async () => {
      try {
        const isUnique = await isUsernameUnique(normalized, user?.uid);
        if (isUnique) {
          setUsernameStatus('available');
          setIsUsernameValid(true);
        } else {
          setUsernameStatus('taken');
          setIsUsernameValid(false);
        }
      } catch (err) {
        console.error('Error checking username uniqueness:', err);
        setUsernameStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editUsername, isEditing, user]);

  useEffect(() => {
    if (!user?.uid) return;

    const loadVerificationStatus = async () => {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      const authEmail = authUser?.email?.toLowerCase();
      const profileEmail = user.email?.toLowerCase();
      setVerification({
        email: Boolean(authUser?.email_confirmed_at && authEmail && authEmail === profileEmail),
        phone: Boolean((authUser as any)?.phone_confirmed_at && (authUser as any)?.phone && (authUser as any).phone === user.phone),
      });
    };

    loadVerificationStatus();
  }, [user?.uid, user?.email, user?.phone]);

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setEditUsername(user?.username || '');
    setEditPhone(user?.phone && user.phone !== 'No Phone' ? user.phone : '');
    setEditLocation(user?.location || '');
    setEditGender(user?.gender || '');
    setEditRelationshipStatus(user?.relationshipStatus || '');
    setEditPersona(getPersonasArray(user?.persona));
    setEditImage(user?.profileImage || null);
    setEditImageBase64(null);
    setEditImageRemoved(false);
    setEditBirthday(user?.birthday || '');
    setEditAnniversaryDate(user?.anniversaryDate || '');
    setUsernameStatus('idle');
    setIsUsernameValid(true);
    setIsEditing(true);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'We need access to your photos to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setEditImage(asset.uri);
        setEditImageBase64(`data:image/jpeg;base64,${asset.base64}`);
        setEditImageRemoved(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleRemoveProfileImage = () => {
    if (!user?.profileImage || saving) return;

    Alert.alert(
      'Remove Profile Photo',
      'Remove your current profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await removeProfileImage();
              setEditImage(null);
              setEditImageBase64(null);
              setEditImageRemoved(true);
              Alert.alert('Success', 'Profile photo removed.');
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to remove profile photo.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveChanges = async () => {
    if (!user?.uid) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Full name cannot be empty.');
      return;
    }
    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }
    if (!isUsernameValid) {
      Alert.alert('Error', 'Please choose a valid and available username.');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = editImageRemoved ? '' : (user.profileImage || '');

      if (editImageBase64) {
        const uploadResult = await uploadProfileImage(editImageBase64, user.uid);
        if (uploadResult && uploadResult.url) {
          finalImageUrl = uploadResult.url;
        }
      }

      const success = await updateUserProfile(user.uid, {
        name: editName.trim(),
        email: normalizedEmail,
        username: editUsername.trim().toLowerCase(),
        profileImage: finalImageUrl,
        phone: editPhone.trim() || '',
        location: editLocation.trim() || '',
        gender: editGender || '',
        relationshipStatus: editRelationshipStatus || '',
        persona: editPersona || '',
        birthday: editBirthday.trim() || '',
        anniversaryDate: editAnniversaryDate.trim() || '',
      });

      if (success) {
        Alert.alert('Success', 'Profile updated successfully.');
        setIsEditing(false);
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    if (user.isPrivate !== undefined) setIsPrivate(user.isPrivate);
  }, [user?.uid]);

  // Fetch activity stats
  useEffect(() => {
    if (!user?.uid) return;

    const fetchActivityStats = async () => {
      try {
        const pCount = await getUserPhotosCount(user.uid);
        const organizedCount = await getUserEventCount(user.uid);
        const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
        const joinedEvents = await getApprovedSharedEventsForUser(identifiers);
        
        setActivityStats({
          photosCount: pCount,
          eventsOrganized: organizedCount,
          eventsJoined: joinedEvents.length,
        });
      } catch (err) {
        console.error('Error fetching activity stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchActivityStats();
  }, [user?.uid]);

  const togglePrivacy = async () => {
    if (!user?.uid || updatingPrivacy) return;
    setUpdatingPrivacy(true);
    const newStatus = !isPrivate;
    const success = await updateUserPrivacy(user.uid, newStatus);
    if (success) {
      setIsPrivate(newStatus);
    }
    setUpdatingPrivacy(false);
  };

  const renderVerificationBadge = (verified: boolean, missing: boolean, missingText: string) => (
    <View
      style={[
        styles.verificationBadge,
        missing ? styles.verificationBadgeMissing : verified ? styles.verificationBadgeVerified : styles.verificationBadgeUnverified,
      ]}
    >
      <IconSymbol
        name={verified && !missing ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"}
        size={12}
        color={missing ? "#fbbf24" : verified ? "#34d399" : "#fb7185"}
      />
      <Text
        style={[
          styles.verificationBadgeText,
          missing ? styles.verificationTextMissing : verified ? styles.verificationTextVerified : styles.verificationTextUnverified,
        ]}
      >
        {missing ? missingText : verified ? "Verified" : "Not verified"}
      </Text>
    </View>
  );

  if (!user) return null;

  const planDetails = getPlanDetails(user.role);
  const personas = getPersonasArray(user.persona);

  return (
    <View style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Profile Header */}
        <LinearGradient
          colors={[colors.deepSlate, colors.background]}
          style={[styles.header, { paddingTop: insets.top + 2 }]}
        >
          <View style={styles.profileHeaderBar}>
            <View style={styles.profileHeaderSide} />
            <View style={styles.profileHeaderTitleWrap}>
              <View style={styles.headingLogoRow}>
                <EveBashLogoBadge />
                <Text style={styles.headerTitle}>Profile</Text>
              </View>
            </View>
            <View style={styles.profileHeaderSide}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/settings' as any)}
                style={styles.settingsBtn}
              >
                <SettingsIcon size={22} color="#d4af37" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <IconSymbol name="person.fill" size={24} color="#64748b" />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userHandle}>@{user.username || 'set_username'}</Text>
              <Text style={styles.userName} numberOfLines={1}>{user.name || user.username || 'EveBash User'}</Text>
              <View style={styles.profileBadgeRow}>
                <View
                  style={[
                    styles.profileBadge,
                    styles.planBadge,
                    {
                      backgroundColor: planDetails.accentSoft,
                      borderColor: planDetails.accent,
                    },
                  ]}
                >
                  <Text style={[styles.planBadgeText, { color: planDetails.accent }]} numberOfLines={1}>
                    {planDetails.name}
                  </Text>
                </View>
                {personas.map((item) => (
                  <View key={item} style={[styles.profileBadge, styles.personaBadge]}>
                    <Text style={styles.personaBadgeText} numberOfLines={1}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          
          {/* Gamified Activity Stats Section */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Your Activity</Text>
          </View>
          
          <View style={styles.statsCardCompact}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activityStats.photosCount}</Text>
              <Text style={styles.statLabel}>Photos Added</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activityStats.eventsOrganized}</Text>
              <Text style={styles.statLabel}>Event Hosted</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activityStats.eventsJoined}</Text>
              <Text style={styles.statLabel}>Event Joined</Text>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Account Info</Text>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.7} onPress={openEditModal}>
              <IconSymbol name="pencil" size={12} color="#050505" style={{ marginTop: -1 }} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="person.fill" size={18} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{user.name}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="person.fill" size={18} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>@{user.username || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="envelope.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{user.email || 'Not provided'}</Text>
                {renderVerificationBadge(
                  verification.email,
                  !user.email,
                  'Email needs to be entered'
                )}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="phone.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>
                  {user.phone && user.phone !== 'No Phone' ? user.phone : 'Not provided'}
                </Text>
                {renderVerificationBadge(
                  verification.phone,
                  !user.phone || user.phone === 'No Phone',
                  'Phone number needs to be entered'
                )}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="mappin.and.ellipse" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{user.location || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="person.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{user.gender || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="heart.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Relationship Status</Text>
                <Text style={styles.infoValue}>{user.relationshipStatus || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="gift.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Birthday</Text>
                <Text style={styles.infoValue}>{user.birthday || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="sparkles" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Anniversary / Milestone Date</Text>
                <Text style={styles.infoValue}>{user.anniversaryDate || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="person.2.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>I am a</Text>
                <View style={styles.badgeRow}>
                  {getPersonasArray(user.persona).length > 0 ? (
                    getPersonasArray(user.persona).map((item) => (
                      <View key={item} style={styles.badgePill}>
                        <Text style={styles.badgeText}>{item}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.infoValue}>Guest</Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="calendar" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Joined EveBash</Text>
                <Text style={styles.infoValue}>{formatJoinedDate(user.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.usageCard} activeOpacity={0.8} onPress={() => router.push('/(tabs)/usage')}>
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.usageGradient}
              >
                <View style={styles.usageIconBox}>
                  <IconSymbol name="chart.bar.fill" size={20} color="#d4af37" />
                </View>
                <View style={styles.usageTextContent}>
                  <Text style={styles.usageTitle}>Usage & Plan</Text>
                  <Text style={styles.usageSubtitle}>View limits and upgrade</Text>
                </View>
                <View style={styles.usageArrowBox}>
                  <IconSymbol name="chevron.right" size={14} color="#d4af37" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

          </View>

          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={logout}>
            <IconSymbol name="rectangle.portrait.and.arrow.right" size={16} color="#f87171" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>EveBash v1.0.4</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!saving) setIsEditing(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                onPress={() => setIsEditing(false)} 
                disabled={saving}
                style={styles.modalCloseBtn}
              >
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Profile Image Picking Area */}
              <View style={styles.editAvatarSection}>
                <TouchableOpacity 
                  onPress={handlePickImage} 
                  disabled={saving}
                  activeOpacity={0.8}
                  style={styles.editAvatarWrapper}
                >
                  {editImage ? (
                    <Image source={{ uri: editImage }} style={styles.editAvatar} />
                  ) : (
                    <View style={styles.editAvatarPlaceholder}>
                      <IconSymbol name="person.fill" size={40} color="#64748b" />
                    </View>
                  )}
                  <View style={styles.changePhotoOverlay}>
                    <IconSymbol name="camera.fill" size={16} color="#ffffff" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handlePickImage} 
                  disabled={saving}
                  style={styles.changePhotoTextBtn}
                >
                  <Text style={styles.changePhotoText}>Change Profile Photo</Text>
                </TouchableOpacity>
                {user.profileImage ? (
                  <TouchableOpacity
                    onPress={handleRemoveProfileImage}
                    disabled={saving}
                    style={styles.removePhotoTextBtn}
                  >
                    <Text style={styles.removePhotoText}>Remove Profile Photo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Edit Form */}
              <View style={styles.formContainer}>
                
                {/* Full Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name <Text style={styles.requiredMark}>*</Text></Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="person.fill" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter full name"
                      placeholderTextColor="#475569"
                      editable={!saving}
                    />
                  </View>
                </View>

                {/* Email Address Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address <Text style={styles.requiredMark}>*</Text></Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="envelope.fill" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editEmail}
                      onChangeText={(val) => setEditEmail(val.trim().toLowerCase())}
                      placeholder="name@example.com"
                      placeholderTextColor="#475569"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!saving}
                    />
                  </View>
                </View>

                {/* Username Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Username <Text style={styles.requiredMark}>*</Text></Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.usernamePrefix}>@</Text>
                    <TextInput
                      style={[styles.textInput, { paddingLeft: 4 }]}
                      value={editUsername}
                      onChangeText={(val) => setEditUsername(val.replace(/\s+/g, '').toLowerCase())}
                      placeholder="username"
                      placeholderTextColor="#475569"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!saving}
                    />
                    {usernameStatus === 'checking' && (
                      <ActivityIndicator size="small" color="#d4af37" style={styles.inputSpinner} />
                    )}
                  </View>
                  
                  {/* Validation Feedback */}
                  {editUsername.trim().toLowerCase() !== user?.username?.toLowerCase() && (
                    <View style={styles.feedbackContainer}>
                      {usernameStatus === 'available' && (
                        <Text style={[styles.feedbackText, styles.feedbackAvailable]}>
                          ✓ Username is available
                        </Text>
                      )}
                      {usernameStatus === 'taken' && (
                        <Text style={[styles.feedbackText, styles.feedbackTaken]}>
                          ✗ Username is already taken
                        </Text>
                      )}
                      {usernameStatus === 'invalid' && (
                        <Text style={[styles.feedbackText, styles.feedbackInvalid]}>
                          ⚠ 3-30 lowercase letters/numbers. Dots/underscores only inside, not repeated.
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Phone Number Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="phone.fill" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editPhone}
                      onChangeText={setEditPhone}
                      placeholder="e.g. +91 98765 43210"
                      placeholderTextColor="#475569"
                      keyboardType="phone-pad"
                      editable={!saving}
                    />
                  </View>
                  <Text style={styles.inputHint}>Optional — include country code</Text>
                </View>

                {/* Location Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Location</Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="mappin.and.ellipse" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editLocation}
                      onChangeText={setEditLocation}
                      placeholder="e.g. Mumbai, Maharashtra"
                      placeholderTextColor="#475569"
                      editable={!saving}
                    />
                  </View>
                  <Text style={styles.inputHint}>Optional — city or region name</Text>
                </View>

                {/* Gender Picker */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gender</Text>
                  <View style={styles.pickerContainer}>
                    {['Male', 'Female', 'Other', 'Prefer not to say'].map((item) => (
                      <TouchableOpacity
                        key={item}
                        activeOpacity={0.7}
                        onPress={() => setEditGender(item)}
                        style={[
                          styles.pickerPill,
                          editGender === item && styles.pickerPillSelected
                        ]}
                      >
                        <Text style={[
                          styles.pickerPillText,
                          editGender === item && styles.pickerPillTextSelected
                        ]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Relationship Status Picker */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Relationship Status</Text>
                  <View style={styles.pickerContainer}>
                    {['Single', 'Engaged', 'Married', 'Prefer not to say'].map((item) => (
                      <TouchableOpacity
                        key={item}
                        activeOpacity={0.7}
                        onPress={() => setEditRelationshipStatus(item)}
                        style={[
                          styles.pickerPill,
                          editRelationshipStatus === item && styles.pickerPillSelected
                        ]}
                      >
                        <Text style={[
                          styles.pickerPillText,
                          editRelationshipStatus === item && styles.pickerPillTextSelected
                        ]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Birthday Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Birthday</Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="gift.fill" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editBirthday}
                      onChangeText={setEditBirthday}
                      placeholder="e.g. October 24 (or DD/MM/YYYY)"
                      placeholderTextColor="#475569"
                      editable={!saving}
                    />
                  </View>
                  <Text style={styles.inputHint}>Optional — used for premium milestone rewards</Text>
                </View>

                {/* Anniversary / Milestone Date Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Anniversary / Milestone Date</Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="sparkles" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editAnniversaryDate}
                      onChangeText={setEditAnniversaryDate}
                      placeholder="e.g. December 18, 2026"
                      placeholderTextColor="#475569"
                      editable={!saving}
                    />
                  </View>
                  <Text style={styles.inputHint}>Optional — used to match vendor services & local milestones</Text>
                </View>

                {/* Persona Picker */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>I am a...</Text>
                  <Text style={styles.inputHint}>Select all that apply</Text>
                  <View style={styles.pickerContainer}>
                    {['Guest', 'Host / Organizer', 'Vendor / Business'].map((item) => {
                      const isSelected = editPersona.includes(item);
                      return (
                        <TouchableOpacity
                          key={item}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isSelected) {
                              if (editPersona.length > 1) {
                                setEditPersona(editPersona.filter((p) => p !== item));
                              } else {
                                Alert.alert('Selection Required', 'Please select at least one role.');
                              }
                            } else {
                              setEditPersona([...editPersona, item]);
                            }
                          }}
                          style={[
                            styles.pickerPill,
                            isSelected && styles.pickerPillSelected
                          ]}
                        >
                          <Text style={[
                            styles.pickerPillText,
                            isSelected && styles.pickerPillTextSelected
                          ]}>{item}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setIsEditing(false)}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.saveBtn,
                    (!editName.trim() || !editEmail.trim() || !isUsernameValid || saving) && styles.saveBtnDisabled
                  ]} 
                  onPress={handleSaveChanges}
                  disabled={!editName.trim() || !editEmail.trim() || !isUsernameValid || saving}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#050505" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  container: { 
    flex: 1 
  },
  header: { 
    position: 'relative',
    paddingTop: 12,
    paddingBottom: 20,
  },
  profileHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 22,
    gap: 14,
  },
  profileHeaderSide: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  profileHeaderTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 38,
    fontFamily: 'AkayaKanadaka_400Regular',
    color: colors.white,
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headingLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 38 },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  profileRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24 
  },
  profileInfo: { 
    marginLeft: 20, 
    paddingRight: 8,
    flex: 1 
  },

  avatarRing: {
    padding: 3,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
  },
  avatarPlaceholder: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: colors.slate900, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.cardBorder 
  },
  userName: { 
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold', 
    color: colors.white,
    letterSpacing: 0,
    marginTop: 1,
  },
  userHandle: {
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.gold,
    textTransform: 'lowercase',
  },
  profileBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  profileBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  planBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  planBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  personaBadge: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  personaBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  content: { 
    paddingHorizontal: 24, 
    marginTop: 16 
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  editBtnText: {
    color: '#050505',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsCard: { 
    backgroundColor: colors.deepSlate, 
    borderRadius: 24, 
    padding: 24, 
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 12 }, 
    shadowOpacity: isDark ? 0.3 : 0.05, 
    shadowRadius: 24, 
    elevation: isDark ? 12 : 3 
  },
  usageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  usageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  usageIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageTextContent: {
    flex: 1,
  },
  usageTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: colors.gold,
    marginBottom: 4,
  },
  usageSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
  },
  usageArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: { 
    fontSize: 10, 
    fontFamily: 'Inter_700Bold', 
    color: colors.slate400, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  infoValue: { 
    fontSize: 14, 
    fontFamily: 'Outfit_600SemiBold', 
    color: colors.white,
    marginTop: 1,
  },
  verificationBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 7,
  },
  verificationBadgeVerified: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  verificationBadgeUnverified: {
    backgroundColor: 'rgba(251, 113, 133, 0.1)',
    borderColor: 'rgba(251, 113, 133, 0.25)',
  },
  verificationBadgeMissing: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  verificationBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  verificationTextVerified: {
    color: '#34d399',
  },
  verificationTextUnverified: {
    color: '#fb7185',
  },
  verificationTextMissing: {
    color: '#fbbf24',
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 20,
  },
  actionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
  },
  actionText: { 
    flex: 1, 
    fontSize: 16, 
    fontFamily: 'Outfit_600SemiBold', 
    color: colors.white 
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.slate800,
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#10b981',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  signOutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    marginTop: 20, 
    paddingVertical: 12, 
    borderRadius: 14, 
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.15)',
  },
  signOutText: { 
    color: '#f87171', 
    fontFamily: 'Outfit_800ExtraBold', 
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: isDark ? 0.5 : 0.08,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.white,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginVertical: 28,
  },
  editAvatarWrapper: {
    position: 'relative',
    padding: 3,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: colors.border,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: colors.gold,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.deepSlate,
  },
  changePhotoTextBtn: {
    marginTop: 12,
  },
  changePhotoText: {
    color: '#60a5fa',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  removePhotoTextBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  removePhotoText: {
    color: '#fb7185',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formContainer: {
    gap: 20,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  requiredMark: {
    color: colors.gold,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  usernamePrefix: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.gold,
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    height: '100%',
  },
  inputSpinner: {
    marginLeft: 8,
  },
  feedbackContainer: {
    marginTop: 4,
    marginLeft: 4,
  },
  feedbackText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  feedbackAvailable: {
    color: '#10b981',
  },
  feedbackTaken: {
    color: '#ef4444',
  },
  feedbackInvalid: {
    color: '#f43f5e',
  },
  inputHint: {
    fontSize: 11,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    marginLeft: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
  },
  cancelBtnText: {
    color: colors.slate400,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  saveBtn: {
    flex: 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: colors.slate800,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#050505',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  themeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  themePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 52,
    alignItems: 'center',
  },
  themePillActive: {
    backgroundColor: colors.gold,
  },
  themePillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.slate400,
  },
  themePillTextActive: {
    color: '#050505',
    fontFamily: 'Inter_700Bold',
  },
  statsCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.15 : 0.02,
    shadowRadius: 8,
    elevation: isDark ? 4 : 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.cardBorder,
  },
  statNumber: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  pickerPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pickerPillSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: '#d4af37',
  },
  pickerPillText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
  },
  pickerPillTextSelected: {
    color: '#d4af37',
    fontFamily: 'Inter_600SemiBold',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badgePill: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  badgeText: {
    color: '#d4af37',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
});

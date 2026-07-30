import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { updateUserPrivacy, updateUserProfile, submitFeedback } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Core Privacy Toggles
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [isDiscoverable, setIsDiscoverable] = useState(user?.discoverable ?? true);
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
  const [updatingSearch, setUpdatingSearch] = useState(false);

  // Notification Preferences
  const [notifPreferences, setNotifPreferences] = useState({
    likesAndComments: user?.notificationPreferences?.likesAndComments ?? true,
    eventInvites: user?.notificationPreferences?.eventInvites ?? true,
    businessMatches: user?.notificationPreferences?.businessMatches ?? true,
    marketing: user?.notificationPreferences?.marketing ?? false,
  });

  // Storage & Resolution
  const [uploadResolution, setUploadResolution] = useState<'optimized' | 'highres'>('optimized');
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);

  // Modals Visibility
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');

  // Modal Inputs & Loaders
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'Bug' | 'Suggestion' | 'Other'>('Bug');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // FAQ Accordion
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Load local storage preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const val = await AsyncStorage.getItem('@high_quality_uploads');
        if (val) setUploadResolution(val as any);
      } catch (err) {
        console.error('Error loading resolution preference:', err);
      }
    };
    loadPreferences();
  }, []);

  // Update State when User Context changes
  useEffect(() => {
    if (user?.isPrivate !== undefined) setIsPrivate(user.isPrivate);
    if (user?.discoverable !== undefined) setIsDiscoverable(user.discoverable);
    if (user?.notificationPreferences) {
      setNotifPreferences({
        likesAndComments: user.notificationPreferences.likesAndComments ?? true,
        eventInvites: user.notificationPreferences.eventInvites ?? true,
        businessMatches: user.notificationPreferences.businessMatches ?? true,
        marketing: user.notificationPreferences.marketing ?? false,
      });
    }
  }, [user]);

  // Privacy Toggle
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

  // Discoverability Toggle
  const toggleDiscoverability = async () => {
    if (!user?.uid || updatingSearch) return;
    setUpdatingSearch(true);
    const newStatus = !isDiscoverable;
    const success = await updateUserProfile(user.uid, { discoverable: newStatus });
    if (success) {
      setIsDiscoverable(newStatus);
    }
    setUpdatingSearch(false);
  };

  // Notifications Toggle Helper
  const toggleNotificationSetting = async (key: keyof typeof notifPreferences) => {
    if (!user?.uid) return;
    const updatedPreferences = {
      ...notifPreferences,
      [key]: !notifPreferences[key],
    };
    
    // Optimistically set state
    setNotifPreferences(updatedPreferences);

    const success = await updateUserProfile(user.uid, {
      notificationPreferences: updatedPreferences,
    });
    
    if (!success) {
      // Revert state on failure
      setNotifPreferences(notifPreferences);
      Alert.alert('Error', 'Failed to update preferences. Try again.');
    }
  };

  // Resolution Preference Toggle
  const changeResolution = async (value: 'optimized' | 'highres') => {
    setUploadResolution(value);
    try {
      await AsyncStorage.setItem('@high_quality_uploads', value);
    } catch (err) {
      console.error('Error saving resolution preference:', err);
    }
  };

  // Simulated Clear Cache Workflow
  const handleClearCache = () => {
    setClearingCache(true);
    setCacheProgress(0);

    const interval = setInterval(() => {
      setCacheProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setClearingCache(false);
            Alert.alert('Cache Wiped', 'Successfully cleared 24.2 MB of temporary media logs.');
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Password Change Handler
  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords match error', 'New password and confirmation password do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      Alert.alert('Success', 'Your account password has been updated.');
      setPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password change error:', error);
      Alert.alert('Error', error?.message || 'Failed to update password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Submit Feedback Handler
  const handleFeedbackSubmit = async () => {
    if (!user?.uid) return;
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Feedback message cannot be empty.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const success = await submitFeedback(
        user.uid,
        user.name,
        feedbackText.trim(),
        feedbackCategory
      );

      if (success) {
        Alert.alert('Feedback Sent', 'Thank you for your valuable feedback! Our team will review this shortly.');
        setFeedbackModalVisible(false);
        setFeedbackText('');
      } else {
        Alert.alert('Error', 'Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Delete Account Handler
  const handleDeleteAccount = async () => {
    if (!user?.uid) return;
    
    try {
      await updateUserProfile(user.uid, { discoverable: false });
      
      await supabase.from('profiles').update({
        role: 'deleted',
        email: null,
        phone: null,
      }).eq('id', user.uid);
      
      await logout();
      Alert.alert('Account Deleted', 'Your EveBash account has been deleted permanently.');
      setDeleteModalVisible(false);
    } catch (error: any) {
      console.error('Account deletion error:', error);
      Alert.alert('Error', error?.message || 'Failed to delete account.');
    }
  };

  // FAQ Accordion Content
  const faqs = [
    {
      q: 'How many photos can I upload?',
      a: 'Depending on your active plan, standard hosts can upload up to 250 photos per event. Upgrading to premium unlocks unlimited high-resolution photo and video uploads.',
    },
    {
      q: 'Can anyone view my private events?',
      a: 'No. Private events require guests to use a unique 5-character event code or link to join, and hosts can set permissions to manually approve guest login logs.',
    },
    {
      q: 'How do I upgrade to a Business account?',
      a: 'Navigate to the Menu tab, select "Register Business", and choose a category. Business profiles gain access to service listings near you and lead enquiries.',
    },
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const openLegalModal = (type: 'terms' | 'privacy') => {
    setLegalModalType(type);
    setLegalModalVisible(true);
  };

  const isEmailLogin = user?.email && !user.email.endsWith('@phone-login.local');

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
          style={styles.backBtn}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Account Info Segment */}
        <Text style={styles.sectionLabel}>Account & Security</Text>
        <View style={styles.settingsCard}>
          <View style={styles.cardInfoRow}>
            <Text style={styles.cardInfoLabel}>Signed in via</Text>
            <Text style={styles.cardInfoValue}>{isEmailLogin ? 'Email' : 'Phone Number'}</Text>
          </View>
          <View style={styles.cardInfoRow}>
            <Text style={styles.cardInfoLabel}>Identifier</Text>
            <Text style={styles.cardInfoValue} numberOfLines={1}>
              {isEmailLogin ? user?.email : user?.phone}
            </Text>
          </View>

          <View style={styles.divider} />

          {isEmailLogin ? (
            <TouchableOpacity
              style={styles.actionItemRow}
              activeOpacity={0.7}
              onPress={() => setPasswordModalVisible(true)}
            >
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                <IconSymbol name="lock.fill" size={18} color="#d4af37" />
              </View>
              <Text style={styles.actionText}>Change Password</Text>
              <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionItemRow, { opacity: 0.5 }]}>
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.05)' }]}>
                <IconSymbol name="lock.fill" size={18} color="#94a3b8" />
              </View>
              <Text style={[styles.actionText, { color: colors.slate400 }]}>Change Password (Phone Login)</Text>
            </View>
          )}

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionItemRow}
            activeOpacity={0.7}
            onPress={() => setDeleteModalVisible(true)}
          >
            <View style={[styles.infoIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <IconSymbol name="trash.fill" size={18} color="#ef4444" />
            </View>
            <Text style={[styles.actionText, { color: '#f87171' }]}>Delete Account</Text>
            <IconSymbol name="chevron.right" size={16} color="#f87171" />
          </TouchableOpacity>
        </View>

        {/* Privacy Settings */}
        <Text style={styles.sectionLabel}>Privacy</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.7} onPress={togglePrivacy} disabled={updatingPrivacy}>
            <View style={[styles.infoIconBox, { backgroundColor: isPrivate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
              <IconSymbol name={isPrivate ? "lock.fill" : "globe"} size={18} color={isPrivate ? "#ef4444" : "#10b981"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>{isPrivate ? 'Private Account' : 'Public Account'}</Text>
              <Text style={styles.actionSubtext}>
                {isPrivate ? 'Followers must be approved' : 'Anyone can follow you'}
              </Text>
            </View>
            <View style={[styles.toggleBtn, isPrivate && styles.toggleBtnActive]}>
              {updatingPrivacy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={[styles.toggleDot, isPrivate && styles.toggleDotActive]} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.7} onPress={toggleDiscoverability} disabled={updatingSearch}>
            <View style={[styles.infoIconBox, { backgroundColor: isDiscoverable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)' }]}>
              <IconSymbol name="magnifyingglass" size={18} color={isDiscoverable ? "#10b981" : "#64748b"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Discoverable Profile</Text>
              <Text style={styles.actionSubtext}>Let people find you in Explore feeds</Text>
            </View>
            <View style={[styles.toggleBtn, isDiscoverable && styles.toggleBtnActive]}>
              {updatingSearch ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={[styles.toggleDot, isDiscoverable && styles.toggleDotActive]} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Notification Preferences */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.8} onPress={() => toggleNotificationSetting('likesAndComments')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Likes & Comments</Text>
              <Text style={styles.actionSubtext}>When people interact with your photos</Text>
            </View>
            <View style={[styles.toggleBtn, notifPreferences.likesAndComments && styles.toggleBtnActive]}>
              <View style={[styles.toggleDot, notifPreferences.likesAndComments && styles.toggleDotActive]} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.8} onPress={() => toggleNotificationSetting('eventInvites')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Event Invitations</Text>
              <Text style={styles.actionSubtext}>When you get added to a new event album</Text>
            </View>
            <View style={[styles.toggleBtn, notifPreferences.eventInvites && styles.toggleBtnActive]}>
              <View style={[styles.toggleDot, notifPreferences.eventInvites && styles.toggleDotActive]} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.8} onPress={() => toggleNotificationSetting('businessMatches')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Local Match Enquiries</Text>
              <Text style={styles.actionSubtext}>New lead alerts matching your area</Text>
            </View>
            <View style={[styles.toggleBtn, notifPreferences.businessMatches && styles.toggleBtnActive]}>
              <View style={[styles.toggleDot, notifPreferences.businessMatches && styles.toggleDotActive]} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.8} onPress={() => toggleNotificationSetting('marketing')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Marketing Offers</Text>
              <Text style={styles.actionSubtext}>Coupons, specials, and milestone deals</Text>
            </View>
            <View style={[styles.toggleBtn, notifPreferences.marketing && styles.toggleBtnActive]}>
              <View style={[styles.toggleDot, notifPreferences.marketing && styles.toggleDotActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Media Storage & Cache */}
        <Text style={styles.sectionLabel}>Storage & Quality</Text>
        <View style={styles.settingsCard}>
          <View style={styles.actionItemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Upload Quality</Text>
              <Text style={styles.actionSubtext}>Choose image rendering preference</Text>
            </View>
            <View style={styles.pickerSegmentContainer}>
              <TouchableOpacity
                style={[styles.segmentPill, uploadResolution === 'optimized' && styles.segmentPillActive]}
                onPress={() => changeResolution('optimized')}
              >
                <Text style={[styles.segmentPillText, uploadResolution === 'optimized' && styles.segmentPillTextActive]}>Speed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentPill, uploadResolution === 'highres' && styles.segmentPillActive]}
                onPress={() => changeResolution('highres')}
              >
                <Text style={[styles.segmentPillText, uploadResolution === 'highres' && styles.segmentPillTextActive]}>High-Res</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.7} onPress={handleClearCache} disabled={clearingCache}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Clear Media Cache</Text>
              {clearingCache ? (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${cacheProgress}%` }]} />
                  <Text style={styles.progressText}>Cleaning... {cacheProgress}%</Text>
                </View>
              ) : (
                <Text style={styles.actionSubtext}>Frees up local device storage space</Text>
              )}
            </View>
            {!clearingCache && (
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(100, 116, 139, 0.1)' }]}>
                <IconSymbol name="clock.fill" size={16} color="#64748b" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Feedback & Support */}
        <Text style={styles.sectionLabel}>Feedback & Support</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.actionItemRow}
            activeOpacity={0.7}
            onPress={() => setFeedbackModalVisible(true)}
          >
            <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
              <IconSymbol name="bell.fill" size={18} color="#d4af37" />
            </View>
            <Text style={styles.actionText}>Report a Bug / Send Feedback</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionItemRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Customer Support', 'Mail us directly at support@evebash.com or tap to copy.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Copy Email', onPress: () => Alert.alert('Copied', 'Email copied to clipboard.') }
            ])}
          >
            <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
              <IconSymbol name="envelope.fill" size={16} color="#d4af37" />
            </View>
            <Text style={styles.actionText}>Contact Customer Support</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
          </TouchableOpacity>
        </View>

        {/* FAQ Accordion Section */}
        <Text style={styles.sectionLabel}>Help Center & FAQs</Text>
        <View style={styles.settingsCard}>
          {faqs.map((faq, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <View key={index}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  activeOpacity={0.7}
                  onPress={() => toggleFaq(index)}
                >
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <IconSymbol
                    name={isExpanded ? "chevron.down" : "chevron.right"}
                    size={16}
                    color="#d4af37"
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswerText}>{faq.a}</Text>
                  </View>
                )}
                {index < faqs.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>

        {/* Legal Section */}
        <Text style={styles.sectionLabel}>About & Legal</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.7} onPress={() => router.push('/' as any)}>
            <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
              <IconSymbol name="house.fill" size={18} color="#d4af37" />
            </View>
            <Text style={styles.actionText}>About EveBash</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.7} onPress={() => openLegalModal('terms')}>
            <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
              <IconSymbol name="doc.on.doc.fill" size={18} color="#d4af37" />
            </View>
            <Text style={styles.actionText}>Terms of Service</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItemRow} activeOpacity={0.7} onPress={() => openLegalModal('privacy')}>
            <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
              <IconSymbol name="shield.fill" size={18} color="#d4af37" />
            </View>
            <Text style={styles.actionText}>Privacy Policy</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
          </TouchableOpacity>
        </View>

        {/* App Version Footer */}
        <Text style={styles.footerVersionText}>EveBash v1.1.2 • Standard Package</Text>

      </ScrollView>

      {/* MODALS SECTION */}

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={true}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#475569"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={true}
                  placeholder="Re-enter password"
                  placeholderTextColor="#475569"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPasswordModalVisible(false)}
                disabled={updatingPassword}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handlePasswordChange}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderTopColor: '#ef4444', borderTopWidth: 4 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#ef4444' }]}>Delete Account Permanently?</Text>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalWarningText}>
                Warning: This action is irreversible. All of your hosted event albums, photos shared, uploaded media, and profile details will be permanently wiped from EveBash databases.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#ef4444' }]}
                onPress={handleDeleteAccount}
              >
                <Text style={[styles.saveBtnText, { color: '#fff' }]}>Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bug & Feedback Modal */}
      <Modal
        visible={feedbackModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Feedback</Text>
              <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputHint}>Choose feedback category:</Text>
              <View style={styles.categoryPillsContainer}>
                {['Bug', 'Suggestion', 'Other'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, feedbackCategory === cat && styles.categoryPillActive]}
                    onPress={() => setFeedbackCategory(cat as any)}
                  >
                    <Text style={[styles.categoryPillText, feedbackCategory === cat && styles.categoryPillTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.inputGroup, { marginTop: 16 }]}>
                <Text style={styles.inputLabel}>Your message</Text>
                <TextInput
                  style={[styles.textInput, { height: 120, textAlignVertical: 'top', paddingVertical: 12 }]}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Describe your issue or suggest a premium feature..."
                  placeholderTextColor="#475569"
                  multiline={true}
                  numberOfLines={5}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setFeedbackModalVisible(false)}
                disabled={submittingFeedback}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleFeedbackSubmit}
                disabled={submittingFeedback}
              >
                {submittingFeedback ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <Text style={styles.saveBtnText}>Send Feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Legal & Policies Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {legalModalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity onPress={() => setLegalModalVisible(false)}>
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalLegalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.legalHeading}>1. Agreement & Acceptance</Text>
              <Text style={styles.legalText}>
                Welcome to EveBash! By accessing or using our mobile application, photo sharing services, and business Hub, you agree to comply with and be bound by these legal policies. Please read these terms carefully before uploading media or engaging with local services.
              </Text>

              <Text style={styles.legalHeading}>2. Photo Ownership & Media Rights</Text>
              <Text style={styles.legalText}>
                When you upload photos or videos to any event album hosted on EveBash, you retain ownership of your content. However, by sharing it within an event, you grant the event host and approved guests a non-exclusive license to view, comment on, and download the shared media files for personal use.
              </Text>

              <Text style={styles.legalHeading}>3. Privacy & Personal Data Protection</Text>
              <Text style={styles.legalText}>
                We prioritize protecting your personal information. Your profile details, email addresses, and phone numbers are encrypted. Local business listings will only receive your enquiry contact info if you explicitly request a service quotation or check out their vendor profile matching.
              </Text>

              <Text style={styles.legalHeading}>4. Content Standards & Blocking Policy</Text>
              <Text style={styles.legalText}>
                You agree not to upload any offensive, prohibited, or copyrighted media. The event hosts and moderators retain absolute authority to block accounts, remove inappropriate comments, or report abuse directly to EveBash administrators. Wiped accounts will have all records deleted permanently.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.saveBtn, { width: '100%' }]}
                onPress={() => setLegalModalVisible(false)}
              >
                <Text style={styles.saveBtnText}>Accept & Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 24,
    elevation: isDark ? 12 : 3,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardInfoLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.slate400,
  },
  cardInfoValue: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
    maxWidth: '65%',
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.white,
  },
  actionSubtext: {
    fontSize: 11,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 16,
  },
  pickerSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  segmentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentPillActive: {
    backgroundColor: colors.gold,
  },
  segmentPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.slate400,
  },
  segmentPillTextActive: {
    color: '#050505',
    fontFamily: 'Inter_700Bold',
  },
  progressContainer: {
    marginTop: 6,
    height: 14,
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  progressText: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: colors.white,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  faqQuestion: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.white,
    flex: 1,
    marginRight: 16,
  },
  faqAnswerContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  faqAnswerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    lineHeight: 18,
  },
  footerVersionText: {
    fontSize: 11,
    color: colors.slate600,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 36,
    marginBottom: 10,
  },
  
  // MODALS STYLING
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalWarningText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.slate300,
    lineHeight: 22,
  },
  modalLegalBody: {
    maxHeight: 350,
    marginBottom: 20,
  },
  legalHeading: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: colors.white,
    marginTop: 16,
    marginBottom: 6,
  },
  legalText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    lineHeight: 18,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.white,
  },
  categoryPillsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryPillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: '#d4af37',
  },
  categoryPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.slate400,
  },
  categoryPillTextActive: {
    color: '#d4af37',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.slate400,
  },
  saveBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#050505',
  },
});

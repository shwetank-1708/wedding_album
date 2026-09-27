import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

const { height } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    // Since resetPassword uses Supabase Auth, it returns { success, error }
    const result = await resetPassword(email.trim());
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to send reset link.');
    }
  };

  return (
    <LinearGradient colors={['#1B211F', '#2B2F2E', '#594C3D']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header with back button */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back to Login</Text>
              </TouchableOpacity>
            </View>

            {/* Brand */}
            <View style={styles.brandContainer}>
              <View style={styles.logoRing}>
                <Text style={styles.logoEmoji}>EB</Text>
              </View>
              <Text style={styles.brandName}>EveBash</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Reset Password</Text>
              <Text style={styles.cardSubtitle}>
                Enter your email address and we&apos;ll send you a secure link to reset your password.
              </Text>

              {success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successEmoji}>📬</Text>
                  <Text style={styles.successTitle}>Check your email!</Text>
                  <Text style={styles.successText}>
                    We&apos;ve sent a password reset link to {email}. Click the link to choose a new password.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => router.back()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.submitText}>Return to Login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#CDB89E"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>

                  {/* Error */}
                  {!!error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* Submit */}
                  <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.submitText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Footer */}
            <Text style={styles.footer}>Protected access to EveBash</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: height,
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },

  // Brand
  brandContainer: {
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 10,
  },
  logoRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(202, 156, 104,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(202, 156, 104,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 20,
    color: '#FFF7EB',
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandName: {
    fontFamily: 'AkayaKanadaka_400Regular',
    fontSize: 28,
    color: '#FFF7EB',
    letterSpacing: 0.5,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 15,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B211F',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 28,
    lineHeight: 20,
  },

  // Fields
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF7EB',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1B211F',
  },

  // Error
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Success
  successBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B211F',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#1B211F',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#1B211F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 13,
    marginTop: 40,
  },
});

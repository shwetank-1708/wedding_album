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

export default function LoginScreen() {
  console.log('LoginScreen rendering...');
  const { login, signup, authWithPhone, loginWithGoogle, loginWithApple } = useAuth();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const isPhoneAuth = authMethod === 'phone';

  // Password validation states
  const passLength = password.length >= 8;
  const passUpper = /[A-Z]/.test(password);
  const passLower = /[a-z]/.test(password);
  const passNumber = /[0-9]/.test(password);
  const passSpecial = /[^A-Za-z0-9]/.test(password);
  const isPassValid = passLength && passUpper && passLower && passNumber && passSpecial;

  const generateStrongPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let newPass = '';
    newPass += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    newPass += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    newPass += '0123456789'[Math.floor(Math.random() * 10)];
    newPass += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];
    for (let i = 0; i < 12; i++) {
      newPass += chars[Math.floor(Math.random() * chars.length)];
    }
    newPass = newPass.split('').sort(() => 0.5 - Math.random()).join('');
    
    setPassword(newPass);
    setConfirmPassword(newPass);
    setShowPass(true);
  };

  const handleSubmit = async () => {
    setError('');
    setVerificationMessage('');

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    if (isPhoneAuth && !phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    if (!isPhoneAuth && !email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isSignUp) {
      if (!isPassValid) {
        setError('Please meet all password requirements.');
        return;
      }
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    const loginId = isPhoneAuth ? `${phone.replace(/\D/g, '')}@phone-login.local` : email.trim();
    const result = isSignUp
      ? isPhoneAuth
        ? await authWithPhone(name.trim(), phone.trim(), password)
        : await signup(email.trim(), password, name.trim())
      : await login(loginId, password);
    setLoading(false);

    if (result.success) {
      if ((result as any).needsEmailVerification) {
        setVerificationMessage(`A verification email has been sent to ${email.trim()}. Please check your inbox and verify your email to log in.`);
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } else {
      setError(result.error || 'Something went wrong.');
    }
  };
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)/dashboard');
    } else {
      setError(result.error || 'Google login failed.');
    }
  };

  const handleAppleLogin = async () => {
    setError('');
    setLoading(true);
    const result = await loginWithApple();
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)/dashboard');
    } else {
      setError(result.error || 'Apple login failed.');
    }
  };
  const toggleMode = () => {
    setIsSignUp((v) => !v);
    setError('');
    setVerificationMessage('');
    setName('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
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
            {/* Logo / Brand */}
            <View style={styles.brandContainer}>
              <View style={styles.logoRing}>
                <Text style={styles.logoEmoji}>EB</Text>
              </View>
              <Text style={styles.brandName}>EveBash</Text>
              <Text style={styles.versionLabel}>v1.1</Text>
              <Text style={styles.brandTagline}>Your event memories, beautifully preserved</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              {/* Header */}
              <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
              <Text style={styles.cardSubtitle}>
                {isSignUp
                  ? 'Sign up to access your gallery'
                  : 'Sign in to access your gallery'}
              </Text>

              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segmentButton, !isPhoneAuth && styles.segmentButtonActive]}
                  onPress={() => {
                    setAuthMethod('email');
                    setError('');
                  }}
                >
                  <Text style={[styles.segmentText, !isPhoneAuth && styles.segmentTextActive]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentButton, isPhoneAuth && styles.segmentButtonActive]}
                  onPress={() => {
                    setAuthMethod('phone');
                    setError('');
                  }}
                >
                  <Text style={[styles.segmentText, isPhoneAuth && styles.segmentTextActive]}>Phone</Text>
                </TouchableOpacity>
              </View>

              {/* Fields */}
              {isSignUp && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor="#CDB89E"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              )}

              {isPhoneAuth ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="9876543210"
                    placeholderTextColor="#CDB89E"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              ) : (
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
                    returnKeyType="next"
                  />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Password</Text>
                  {isSignUp && (
                    <TouchableOpacity onPress={generateStrongPassword}>
                      <Text style={{ color: '#0284c7', fontSize: 12, fontWeight: '700' }}>Suggest Strong Password</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor="#CDB89E"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    returnKeyType={isSignUp ? 'next' : 'done'}
                    onSubmitEditing={!isSignUp ? handleSubmit : undefined}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPass((v) => !v)}
                  >
                    <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isSignUp && (
                <View style={styles.passwordChecklist}>
                  <Text style={[styles.checkItem, passLength ? styles.checkMet : null]}>
                    {passLength ? '✓' : '○'} At least 8 characters
                  </Text>
                  <Text style={[styles.checkItem, passUpper ? styles.checkMet : null]}>
                    {passUpper ? '✓' : '○'} One uppercase letter
                  </Text>
                  <Text style={[styles.checkItem, passLower ? styles.checkMet : null]}>
                    {passLower ? '✓' : '○'} One lowercase letter
                  </Text>
                  <Text style={[styles.checkItem, passNumber ? styles.checkMet : null]}>
                    {passNumber ? '✓' : '○'} One number
                  </Text>
                  <Text style={[styles.checkItem, passSpecial ? styles.checkMet : null]}>
                    {passSpecial ? '✓' : '○'} One special character
                  </Text>
                </View>
              )}

              {!isSignUp && !isPhoneAuth && (
                <TouchableOpacity onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 12 }}>
                  <Text style={{ color: '#0284c7', fontSize: 13, fontWeight: '600' }}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              {isSignUp && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#CDB89E"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              )}

              {/* Error */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Verification Message */}
              {!!verificationMessage && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{verificationMessage}</Text>
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
                  <Text style={styles.submitText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                )}
              </TouchableOpacity>

              {/* Social Login Options */}
              <View style={styles.socialDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.socialBtnGoogle}
                onPress={handleGoogleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.socialBtnGoogleText}>Continue with Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.socialBtnApple}
                  onPress={handleAppleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.socialBtnAppleText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}

              {/* Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </Text>
                <TouchableOpacity onPress={toggleMode}>
                  <Text style={styles.toggleAction}>
                    {isSignUp ? ' Sign In' : ' Sign Up'}
                  </Text>
                </TouchableOpacity>
              </View>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    minHeight: height,
  },

  // Brand
  brandContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(202, 156, 104,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(202, 156, 104,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 24,
    color: '#FFF7EB',
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandName: {
    fontFamily: 'AkayaKanadaka_400Regular',
    fontSize: 32,
    color: '#FFF7EB',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 14,
    color: '#CDB89E',
    fontWeight: '400',
    letterSpacing: 0.3,
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
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 28,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#1B211F',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  segmentTextActive: {
    color: '#ffffff',
  },

  // Fields
  fieldGroup: {
    marginBottom: 20,
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
    flex: 1,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  eyeBtn: {
    backgroundColor: '#FFF7EB',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 18,
  },
  passwordChecklist: {
    marginTop: -10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkItem: {
    fontSize: 12,
    color: '#CDB89E',
    marginBottom: 4,
  },
  checkMet: {
    color: '#10b981',
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
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Success
  successBox: {
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  successText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Submit
  submitBtn: {
    backgroundColor: '#1B211F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
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

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    flexWrap: 'wrap',
  },
  toggleLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  toggleAction: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },

  // Social Login
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    color: '#CDB89E',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  socialBtnGoogle: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  socialBtnGoogleText: {
    color: '#1B211F',
    fontSize: 15,
    fontWeight: '600',
  },
  socialBtnApple: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  socialBtnAppleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Footer
  footer: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 13,
    marginTop: 28,
  },
  versionLabel: {
    fontSize: 10,
    color: '#CA9C68',
    fontWeight: 'bold',
    marginBottom: 4,
    backgroundColor: 'rgba(202, 156, 104,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

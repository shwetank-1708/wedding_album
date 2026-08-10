import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/context/ThemeContext';
import { MidnightColors } from '@/constants/theme';
import { Stack, useRouter } from 'expo-router';

export default function ContactUsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

  const clearSubmitState = () => {
    setSubmitError('');
    setSubmitSuccess('');
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/contact-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          message,
          source: 'mobile',
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to send message right now.');
      }

      setFirstName('');
      setLastName('');
      setEmail('');
      setMessage('');
      setSubmitSuccess('Message sent. We will get back to you within 24 hours.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to send message right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ 
        headerShown: true, 
        headerTransparent: true,
        headerTitle: 'Contact Us',
        headerTintColor: colors.white,
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
            }} 
            style={styles.nativeBackButton}
            hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
          >
            <IconSymbol name="chevron.left" size={28} color={colors.white} />
          </TouchableOpacity>
        ),
        headerShadowVisible: false,
      }} />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Get in Touch</Text>
          <Text style={styles.subtitle}>
            {`We'd love to hear about your story. Send us a message and let's start planning something beautiful.`}
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          
          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <IconSymbol name="house.fill" size={24} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>STUDIO ADDRESS</Text>
              <Text style={styles.infoText}>Dehradun, Uttarakhand, India - 248001</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <IconSymbol name="phone.fill" size={24} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>PHONE</Text>
              <Text style={styles.infoText}>+91 98712 64964</Text>
              <Text style={styles.infoText}>+91 85350 29872</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <IconSymbol name="envelope.fill" size={24} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>EMAIL</Text>
              <Text style={styles.infoText}>support@evebash.com</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <IconSymbol name="clock.fill" size={24} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>BUSINESS HOURS</Text>
              <Text style={styles.infoText}>Mon - Fri: 10:00 AM - 6:00 PM</Text>
            </View>
          </View>
        </View>

        {/* Contact Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Send Us a Message</Text>
          <Text style={styles.formSubtitle}>Fill out the form below and we will get back to you within 24 hours.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FIRST NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="John"
              placeholderTextColor={colors.slate400}
              value={firstName}
              onChangeText={(value) => {
                setFirstName(value);
                clearSubmitState();
              }}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>LAST NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Doe"
              placeholderTextColor={colors.slate400}
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                clearSubmitState();
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor={colors.slate400}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearSubmitState();
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>MESSAGE</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Tell us more about your event..." 
              placeholderTextColor={colors.slate400}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={message}
              onChangeText={(value) => {
                setMessage(value);
                clearSubmitState();
              }}
            />
          </View>

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          {submitSuccess ? <Text style={styles.successText}>{submitSuccess}</Text> : null}

          <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitButtonText}>{submitting ? 'SENDING...' : 'SEND MESSAGE'}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.slate400,
    textAlign: 'center',
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: colors.deepSlate,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(56,189,248,0.12)' : '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.slate400,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: colors.deepSlate,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.slate400,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.slate400,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: isDark ? colors.slate900 : colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.white,
  },
  textArea: {
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: '#101010',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#64748b',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  errorText: {
    color: '#be123c',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  successText: {
    color: '#047857',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
  },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Stack, useRouter } from 'expo-router';

export default function ContactUsScreen() {
  const router = useRouter();
  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ 
        headerShown: true, 
        headerTransparent: true,
        headerTitle: 'Contact Us',
        headerTintColor: '#101010',
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
            <IconSymbol name="chevron.left" size={28} color="#101010" />
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
            <TextInput style={styles.input} placeholder="John" placeholderTextColor="#94a3b8" />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>LAST NAME</Text>
            <TextInput style={styles.input} placeholder="Doe" placeholderTextColor="#94a3b8" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>MESSAGE</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Tell us more about your event..." 
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={styles.submitButton}>
            <Text style={styles.submitButtonText}>SEND MESSAGE</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#101010',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#101010',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    backgroundColor: '#f0f9ff',
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
    color: '#101010',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#101010',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#101010',
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
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

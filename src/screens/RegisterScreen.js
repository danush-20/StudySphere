import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { registerUser } from '../services/authService';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

// Design System Tokens: Deep Focus (Cognitive Sanctuary)
const COLORS = {
  primary: '#102A43',
  secondary: '#D9E2EC',
  accent: '#334E68',
  background: '#F0F4F8',
  surface: '#FFFFFF',
  text: '#102A43',
  textSecondary: '#486581',
  border: '#BCCCDC',
  white: '#FFFFFF',
};

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [academic, setAcademic] = useState('');
  const [exam, setExam] = useState('');
  const [location, setLocation] = useState('');
  const [username, setUsername] = useState('');

  const labEquipment = [
    'Microscope',
    'Beaker',
    'Voltmeter',
    'Ammeter',
    'Oscilloscope',
    'BunsenBurner',
    'Thermometer',
    'Pipette',
    'TestTube',
    'Centrifuge',
  ];

  const generateUsername = () => {
    const random =
      labEquipment[Math.floor(Math.random() * labEquipment.length)];
    const number = Math.floor(100 + Math.random() * 900);
    setUsername(random);
  };

  const handleRegister = async () => {
    try {
      await registerUser(
        email,
        password,
        username,
        phone,
        academic,
        exam,
        location,
      );

      console.log('User registered successfully');

      //await signOut(auth);
      navigation.navigate('VerifyEmail');

    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(
          'Registration Error',
          'This email is already registered. Please login or use another email.',
        );
      } else if (error.code === 'auth/weak-password') {
        Alert.alert(
          'Registration Error',
          'Password should be at least 6 characters.',
        );
      } else {
        Alert.alert('Registration Error', error.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={40}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.brandName}>StudySphere</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(800)}>
            <Text style={styles.heroTitle}>
              Begin your{'\n'}
              <Text style={styles.heroItalic}>Cognitive{'\n'}Journey.</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              {/* Join our sanctuary designed for high-end concentration and
              academic excellence. */}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(600).duration(800)}
            style={styles.formCard}
          >
            <Text style={styles.sectionLabel}>PERSONAL IDENTITY</Text>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.usernameRow}>
                <TextInput
                  placeholder=""
                  value={username}
                  onChangeText={setUsername}
                  style={styles.usernameInput}
                />
                <TouchableOpacity
                  onPress={generateUsername}
                  style={styles.sparkButton}
                >
                  <Image
                    source={require('../../assets/generate.png')}
                    style={{ width: 24, height: 24, resizeMode: 'contain' }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Institutional Email</Text>
              <TextInput
                placeholder="name@university.edu"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Secure Password</Text>
              <TextInput
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                placeholder="+91 00000-00000"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
              ACADEMIC DOMAIN
            </Text>

            {/* Academic */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Academic Pursuing</Text>
              <TextInput
                placeholder="e.g. B.Tech Computer Science"
                value={academic}
                onChangeText={setAcademic}
                style={styles.input}
              />
            </View>

            {/* Exam Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Exam</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={exam}
                  onValueChange={itemValue => setExam(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item
                    label="Select Exam"
                    value=""
                    color={COLORS.textSecondary}
                  />
                  <Picker.Item label="JEE" value="jee" />
                  <Picker.Item label="NEET" value="neet" />
                  <Picker.Item label="UPSC" value="upsc" />
                  <Picker.Item label="GATE" value="gate" />
                  <Picker.Item label="CAT" value="cat" />
                  <Picker.Item label="CLAT" value="clat" />
                  <Picker.Item label="SSC" value="ssc" />
                  <Picker.Item label="Banking Exams" value="banking" />
                </Picker>
              </View>
            </View>

            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <View style={styles.locationWrapper}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color={COLORS.accent}
                  style={styles.locationIcon}
                />
                <TextInput
                  placeholder="Enter your city or campus..."
                  value={location}
                  onChangeText={setLocation}
                  style={styles.locationInput}
                />
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
            >
              <Text style={styles.registerButtonText}>Register</Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <TouchableOpacity
              style={styles.signInLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.signInText}>
                Already Inside Sanctuary?{' '}
                <Text style={styles.signInBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 40 },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 48,
    marginBottom: 16,
  },
  heroItalic: { fontStyle: 'italic', color: COLORS.accent, fontWeight: '500' },
  heroSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: 10,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    opacity: 0.6,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: COLORS.primary,
  },
  usernameRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    alignItems: 'center',
  },
  usernameInput: { flex: 1, padding: 16, fontSize: 15, color: COLORS.primary },
  sparkButton: { padding: 16 },
  pickerWrapper: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: { height: 56, color: COLORS.primary },
  locationWrapper: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  locationIcon: { marginRight: 8 },
  locationInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: COLORS.primary,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  registerButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  signInLink: { marginTop: 24, alignItems: 'center' },
  signInText: { color: COLORS.textSecondary, fontSize: 14 },
  signInBold: { color: COLORS.primary, fontWeight: '800' },
});

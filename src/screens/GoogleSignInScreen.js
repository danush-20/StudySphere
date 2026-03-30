import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';

export default function GoogleSignInScreen() {
  const { refreshProfile } = useContext(AuthContext);
  const { COLORS, isDark } = useTheme();
  const [phone, setPhone] = useState('');
  const [academic, setAcademic] = useState('');
  const [exam, setExam] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const styles = makeStyles(COLORS);

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

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSubmit = async () => {
    if (!username || !phone || !academic || !exam || !location) {
      showAlert(
        'Missing Fields',
        'Please fill in all fields before continuing.',
      );
      return;
    }

    const uid = auth.currentUser?.uid;
    const email = auth.currentUser?.email;

    if (!uid) {
      showAlert(
        'Error',
        'No authenticated user found. Please try logging in again.',
      );
      return;
    }

    setLoading(true);

    try {
      await setDoc(doc(db, 'users', uid), {
        email,
        username,
        phone,
        academic,
        exam,
        location,
      });

      await refreshProfile();
    } catch (error) {
      showAlert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate button — uses image on native, icon on web to avoid DOM Image conflict
  const GenerateButton = () => (
    <TouchableOpacity onPress={generateUsername} style={styles.sparkButton}>
      {Platform.OS === 'web' ? (
        <MaterialCommunityIcons
          name="auto-fix"
          size={22}
          color={COLORS.accent}
        />
      ) : (
        <Image
          source={require('../../assets/generate.png')}
          style={{ width: 24, height: 24, resizeMode: 'contain' }}
        />
      )}
    </TouchableOpacity>
  );

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
              Complete your{'\n'}
              <Text style={styles.heroItalic}>Sphere{'\n'}Profile.</Text>
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
                  placeholder="Scholar_Mind"
                  value={username}
                  onChangeText={setUsername}
                  style={styles.usernameInput}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <GenerateButton />
              </View>
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
                placeholderTextColor={COLORS.textSecondary}
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
                placeholderTextColor={COLORS.textSecondary}
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
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.registerButton, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Saving...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = COLORS =>
  StyleSheet.create({
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
      backgroundColor: COLORS.primaryBtn, // was COLORS.primary
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    brandName: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.text, // was COLORS.primary
      letterSpacing: -0.5,
    },
    heroTitle: {
      fontSize: 44,
      fontWeight: '800',
      color: COLORS.text, // was COLORS.primary
      lineHeight: 48,
      marginBottom: 40,
    },
    heroItalic: {
      fontStyle: 'italic',
      color: COLORS.highlight, // was COLORS.accent — amber works in both modes
      fontWeight: '500',
    },
    formCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1, // added
      borderColor: COLORS.border, // added — card edge in dark mode
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
      elevation: 2,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: COLORS.textSecondary, // was COLORS.accent with opacity
      letterSpacing: 1.5,
      marginBottom: 20,
    },
    inputGroup: { marginBottom: 20 },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.text, // was COLORS.primary
      marginBottom: 8,
    },
    input: {
      backgroundColor: COLORS.inputBg, // was COLORS.secondary
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: COLORS.text, // was COLORS.primary
      borderWidth: 1,
      borderColor: COLORS.border, // added
    },
    usernameRow: {
      flexDirection: 'row',
      backgroundColor: COLORS.inputBg, // was COLORS.secondary
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border, // added
    },
    usernameInput: {
      flex: 1,
      padding: 16,
      fontSize: 15,
      color: COLORS.text, // was COLORS.primary
    },
    sparkButton: { padding: 16 },
    pickerWrapper: {
      backgroundColor: COLORS.inputBg, // was COLORS.secondary
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.border, // added
    },
    picker: {
      height: 56,
      color: COLORS.text, // was COLORS.primary
    },
    locationWrapper: {
      flexDirection: 'row',
      backgroundColor: COLORS.inputBg, // was COLORS.secondary
      borderRadius: 12,
      alignItems: 'center',
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: COLORS.border, // added
    },
    locationIcon: { marginRight: 8 },
    locationInput: {
      flex: 1,
      paddingVertical: 16,
      fontSize: 15,
      color: COLORS.text, // was COLORS.primary
    },
    registerButton: {
      backgroundColor: COLORS.primaryBtn, // was COLORS.primary
      borderRadius: 100,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
      shadowColor: COLORS.primaryBtn, // was COLORS.primary
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },
    registerButtonText: {
      color: COLORS.primaryBtnText, // was COLORS.white
      fontSize: 18,
      fontWeight: '800',
    },
  });

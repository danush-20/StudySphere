import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Alert,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginUser } from '../services/authService';
import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId:
    '634668096541-7tuuah43lk4vckqbtmpbhthjtp05v1qf.apps.googleusercontent.com',
});

export default function LoginScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const { COLORS, isDark } = useTheme();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const message = route?.params?.message;
  const styles = makeStyles(COLORS);

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        Alert.alert('Google Login Error', 'No token received');
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      console.log('Google login success');
      // AuthContext listener will switch screen automatically
    } catch (error) {
      console.log(error);
      Alert.alert('Google Login Error', error.message);
    }
  };

  const handleLogin = async () => {
    try {
      await loginUser(email, password);
      // If email is unverified, AppNavigator will route to VerifyEmailScreen automatically
    } catch (error) {
      if (error.code === 'auth/invalid-credential') {
        Alert.alert(
          'Invalid Credentials',
          'The email or password you entered is incorrect.',
        );
      } else {
        Alert.alert('Login Error', error.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={48}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.brandName}>StudySphere</Text>
            <Text style={styles.brandTagline}>THE COGNITIVE SANCTUARY</Text>
          </View>

          {/* Feedback Message */}
          {message ? (
            <View style={styles.messageBanner}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          {/* Input Section */}
          <View style={styles.form}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              placeholder="alex@sanctuary.com"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={styles.passwordInput}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.accent}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Actions */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.button, styles.loginButton]}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.signUpButton]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}
            >
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Login */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.googleButtonText}>Login with Google</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = COLORS =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 24,
      marginBottom: 16,
    },
    brandName: {
      fontSize: 32,
      fontWeight: '800',
      color: COLORS.text,
      letterSpacing: -1,
    },
    brandTagline: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textSecondary,
      letterSpacing: 2,
      marginTop: 4,
    },
    messageBanner: {
      backgroundColor: COLORS.success + '22',
      padding: 12,
      borderRadius: 8,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: COLORS.success,
    },
    messageText: {
      color: COLORS.success,
      fontSize: 14,
      textAlign: 'center',
    },
    form: {
      marginBottom: 24,
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      color: COLORS.textSecondary,
      marginBottom: 8,
      letterSpacing: 1,
    },
    input: {
      backgroundColor: COLORS.inputBg,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: COLORS.text,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.inputBg,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 16,
      fontSize: 16,
      color: COLORS.text,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
    },
    button: {
      flex: 1,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginButton: {
      backgroundColor: COLORS.primaryBtn,
    },
    loginButtonText: {
      color: COLORS.primaryBtnText,
      fontSize: 16,
      fontWeight: '700',
    },
    signUpButton: {
      backgroundColor: COLORS.secondaryBtn,
    },
    signUpButtonText: {
      color: COLORS.secondaryBtnText,
      fontSize: 16,
      fontWeight: '700',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 32,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: COLORS.border,
      opacity: 0.5,
    },
    dividerText: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textSecondary,
      paddingHorizontal: 16,
      letterSpacing: 1,
    },
    googleButton: {
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    googleButtonText: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '600',
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: COLORS.primaryBtn,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
  });

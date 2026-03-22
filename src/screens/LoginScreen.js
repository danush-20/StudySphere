import React, { useState, useEffect } from 'react';
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

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

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

export default function LoginScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const message = route?.params?.message;

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId:
      '634668096541-h3den2c1pp10anb1l15rr2np9pjq2i2a.apps.googleusercontent.com',
    webClientId:
      '634668096541-h3den2c1pp10anb1l15rr2np9pjq2i2a.apps.googleusercontent.com',
    androidClientId:
      '634668096541-29jo0hfmri2v6ttaup3rm9nf0almfg0k.apps.googleusercontent.com',
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;

      if (!idToken) {
        console.log('No Google token received');
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);

      signInWithCredential(auth, credential)
        .then(() => {
          console.log('Google login success');
          // AuthContext listener will switch screen automatically
        })
        .catch(error => {
          console.log(error);
          Alert.alert('Google Login Error', error.message);
        });
    }
  }, [response]);

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
            style={[styles.googleButton, !request && { opacity: 0.5 }]}
            onPress={() => promptAsync()}
            disabled={!request}
            activeOpacity={0.7}
          >
            <Text style={styles.googleButtonText}>Login with Google</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    color: COLORS.primary,
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 2,
    marginTop: 4,
  },
  messageBanner: {
    backgroundColor: '#E3F9E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3EBD93',
  },
  messageText: {
    color: '#084832',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 20,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
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
    backgroundColor: COLORS.primary,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  signUpButton: {
    backgroundColor: '#D1E9FF',
  },
  signUpButtonText: {
    color: COLORS.primary,
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
    color: COLORS.accent,
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
    backgroundColor: COLORS.primary,
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

import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Animated,
  Easing
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function VerifyEmailScreen() {
  const { refreshUser } = useContext(AuthContext);
  const { COLORS } = useTheme();

  const [checking,  setChecking]  = useState(false);
  const [resending, setResending] = useState(false);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1, duration: 900,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true
        }),
        Animated.timing(bounceAnim, {
          toValue: 0, duration: 900,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 1500,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 0, duration: 1500,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true
        }),
      ])
    );

    bounceLoop.start();
    pulseLoop.start();

    return () => { bounceLoop.stop(); pulseLoop.stop(); };
  }, []);

  // ── Handlers (original, unchanged) ───────────────────────────────────────

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        refreshUser();
      } else {
        Alert.alert("Not Verified Yet", "Your email hasn't been verified yet. Please check your inbox.");
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      Alert.alert("Email Sent", "Verification email resent. Please check your inbox.");
    } catch (error) {
      if (error.code === "auth/too-many-requests") {
        Alert.alert("Too Many Requests", "Please wait a while before requesting another email.");
      } else {
        Alert.alert("Error", error.message);
      }
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log(error.message);
    }
  };

  const s = makeStyles(COLORS);

  return (
    <View style={s.container}>
      <View style={s.card}>
        {/* Bouncing email icon */}
        <Animated.View
          style={[
            s.iconWrapper,
            {
              transform: [
                {
                  translateY: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12],
                  }),
                },
                {
                  scale: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialIcons
            name="mark-email-unread"
            size={42}
            color={COLORS.primary}
          />
        </Animated.View>

        <Text style={s.title}>Verify Your Email</Text>

        <Text style={s.subtitle}>We've sent a verification link to</Text>

        <View style={s.emailBadge}>
          <Text style={s.emailText}>{auth.currentUser?.email}</Text>
        </View>

        <Text style={s.subtitle}>
          Please open the link to verify your account.
        </Text>

        {/* Pulsing primary button */}
        <Animated.View
          style={{
            transform: [
              {
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.02],
                }),
              },
            ],
            width: '100%',
          }}
        >
          <TouchableOpacity
            style={[s.primaryButton, checking && s.disabledButton]}
            onPress={handleRefresh}
            disabled={checking}
            activeOpacity={0.88}
          >
            <View style={s.buttonContent}>
              <Text style={s.primaryText}>
                {checking ? 'Checking...' : "I've Verified"}
              </Text>
              {!checking && (
                <MaterialIcons
                  name="check-circle"
                  size={20}
                  color= 'green'
                  style={{ marginLeft: 6 }}
                />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[s.secondaryButton, resending && s.disabledButton]}
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.88}
        >
          <Text style={s.secondaryText}>
            {resending ? 'Sending...' : 'Resend Email'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <Text style={s.logout}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: COLORS.surface,
      borderRadius: 24,
      padding: 28,
      alignItems: "center",
    },
    iconWrapper: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: COLORS.surfaceHigh,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 26,
      fontWeight: "bold",
      color: COLORS.text,
      marginBottom: 12,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: COLORS.textSecondary,
      textAlign: "center",
      marginBottom: 10,
    },
    emailBadge: {
      backgroundColor: COLORS.surfaceHighest,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 10,
    },
    emailText: {
      color: COLORS.text,
      fontWeight: "600",
    },
    primaryButton: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: 30,
      backgroundColor: COLORS.primaryBtn,
      alignItems: "center",
      marginTop: 20,
    },
    primaryText: {
      color: COLORS.primaryBtnText,
      fontWeight: "600",
      fontSize: 15,
    },
    secondaryButton: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: 30,
      backgroundColor: COLORS.secondaryBtn,
      alignItems: "center",
      marginTop: 10,
    },
    secondaryText: {
      color: COLORS.secondaryBtnText,
      fontWeight: "600",
      fontSize: 15,
    },
    logout: {
      marginTop: 16,
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.7,
    },
  });
}
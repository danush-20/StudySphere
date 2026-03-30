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

import { MaterialIcons } from "@expo/vector-icons"; // ✅ ICON FIX

import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

export default function VerifyEmailScreen() {

  const { refreshUser } = useContext(AuthContext);

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    bounceLoop.start();
    pulseLoop.start();

    return () => {
      bounceLoop.stop();
      pulseLoop.stop();
    };

  }, []);

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

  return (
    <View style={styles.container}>

      <View style={styles.card}>

        {/* ✅ ICON + ANIMATION (FIXED) */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              transform: [
                {
                  translateY: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12]
                  })
                },
                {
                  scale: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08]
                  })
                }
              ]
            }
          ]}
        >
          <MaterialIcons name="mark-email-unread" size={42} color="#00152a" />
        </Animated.View>

        <Text style={styles.title}>Verify Your Email</Text>

        <Text style={styles.subtitle}>
          We've sent a verification link to
        </Text>

        <View style={styles.emailBadge}>
          <Text style={styles.emailText}>
            {auth.currentUser?.email}
          </Text>
        </View>

        <Text style={styles.subtitle}>
          Please open the link to verify your account.
        </Text>

        <Animated.View
          style={{
            transform: [
              {
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.02]
                })
              }
            ],
            width: "100%"
          }}
        >
          <TouchableOpacity
 style={[styles.primaryButton, checking && styles.disabledButton]}
  onPress={handleRefresh}
  disabled={checking}
>
  <View style={styles.buttonContent}>
    <Text style={styles.primaryText}>
      {checking ? "Checking..." : "I've Verified"}
    </Text>

    {!checking && (
      <MaterialIcons
        name="check-circle"
        size={20}
        color="#ffffff"
        style={{ marginLeft: 6 }}
      />
    )}
  </View>
</TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[styles.secondaryButton, resending && styles.disabledButton]}
          onPress={handleResend}
          disabled={resending}
        >
          <Text style={styles.secondaryText}>
            {resending ? "Sending..." : "Resend Email"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f6fafe",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center"
  },

  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f0f4f8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#171c1f",
    marginBottom: 12,
    textAlign: "center"
  },

  subtitle: {
    fontSize: 15,
    color: "#43474d",
    textAlign: "center",
    marginBottom: 10
  },

  emailBadge: {
    backgroundColor: "#e8eef3",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10
  },

  emailText: {
    color: "#00152a",
    fontWeight: "600"
  },

  primaryButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: "#00152a",
    alignItems: "center",
    marginTop: 20
  },

  primaryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15
  },

  secondaryButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: "#dbe1ff",
    alignItems: "center",
    marginTop: 10
  },

  secondaryText: {
    color: "#00174b",
    fontWeight: "600",
    fontSize: 15
  },

  logout: {
    marginTop: 16,
    fontSize: 14,
    color: "#43474d"
  },

  buttonContent: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center"
  },

  disabledButton: {
    opacity: 0.7
  }

});
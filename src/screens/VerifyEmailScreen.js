import React, { useState, useContext } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";

import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

export default function VerifyEmailScreen() {

  const { refreshUser } = useContext(AuthContext);

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const handleRefresh = async () => {

    setChecking(true);

    try {

      await auth.currentUser.reload();

      if (auth.currentUser.emailVerified) {
        refreshUser(); // manually tell context to re-read, AppNavigator will switch screens
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

      <Text style={styles.title}>Verify Your Email</Text>

      <Text style={styles.subtitle}>
        We sent a verification link to{" "}
        <Text style={styles.email}>{auth.currentUser?.email}</Text>.
        {"\n"}Please check your inbox and verify before continuing.
      </Text>

      <Button
        title={checking ? "Checking..." : "I've Verified"}
        onPress={handleRefresh}
        disabled={checking}
      />

      <Button
        title={resending ? "Sending..." : "Resend Email"}
        onPress={handleResend}
        disabled={resending}
      />

      <Button
        title="Logout"
        onPress={handleLogout}
        color="gray"
      />

    </View>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 16
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "gray",
    lineHeight: 22
  },
  email: {
    fontWeight: "bold",
    color: "black"
  }
});
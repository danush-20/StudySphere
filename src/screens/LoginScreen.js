import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Image, StyleSheet, Alert } from "react-native";

import { loginUser } from "../services/authService";
import { auth } from "../services/firebase";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

console.log(AuthSession.makeRedirectUri());

export default function LoginScreen({ navigation, route }) {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const message = route?.params?.message;

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: "634668096541-h3den2c1pp10anb1l15rr2np9pjq2i2a.apps.googleusercontent.com",
    webClientId: "634668096541-h3den2c1pp10anb1l15rr2np9pjq2i2a.apps.googleusercontent.com",
    androidClientId: "634668096541-29jo0hfmri2v6ttaup3rm9nf0almfg0k.apps.googleusercontent.com",
    responseType: "id_token",
    scopes: ["openid", "profile", "email"]
  });

  useEffect(() => {

    if (response?.type === "success") {

      const idToken = response.params?.id_token;

      if (!idToken) {
        console.log("No Google token received");
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);

      signInWithCredential(auth, credential)
        .then(() => {
          console.log("Google login success");
          // AuthContext / Auth listener will move user to Home
        })
        .catch((error) => {
          console.log(error);
          Alert.alert("Google Login Error", error.message);
        });

    }

  }, [response]);



  const handleLogin = async () => {

    try {

      const user = await loginUser(username, password);

      await user.reload();

      if (!user.emailVerified) {

        await auth.signOut();

        Alert.alert(
          "Email Not Verified",
          "Please verify your email before logging in."
        );

        return;
      }

      console.log("Login successful");

      // Navigation handled automatically by auth state listener

    } catch (error) {

      if (error.code === "auth/invalid-credential") {

        Alert.alert(
          "Invalid Credentials",
          "The email or password you entered is incorrect."
        );

      } else {

        Alert.alert("Login Error", error.message);

      }

    }

  };


  return (
    <View style={styles.container}>

      {message && (
        <Text style={{ color: "green", marginBottom: 10 }}>
          {message}
        </Text>
      )}

      <Image
        source={require("../../assets/android-icon-foreground.png")}
        style={styles.logo}
      />

      <TextInput
        placeholder="Email"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <View style={styles.row}>

        <View style={{ flex: 1 }}>
          <Button title="Login" onPress={handleLogin} />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            title="Sign Up"
            onPress={() => navigation.navigate("Register")}
          />
        </View>

      </View>

      <Button
        title="Login with Google"
        disabled={!request}
        onPress={() => promptAsync()}
      />

    </View>
  );

}


const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    gap: 10
  },

  logo: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 20
  },

  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 10
  },

  row: {
    flexDirection: "row",
    gap: 10
  }

});
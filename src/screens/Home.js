import React, { useContext } from "react";
import { View, Text, Button, StyleSheet } from "react-native";

import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

export default function Home() {

  const { user, profile } = useContext(AuthContext);

  const value = user?.emailVerified ? "verified" : "not verified";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("User logged out");
    } catch (error) {
      console.log(error.message);
    }
  };

  return (
    <View style={styles.container}>

      <Text>Welcome to StudySphere</Text>

      <Text>{user?.email}</Text>

      <Text>{value}</Text>

      <Text>{profile?.academic}</Text>

      <Button
        title="Logout"
        onPress={handleLogout}
      />

    </View>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20
  }
});
import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet, Text, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase";

export default function GoogleSignInScreen() {

  const [phone, setPhone] = useState("");
  const [academic, setAcademic] = useState("");
  const [exam, setExam] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {

    if (!phone || !academic || !exam || !location) {
      Alert.alert("Missing Fields", "Please fill in all fields before continuing.");
      return;
    }

    const uid = auth.currentUser?.uid;
    const email = auth.currentUser?.email;

    if (!uid) {
      Alert.alert("Error", "No authenticated user found. Please try logging in again.");
      return;
    }

    setLoading(true);

    try {

      await setDoc(doc(db, "users", uid), {
        email,
        phone,
        academic,
        exam,
        location
      });

      console.log("Google user profile created");
      // AuthContext listener will detect the new doc and set profileExists = true,
      // which causes AppNavigator to switch to Home automatically.

    } catch (error) {

      console.log("Error creating profile:", error.message);
      Alert.alert("Error", "Failed to save your profile. Please try again.");

    } finally {

      setLoading(false);

    }

  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Complete Your Sphere</Text>

      <TextInput
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Academic Pursuing"
        value={academic}
        onChangeText={setAcademic}
        style={styles.input}
      />

      <Picker
        selectedValue={exam}
        onValueChange={(itemValue) => setExam(itemValue)}
        style={styles.input}
      >
        <Picker.Item label="Select Exam" value="" />
        <Picker.Item label="JEE" value="jee" />
        <Picker.Item label="NEET" value="neet" />
        <Picker.Item label="UPSC" value="upsc" />
        <Picker.Item label="GATE" value="gate" />
        <Picker.Item label="CAT" value="cat" />
        <Picker.Item label="CLAT" value="clat" />
        <Picker.Item label="SSC" value="ssc" />
        <Picker.Item label="Banking Exams" value="banking" />
      </Picker>

      <TextInput
        placeholder="Location"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      <Button
        title={loading ? "Saving..." : "Continue"}
        onPress={handleSubmit}
        disabled={loading}
      />

    </View>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    gap: 10
  },

  title: {
    fontSize: 20,
    textAlign: "center"
  },

  input: {
    borderWidth: 1,
    padding: 10
  }
});
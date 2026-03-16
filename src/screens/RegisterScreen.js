import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet, Text, Alert, TouchableOpacity, Image } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { registerUser } from "../services/authService";

export default function RegisterScreen({ navigation }) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [academic, setAcademic] = useState("");
  const [exam, setExam] = useState("");
  const [location, setLocation] = useState("");
  const [username, setUsername] = useState("");

  const labEquipment = [
    "Microscope",
    "Beaker",
    "Voltmeter",
    "Ammeter",
    "Oscilloscope",
    "BunsenBurner",
    "Thermometer",
    "Pipette",
    "TestTube",
    "Centrifuge"
  ];

  const generateUsername = () => {
    const random = labEquipment[Math.floor(Math.random() * labEquipment.length)];
    const number = Math.floor(100 + Math.random() * 900);
    setUsername(random);
  };

  const handleRegister = async () => {

    try {

      await registerUser(email, password, username, phone, academic, exam, location);

      console.log("User registered successfully");

      await signOut(auth);

      navigation.navigate("Login", {
        message: "Registration successful! Please verify your email before logging in."
      });

    } catch (error) {

      if (error.code === "auth/email-already-in-use") {

        Alert.alert(
          "Registration Error",
          "This email is already registered. Please login or use another email."
        );

      } else if (error.code === "auth/weak-password") {

        Alert.alert(
          "Registration Error",
          "Password should be at least 6 characters."
        );

      } else {

        Alert.alert("Registration Error", error.message);

      }

    }

  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Create Your Sphere</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        
        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          style={{
            flex: 1,
            borderWidth: 1,
            padding: 10,
            borderRadius: 5
          }}
        />

        <TouchableOpacity
          onPress={generateUsername}
          style={{ marginLeft: 8 }}
        >
          <Image
            source={require("../../assets/generate.png")}
            style={{
              width: 30,
              height: 25,
              resizeMode: "contain"
            }}
          />
        </TouchableOpacity>

      </View>

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

      <Button title="Register" onPress={handleRegister} />

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
  title: {
    fontSize: 20,
    textAlign: "center"
  },
  input: {
    borderWidth: 1,
    padding: 10
  }
});
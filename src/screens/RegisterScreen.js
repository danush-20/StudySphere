import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet, Text, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { registerUser } from "../services/authService";


export default function RegisterScreen({ navigation }) {

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [phone,setPhone] = useState("");
  const [academic,setAcademic] = useState("");
  const [exam,setExam] = useState("");
  const [location,setLocation] = useState("");

  const handleRegister = async () => {

    try {

      await registerUser(email, password, phone, academic, exam, location);
      console.log("User registered successfully");

    } catch (error) {

      if (error.code === "auth/email-already-in-use") {
        Alert.alert(
        "Registration Error",
        "This email is already registered. Please login or use another email."
      );
      //alert("Email already registered. Please login or use another email.");
        console.log("Email already registered");
      }

      else if (error.code === "auth/weak-password"){
        Alert.alert(
          "Registration Error",
          "Password should be at least 6 characters."
        );
        console.log("Weak password");
        //alert("Password should be at least 6 characters.");
      }

      else {
        console.log(error.message);
      }

    }

  };

  return (
    <View style={styles.container}>

      <Text>Create Your Sphere</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TextInput
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
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
  container:{
    flex:1,
    justifyContent:"center",
    padding:20,
    gap:10
  },
  input:{
    borderWidth:1,
    padding:10
  }
});
import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet, Text } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { doc, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export default function GoogleSignInScreen({ navigation, route }) {

  const { uid, email } = route.params;

  const [phone,setPhone] = useState("");
  const [academic,setAcademic] = useState("");
  const [exam,setExam] = useState("");
  const [location,setLocation] = useState("");

  const handleSubmit = async () => {

    await setDoc(doc(db,"users",uid),{
      email,
      phone,
      academic,
      exam,
      location
    });

    console.log("Google user profile created");

    navigation.navigate("Home");

  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Complete Your Sphere</Text>

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

      <Button title="Continue" onPress={handleSubmit} />

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
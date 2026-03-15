import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../services/firebase";

export default function FeedbackScreen({ navigation, route }) {

  const { groupName, sessionId } = route.params || {};

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating before submitting.");
      return;
    }

    setSubmitting(true);

    try {

      // Save feedback to Firestore
      await addDoc(collection(db, "feedback"), {
        sessionId: sessionId || null,
        groupName: groupName || null,
        rating,
        comment: comment || "",
        submittedBy: auth.currentUser?.uid || null,
        submittedByEmail: auth.currentUser?.email || null,
        createdAt: serverTimestamp()
      });

      Alert.alert(
        "Thank You! 🎉",
        "Your feedback has been submitted.",
        [{ text: "OK", onPress: () => navigation.navigate("Home") }]
      );

    } catch (e) {
      console.log("Feedback error:", e.message);
      Alert.alert("Error", "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.navigate("Home")}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>StudySphere</Text>
          <Text style={styles.heading}>How was your session?</Text>
          {groupName ? <Text style={styles.subheading}>{groupName}</Text> : null}

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={40}
                  color={star <= rating ? "#FFC107" : "#ddd"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>
            {rating === 0 ? "Tap to rate" :
             rating === 1 ? "Poor 😞" :
             rating === 2 ? "Fair 😐" :
             rating === 3 ? "Good 🙂" :
             rating === 4 ? "Great 😄" : "Excellent! 🌟"}
          </Text>

          <Text style={styles.inputLabel}>
            Comments{"  "}<Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Tell us about your experience..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => navigation.navigate("ReportIssue")}
          >
            <Ionicons name="flag-outline" size={18} color="#fff" />
            <Text style={styles.reportBtnText}>Report an Issue</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, alignItems: "center" },
  skipBtn: { alignSelf: "flex-end", paddingVertical: 10, paddingLeft: 20 },
  skipText: { color: "#aaa", fontSize: 14 },
  logo: { fontSize: 26, fontWeight: "bold", color: "#2e7d32", marginTop: 10, marginBottom: 28 },
  heading: { fontSize: 22, fontWeight: "700", color: "#222", textAlign: "center" },
  subheading: { fontSize: 14, color: "#888", marginTop: 6, textAlign: "center", marginBottom: 4 },
  starsRow: { flexDirection: "row", gap: 10, marginTop: 28, marginBottom: 10 },
  ratingLabel: { fontSize: 14, color: "#888", marginBottom: 28 },
  inputLabel: { alignSelf: "flex-start", fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  optional: { fontWeight: "400", color: "#aaa" },
  textArea: { width: "100%", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100, marginBottom: 20 },
  submitBtn: { width: "100%", backgroundColor: "#4CAF50", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  divider: { flexDirection: "row", alignItems: "center", width: "100%", marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#eee" },
  dividerText: { marginHorizontal: 12, color: "#aaa", fontSize: 13 },
  reportBtn: { width: "100%", backgroundColor: "#e53935", borderRadius: 10, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  reportBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 }
});
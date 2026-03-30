import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../services/firebase";

export default function FeedbackScreen({ navigation, route }) {
  const { groupName, sessionId } = route.params || {};
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Pulse animation for submit button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.92, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Keyboard listeners — same pattern as ChatScreen
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Logic (original, unchanged) ───────────────────────────────────────────

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      await addDoc(collection(db, "feedback"), {
        sessionId: sessionId || null,
        groupName: groupName || null,
        rating,
        comment: comment || "",
        submittedBy: auth.currentUser?.uid || null,
        submittedByEmail: auth.currentUser?.email || null,
        createdAt: serverTimestamp(),
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

  const ratingLabel = () => {
    if (rating === 0) return "Tap to rate";
    if (rating === 1) return "Poor 😞";
    if (rating === 2) return "Fair 😐";
    if (rating === 3) return "Good 🙂";
    if (rating === 4) return "Great 😄";
    return "Excellent! 🌟";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#002678" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          activeOpacity={0.7}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 32 + insets.bottom + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Text style={styles.logo}>StudySphere</Text>

        {/* Glass card */}
        <View style={styles.card}>

          {/* Heading */}
          <View style={styles.cardHeader}>
            <Text style={styles.heading}>How was your session?</Text>
            {groupName ? (
              <Text style={styles.subheading}>{groupName}</Text>
            ) : null}
          </View>

          {/* Stars */}
          <View style={styles.starsSection}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={star <= rating ? "#FFC107" : "#c4c5d5"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.ratingLabel, rating > 0 && styles.ratingLabelActive]}>
              {ratingLabel()}
            </Text>
          </View>

          {/* Comment */}
          <View style={styles.commentSection}>
            <Text style={styles.inputLabel}>Detailed Thoughts</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Tell us about your experience..."
              placeholderTextColor="#747684"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Submit button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              <Text style={styles.submitText}>
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Text>
              {!submitting && (
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Report button */}
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => navigation.navigate("ReportIssue")}
            activeOpacity={0.85}
          >
            <Ionicons name="flag-outline" size={17} color="#ba1a1a" />
            <Text style={styles.reportBtnText}>Report an Issue</Text>
          </TouchableOpacity>
        </View>

        {/* Editorial footer */}
        <View style={styles.editorial}>
          <Text style={styles.editorialLabel}>Community Note</Text>
          <Text style={styles.editorialText}>
            Your feedback helps us curate better study sessions for everyone in the Sphere.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },

  // ── Header ────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#191c1e",
    letterSpacing: -0.2,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#747684",
  },

  // ── Scroll ────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: 20,
    alignItems: "center",
  },

  // ── Logo ──────────────────────────────────────────────────────────
  logo: {
    fontSize: 22,
    fontWeight: "800",
    fontStyle: "italic",
    color: "#0b3aa4",
    letterSpacing: -1,
    marginBottom: 16,
    marginTop: 4,
  },

  // ── Glass card ────────────────────────────────────────────────────
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    // soft shadow
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    gap: 20,
  },

  cardHeader: {
    alignItems: "center",
    gap: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#191c1e",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subheading: {
    fontSize: 13,
    color: "#444653",
    fontWeight: "500",
    textAlign: "center",
  },

  // ── Stars ─────────────────────────────────────────────────────────
  starsSection: {
    alignItems: "center",
    gap: 8,
  },
  starsRow: {
    flexDirection: "row",
    gap: 10,
  },
  ratingLabel: {
    fontSize: 14,
    color: "#747684",
    fontWeight: "500",
  },
  ratingLabelActive: {
    color: "#002678",
    fontWeight: "700",
    fontSize: 16,
  },

  // ── Comment ───────────────────────────────────────────────────────
  commentSection: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#747684",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  textArea: {
    backgroundColor: "rgba(242,244,246,0.6)",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    color: "#191c1e",
    minHeight: 110,
    lineHeight: 21,
  },

  // ── Submit button ─────────────────────────────────────────────────
  submitBtn: {
    width: "100%",
    backgroundColor: "#102A43",
    borderRadius: 999,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#102A43",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
  },

  // ── Divider ───────────────────────────────────────────────────────
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(196,197,213,0.35)",
  },
  dividerText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#747684",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  // ── Report button ─────────────────────────────────────────────────
  reportBtn: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(186,26,26,0.06)",
    borderWidth: 1,
    borderColor: "rgba(186,26,26,0.12)",
  },
  reportBtnText: {
    color: "#ba1a1a",
    fontWeight: "700",
    fontSize: 14,
  },

  // ── Editorial footer ──────────────────────────────────────────────
  editorial: {
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 4,
    gap: 4,
  },
  editorialLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#002678",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  editorialText: {
    fontSize: 12,
    color: "#444653",
    lineHeight: 18,
  },
});
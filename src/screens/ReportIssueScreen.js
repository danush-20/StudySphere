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
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import emailjsNative from "@emailjs/react-native";
import * as emailjsBrowser from "@emailjs/browser";

const emailjs = Platform.OS === "web" ? emailjsBrowser : emailjsNative;
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase";

// ─── EmailJS credentials ───────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = "service_je1k5nu";
const EMAILJS_TEMPLATE_ID = "template_vhc5fip";
const EMAILJS_PUBLIC_KEY  = "VBsxqtR2svCBmyVTx";

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

const ISSUES = [
  { label: "Select an issue type...", value: "" },
  { label: "Inappropriate behaviour",    value: "Inappropriate behaviour" },
  { label: "Spam or misleading content", value: "Spam or misleading content" },
  { label: "Technical bug or crash",     value: "Technical bug or crash" },
  { label: "Session abuse",             value: "Session abuse" },
  { label: "Harassment",                value: "Harassment" },
  { label: "Other",                     value: "Other" },
];

const PRIORITIES = ["Low", "Medium", "High"];

export default function ReportIssueScreen({ navigation, route }) {
  const { sessionMembers = [], preSelectedUid } = route.params || {};
  const insets = useSafeAreaInsets();

  const [issueType,      setIssueType]      = useState("");
  const [description,    setDescription]    = useState("");
  const [selectedUids,   setSelectedUids]   = useState([]);
  const [memberDetails,  setMemberDetails]  = useState([]);
  const [priority,       setPriority]       = useState("Medium");
  const [submitting,     setSubmitting]     = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Submit button pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Fetch member emails (original, unchanged) ─────────────────────────────

  useEffect(() => {
    const fetchEmails = async () => {
      const currentUid = auth.currentUser?.uid;
      const others = sessionMembers.filter((m) => m.id !== currentUid);
      const details = await Promise.all(
        others.map(async (m) => {
          try {
            const snap = await getDoc(doc(db, "users", m.id));
            const email = snap.exists() ? snap.data().email : "Unknown";
            return { uid: m.id, name: m.name, email };
          } catch {
            return { uid: m.id, name: m.name, email: "Unknown" };
          }
        })
      );
      setMemberDetails(details);
      if (preSelectedUid) setSelectedUids([preSelectedUid]);
    };
    if (sessionMembers.length > 0) fetchEmails();
  }, []);

  // ── Handlers (original, unchanged) ───────────────────────────────────────

  const toggleMember = (uid) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = () => {
    if (!issueType) {
      Alert.alert("Required", "Please select an issue type.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Required", "Please describe the issue before submitting.");
      return;
    }
    Alert.alert(
      "Submit Report?",
      "Your report will be sent to the StudySphere support team.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", style: "default", onPress: sendReport },
      ]
    );
  };

  const sendReport = async () => {
    setSubmitting(true);

    const reporterEmail  = auth.currentUser?.email || "Unknown";
    const reporterUid    = auth.currentUser?.uid   || "Unknown";
    const reportedUsers  = memberDetails.filter((m) => selectedUids.includes(m.uid));
    const reportedUsersText =
      reportedUsers.length > 0
        ? reportedUsers.map((u) => `${u.name} — ${u.email} (UID: ${u.uid})`).join("\n")
        : "None";

    try {
      // 1. Save to Firestore
      await addDoc(collection(db, "reports"), {
        issueType,
        description: description.trim(),
        reportedUsers,
        reporterUid,
        reporterEmail,
        priority,
        createdAt: serverTimestamp(),
        status: "open",
      });

      // 2. Send email via EmailJS
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        issue_type:     issueType,
        description:    description.trim(),
        reported_users: reportedUsersText,
        reporter_email: reporterEmail,
        reporter_uid:   reporterUid,
        to_email:       "360studysphere@gmail.com",
      });

      Alert.alert(
        "Report Submitted ✅",
        "Thank you. Our team will review your report.",
        [{ text: "OK", onPress: () => navigation.navigate("Home") }]
      );
    } catch (e) {
      console.log("Report error:", JSON.stringify(e));
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report an Issue</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 32 + insets.bottom + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Issue type picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Issue Type <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={issueType}
              onValueChange={(val) => setIssueType(val)}
              style={styles.picker}
            >
              {ISSUES.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Member chips */}
        {memberDetails.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Report Specific Members{" "}
              <Text style={styles.optional}>(optional)</Text>
            </Text>
            <View style={styles.chipsRow}>
              {memberDetails.map((m) => {
                const selected = selectedUids.includes(m.uid);
                return (
                  <TouchableOpacity
                    key={m.uid}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleMember(m.uid)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={selected ? "#fff" : "#64748b"}
                    />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Describe the Issue <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Provide as much detail as possible..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* Priority selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Priority Level</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, active && styles.priorityBtnActive]}
                  onPress={() => setPriority(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.priorityText, active && styles.priorityTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Note */}
        <Text style={styles.note}>
          Your report will be reviewed by the StudySphere team
        </Text>

        {/* Submit button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
          >
            <Ionicons name="send-outline" size={17} color="#fff" />
            <Text style={styles.submitText}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.navigate("Home")}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  // ── Header ────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(248,250,252,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.6)",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.4,
  },

  // ── Scroll ────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // ── Sections ──────────────────────────────────────────────────────
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginLeft: 4,
  },
  required: { color: "#e53935" },
  optional: {
    fontWeight: "400",
    color: "#94a3b8",
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 11,
  },

  // ── Picker ────────────────────────────────────────────────────────
  pickerWrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  picker: {
    width: "100%",
    color: "#0f172a",
  },

  // ── Member chips ──────────────────────────────────────────────────
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  chipSelected: {
    backgroundColor: "#e53935",
    borderColor: "#e53935",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  chipTextSelected: {
    color: "#ffffff",
  },

  // ── Text area ─────────────────────────────────────────────────────
  textArea: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    padding: 18,
    fontSize: 15,
    color: "#0f172a",
    minHeight: 160,
    lineHeight: 22,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },

  // ── Priority ──────────────────────────────────────────────────────
  priorityRow: {
    flexDirection: "row",
    gap: 10,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  priorityBtnActive: {
    backgroundColor: "#e53935",
    borderColor: "#e53935",
    shadowColor: "#e53935",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  priorityTextActive: {
    color: "#ffffff",
  },

  // ── Note ──────────────────────────────────────────────────────────
  note: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },

  // ── Submit button ─────────────────────────────────────────────────
  submitBtn: {
    width: "100%",
    backgroundColor: "#e53935",
    borderRadius: 999,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#e53935",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // ── Cancel ────────────────────────────────────────────────────────
  cancelBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
});
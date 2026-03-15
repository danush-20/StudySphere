import React, { useState, useEffect } from "react";
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
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import emailjsNative from "@emailjs/react-native";
import * as emailjsBrowser from "@emailjs/browser";

const emailjs = Platform.OS === "web" ? emailjsBrowser : emailjsNative;
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase";

// ─── EmailJS credentials ───────────────────────────────────────────────────
// Sign up at emailjs.com, create a service + template, paste IDs below
const EMAILJS_SERVICE_ID = "service_je1k5nu";
const EMAILJS_TEMPLATE_ID = "template_vhc5fip";
const EMAILJS_PUBLIC_KEY = "VBsxqtR2svCBmyVTx";

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });


const ISSUES = [
  { label: "Select an issue type...", value: "" },
  { label: "Inappropriate behaviour", value: "Inappropriate behaviour" },
  { label: "Spam or misleading content", value: "Spam or misleading content" },
  { label: "Technical bug or crash", value: "Technical bug or crash" },
  { label: "Session abuse", value: "Session abuse" },
  { label: "Harassment", value: "Harassment" },
  { label: "Other", value: "Other" },
];

export default function ReportIssueScreen({ navigation, route }) {

  const { sessionMembers = [], preSelectedUid } = route.params || {};

  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUids, setSelectedUids] = useState([]);
  const [memberDetails, setMemberDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch emails for all session members excluding self
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
      // Auto-select the member that was tapped
      if (preSelectedUid) {
        setSelectedUids([preSelectedUid]);
      }
    };
    if (sessionMembers.length > 0) fetchEmails();
  }, []);

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
        { text: "Submit", style: "default", onPress: sendReport }
      ]
    );
  };

  const sendReport = async () => {
    setSubmitting(true);

    const reporterEmail = auth.currentUser?.email || "Unknown";
    const reporterUid = auth.currentUser?.uid || "Unknown";
    const reportedUsers = memberDetails.filter((m) => selectedUids.includes(m.uid));

    const reportedUsersText = reportedUsers.length > 0
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
        createdAt: serverTimestamp(),
        status: "open"
      });

      // 2. Send email via EmailJS
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          issue_type: issueType,
          description: description.trim(),
          reported_users: reportedUsersText,
          reporter_email: reporterEmail,
          reporter_uid: reporterUid,
          to_email: "360studysphere@gmail.com"
        }
      );

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.navigate("Home")}>
            <Ionicons name="close" size={24} color="#555" />
          </TouchableOpacity>

          <Text style={styles.logo}>StudySphere</Text>
          <Text style={styles.heading}>Report an Issue</Text>
          <Text style={styles.subheading}>
            Help us keep StudySphere safe and enjoyable for everyone.
          </Text>

          <Text style={styles.inputLabel}>
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

          {memberDetails.length > 0 && (
            <>
              <Text style={styles.inputLabel}>
                Report Specific Members{" "}
                <Text style={styles.optional}>(optional, select one or more)</Text>
              </Text>
              <View style={styles.memberList}>
                {memberDetails.map((m) => {
                  const selected = selectedUids.includes(m.uid);
                  return (
                    <TouchableOpacity
                      key={m.uid}
                      style={[styles.memberChip, selected && styles.memberChipSelected]}
                      onPress={() => toggleMember(m.uid)}
                    >
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={selected ? "#fff" : "#aaa"}
                      />
                      <Text style={[styles.memberChipText, selected && styles.memberChipTextSelected]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.inputLabel}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please describe the issue in detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={styles.emailNote}>
            Report will be reviewed by the StudySphere team
          </Text>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Ionicons name="send-outline" size={16} color="#fff" />
            <Text style={styles.submitText}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, alignItems: "center" },
  closeBtn: { alignSelf: "flex-end", padding: 10, marginTop: 4 },
  logo: { fontSize: 26, fontWeight: "bold", color: "#2e7d32", marginTop: 6, marginBottom: 24 },
  heading: { fontSize: 22, fontWeight: "700", color: "#222", textAlign: "center" },
  subheading: { fontSize: 14, color: "#888", marginTop: 8, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  inputLabel: { alignSelf: "flex-start", fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  required: { color: "#e53935" },
  optional: { fontWeight: "400", color: "#aaa" },
  pickerWrapper: { width: "100%", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, marginBottom: 20, overflow: "hidden" },
  picker: { width: "100%" },
  memberList: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  memberChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#ddd", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  memberChipSelected: { backgroundColor: "#e53935", borderColor: "#e53935" },
  memberChipText: { fontSize: 13, color: "#555" },
  memberChipTextSelected: { color: "#fff", fontWeight: "600" },
  textArea: { width: "100%", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, padding: 12, fontSize: 14, minHeight: 120, marginBottom: 10 },
  emailNote: { alignSelf: "flex-start", fontSize: 12, color: "#aaa", marginBottom: 24 },
  submitBtn: { width: "100%", backgroundColor: "#e53935", borderRadius: 10, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 15 }
});
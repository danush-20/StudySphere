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
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { useTheme } from "../context/ThemeContext";

const emailjs = Platform.OS === "web" ? emailjsBrowser : emailjsNative;

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

const PRIORITIES = ["Low", "Medium", "High"];

export default function ReportIssueScreen({ navigation, route }) {
  const { sessionMembers = [], preSelectedUid } = route.params || {};
  const insets = useSafeAreaInsets();
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);

  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUids, setSelectedUids] = useState([]);
  const [memberDetails, setMemberDetails] = useState([]);
  const [priority, setPriority] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

    const reporterEmail = auth.currentUser?.email || "Unknown";
    const reporterUid = auth.currentUser?.uid || "Unknown";
    const reportedUsers = memberDetails.filter((m) => selectedUids.includes(m.uid));
    const reportedUsersText =
      reportedUsers.length > 0
        ? reportedUsers.map((u) => `${u.name} — ${u.email} (UID: ${u.uid})`).join("\n")
        : "None";

    try {
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

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        issue_type: issueType,
        description: description.trim(),
        reported_users: reportedUsersText,
        reporter_email: reporterEmail,
        reporter_uid: reporterUid,
        to_email: "360studysphere@gmail.com",
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
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
                      color={selected ? COLORS.onPrimary : COLORS.textSecondary}
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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Describe the Issue <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Provide as much detail as possible..."
            placeholderTextColor={COLORS.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

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

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
           style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
            >
            <View style={styles.submitContent}>
              <Text style={styles.submitText}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Text>

              {!submitting && (
                <Ionicons
                  name="send-outline"
                  size={17}
                  color={COLORS.onPrimary}
                  style={styles.submitIcon}
                />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

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

function makeStyles(COLORS) {
  const surface = COLORS.surface;
  const surfaceVariant = COLORS.surfaceVariant || COLORS.surfaceHigh || COLORS.surface;
  const surfaceHigh = COLORS.surfaceHigh || COLORS.surfaceContainer || COLORS.surfaceVariant || COLORS.surface;
  const surfaceHighest = COLORS.surfaceHighest || COLORS.surfaceContainerHigh || COLORS.border || COLORS.surface;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 12,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: surfaceHigh,
    },
    headerTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: COLORS.text,
      letterSpacing: -0.4,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 24,
      maxWidth: 480,
      width: "100%",
      alignSelf: "center",
    },
    section: {
      marginBottom: 24,
      gap: 10,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: COLORS.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 1.8,
      marginLeft: 4,
    },
    required: {
      color: COLORS.error,
    },
    optional: {
      fontWeight: "400",
      color: COLORS.textSecondary,
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11,
    },
    pickerWrapper: {
      backgroundColor: surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: "hidden",
    },
    picker: {
      width: "100%",
      color: COLORS.text,
    },
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
      borderColor: COLORS.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: surface,
    },
    chipSelected: {
      backgroundColor: COLORS.error,
      borderColor: COLORS.error,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    chipTextSelected: {
      color: COLORS.onPrimary,
    },
    textArea: {
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
      padding: 18,
      fontSize: 15,
      color: COLORS.text,
      minHeight: 200,
      lineHeight: 22,
    },
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
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    priorityBtnActive: {
      backgroundColor: COLORS.primaryBtn,
      borderColor: COLORS.Btnsecondary,
    },
    priorityText: {
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.textSecondary,
    },
    priorityTextActive: {
      color: COLORS.onPrimary,
    },
    submitBtn: {
      width: "100%",
      backgroundColor: COLORS.primaryBtn,
      borderRadius: 999,
      paddingVertical: 17,
      alignItems: "center",
      justifyContent: "center",
      shadowOpacity: 0,
      marginBottom: 12,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: COLORS.onPrimary,
      fontWeight: "800",
      fontSize: 15,
      letterSpacing: 0.3,
    },
    cancelBtn: {
      alignSelf: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    cancelText: {
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.textSecondary,
    },
    submitContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    submitIcon: {
     marginLeft: 6,
    },
  });
}
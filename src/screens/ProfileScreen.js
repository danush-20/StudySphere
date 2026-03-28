import React, { useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

const AVATARS = [
  { id: "1"  },
  { id: "2"  },
  { id: "3"  },
  { id: "4"  },
  { id: "5"  },
  { id: "6"  },
  { id: "7"  },
  { id: "8"  },
  { id: "9"  },
  { id: "10" },
  { id: "11" },
  { id: "12" },
];

const AVATAR_IMAGES = {
  "1":  require("../../assets/Avatar-1.png"),
  "2":  require("../../assets/Avatar-2.png"),
  "3":  require("../../assets/Avatar-3.png"),
  "4":  require("../../assets/Avatar-4.png"),
  "5":  require("../../assets/Avatar-5.png"),
  "6":  require("../../assets/Avatar-6.png"),
  "7":  require("../../assets/Avatar-7.png"),
  "8":  require("../../assets/Avatar-8.png"),
  "9":  require("../../assets/Avatar-9.png"),
  "10": require("../../assets/Avatar-10.png"),
  "11": require("../../assets/Avatar-11.png"),
  "12": require("../../assets/Avatar-12.png"),
};

const EXAMS = [
  { label: "Select Exam", value: "" },
  { label: "JEE",          value: "jee" },
  { label: "NEET",         value: "neet" },
  { label: "UPSC",         value: "upsc" },
  { label: "GATE",         value: "gate" },
  { label: "CAT",          value: "cat" },
  { label: "CLAT",         value: "clat" },
  { label: "SSC",          value: "ssc" },
  { label: "Banking Exams",value: "banking" },
];

export default function ProfileScreen({ navigation }) {

  const { user, profile, refreshProfile } = useContext(AuthContext);

  const [editing, setEditing] = useState(false);
  const [avatarModal, setAvatarModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [avatar,   setAvatar]   = useState(profile?.avatar   || "1");
  const [academic, setAcademic] = useState(profile?.academic || "");
  const [exam,     setExam]     = useState(profile?.exam     || "");
  const [location, setLocation] = useState(profile?.location || "");

  const currentAvatarSource = AVATAR_IMAGES[avatar] || AVATAR_IMAGES["1"];

  const handleSave = async () => {
    if (!academic.trim()) {
      Alert.alert("Required", "Academic field cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        avatar,
        academic: academic.trim(),
        exam,
        location: location.trim()
      });
      await refreshProfile();
      setEditing(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        try {
          await signOut(auth);
        } catch (e) {
          console.log(e.message);
        }
      }
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (e) {
            console.log(e.message);
          }
        },
      },
    ]);
  };

  const examLabel = EXAMS.find((e) => e.value === (editing ? exam : profile?.exam))?.label || "—";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>StudySphere</Text>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
            >
              <Text style={styles.editBtnText}>
                {editing ? (saving ? "Saving..." : "Save") : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => editing && setAvatarModal(true)}
              activeOpacity={editing ? 0.7 : 1}
            >
              <Image
                source={currentAvatarSource}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            {editing && (
              <TouchableOpacity onPress={() => setAvatarModal(true)}>
                <Text style={styles.changeAvatarText}>Change Avatar</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.profileName}>
              {profile?.username || "User"}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          {/* Info Cards */}
          <View style={styles.section}>

            <Text style={styles.sectionTitle}>Profile Info</Text>

            {/* Academic */}
            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <Ionicons name="school-outline" size={18} color="#2e7d32" />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Academic</Text>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={academic}
                    onChangeText={setAcademic}
                    placeholder="e.g. B.Tech, 2nd Year"
                    placeholderTextColor="#bbb"
                  />
                ) : (
                  <Text style={styles.fieldValue}>{profile?.academic || "—"}</Text>
                )}
              </View>
            </View>

            {/* Exam */}
            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <Ionicons name="document-text-outline" size={18} color="#2e7d32" />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Preparing For</Text>
                {editing ? (
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={exam}
                      onValueChange={(val) => setExam(val)}
                      style={styles.picker}
                    >
                      {EXAMS.map((e) => (
                        <Picker.Item key={e.value} label={e.label} value={e.value} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <Text style={styles.fieldValue}>{examLabel}</Text>
                )}
              </View>
            </View>

            {/* Location */}
            <View style={[styles.field, { borderBottomWidth: 0 }]}>
              <View style={styles.fieldIcon}>
                <Ionicons name="location-outline" size={18} color="#2e7d32" />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Location</Text>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. Chennai, India"
                    placeholderTextColor="#bbb"
                  />
                ) : (
                  <Text style={styles.fieldValue}>{profile?.location || "—"}</Text>
                )}
              </View>
            </View>

          </View>

          {/* Cancel edit */}
          {editing && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setAvatar(profile?.avatar || "1");
                setAcademic(profile?.academic || "");
                setExam(profile?.exam || "");
                setLocation(profile?.location || "");
                setEditing(false);
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {/* Logout */}
          {!editing && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#e53935" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Picker Modal */}
      <Modal visible={avatarModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAvatarModal(false)}
        >
          <View style={styles.avatarSheet}>

            <View style={styles.avatarSheetHandle} />
            <Text style={styles.avatarSheetTitle}>Choose Your Avatar</Text>

            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.avatarOption,
                    avatar === a.id && styles.avatarOptionSelected
                  ]}
                  onPress={() => {
                    setAvatar(a.id);
                    setAvatarModal(false);
                  }}
                >
                  <Image
                    source={AVATAR_IMAGES[a.id]}
                    style={styles.avatarOptionImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>

          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safe: { flex: 1, backgroundColor: "#f5f5f5" },

  scroll: { paddingBottom: 48 },

  // ── Header ──────────────────────────────────────────────

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: "#eee"
  },

  backBtn: { padding: 4 },

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2e7d32"
  },

  editBtn: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20
  },

  editBtnText: {
    color: "#2e7d32",
    fontWeight: "700",
    fontSize: 13
  },

  // ── Avatar Section ───────────────────────────────────────

  avatarSection: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderColor: "#eee"
  },

  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#c8e6c9"
  },

  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50
  },

  changeAvatarText: {
    fontSize: 13,
    color: "#2e7d32",
    fontWeight: "600",
    marginBottom: 14
  },

  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4
  },

  profileEmail: {
    fontSize: 13,
    color: "#aaa"
  },

  // ── Section ──────────────────────────────────────────────

  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingTop: 16,
    paddingBottom: 8
  },

  // ── Field ────────────────────────────────────────────────

  field: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: "#f0f0f0",
    gap: 12
  },

  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center"
  },

  fieldContent: { flex: 1 },

  fieldLabel: {
    fontSize: 11,
    color: "#aaa",
    marginBottom: 3,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },

  fieldValue: {
    fontSize: 15,
    color: "#222",
    fontWeight: "500"
  },

  fieldInput: {
    fontSize: 15,
    color: "#222",
    borderBottomWidth: 1,
    borderColor: "#c8e6c9",
    paddingVertical: 4,
    paddingHorizontal: 0
  },

  pickerWrapper: {
    marginTop: -8,
    marginLeft: -8
  },

  picker: {
    height: 44,
    color: "#222"
  },

  // ── Buttons ──────────────────────────────────────────────

  cancelBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  },

  cancelBtnText: {
    color: "#888",
    fontWeight: "600",
    fontSize: 15
  },

  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#ffcdd2",
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: "#fff"
  },

  logoutText: {
    color: "#e53935",
    fontWeight: "700",
    fontSize: 15
  },

  // ── Avatar Modal ─────────────────────────────────────────

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)"
  },

  avatarSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12
  },

  avatarSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16
  },

  avatarSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 20
  },

  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12
  },

  avatarOption: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent"
  },

  avatarOptionSelected: {
    borderColor: "#2e7d32",
    backgroundColor: "#e8f5e9"
  },

  avatarOptionImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10
  }

});
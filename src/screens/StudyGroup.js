import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ToastAndroid,
  Platform,
  Alert,
  Clipboard
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

const AVATAR_IMAGES = {
  "1":  require("../../assets/avatar-1.png"),
  "2":  require("../../assets/avatar-1.png"),
  "3":  require("../../assets/avatar-1.png"),
  "4":  require("../../assets/avatar-1.png"),
  "5":  require("../../assets/avatar-1.png"),
  "6":  require("../../assets/avatar-1.png"),
  "7":  require("../../assets/avatar-1.png"),
  "8":  require("../../assets/avatar-2.png"),
  "9":  require("../../assets/avatar-2.png"),
  "10": require("../../assets/avatar-1.png"),
  "11": require("../../assets/avatar-1.png"),
  "12": require("../../assets/avatar-2.png"),
};

export default function StudyGroupScreen({ route, navigation }) {

  const { sessionId } = route.params;
  const { user, profile } = useContext(AuthContext);

  const [groupName, setGroupName] = useState("");
  const [pin, setPin] = useState("");
  const [members, setMembers] = useState([]);
  const [hostUid, setHostUid] = useState("");
  const [menuMember, setMenuMember] = useState(null); // member whose 3-dot menu is open

  // Pomodoro state
  const [studyTime, setStudyTime] = useState("25");
  const [breakTime, setBreakTime] = useState("5");
  const [timer, setTimer] = useState(25 * 60);
  const [mode, setMode] = useState("study"); // "study" | "break"
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false); // true after Stop pressed

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempStudy, setTempStudy] = useState("25");
  const [tempBreak, setTempBreak] = useState("5");

  // Stats (synced via Firestore)
  const [focusSecs, setFocusSecs] = useState(0);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const focusRef = useRef(null);
  const focusSecsRef = useRef(0); // ref so interval can read latest value

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const sheetRef = useRef(null);
  const snapPoints = ["12%", "45%", "80%"];
  const intervalRef = useRef(null);

  // ─── Firestore listener ───────────────────────────────────────────────────

  useEffect(() => {

    const unsub = onSnapshot(doc(db, "studySessions", sessionId), async (snap) => {

      if (!snap.exists()) return;

      const data = snap.data();

      setGroupName(data.groupName || "");
      setPin(data.pin || "");
      setHostUid(data.host || "");


      if (data.members) {
        // members is stored as { uid: true }, so we fetch display names
        const uids = Object.keys(data.members);
        const memberList = await Promise.all(
          uids.map(async (uid) => {
            try {
              const userDoc = await getDoc(doc(db, "users", uid));
              const name = userDoc.exists()
                ? userDoc.data().email?.split("@")[0]
                : uid;
              const avatar = userDoc.exists() ? userDoc.data().avatar || "1" : "1";
              return { id: uid, name, avatar };
            } catch {
              return { id: uid, name: uid };
            }
          })
        );
        setMembers(memberList);
      } else {
        setMembers([]);
      }

      // Sync stats
      if (data.stats) {
        setFocusSecs(data.stats.focusSecs || 0);
        setSessionsCompleted(data.stats.sessionsCompleted || 0);
      }

      // Sync tasks
      if (data.tasks) {
        setTasks(data.tasks);
      }

      // Sync settings so all members use the same durations
      if (data.pomodoroSettings) {
        setStudyTime(String(data.pomodoroSettings.studyTime));
        setBreakTime(String(data.pomodoroSettings.breakTime));
      }

      // Sync timer state — calculate elapsed time on join/rejoin so timer is live
      if (data.timerState) {
        const { running: r, timer: t, mode: m, startedAt } = data.timerState;
        setMode(m);
        setStopped(!r && t > 0);

        if (r && startedAt) {
          // Calculate seconds elapsed since host started the timer
          const now = Date.now();
          const startedMs = startedAt.toMillis ? startedAt.toMillis() : startedAt;
          const elapsed = Math.floor((now - startedMs) / 1000);
          const current = Math.max(t - elapsed, 0);
          setTimer(current);
          setRunning(current > 0);
          if (current <= 0) {
            setStopped(false);
            setMode(m === "study" ? "break" : "study");
          }
        } else {
          setTimer(t);
          setRunning(r);
        }
      }

    });

    return () => unsub();

  }, [sessionId]);

  // ─── Local timer tick ─────────────────────────────────────────────────────

  useEffect(() => {

    if (running) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setStopped(false);
            if (mode === "study") {
              const newCount = sessionsCompleted + 1;
              setSessionsCompleted(newCount);
              updateDoc(doc(db, "studySessions", sessionId), {
                "stats.sessionsCompleted": newCount
              }).catch((e) => console.log("Sessions sync error:", e.message));
            }
            setMode((m) => (m === "study" ? "break" : "study"));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);

  }, [running]);

  // ─── Focus time counter — ticks locally, syncs to Firestore every 5s ──────

  useEffect(() => {
    if (running && mode === "study") {
      focusRef.current = setInterval(() => {
        focusSecsRef.current += 1;
        setFocusSecs(focusSecsRef.current);
        // Write to Firestore every 5 seconds to avoid hammering
        if (focusSecsRef.current % 5 === 0) {
          updateDoc(doc(db, "studySessions", sessionId), {
            "stats.focusSecs": focusSecsRef.current
          }).catch((e) => console.log("Stats sync error:", e.message));
        }
      }, 1000);
    } else {
      clearInterval(focusRef.current);
    }
    return () => clearInterval(focusRef.current);
  }, [running, mode]);

  const isHost = auth.currentUser?.uid === hostUid;

  // Sort members: host first, then others
  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === hostUid) return -1;
    if (b.id === hostUid) return 1;
    return 0;
  });

  // ─── Firestore timer sync (only host should write, others read) ───────────

  const syncTimerToFirestore = async (updates) => {
    try {
      await updateDoc(doc(db, "studySessions", sessionId), {
        timerState: updates
      });
    } catch (e) {
      console.log("Timer sync error:", e.message);
    }
  };

  // ─── Button handlers ──────────────────────────────────────────────────────

  // Start button (also serves as "Break" button when running)
  const handleStartOrBreak = async () => {
    if (running) {
      // Switch to break
      const breakSecs = parseInt(breakTime) * 60;
      setMode("break");
      setTimer(breakSecs);
      setRunning(true);
      setStopped(false);
      await syncTimerToFirestore({ running: true, timer: breakSecs, mode: "break", startedAt: serverTimestamp() });
    } else {
      // Start study
      const studySecs = parseInt(studyTime) * 60;
      if (!stopped) setTimer(studySecs);
      setMode("study");
      setRunning(true);
      setStopped(false);
      await syncTimerToFirestore({ running: true, timer: stopped ? timer : studySecs, mode: "study", startedAt: serverTimestamp() });
    }
  };

  // Stop button (also serves as "Reset" after stopped)
  const handleStopOrReset = async () => {
    if (stopped) {
      // Reset
      const studySecs = parseInt(studyTime) * 60;
      setTimer(studySecs);
      setMode("study");
      setStopped(false);
      setRunning(false);
      await syncTimerToFirestore({ running: false, timer: studySecs, mode: "study" });
    } else {
      // Stop
      setRunning(false);
      setStopped(true);
      await syncTimerToFirestore({ running: false, timer, mode });
    }
  };

  // ─── Save settings ────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    const s = parseInt(tempStudy) || 25;
    const b = parseInt(tempBreak) || 5;
    setStudyTime(String(s));
    setBreakTime(String(b));
    const newTimer = s * 60;
    setTimer(newTimer);
    setRunning(false);
    setStopped(false);
    setMode("study");
    setSettingsVisible(false);
    await syncTimerToFirestore({ running: false, timer: newTimer, mode: "study" });
    try {
      await updateDoc(doc(db, "studySessions", sessionId), {
        pomodoroSettings: { studyTime: s, breakTime: b }
      });
    } catch (e) {
      console.log("Settings sync error:", e.message);
    }
  };

  // ─── Task handlers ───────────────────────────────────────────────────────

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    const updated = [...tasks, { id: Date.now().toString(), text: newTask.trim(), done: false }];
    setNewTask("");
    setAddingTask(false);
    try {
      await updateDoc(doc(db, "studySessions", sessionId), { tasks: updated });
    } catch (e) {
      console.log("Task add error:", e.message);
    }
  };

  const handleToggleTask = async (id) => {
    const updated = tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t);
    try {
      await updateDoc(doc(db, "studySessions", sessionId), { tasks: updated });
    } catch (e) {
      console.log("Task toggle error:", e.message);
    }
  };

  const formatFocus = () => {
    const h = Math.floor(focusSecs / 3600);
    const m = Math.floor((focusSecs % 3600) / 60);
    const s = focusSecs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };


  // ─── Leave session ────────────────────────────────────────────────────────

  const handleLeave = async () => {
    try {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, "studySessions", sessionId), {
        [`members.${uid}`]: deleteField()
      });
      navigation.navigate("Feedback", { groupName, sessionId });
    } catch (e) {
      console.log("Leave error:", e.message);
    }
  };

  // ─── Copy PIN ─────────────────────────────────────────────────────────────

  const handleCopyPin = () => {
    Clipboard.setString(pin);
    if (Platform.OS === "android") {
      ToastAndroid.show("PIN copied!", ToastAndroid.SHORT);
    } else {
      Alert.alert("Copied", `PIN ${pin} copied to clipboard`);
    }
  };

  // ─── Format time ─────────────────────────────────────────────────────────

  const formatTime = () => {
    const m = Math.floor(timer / 60);
    const s = timer % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Button labels ────────────────────────────────────────────────────────

  const startLabel = running ? "Break" : "Start";
  const stopLabel = stopped ? "Reset" : "Stop";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>

        <Text style={styles.logo}>StudySphere</Text>

        <View style={styles.groupRow}>
          <Text style={styles.groupName}>{groupName}</Text>
          <TouchableOpacity style={styles.pinBadge} onPress={handleCopyPin}>
            <Text style={styles.pinText}>PIN  {pin}</Text>
            <Ionicons name="copy-outline" size={13} color="#666" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Pomodoro Box */}
      <View style={styles.pomodoroBox}>

        <View style={styles.modeRow}>
          <Text style={styles.modeLabel}>
            {mode === "study" ? "🎯 Study Session" : "☕ Break Time"}
          </Text>
          <TouchableOpacity onPress={() => {
            setTempStudy(studyTime);
            setTempBreak(breakTime);
            setSettingsVisible(true);
          }}>
            <Ionicons name="settings-outline" size={20} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{formatTime()}</Text>
        </View>

        <View style={styles.timerButtons}>

          <TouchableOpacity
            style={[styles.timerBtn, running ? styles.breakBtn : styles.startBtn, !isHost && styles.btnDisabled]}
            onPress={isHost ? handleStartOrBreak : null}
            disabled={!isHost}
          >
            <Text style={styles.timerBtnText}>{startLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timerBtn, stopped ? styles.resetBtn : styles.stopBtn, !isHost && styles.btnDisabled]}
            onPress={isHost ? handleStopOrReset : null}
            disabled={!isHost || (!running && !stopped)}
          >
            <Text style={styles.timerBtnText}>{stopLabel}</Text>
          </TouchableOpacity>

        </View>

      </View>

      {/* Stats + Tasks */}
      <View style={styles.midSection}>

        {/* Session Stats */}
        <View style={styles.statsRow}>

          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={18} color="#4CAF50" />
            <Text style={styles.statValue}>{formatFocus()}</Text>
            <Text style={styles.statLabel}>Focus Time</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2196F3" />
            <Text style={styles.statValue}>{sessionsCompleted}</Text>
            <Text style={styles.statLabel}>Sessions Done</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={18} color="#FF9800" />
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>

        </View>

        {/* Task Checklist */}
        <View style={styles.taskSection}>

          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle}>📋 Session Goals</Text>
            {isHost && (
              <TouchableOpacity onPress={() => setAddingTask(!addingTask)}>
                <Ionicons name={addingTask ? "close" : "add-circle-outline"} size={22} color="#4CAF50" />
              </TouchableOpacity>
            )}
          </View>

          {isHost && addingTask && (
            <View style={styles.taskInputRow}>
              <TextInput
                style={styles.taskInput}
                placeholder="Add a goal..."
                value={newTask}
                onChangeText={setNewTask}
                onSubmitEditing={handleAddTask}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity style={styles.taskAddBtn} onPress={handleAddTask}>
                <Text style={styles.taskAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {tasks.length === 0 && !addingTask ? (
            <Text style={styles.noTasks}>{isHost ? "Tap + to add session goals" : "No goals added yet"}</Text>
          ) : (
            tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskRow}
                onPress={() => isHost ? handleToggleTask(task.id) : null}
                disabled={!isHost}
              >
                <Ionicons
                  name={task.done ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={task.done ? "#4CAF50" : "#bbb"}
                />
                <Text style={[styles.taskText, task.done && styles.taskDone]}>
                  {task.text}
                </Text>
              </TouchableOpacity>
            ))
          )}

        </View>

      </View>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        handleIndicatorStyle={styles.dragHandle}
      >
        <BottomSheetView style={styles.sheetContent}>

          {/* Mic / Media / Chat buttons — always visible, travel with sheet */}
          <View style={styles.iconRow}>

            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="mic-outline" size={22} color="#333" />
              <Text style={styles.iconLabel}>Mic</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="videocam-outline" size={22} color="#333" />
              <Text style={styles.iconLabel}>Media</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="chatbubble-outline" size={22} color="#333" />
              <Text style={styles.iconLabel}>Chat</Text>
            </TouchableOpacity>

          </View>

          {/* Members list */}
          <Text style={styles.membersTitle}>Members ({members.length})</Text>

          {sortedMembers.length === 0 ? (
            <Text style={styles.noMember}>No active members</Text>
          ) : (
            <FlatList
              data={sortedMembers}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isItemHost = item.id === hostUid;
                const isMe = item.id === auth.currentUser?.uid;
                return (
                  <View style={styles.memberRow}>
                    <Image
                      source={AVATAR_IMAGES[item.avatar] || AVATAR_IMAGES["1"]}
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: isItemHost ? "#c8e6c9" : "#eee"
                      }}
                      resizeMode="cover"
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {item.name}{isMe ? "  (you)" : ""}
                      </Text>
                      {isItemHost && (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>HOST</Text>
                        </View>
                      )}
                    </View>
                    {/* 3-dot menu button — show for everyone except yourself */}
                    {!isMe && (
                      <TouchableOpacity
                        style={styles.dotMenu}
                        onPress={() => setMenuMember(item)}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          {/* Leave button */}
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <Ionicons name="exit-outline" size={18} color="#fff" />
            <Text style={styles.leaveBtnText}>Leave Session</Text>
          </TouchableOpacity>

        </BottomSheetView>
      </BottomSheet>

      {/* Member Action Modal */}
      <Modal visible={!!menuMember} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuMember(null)}
        >
          <View style={styles.actionSheet}>

            <Text style={styles.actionSheetName}>
              {menuMember?.name}
              {menuMember?.id === hostUid ? "  👑" : ""}
            </Text>

            {/* Host-only actions */}
            {isHost && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setMenuMember(null);
                  Alert.alert("Mute", `${menuMember?.name} muted. (Feature coming soon)`);
                }}
              >
                <Ionicons name="mic-off-outline" size={20} color="#555" />
                <Text style={styles.actionText}>Mute</Text>
              </TouchableOpacity>
            )}

            {/* Available to all */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setMenuMember(null);
                navigation.navigate("ViewProfile", { uid: menuMember?.id });
              }}
            >
              <Ionicons name="person-outline" size={20} color="#555" />
              <Text style={styles.actionText}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setMenuMember(null);
                navigation.navigate("ReportIssue", { sessionMembers: members, preSelectedUid: menuMember?.id });
              }}
            >
              <Ionicons name="flag-outline" size={20} color="#FF9800" />
              <Text style={[styles.actionText, { color: "#FF9800" }]}>Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionCancel]}
              onPress={() => setMenuMember(null)}
            >
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            <Text style={styles.modalTitle}>⏱ Pomodoro Settings</Text>

            <Text style={styles.modalLabel}>Study Duration (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={tempStudy}
              onChangeText={setTempStudy}
              keyboardType="numeric"
            />

            <Text style={styles.modalLabel}>Break Duration (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={tempBreak}
              onChangeText={setTempBreak}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveSettings}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },

  // ── Header ──────────────────────────────────────────────

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee"
  },

  logo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2e7d32"
  },

  groupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },

  groupName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333"
  },

  pinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },

  pinText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500"
  },

  // ── Pomodoro Box ─────────────────────────────────────────

  pomodoroBox: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },

  modeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16
  },

  modeLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333"
  },

  timerCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24
  },

  timerText: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#222",
    letterSpacing: 2
  },

  timerButtons: {
    flexDirection: "row",
    gap: 14
  },

  timerBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: "center"
  },

  startBtn: {
    backgroundColor: "#4CAF50"
  },

  breakBtn: {
    backgroundColor: "#2196F3"
  },

  stopBtn: {
    backgroundColor: "#f44336"
  },

  resetBtn: {
    backgroundColor: "#FF9800"
  },

  timerBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15
  },

  // ── Bottom Sheet ─────────────────────────────────────────

  dragHandle: {
    backgroundColor: "#ccc",
    width: 40
  },

  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8
  },

  iconRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginBottom: 12
  },

  iconBtn: {
    alignItems: "center",
    gap: 4
  },

  iconLabel: {
    fontSize: 11,
    color: "#555"
  },

  membersTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: "#eee",
    gap: 10
  },

  memberName: {
    fontSize: 15,
    color: "#333"
  },

  noMember: {
    textAlign: "center",
    color: "#aaa",
    marginVertical: 20
  },

  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e53935",
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    gap: 8
  },

  leaveBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15
  },

  // ── Mid Section ──────────────────────────────────────────

  midSection: {
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10
  },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },

  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 3
  },

  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
    marginTop: 2
  },

  statLabel: {
    fontSize: 11,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },

  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#eee"
  },

  taskSection: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },

  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333"
  },

  taskInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10
  },

  taskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14
  },

  taskAddBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center"
  },

  taskAddBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13
  },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 0.5,
    borderColor: "#f0f0f0"
  },

  taskText: {
    fontSize: 14,
    color: "#333",
    flex: 1
  },

  taskDone: {
    textDecorationLine: "line-through",
    color: "#aaa"
  },

  noTasks: {
    fontSize: 13,
    color: "#bbb",
    textAlign: "center",
    paddingVertical: 8
  },

  btnDisabled: {
    opacity: 0.4
  },

  memberInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },

  hostBadge: {
    backgroundColor: "#e8f5e9",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },

  hostBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2e7d32",
    letterSpacing: 0.5
  },

  dotMenu: {
    padding: 6
  },

  actionSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 30,
    paddingHorizontal: 20
  },

  actionSheetName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginBottom: 8
  },

  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: "#f0f0f0"
  },

  actionText: {
    fontSize: 15,
    color: "#333"
  },

  actionCancel: {
    justifyContent: "center",
    borderBottomWidth: 0,
    marginTop: 4
  },

  actionCancelText: {
    fontSize: 15,
    color: "#999",
    textAlign: "center",
    width: "100%"
  },

  // ── Settings Modal ───────────────────────────────────────

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)"
  },

  modalBox: {
    backgroundColor: "#fff",
    margin: 30,
    borderRadius: 14,
    padding: 24
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#222"
  },

  modalLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    fontSize: 15
  },

  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },

  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center"
  },

  cancelText: {
    color: "#555"
  },

  saveBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    alignItems: "center"
  },

  saveText: {
    color: "#fff",
    fontWeight: "bold"
  }

});
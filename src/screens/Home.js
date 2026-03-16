import React, { useContext, useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Modal, RefreshControl, Alert
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AvatarIcon from "../components/AvatarIcon";

import { signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

import {
  collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, doc, getDoc, arrayUnion, arrayRemove
} from "firebase/firestore";

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Study hard, for the well is deep and our brains are shallow.", author: "Richard Baxter" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Education is the passport to the future.", author: "Malcolm X" },
  { text: "The beautiful thing about learning is nobody can take it away from you.", author: "B.B. King" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { text: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "Little things make big days.", author: "Unknown" },
  { text: "It's going to be hard, but hard does not mean impossible.", author: "Unknown" },
  { text: "Don't wait for opportunity. Create it.", author: "Unknown" },
  { text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.", author: "Unknown" },
  { text: "Concentrate all your thoughts upon the work in hand.", author: "Alexander Graham Bell" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
];

const getDailyQuote = () => QUOTES[new Date().getDate() % QUOTES.length];

export default function Home({ navigation }) {

  const { user, profile } = useContext(AuthContext);

  const [showSearch, setShowSearch] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [myGroups, setMyGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); // requests for host to approve
  const [refreshing, setRefreshing] = useState(false);

  const quote = getDailyQuote();
  const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();

  const fetchSessions = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      // Hosted groups
      const hostedQ = query(collection(db, "studySessions"), where("host", "==", uid));
      const hostedSnap = await getDocs(hostedQ);
      const hosted = hostedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyGroups(hosted);

      // Collect all join requests across hosted groups
      const allRequests = [];
      for (const group of hosted) {
        if (group.joinRequests && group.joinRequests.length > 0) {
          for (const req of group.joinRequests) {
            // Fetch username for display
            try {
              const userDoc = await getDoc(doc(db, "users", req.uid));
              const userData = userDoc.exists() ? userDoc.data() : {};
              allRequests.push({
                ...req,
                username: userData.username || userData.email?.split("@")[0] || req.uid,
                sessionId: group.id,
                sessionName: group.groupName
              });
            } catch {
              allRequests.push({ ...req, username: req.uid, sessionId: group.id, sessionName: group.groupName });
            }
          }
        }
      }
      setPendingRequests(allRequests);

      // Joined groups (active members, not host)
      const joinedActiveQ = query(
        collection(db, "studySessions"),
        where(`members.${uid}`, "==", true)
      );
      // Past members (left but should still show)
      const joinedInactiveQ = query(
        collection(db, "studySessions"),
        where(`members.${uid}`, "==", false)
      );
      const [activeSnap, inactiveSnap] = await Promise.all([
        getDocs(joinedActiveQ),
        getDocs(joinedInactiveQ)
      ]);
      const allJoined = [
        ...activeSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ...inactiveSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      ];
      // Deduplicate and exclude sessions where user is host
      const seen = new Set();
      const joined = allJoined.filter(g => {
        if (g.host === uid || seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      setJoinedGroups(joined);
    } catch (e) {
      console.log("Fetch error:", e.message);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }, [fetchSessions]);

  const handleCreateSession = async () => {
    try {
      const uid = auth.currentUser.uid;
      const pin = generatePin();
      const docRef = await addDoc(collection(db, "studySessions"), {
        groupName, subject, description,
        host: uid, pin,
        createdAt: serverTimestamp(),
        members: { [uid]: true },
        joinRequests: []
      });
      setGroupName(""); setSubject(""); setDescription("");
      setModalVisible(false);
      fetchSessions();
      navigation.navigate("StudyGroup", { sessionId: docRef.id });
    } catch (e) { console.log(e.message); }
  };

  // Instead of joining directly, send a join request to the host
  const handleJoin = async () => {
    if (!joinPin.trim()) return;
    try {
      const q = query(collection(db, "studySessions"), where("pin", "==", joinPin));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        Alert.alert("Not Found", "No session found with that PIN.");
        return;
      }
      const sessionDoc = snapshot.docs[0];
      const sessionId = sessionDoc.id;
      const sessionData = sessionDoc.data();
      const uid = auth.currentUser.uid;

      // Already an active member — go straight in
      if (sessionData.members?.[uid] === true) {
        setJoinModalVisible(false);
        setJoinPin("");
        navigation.navigate("StudyGroup", { sessionId });
        return;
      }
      // Past member (left before) — re-activate directly, no approval needed
      if (sessionData.members?.[uid] === false) {
        await updateDoc(doc(db, "studySessions", sessionId), {
          [`members.${uid}`]: true
        });
        setJoinModalVisible(false);
        setJoinPin("");
        fetchSessions();
        navigation.navigate("StudyGroup", { sessionId });
        return;
      }

      // Already requested
      const alreadyRequested = (sessionData.joinRequests || []).some(r => r.uid === uid);
      if (alreadyRequested) {
        Alert.alert("Already Requested", "Your join request is pending host approval.");
        return;
      }

      // Send join request
      await updateDoc(doc(db, "studySessions", sessionId), {
        joinRequests: arrayUnion({
          uid,
          username: profile?.username || user?.email?.split("@")[0] || uid,
          requestedAt: new Date().toISOString()
        })
      });

      setJoinModalVisible(false);
      setJoinPin("");
      Alert.alert("Request Sent", "Your join request has been sent to the host for approval.");
    } catch (e) {
      console.log(e.message);
    }
  };

  // Host approves a join request
  const handleApprove = async (req) => {
    try {
      const sessionRef = doc(db, "studySessions", req.sessionId);
      const sessionDoc = await getDoc(sessionRef);
      const requests = sessionDoc.data()?.joinRequests || [];
      const updated = requests.filter(r => r.uid !== req.uid);

      await updateDoc(sessionRef, {
        [`members.${req.uid}`]: true,
        joinRequests: updated
      });
      fetchSessions();
    } catch (e) {
      console.log("Approve error:", e.message);
    }
  };

  // Host declines a join request
  const handleDecline = async (req) => {
    try {
      const sessionRef = doc(db, "studySessions", req.sessionId);
      const sessionDoc = await getDoc(sessionRef);
      const requests = sessionDoc.data()?.joinRequests || [];
      const updated = requests.filter(r => r.uid !== req.uid);
      await updateDoc(sessionRef, { joinRequests: updated });
      fetchSessions();
    } catch (e) {
      console.log("Decline error:", e.message);
    }
  };

  const joinDirect = async (sessionId) => {
    try {
      const uid = auth.currentUser.uid;
      // Re-activate membership (works for both new joins and rejoins)
      await updateDoc(doc(db, "studySessions", sessionId), { [`members.${uid}`]: true });
      setJoinModalVisible(false);
      navigation.navigate("StudyGroup", { sessionId });
    } catch (e) { console.log(e.message); }
  };

  const getMemberCount = (group) => {
    if (!group.members) return 0;
    return Object.values(group.members).filter(v => v === true).length;
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <AvatarIcon size={36} />
        </TouchableOpacity>
        <Text style={styles.logo}>StudySphere</Text>
        <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
          <Ionicons name="search-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={16} color="#aaa" style={{ marginRight: 8 }} />
          <TextInput placeholder="Search..." style={styles.searchInput} />
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.username}>
            {profile?.username || user?.email?.split("@")[0]} 👋
          </Text>
        </View>

        {/* Daily Quote */}
        <View style={styles.quoteCard}>
          <Ionicons name="bulb-outline" size={18} color="#f0a500" style={{ marginBottom: 8 }} />
          <Text style={styles.quoteText}>"{quote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
        </View>

        {/* Pending Join Requests (host only) */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Join Requests</Text>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{pendingRequests.length}</Text>
              </View>
            </View>
            {pendingRequests.map((req, i) => (
              <View key={`${req.uid}-${i}`} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestUsername}>{req.username}</Text>
                  <Text style={styles.requestSession}>wants to join "{req.sessionName}"</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => handleDecline(req)}
                  >
                    <Ionicons name="close" size={16} color="#e53935" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(req)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Joined Sessions */}
        {joinedGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Joined Sessions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {joinedGroups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.sessionCard, styles.joinedCard]}
                  onPress={() => joinDirect(group.id)}
                >
                  <View style={styles.sessionCardTop}>
                    <View style={[styles.hostBadge, styles.memberBadge]}>
                      <Text style={[styles.hostBadgeText, styles.memberBadgeText]}>MEMBER</Text>
                    </View>
                    <Text style={styles.sessionCardMembers}>
                      <Ionicons name="people-outline" size={12} /> {getMemberCount(group)}
                    </Text>
                  </View>
                  <Text style={styles.sessionCardName} numberOfLines={2}>{group.groupName}</Text>
                  <Text style={styles.sessionCardSubject} numberOfLines={1}>{group.subject}</Text>
                  <View style={[styles.openBtn, styles.rejoinBtn]}>
                    <Text style={styles.openBtnText}>Rejoin →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {myGroups.length === 0 && joinedGroups.length === 0 && pendingRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#ddd" />
            <Text style={styles.emptyTitle}>No active sessions</Text>
            <Text style={styles.emptySubtitle}>Create or join a study group to get started</Text>
          </View>
        )}

        <View style={{ height: 20 }} />

      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Study Group</Text>
            <TextInput placeholder="Group Name" value={groupName} onChangeText={setGroupName} style={styles.input} />
            <TextInput placeholder="Subject" value={subject} onChangeText={setSubject} style={styles.input} />
            <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={styles.input} />
            <TouchableOpacity style={styles.modalButton} onPress={handleCreateSession}>
              <Text style={styles.modalButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* JOIN MODAL */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setJoinModalVisible(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Join Study Group</Text>

            {/* Host's own groups — shown as "not joined yet" for others */}
            {myGroups.length > 0 && (
              <ScrollView contentContainerStyle={styles.grid} style={{ maxHeight: 150 }}>
                {myGroups.map(group => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.cube}
                    onPress={() => joinDirect(group.id)}
                  >
                    <Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center", color: "#333" }}>
                      {group.groupName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TextInput
              placeholder="Enter PIN to request joining"
              value={joinPin}
              onChangeText={setJoinPin}
              style={styles.input}
              keyboardType="numeric"
            />

            <Text style={styles.joinNote}>
              <Ionicons name="information-circle-outline" size={13} color="#aaa" />
              {"  "}Join requests require host approval
            </Text>

            <TouchableOpacity style={styles.modalButton} onPress={handleJoin}>
              <Text style={styles.modalButtonText}>Send Join Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.button} onPress={() => { fetchSessions(); setJoinModalVisible(true); }}>
          <Ionicons name="enter-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { setGroupName(""); setSubject(""); setDescription(""); setModalVisible(true); }}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderColor: "#eee"
  },

  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2e7d32"
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333"
  },

  scroll: {
    flex: 1
  },

  greetingRow: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4
  },

  greeting: {
    fontSize: 14,
    color: "#888"
  },

  username: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 2
  },

  quoteCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#fffde7",
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#f0a500"
  },

  quoteText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    fontStyle: "italic",
    marginBottom: 8
  },

  quoteAuthor: {
    fontSize: 12,
    color: "#f0a500",
    fontWeight: "600"
  },

  section: {
    marginTop: 24,
    paddingHorizontal: 16
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },

  badgeCount: {
    backgroundColor: "#e53935",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2
  },

  badgeCountText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "700"
  },

  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },

  requestInfo: {
    flex: 1
  },

  requestUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222"
  },

  requestSession: {
    fontSize: 12,
    color: "#888",
    marginTop: 2
  },

  requestActions: {
    flexDirection: "row",
    gap: 8
  },

  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#ffcdd2",
    alignItems: "center",
    justifyContent: "center"
  },

  approveBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center"
  },

  sessionCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },

  joinedCard: {
    backgroundColor: "#f0f7ff"
  },

  sessionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },

  hostBadge: {
    backgroundColor: "#e8f5e9",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },

  hostBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2e7d32",
    letterSpacing: 0.5
  },

  memberBadge: {
    backgroundColor: "#e3f2fd"
  },

  memberBadgeText: {
    color: "#1565c0"
  },

  sessionCardMembers: {
    fontSize: 12,
    color: "#aaa"
  },

  sessionCardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4
  },

  sessionCardSubject: {
    fontSize: 12,
    color: "#888",
    marginBottom: 12
  },

  openBtn: {
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center"
  },

  rejoinBtn: {
    backgroundColor: "#1565c0"
  },

  openBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },

  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#bbb",
    marginTop: 16
  },

  emptySubtitle: {
    fontSize: 13,
    color: "#ccc",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20
  },

  bottomButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 12,
    borderTopWidth: 0.5,
    borderColor: "#eee",
    backgroundColor: "#fff"
  },

  button: {
    backgroundColor: "#2e7d32",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  },

  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)"
  },

  modalBox: {
    width: "88%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12
  },

  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    fontSize: 14
  },

  joinNote: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 8,
    marginLeft: 2
  },

  modalButton: {
    backgroundColor: "#2e7d32",
    borderRadius: 10,
    padding: 13,
    marginTop: 14,
    alignItems: "center"
  },

  modalButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10
  },

  cube: {
    width: "30%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    margin: 5,
    justifyContent: "center",
    alignItems: "center",
    padding: 4
  }
});
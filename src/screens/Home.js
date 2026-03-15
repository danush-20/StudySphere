import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AvatarIcon from "../components/AvatarIcon";

import { signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { AuthContext } from "../context/AuthContext";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";

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

  const value = user?.emailVerified ? "verified" : "not verified";

  const generatePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleCreateSession = async () => {

    try {

      const uid = auth.currentUser.uid;
      const pin = generatePin();

      const docRef = await addDoc(collection(db, "studySessions"), {
        groupName,
        subject,
        description,
        host: uid,
        pin,
        createdAt: serverTimestamp(),
        members: {
          [uid]: true
        }
      });

      setGroupName("");
      setSubject("");
      setDescription("");
      setModalVisible(false);

      navigation.navigate("StudyGroup", { sessionId: docRef.id });

    } catch (error) {
      console.log(error.message);
    }

  };

  const fetchHostGroups = async () => {

    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, "studySessions"),
      where("host", "==", uid)
    );

    const snapshot = await getDocs(q);

    const groups = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    setMyGroups(groups);

  };

  const handleJoin = async () => {

    try {

      const q = query(
        collection(db, "studySessions"),
        where("pin", "==", joinPin)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {

        const docSnap = snapshot.docs[0];
        const sessionId = docSnap.id;

        const uid = auth.currentUser.uid;

        await updateDoc(doc(db, "studySessions", sessionId), {
          [`members.${uid}`]: true
        });

        setJoinModalVisible(false);

        navigation.navigate("StudyGroup", { sessionId });

      }

    } catch (error) {
      console.log(error.message);
    }

  };

  const joinDirect = async (sessionId) => {

    try {

      const uid = auth.currentUser.uid;

      await updateDoc(doc(db, "studySessions", sessionId), {
        [`members.${uid}`]: true
      });

      setJoinModalVisible(false);

      navigation.navigate("StudyGroup", { sessionId });

    } catch (error) {
      console.log(error.message);
    }

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
          {/* <Ionicons name="search" size={25} /> */}
        </TouchableOpacity> 

      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput placeholder="Search..." style={styles.searchInput}/>
        </View>
      )}

      {/* CREATE MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">

        <View style={styles.overlay}>

          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
          />

          <View style={styles.modalBox}>

            <Text>Create Study Group</Text>

            <TextInput
              placeholder="Group Name"
              value={groupName}
              onChangeText={setGroupName}
              style={styles.input}
            />

            <TextInput
              placeholder="Subject"
              value={subject}
              onChangeText={setSubject}
              style={styles.input}
            />

            <TextInput
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCreateSession}
            >
              <Text>Create</Text>
            </TouchableOpacity>

          </View>

        </View>

      </Modal>

      {/* JOIN MODAL */}
      <Modal visible={joinModalVisible} transparent animationType="fade">

        <View style={styles.overlay}>

          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setJoinModalVisible(false)}
          />

          <View style={styles.modalBox}>

            <Text>Join Study Group</Text>

            <ScrollView contentContainerStyle={styles.grid}>

              {myGroups.map(group => (

                <TouchableOpacity
                  key={group.id}
                  style={styles.cube}
                  onPress={() => joinDirect(group.id)}
                >

                  <Text numberOfLines={2}>{group.groupName}</Text>

                </TouchableOpacity>

              ))}

            </ScrollView>

            <TextInput
              placeholder="Enter PIN"
              value={joinPin}
              onChangeText={setJoinPin}
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleJoin}
            >
              <Text>Join</Text>
            </TouchableOpacity>

          </View>

        </View>

      </Modal>

      {/* Scrollable Content */}
      <ScrollView style={styles.content}>

        <Text>Welcome to StudySphere</Text>
        <Text>{user?.email}</Text>
        <Text>{value}</Text>
        <Text>{profile?.academic}</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            fetchHostGroups();
            setJoinModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Join</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
          setGroupName("");
          setSubject("");
          setDescription("");
          setModalVisible(true);
        }}
        >
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:"#fff"
  },

  header:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center",
    paddingHorizontal:15,
    paddingVertical:10
  },

  logo:{
    fontSize:20,
    fontWeight:"bold"
  },

  searchContainer:{
    paddingHorizontal:15
  },

  searchInput:{
    borderWidth:1,
    borderColor:"#ccc",
    borderRadius:8,
    padding:8
  },

  content:{
    flex:1,
    padding:20
  },

  logoutBtn:{
    backgroundColor:"#e74c3c",
    padding:10,
    borderRadius:6,
    marginTop:20,
    alignItems:"center"
  },

  logoutText:{
    color:"#fff",
    fontWeight:"bold"
  },

  bottomButtons:{
    flexDirection:"row",
    justifyContent:"space-around",
    padding:15,
    borderTopWidth:1,
    borderColor:"#ddd"
  },

  button:{
    backgroundColor:"#4CAF50",
    paddingVertical:12,
    paddingHorizontal:30,
    borderRadius:8
  },

  buttonText:{
    color:"#fff",
    fontWeight:"bold"
  },

  overlay:{
    flex:1,
    justifyContent:"center",
    alignItems:"center",
    backgroundColor:"rgba(0,0,0,0.3)"
  },

  modalBox:{
    width:"85%",
    backgroundColor:"white",
    padding:20
  },

  input:{
    borderWidth:1,
    marginTop:10,
    padding:8
  },

  modalButton:{
    borderWidth:1,
    padding:10,
    marginTop:10,
    alignItems:"center",
    backgroundColor:"#4CAF50"
  },

  grid:{
    flexDirection:"row",
    flexWrap:"wrap",
    marginTop:10
  },

  cube:{
    width:"30%",
    aspectRatio:1,
    borderWidth:1,
    margin:5,
    justifyContent:"center",
    alignItems:"center"
  }

});
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { db } from '../services/firebase';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

const JoinRequestsScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);

  useEffect(() => {
    const sessionRef = doc(db, 'studySessions', groupId);

    const unsubscribe = onSnapshot(sessionRef, snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const joinRequests = (data.joinRequests || []).map(req => ({
          id: `${req.uid}_${req.requestedAt}`,
          userId: req.uid,
          userName: req.username,
          timestamp: new Date(req.requestedAt).getTime(),
          raw: req,
        }));

        setRequests(joinRequests.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setRequests([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleAccept = async request => {
    try {
      setProcessingId(request.id);
      const sessionRef = doc(db, 'studySessions', groupId);

      await updateDoc(sessionRef, {
        [`members.${request.userId}`]: true,
        joinRequests: arrayRemove(request.raw),
      });

      Alert.alert(
        '✅ Accepted',
        `${request.userName} has been added to the group`,
      );
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async request => {
    try {
      setProcessingId(request.id);
      const sessionRef = doc(db, 'studySessions', groupId);

      await updateDoc(sessionRef, {
        joinRequests: arrayRemove(request.raw),
      });

      Alert.alert('Rejected', `${request.userName}'s request was rejected`);
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const renderRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestInfo}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>

      <View style={styles.actions}>
        {processingId === item.id ? (
          <ActivityIndicator size="small" color={COLORS.primaryBtn} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.actionBtnText}>✓</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item)}
            >
              <Text style={styles.actionBtnText}>✕</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryBtn} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Join Requests</Text>
        <Text style={styles.subtitle}>{groupName}</Text>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending requests</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const makeStyles = COLORS =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: COLORS.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: COLORS.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    listContent: {
      padding: 16,
    },
    requestCard: {
      backgroundColor: COLORS.cardBg,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    requestInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: 4,
    },
    timestamp: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    acceptBtn: {
      backgroundColor: '#10b981',
    },
    rejectBtn: {
      backgroundColor: '#ef4444',
    },
    actionBtnText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: COLORS.textSecondary,
      fontSize: 16,
    },
  });

export default JoinRequestsScreen;

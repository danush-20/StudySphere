import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { database, auth } from '../config/firebase';
import { ref, onValue, update } from 'firebase/database';
import { makeStyles } from '../theme/ThemeContext';

const JoinRequestsScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const styles = useStyles();

  useEffect(() => {
    const requestsRef = ref(database, `join_requests/${groupId}`);

    const unsubscribe = onValue(requestsRef, snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const requestList = Object.entries(data)
          .filter(([_, req]) => req.status === 'pending')
          .map(([id, req]) => ({ id, ...req }))
          .sort((a, b) => b.timestamp - a.timestamp); // Newest first

        setRequests(requestList);
      } else {
        setRequests([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleAccept = async (requestId, userId, userName) => {
    try {
      setProcessingId(requestId);

      const updates = {};
      // Update request status
      updates[`join_requests/${groupId}/${requestId}/status`] = 'accepted';
      // Add user to group members
      updates[`study_groups/${groupId}/members/${userId}`] = {
        joinedAt: Date.now(),
        name: userName,
      };

      await update(ref(database), updates);
      Alert.alert('✅ Accepted', `${userName} has been added to the group`);
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId, userName) => {
    try {
      setProcessingId(requestId);

      await update(ref(database, `join_requests/${groupId}/${requestId}`), {
        status: 'rejected',
      });
      Alert.alert('Rejected', `${userName}'s request was rejected`);
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
          <ActivityIndicator
            size="small"
            color={styles.loadingIndicator.color}
          />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleAccept(item.id, item.userId, item.userName)}
            >
              <Text style={styles.actionBtnText}>✓</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item.id, item.userName)}
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
        <ActivityIndicator size="large" color={styles.loadingIndicator.color} />
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

const useStyles = makeStyles(COLORS => ({
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
  loadingIndicator: {
    color: COLORS.primaryBtn,
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
}));

export default JoinRequestsScreen;

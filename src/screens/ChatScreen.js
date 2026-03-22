import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ref, push, onValue, serverTimestamp, off } from 'firebase/database';
import { rtdb, auth } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';
import AvatarIcon from '../components/AvatarIcon';

export default function ChatScreen({ route, navigation }) {
  const { sessionId, groupName } = route.params;
  const { profile, user } = useContext(AuthContext);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  const myUid = auth.currentUser?.uid;
  const myName = profile?.username || user?.email?.split('@')[0] || 'Unknown';
  const myAvatar = profile?.avatar || '1';

  // ── Listen to messages ────────────────────────────────────────────────────

  useEffect(() => {
    const messagesRef = ref(rtdb, `chats/${sessionId}/messages`);

    onValue(messagesRef, snapshot => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.entries(data)
          .map(([id, msg]) => ({ id, ...msg }))
          .sort((a, b) => a.timestamp - b.timestamp);
        setMessages(parsed);
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => off(messagesRef);
  }, [sessionId]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);

    try {
      const messagesRef = ref(rtdb, `chats/${sessionId}/messages`);
      await push(messagesRef, {
        text,
        senderUid: myUid,
        senderName: myName,
        senderAvatar: myAvatar,
        timestamp: Date.now(),
        status: 'sent',
      });
    } catch (e) {
      console.log('Send error:', e.message);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatTime = ts => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDivider = ts => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const shouldShowDateDivider = index => {
    if (index === 0) return true;
    const curr = new Date(messages[index].timestamp).toDateString();
    const prev = new Date(messages[index - 1].timestamp).toDateString();
    return curr !== prev;
  };

  const shouldShowAvatar = index => {
    if (index === messages.length - 1) return true;
    return messages[index].senderUid !== messages[index + 1].senderUid;
  };

  const shouldShowName = index => {
    if (index === 0) return true;
    return messages[index].senderUid !== messages[index - 1].senderUid;
  };

  // ── Render message ────────────────────────────────────────────────────────

  const renderMessage = ({ item, index }) => {
    const isMe = item.senderUid === myUid;
    const showAvatar = shouldShowAvatar(index);
    const showName = !isMe && shouldShowName(index);
    const showDate = shouldShowDateDivider(index);

    return (
      <View>
        {/* Date divider */}
        {showDate && (
          <View style={styles.dateDivider}>
            <View style={styles.dateDividerLine} />
            <Text style={styles.dateDividerText}>
              {formatDateDivider(item.timestamp)}
            </Text>
            <View style={styles.dateDividerLine} />
          </View>
        )}

        <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
          {/* Avatar (others only) */}
          {!isMe && (
            <View style={styles.avatarCol}>
              {showAvatar ? (
                <AvatarIcon size={32} avatarId={item.senderAvatar} />
              ) : (
                <View style={{ width: 32 }} />
              )}
            </View>
          )}

          <View
            style={[
              styles.messageBubbleWrapper,
              isMe && styles.messageBubbleWrapperMe,
            ]}
          >
            {/* Sender name */}
            {showName && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}

            {/* Bubble */}
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleThem,
                !showAvatar && !isMe && styles.bubbleNoAvatar,
              ]}
            >
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                {item.text}
              </Text>

              <View style={styles.bubbleMeta}>
                <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                  {formatTime(item.timestamp)}
                </Text>
                {isMe && (
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color="rgba(255,255,255,0.7)"
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            </View>
          </View>

          {/* My avatar */}
          {isMe && (
            <View style={styles.avatarCol}>
              {showAvatar ? (
                <AvatarIcon size={32} avatarId={myAvatar} />
              ) : (
                <View style={{ width: 32 }} />
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{groupName}</Text>
          <Text style={styles.headerSub}>Group Chat</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Live</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2e7d32" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={52} color="#ddd" />
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatSub}>
                  Say hello to the group 👋
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#aaa"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  flex: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#69f0ae',
  },
  onlineText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  // ── Messages ─────────────────────────────────────────────────────
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },

  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 8,
  },
  dateDividerLine: { flex: 1, height: 0.5, backgroundColor: '#ccc' },
  dateDividerText: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 8,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    gap: 6,
  },
  messageRowMe: { flexDirection: 'row-reverse' },

  avatarCol: { width: 32, marginBottom: 2 },

  messageBubbleWrapper: { maxWidth: '72%', alignItems: 'flex-start' },
  messageBubbleWrapperMe: { alignItems: 'flex-end' },

  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 3,
    marginLeft: 12,
  },

  bubble: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
    maxWidth: '100%',
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#2e7d32',
    borderBottomRightRadius: 4,
    shadowColor: '#2e7d32',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleNoAvatar: { marginLeft: 0 },

  bubbleText: {
    fontSize: 15,
    color: '#222',
    lineHeight: 20,
  },
  bubbleTextMe: { color: '#fff' },

  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 2,
  },
  bubbleTime: {
    fontSize: 10,
    color: '#aaa',
  },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.65)' },

  // ── Empty ────────────────────────────────────────────────────────
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#bbb',
    marginTop: 16,
  },
  emptyChatSub: { fontSize: 13, color: '#ccc', marginTop: 6 },

  // ── Input ────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderColor: '#eee',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 42,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    color: '#222',
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#a5d6a7' },
});

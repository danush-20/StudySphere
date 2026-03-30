import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Keyboard,
  Platform,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ref, push, onValue, serverTimestamp, off, set, remove, onDisconnect } from 'firebase/database';
import { rtdb, auth } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';
import AvatarIcon from '../components/AvatarIcon';

export default function ChatScreen({ route, navigation }) {
  const { sessionId, groupName } = route.params;
  const { profile, user } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  const myUid = auth.currentUser?.uid;
  const myName = profile?.username || user?.email?.split('@')[0] || 'Unknown';
  const myAvatar = profile?.avatar || '1';

  // Typing dot animations
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeDotAnim = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - delay),
        ])
      );
    const a1 = makeDotAnim(dot1, 0);
    const a2 = makeDotAnim(dot2, 200);
    const a3 = makeDotAnim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  // ── Keyboard listeners ────────────────────────────────────────────────────

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

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
    const othersTyping = typingUsers.filter(uid => uid !== myUid);
    if (othersTyping.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 8, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [typingUsers]);


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

  // ── Listen to who is typing ───────────────────────────────────────────────

  useEffect(() => {
    const typingRef = ref(rtdb, `chats/${sessionId}/typing`);

    onValue(typingRef, snapshot => {
      const data = snapshot.val();
      if (data) {
        setTypingUsers(Object.keys(data));
      } else {
        setTypingUsers([]);
      }
    });

    // Clean up own typing flag if app closes mid-type
    const myTypingRef = ref(rtdb, `chats/${sessionId}/typing/${myUid}`);
    onDisconnect(myTypingRef).remove();

    return () => {
      off(typingRef);
      remove(myTypingRef);
    };
  }, [sessionId]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // ── Typing presence ───────────────────────────────────────────────────────

  const setTypingPresence = async (isTyping) => {
    const myTypingRef = ref(rtdb, `chats/${sessionId}/typing/${myUid}`);
    try {
      if (isTyping) {
        await set(myTypingRef, true);
      } else {
        await remove(myTypingRef);
      }
    } catch (e) {
      // silent — typing presence is non-critical
    }
  };

  const handleInputChange = (text) => {
    setInput(text);
    if (text.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTypingPresence(true);
      }
      // Reset the stop-typing debounce
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        setTypingPresence(false);
      }, 2000);
    } else {
      clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      setTypingPresence(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    // Clear typing presence immediately on send
    clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    setTypingPresence(false);

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
        {/* Date divider — pill style from frontend */}
        {showDate && (
          <View style={styles.dateDivider}>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>
                {formatDateDivider(item.timestamp)}
              </Text>
            </View>
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
            {/* Sender name — styled per frontend */}
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
                    size={13}
                    color="rgba(255,255,255,0.65)"
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fb" />

      {/* Header — frontend style */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#0B3AA4" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{groupName}</Text>
            {/* Live pill — animated pulse */}
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>Group Chat</Text>
        </View>
      </View>

      {/* Messages + Input — manual keyboard offset */}
      <View style={[styles.flex, { marginBottom: keyboardHeight }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0B3AA4" />
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
                <Ionicons name="chatbubbles-outline" size={52} color="#c3c6ce" />
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatSub}>Say hello to the group 👋</Text>
              </View>
            }
            ListFooterComponent={
              <Animated.View
                style={[
                  styles.typingRow,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
                pointerEvents="none"
              >
                <View style={styles.typingBubble}>
                  {[dot1, dot2, dot3].map((dot, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.typingDot,
                        {
                          opacity: dot.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                          transform: [
                            {
                              translateY: dot.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -4],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  ))}
                </View>
              </Animated.View>
            }
          />
        )}

        {/* Input bar — frontend style */}
        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          {/* Add button — secondary container style */}
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#00174b" />
          </TouchableOpacity>

          {/* Text input wrapper */}
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="rgba(67,71,77,0.5)"
              value={input}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
            />
            {/* Emoji button inside input */}
            <TouchableOpacity style={styles.emojiBtn} activeOpacity={0.7}>
              <Ionicons name="happy-outline" size={20} color="rgba(67,71,77,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Send button — primary blue */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6fafe' },
  flex: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247,249,251,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 0,
    // subtle bottom shadow
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerInfo: { flex: 1 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B3AA4',
    letterSpacing: -0.3,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 1.2,
  },
  headerSub: {
    fontSize: 10,
    color: '#43474d',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 1,
  },

  // ── Messages ─────────────────────────────────────────────────────
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // Date divider — pill style
  dateDivider: {
    alignItems: 'center',
    marginVertical: 20,
  },
  datePill: {
    backgroundColor: '#102a43',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  datePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 2,
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

  // Sender name — uppercase tracking style
  senderName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#43474d',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 3,
    marginLeft: 12,
  },

  bubble: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 14,
    maxWidth: '100%',
  },
  // Others' bubble — surface-container-low
  bubbleThem: {
    backgroundColor: '#f0f4f8',
    borderBottomLeftRadius: 4,
  },
  // My bubble — primary-container dark navy
  bubbleMe: {
    backgroundColor: '#102a43',
    borderBottomRightRadius: 4,
  },
  bubbleNoAvatar: { marginLeft: 0 },

  bubbleText: {
    fontSize: 14,
    color: '#43474d',
    lineHeight: 21,
  },
  bubbleTextMe: { color: 'rgba(255,255,255,0.95)' },

  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 2,
  },
  bubbleTime: {
    fontSize: 9,
    color: 'rgba(67,71,77,0.5)',
    fontWeight: '500',
  },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },

  // ── Typing indicator ─────────────────────────────────────────────
  typingRow: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0B3AA4',
  },

  // ── Empty ────────────────────────────────────────────────────────
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c3c6ce',
    marginTop: 16,
  },
  emptyChatSub: { fontSize: 13, color: '#c3c6ce', marginTop: 6 },

  // ── Input bar ────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: 'rgba(247,249,251,0.95)',
    borderTopWidth: 0,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  // Add (+) button — secondary container
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbe1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8eef3',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#171c1f',
    maxHeight: 100,
    paddingRight: 6,
  },
  emojiBtn: {
    paddingLeft: 4,
  },
  // Send button — primary blue
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
}); 
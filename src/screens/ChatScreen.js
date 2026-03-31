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
import { Ionicons } from '@expo/vector-icons';
import { ref, push, onValue, off, set, remove, onDisconnect } from 'firebase/database';
import { rtdb, auth } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';
import AvatarIcon from '../components/AvatarIcon';
import { useTheme } from '../context/ThemeContext';

export default function ChatScreen({ route, navigation }) {
  const { sessionId, groupName } = route.params;
  const { profile, user } = useContext(AuthContext);
  const { COLORS, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [typingUsers,  setTypingUsers]  = useState([]);

  const flatListRef      = useRef(null);
  const inputRef         = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef      = useRef(false);
  const fadeAnim         = useRef(new Animated.Value(0)).current;
  const slideAnim        = useRef(new Animated.Value(8)).current;

  const myUid   = auth.currentUser?.uid;
  const myName  = profile?.username || user?.email?.split('@')[0] || 'Unknown';
  const myAvatar = profile?.avatar || '1';

  // ── Typing dot animations ─────────────────────────────────────────────────
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
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Typing bubble fade in/out ─────────────────────────────────────────────
  useEffect(() => {
    const othersTyping = typingUsers.filter(uid => uid !== myUid);
    if (othersTyping.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 8, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [typingUsers]);

  // ── Messages listener ─────────────────────────────────────────────────────
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

  // ── Typing presence listener ──────────────────────────────────────────────
  useEffect(() => {
    const typingRef = ref(rtdb, `chats/${sessionId}/typing`);
    onValue(typingRef, snapshot => {
      const data = snapshot.val();
      setTypingUsers(data ? Object.keys(data) : []);
    });
    const myTypingRef = ref(rtdb, `chats/${sessionId}/typing/${myUid}`);
    onDisconnect(myTypingRef).remove();
    return () => { off(typingRef); remove(myTypingRef); };
  }, [sessionId]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // ── Typing presence write ─────────────────────────────────────────────────
  const setTypingPresence = async (isTyping) => {
    const myTypingRef = ref(rtdb, `chats/${sessionId}/typing/${myUid}`);
    try {
      isTyping ? await set(myTypingRef, true) : await remove(myTypingRef);
    } catch (e) { /* non-critical */ }
  };

  const handleInputChange = (text) => {
    setInput(text);
    if (text.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTypingPresence(true);
      }
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
  const formatTime = ts =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDateDivider = ts => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const shouldShowDateDivider = index => {
    if (index === 0) return true;
    return new Date(messages[index].timestamp).toDateString() !==
           new Date(messages[index - 1].timestamp).toDateString();
  };
  const shouldShowAvatar = index =>
    index === messages.length - 1 ||
    messages[index].senderUid !== messages[index + 1].senderUid;

  const shouldShowName = index =>
    index === 0 || messages[index].senderUid !== messages[index - 1].senderUid;

  // ── Render message ────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    const isMe       = item.senderUid === myUid;
    const showAvatar = shouldShowAvatar(index);
    const showName   = !isMe && shouldShowName(index);
    const showDate   = shouldShowDateDivider(index);
    const s          = makeStyles(COLORS);

    return (
      <View>
        {showDate && (
          <View style={s.dateDivider}>
            <View style={s.datePill}>
              <Text style={s.datePillText}>{formatDateDivider(item.timestamp)}</Text>
            </View>
          </View>
        )}

        <View style={[s.messageRow, isMe && s.messageRowMe]}>
          {!isMe && (
            <View style={s.avatarCol}>
              {showAvatar ? <AvatarIcon size={32} avatarId={item.senderAvatar} /> : <View style={{ width: 32 }} />}
            </View>
          )}

          <View style={[s.messageBubbleWrapper, isMe && s.messageBubbleWrapperMe]}>
            {showName && <Text style={s.senderName}>{item.senderName}</Text>}

            <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem, !showAvatar && !isMe && s.bubbleNoAvatar]}>
              <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{item.text}</Text>
              <View style={s.bubbleMeta}>
                <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>{formatTime(item.timestamp)}</Text>
                {isMe && (
                  <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.65)" style={{ marginLeft: 3 }} />
                )}
              </View>
            </View>
          </View>

          {isMe && (
            <View style={s.avatarCol}>
              {showAvatar ? <AvatarIcon size={32} avatarId={myAvatar} /> : <View style={{ width: 32 }} />}
            </View>
          )}
        </View>
      </View>
    );
  };

  const s = makeStyles(COLORS);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.surface}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={s.headerInfo}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerTitle}>{groupName}</Text>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>LIVE</Text>
            </View>
          </View>
          <Text style={s.headerSub}>Group Chat</Text>
        </View>
      </View>

      {/* Messages + Input */}
      <View style={[s.flex, { marginBottom: keyboardHeight }]}>
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={s.messagesList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={s.emptyChat}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={52}
                  color={COLORS.tertiaryBtnText}
                />
                <Text style={s.emptyChatTitle}>No messages yet</Text>
                <Text style={s.emptyChatSub}>Say hello to the group</Text>
              </View>
            }
            ListFooterComponent={
              <Animated.View
                style={[
                  s.typingRow,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
                pointerEvents="none"
              >
                <View style={s.typingBubble}>
                  {[dot1, dot2, dot3].map((dot, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        s.typingDot,
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

        {/* Input bar */}
        <View style={[s.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <View style={s.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Message..."
              placeholderTextColor={COLORS.textSecondary}
              value={input}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
            />
          </View>

          {/* Send button — icon perfectly centred */}
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
            ) : (
              <Ionicons name="send" size={18} color="green" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Theme-aware styles ────────────────────────────────────────────────────────
function makeStyles(COLORS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    flex: { flex: 1 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
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
    },
    headerInfo: { flex: 1 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.primary,
      letterSpacing: -0.3,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239,68,68,0.12)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
    },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: COLORS.error,
    },
    liveText: {
      fontSize: 8,
      fontWeight: '800',
      color: COLORS.error,
      letterSpacing: 1.2,
    },
    headerSub: {
      fontSize: 10,
      color: COLORS.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginTop: 1,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },

    dateDivider: { alignItems: 'center', marginVertical: 20 },
    datePill: {
      backgroundColor: COLORS.primaryBtn,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 999,
    },
    datePillText: {
      fontSize: 9,
      fontWeight: '800',
      color: COLORS.primaryBtnText,
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

    senderName: {
      fontSize: 9,
      fontWeight: '700',
      color: COLORS.textSecondary,
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
    bubbleThem: {
      backgroundColor: COLORS.surfaceHigh,
      borderBottomLeftRadius: 4,
    },
    bubbleMe: {
      backgroundColor: COLORS.primaryBtn,
      borderBottomRightRadius: 4,
    },
    bubbleNoAvatar: { marginLeft: 0 },

    bubbleText: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
    bubbleTextMe: { color: COLORS.primaryBtnText },

    bubbleMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 4,
      gap: 2,
    },
    bubbleTime: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '500' },
    bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },

    typingRow: {
      paddingHorizontal: 4,
      paddingVertical: 10,
      alignItems: 'flex-start',
    },
    typingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: COLORS.surfaceHigh,
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
      backgroundColor: COLORS.primary,
    },

    emptyChat: { flex: 1, alignItems: 'center', paddingTop: 80 },
    emptyChatTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.tertiaryBtnText,
      marginTop: 16,
    },
    emptyChatSub: { fontSize: 13, color: COLORS.tertiaryBtnText, marginTop: 6 },

    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 10,
      backgroundColor: COLORS.surface,
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 4,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.secondaryBtn,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.inputBg,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 6,
      minHeight: 44,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: COLORS.text,
      maxHeight: 100,
      paddingRight: 6,
    },

    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.primaryBtn,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
  });
}
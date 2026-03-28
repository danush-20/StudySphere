import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../services/firebase';

// ── Design System Tokens ─────────────────────────────────────────────────────
const COLORS = {
  primary: '#102A43',
  secondary: '#D9E2EC',
  accent: '#334E68',
  background: '#F0F4F8',
  surface: '#FFFFFF',
  text: '#102A43',
  textSecondary: '#486581',
  border: '#BCCCDC',
  white: '#FFFFFF',
  success: '#3EBD93',
  error: '#E53935',
  warning: '#F0A500',
};

const AVATAR_IMAGES = {
  1: require('../../assets/Avatar-1.png'),
  2: require('../../assets/Avatar-2.png'),
  3: require('../../assets/Avatar-3.png'),
  4: require('../../assets/Avatar-4.png'),
  5: require('../../assets/Avatar-5.png'),
  6: require('../../assets/Avatar-6.png'),
  7: require('../../assets/Avatar-7.png'),
  8: require('../../assets/Avatar-8.png'),
  9: require('../../assets/Avatar-9.png'),
  10: require('../../assets/Avatar-10.png'),
  11: require('../../assets/Avatar-11.png'),
  12: require('../../assets/Avatar-12.png'),
};

export default function StudyGroupScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const { user, profile } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTime, setLastReadTime] = useState(Date.now());

  const [groupName, setGroupName] = useState('');
  const [pin, setPin] = useState('');
  const [members, setMembers] = useState([]);
  const [hostUid, setHostUid] = useState('');
  const [menuMember, setMenuMember] = useState(null);

  // Pomodoro state
  const [studyTime, setStudyTime] = useState('25');
  const [breakTime, setBreakTime] = useState('5');
  const [timer, setTimer] = useState(25 * 60);
  const [mode, setMode] = useState('study');
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempStudy, setTempStudy] = useState('25');
  const [tempBreak, setTempBreak] = useState('5');

  // Stats
  const [focusSecs, setFocusSecs] = useState(0);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const focusRef = useRef(null);
  const focusSecsRef = useRef(0);

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ['12%', '45%', '80%'], []);
  const intervalRef = useRef(null);

  // ─── Firestore listener ───────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'studySessions', sessionId),
      async snap => {
        if (!snap.exists()) return;
        const data = snap.data();

        setGroupName(data.groupName || '');
        setPin(data.pin || '');
        setHostUid(data.host || '');

        if (data.members) {
          const uids = Object.entries(data.members)
            .filter(([, v]) => v === true)
            .map(([uid]) => uid);
          const memberList = await Promise.all(
            uids.map(async uid => {
              try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                const name =
                  userData.username || userData.email?.split('@')[0] || uid;
                const avatar = userData.avatar || '1';
                return { id: uid, name, avatar };
              } catch {
                return { id: uid, name: uid };
              }
            }),
          );
          setMembers(memberList);
        } else {
          setMembers([]);
        }

        if (data.stats) {
          setFocusSecs(data.stats.focusSecs || 0);
          setSessionsCompleted(data.stats.sessionsCompleted || 0);
        }

        if (data.tasks) setTasks(data.tasks);

        if (data.pomodoroSettings) {
          setStudyTime(String(data.pomodoroSettings.studyTime));
          setBreakTime(String(data.pomodoroSettings.breakTime));
        }

        if (data.timerState) {
          const { running: r, timer: t, mode: m, startedAt } = data.timerState;
          setMode(m);
          setStopped(!r && t > 0);
          if (r && startedAt) {
            const now = Date.now();
            const startedMs = startedAt.toMillis
              ? startedAt.toMillis()
              : startedAt;
            const elapsed = Math.floor((now - startedMs) / 1000);
            const current = Math.max(t - elapsed, 0);
            setTimer(current);
            setRunning(current > 0);
            if (current <= 0) {
              setStopped(false);
              setMode(m === 'study' ? 'break' : 'study');
            }
          } else {
            setTimer(t);
            setRunning(r);
          }
        }
      },
    );
    return () => unsub();
  }, [sessionId]);

  // ─── Local timer tick ─────────────────────────────────────────────────────

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setStopped(false);
            if (mode === 'study') {
              const newCount = sessionsCompleted + 1;
              setSessionsCompleted(newCount);
              updateDoc(doc(db, 'studySessions', sessionId), {
                'stats.sessionsCompleted': newCount,
              }).catch(e => console.log('Sessions sync error:', e.message));
            }
            setMode(m => (m === 'study' ? 'break' : 'study'));
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

  // ─── Focus time counter ───────────────────────────────────────────────────

  useEffect(() => {
    if (running && mode === 'study') {
      focusRef.current = setInterval(() => {
        focusSecsRef.current += 1;
        setFocusSecs(focusSecsRef.current);
        if (focusSecsRef.current % 5 === 0) {
          updateDoc(doc(db, 'studySessions', sessionId), {
            'stats.focusSecs': focusSecsRef.current,
          }).catch(e => console.log('Stats sync error:', e.message));
        }
      }, 1000);
    } else {
      clearInterval(focusRef.current);
    }
    return () => clearInterval(focusRef.current);
  }, [running, mode]);

  const isHost = auth.currentUser?.uid === hostUid;

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === hostUid) return -1;
    if (b.id === hostUid) return 1;
    return 0;
  });

  // ─── RTDB unread chat listener ────────────────────────────────────────────

  useEffect(() => {
    const messagesRef = ref(rtdb, `chats/${sessionId}/messages`);
    onValue(messagesRef, snapshot => {
      const data = snapshot.val();
      if (!data) return;
      const count = Object.values(data).filter(
        msg =>
          msg.timestamp > lastReadTime &&
          msg.senderUid !== auth.currentUser?.uid,
      ).length;
      setUnreadCount(count);
    });
    return () => off(messagesRef);
  }, [lastReadTime]);

  // ─── Timer sync ───────────────────────────────────────────────────────────

  const syncTimerToFirestore = async updates => {
    try {
      await updateDoc(doc(db, 'studySessions', sessionId), {
        timerState: updates,
      });
    } catch (e) {
      console.log('Timer sync error:', e.message);
    }
  };

  // ─── Button handlers ──────────────────────────────────────────────────────

  const handleStartOrBreak = async () => {
    if (running) {
      const breakSecs = parseInt(breakTime) * 60;
      setMode('break');
      setTimer(breakSecs);
      setRunning(true);
      setStopped(false);
      await syncTimerToFirestore({
        running: true,
        timer: breakSecs,
        mode: 'break',
        startedAt: serverTimestamp(),
      });
    } else {
      const studySecs = parseInt(studyTime) * 60;
      if (!stopped) setTimer(studySecs);
      setMode('study');
      setRunning(true);
      setStopped(false);
      await syncTimerToFirestore({
        running: true,
        timer: stopped ? timer : studySecs,
        mode: 'study',
        startedAt: serverTimestamp(),
      });
    }
  };

  const handleStopOrReset = async () => {
    if (stopped) {
      const studySecs = parseInt(studyTime) * 60;
      setTimer(studySecs);
      setMode('study');
      setStopped(false);
      setRunning(false);
      await syncTimerToFirestore({
        running: false,
        timer: studySecs,
        mode: 'study',
      });
    } else {
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
    setMode('study');
    setSettingsVisible(false);
    await syncTimerToFirestore({
      running: false,
      timer: newTimer,
      mode: 'study',
    });
    try {
      await updateDoc(doc(db, 'studySessions', sessionId), {
        pomodoroSettings: { studyTime: s, breakTime: b },
      });
    } catch (e) {
      console.log('Settings sync error:', e.message);
    }
  };

  // ─── Task handlers ────────────────────────────────────────────────────────

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    const updated = [
      ...tasks,
      { id: Date.now().toString(), text: newTask.trim(), done: false },
    ];
    setNewTask('');
    setAddingTask(false);
    try {
      await updateDoc(doc(db, 'studySessions', sessionId), { tasks: updated });
    } catch (e) {
      console.log('Task add error:', e.message);
    }
  };

  const handleToggleTask = async id => {
    const updated = tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t));
    try {
      await updateDoc(doc(db, 'studySessions', sessionId), { tasks: updated });
    } catch (e) {
      console.log('Task toggle error:', e.message);
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
      await updateDoc(doc(db, 'studySessions', sessionId), {
        [`members.${uid}`]: false,
      });
      navigation.navigate('Feedback', { groupName, sessionId });
    } catch (e) {
      console.log('Leave error:', e.message);
    }
  };

  // ─── Copy PIN ─────────────────────────────────────────────────────────────

  const handleCopyPin = () => {
    Clipboard.setStringAsync(pin); // note: setStringAsync not setString
    if (Platform.OS === 'android') {
      ToastAndroid.show('PIN copied!', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied', `PIN ${pin} copied to clipboard`);
    }
  };

  // ─── Format time ─────────────────────────────────────────────────────────

  const formatTime = () => {
    const m = Math.floor(timer / 60);
    const s = timer % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startLabel = running ? 'Break' : 'Start';
  const stopLabel = stopped ? 'Reset' : 'Stop';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>StudySphere</Text>
          <Text style={styles.groupName}>{groupName}</Text>
        </View>
        <TouchableOpacity style={styles.pinBadge} onPress={handleCopyPin}>
          <Text style={styles.pinText}>PIN {pin}</Text>
          <Ionicons
            name="copy-outline"
            size={13}
            color={COLORS.primary}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      </View>

      {/* Scrollable main content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pomodoro Card */}
        <Animated.View
          entering={FadeInDown.duration(600)}
          style={styles.pomodoroCard}
        >
          <View style={styles.cardHeader}>
            <View style={styles.modeBadge}>
              <View
                style={[
                  styles.modeDot,
                  {
                    backgroundColor:
                      mode === 'study' ? COLORS.success : COLORS.warning,
                  },
                ]}
              />
              <Text style={styles.modeText}>
                {mode === 'study' ? 'STUDY SESSION' : 'BREAK TIME'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setTempStudy(studyTime);
                setTempBreak(breakTime);
                setSettingsVisible(true);
              }}
            >
              <Ionicons
                name="settings-sharp"
                size={22}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Timer Circle */}
          <View style={styles.timerContainer}>
            <View style={styles.timerWrapper}>
              <Svg width={200} height={200} style={StyleSheet.absoluteFill}>
                {/* Background track */}
                <Circle
                  cx={100}
                  cy={100}
                  r={88}
                  stroke={COLORS.secondary}
                  strokeWidth={8}
                  fill="none"
                />
                {/* Progress arc */}
                <Circle
                  cx={100}
                  cy={100}
                  r={88}
                  stroke={mode === 'study' ? COLORS.primary : COLORS.warning}
                  strokeWidth={8}
                  fill="none"
                  strokeDasharray={2 * Math.PI * 88}
                  strokeDashoffset={
                    2 *
                    Math.PI *
                    88 *
                    (1 -
                      timer /
                        (parseInt(mode === 'study' ? studyTime : breakTime) *
                          60))
                  }
                  strokeLinecap="round"
                  rotation="-90"
                  origin="100, 100"
                />
              </Svg>
              <Text style={styles.timerMain}>{formatTime()}</Text>
              <Text style={styles.timerSub}>TIME REMAINING</Text>
            </View>
          </View>

          {/* Timer Buttons */}
          <View style={styles.timerActions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                running ? styles.breakBtn : styles.startBtn,
                !isHost && styles.btnDisabled,
              ]}
              onPress={isHost ? handleStartOrBreak : null}
              disabled={!isHost}
            >
              <Text style={styles.actionBtnText}>{startLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                stopped ? styles.resetBtn : styles.stopBtn,
                !isHost && styles.btnDisabled,
              ]}
              onPress={isHost ? handleStopOrReset : null}
              disabled={!isHost || (!running && !stopped)}
            >
              <Text style={[styles.actionBtnText, styles.stopBtnText]}>
                {stopLabel}
              </Text>
            </TouchableOpacity>
          </View>

          {!isHost && (
            <Text style={styles.hostOnlyNote}>
              Only the host can control the timer
            </Text>
          )}
        </Animated.View>

        {/* Stats Row */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.statsRow}
        >
          <View style={styles.statBox}>
            <View style={styles.statIconCircle}>
              <Ionicons name="time-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.statLabel}>FOCUS TIME</Text>
            <Text style={styles.statValue}>{formatFocus()}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconCircle}>
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>
              {sessionsCompleted.toString().padStart(2, '0')}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconCircle}>
              <Ionicons
                name="people-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.statLabel}>MEMBERS</Text>
            <Text style={styles.statValue}>
              {members.length.toString().padStart(2, '0')}
            </Text>
          </View>
        </Animated.View>

        {/* Session Goals / Tasks */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600)}
          style={styles.goalsCard}
        >
          <View style={styles.goalsHeader}>
            <Text style={styles.goalsTitle}>Session Goals</Text>
            {isHost && (
              <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={() => setAddingTask(!addingTask)}
              >
                <Ionicons
                  name={addingTask ? 'close' : 'add'}
                  size={20}
                  color={COLORS.primary}
                />
                {!addingTask && (
                  <Text style={styles.addTaskText}>Add Task</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {isHost && addingTask && (
            <View style={styles.taskInputRow}>
              <TextInput
                style={styles.taskInput}
                placeholder="Add a goal..."
                placeholderTextColor={COLORS.textSecondary}
                value={newTask}
                onChangeText={setNewTask}
                onSubmitEditing={handleAddTask}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity
                style={styles.taskAddBtn}
                onPress={handleAddTask}
              >
                <Text style={styles.taskAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {tasks.length === 0 && !addingTask ? (
            <Text style={styles.noTasks}>
              {isHost ? 'Tap + to add session goals' : 'No goals added yet'}
            </Text>
          ) : (
            tasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskRow}
                onPress={() => (isHost ? handleToggleTask(task.id) : null)}
                disabled={!isHost}
              >
                <Ionicons
                  name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={task.done ? COLORS.success : COLORS.border}
                />
                <Text style={[styles.taskText, task.done && styles.taskDone]}>
                  {task.text}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>

        {/* Bottom padding so sheet doesn't cover content */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={styles.sheetContent}>
          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.wideBtn, styles.chatBtn]}
              onPress={() => {
                setLastReadTime(Date.now());
                setUnreadCount(0);
                navigation.navigate('Chat', { sessionId, groupName });
              }}
            >
              <Ionicons name="chatbubble" size={22} color={COLORS.white} />
              <Text style={styles.wideBtnText}>Chat</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.wideBtn, styles.mediaBtn]}
              onPress={() =>
                navigation.navigate('Media', { sessionId, groupName })
              }
            >
              <Ionicons
                name="videocam-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={styles.mediaBtnText}>Media</Text>
            </TouchableOpacity>
          </View>

          {/* Members */}
          <View style={styles.membersHeader}>
            <Text style={styles.membersCount}>MEMBERS ({members.length})</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          {sortedMembers.length === 0 ? (
            <Text style={styles.noMember}>No active members</Text>
          ) : (
            <FlatList
              data={sortedMembers}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isItemHost = item.id === hostUid;
                const isMe = item.id === auth.currentUser?.uid;
                return (
                  <View style={styles.memberRow}>
                    <Image
                      source={AVATAR_IMAGES[item.avatar] || AVATAR_IMAGES['1']}
                      style={[
                        styles.memberAvatar,
                        isItemHost && styles.memberAvatarHost,
                      ]}
                      resizeMode="contain"
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {item.name}
                        {isMe ? '  (you)' : ''}
                      </Text>
                      {isItemHost && (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>HOST</Text>
                        </View>
                      )}
                    </View>
                    {!isMe && (
                      <TouchableOpacity
                        style={styles.dotMenu}
                        onPress={() => setMenuMember(item)}
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={18}
                          color={COLORS.border}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          {/* Leave Button */}
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <Ionicons name="exit-outline" size={20} color={COLORS.error} />
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
              {menuMember?.id === hostUid ? '  👑' : ''}
            </Text>

            {isHost && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setMenuMember(null);
                  Alert.alert(
                    'Mute',
                    `${menuMember?.name} muted. (Feature coming soon)`,
                  );
                }}
              >
                <Ionicons
                  name="mic-off-outline"
                  size={20}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.actionText}>Mute</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setMenuMember(null);
                navigation.navigate('ViewProfile', { uid: menuMember?.id });
              }}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <Text style={styles.actionText}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setMenuMember(null);
                navigation.navigate('ReportIssue', {
                  sessionMembers: members,
                  preSelectedUid: menuMember?.id,
                });
              }}
            >
              <Ionicons name="flag-outline" size={20} color={COLORS.warning} />
              <Text style={[styles.actionText, { color: COLORS.warning }]}>
                Report
              </Text>
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSettingsVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalBox}
          >
            <Text style={styles.modalTitle}>⏱ Pomodoro Settings</Text>

            <Text style={styles.modalLabel}>Study Duration (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={tempStudy}
              onChangeText={setTempStudy}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.modalLabel}>Break Duration (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={tempBreak}
              onChangeText={setTempBreak}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1E9FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pinText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  // ── Pomodoro Card ─────────────────────────────────────────────────────────
  pomodoroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 28,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  modeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  timerWrapper: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    borderColor: COLORS.secondary,
    borderTopColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerMain: {
    fontSize: 52,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -2,
  },
  timerSub: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  timerActions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  breakBtn: {
    backgroundColor: '#1565C0',
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  stopBtn: { backgroundColor: COLORS.secondary },
  resetBtn: {
    backgroundColor: COLORS.warning,
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  actionBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  stopBtnText: { color: COLORS.accent },
  btnDisabled: { opacity: 0.4 },
  hostOnlyNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 14,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#D1E9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.secondary },

  // ── Goals Card ────────────────────────────────────────────────────────────
  goalsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalsTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  addTaskBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addTaskText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  taskInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  taskInput: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  taskAddBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  taskAddBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  taskText: { fontSize: 15, fontWeight: '600', color: COLORS.text, flex: 1 },
  taskDone: { textDecorationLine: 'line-through', color: COLORS.border },
  noTasks: {
    fontSize: 13,
    color: COLORS.border,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // ── Bottom Sheet ──────────────────────────────────────────────────────────
  sheetBackground: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 16,
  },
  sheetHandle: { backgroundColor: COLORS.secondary, width: 48 },
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  wideBtn: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chatBtn: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  wideBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  mediaBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mediaBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },

  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  membersCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  liveBadge: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveText: { fontSize: 10, fontWeight: '900', color: COLORS.success },

  noMember: {
    textAlign: 'center',
    color: COLORS.border,
    marginVertical: 20,
    fontSize: 13,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.background,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  memberAvatarHost: { borderColor: COLORS.success },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  hostBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  dotMenu: { padding: 8 },

  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    height: 60,
    borderRadius: 18,
    marginTop: 20,
    gap: 8,
  },
  leaveBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '800' },

  // ── Member Action Sheet ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,42,67,0.4)',
  },
  actionSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  actionSheetName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.secondary,
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderColor: COLORS.secondary,
  },
  actionText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  actionCancel: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    marginTop: 4,
  },
  actionCancelText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    width: '100%',
  },

  // ── Settings Modal ────────────────────────────────────────────────────────
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});

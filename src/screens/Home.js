import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Location from 'expo-location';

import { auth, db } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';
import AvatarIcon from '../components/AvatarIcon';

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';

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
  highlight: '#F0A500',
};

// ── Quotes ───────────────────────────────────────────────────────────────────
const QUOTES = [
  {
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
  },
  {
    text: "It always seems impossible until it's done.",
    author: 'Nelson Mandela',
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: 'Sam Levenson',
  },
  {
    text: 'Success is the sum of small efforts repeated day in and day out.',
    author: 'Robert Collier',
  },
  {
    text: 'The expert in anything was once a beginner.',
    author: 'Helen Hayes',
  },
  {
    text: "Believe you can and you're halfway there.",
    author: 'Theodore Roosevelt',
  },
  {
    text: "Hard work beats talent when talent doesn't work hard.",
    author: 'Tim Notke',
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: 'Zig Ziglar',
  },
  {
    text: 'The more that you read, the more things you will know.',
    author: 'Dr. Seuss',
  },
  {
    text: 'Study hard, for the well is deep and our brains are shallow.',
    author: 'Richard Baxter',
  },
  {
    text: 'An investment in knowledge pays the best interest.',
    author: 'Benjamin Franklin',
  },
  { text: 'Education is the passport to the future.', author: 'Malcolm X' },
  {
    text: 'The beautiful thing about learning is nobody can take it away from you.',
    author: 'B.B. King',
  },
  {
    text: 'Push yourself, because no one else is going to do it for you.',
    author: 'Unknown',
  },
  { text: 'Great things never come from comfort zones.', author: 'Unknown' },
  { text: 'Dream it. Wish it. Do it.', author: 'Unknown' },
  {
    text: "Success doesn't just find you. You have to go out and get it.",
    author: 'Unknown',
  },
  {
    text: "The harder you work for something, the greater you'll feel when you achieve it.",
    author: 'Unknown',
  },
  {
    text: "Don't stop when you're tired. Stop when you're done.",
    author: 'Unknown',
  },
  {
    text: 'Wake up with determination. Go to bed with satisfaction.',
    author: 'Unknown',
  },
  {
    text: 'Do something today that your future self will thank you for.',
    author: 'Sean Patrick Flanery',
  },
  { text: 'Little things make big days.', author: 'Unknown' },
  {
    text: "It's going to be hard, but hard does not mean impossible.",
    author: 'Unknown',
  },
  { text: "Don't wait for opportunity. Create it.", author: 'Unknown' },
  {
    text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
    author: 'Unknown',
  },
  {
    text: 'Concentrate all your thoughts upon the work in hand.',
    author: 'Alexander Graham Bell',
  },
  { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn' },
  {
    text: 'I find that the harder I work, the more luck I seem to have.',
    author: 'Thomas Jefferson',
  },
  {
    text: 'Motivation is what gets you started. Habit is what keeps you going.',
    author: 'Jim Ryun',
  },
  {
    text: 'Genius is one percent inspiration and ninety-nine percent perspiration.',
    author: 'Thomas Edison',
  },
];

const getDailyQuote = () => QUOTES[new Date().getDate() % QUOTES.length];

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'StudySphere/1.0' } },
    );
    const data = await res.json();
    const a = data.address || {};
    return (
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.town ||
      a.village ||
      a.city_district ||
      a.city ||
      null
    );
  } catch (e) {
    console.log('Reverse geocode error:', e.message);
    return null;
  }
};

export default function Home({ navigation }) {
  const { user, profile } = useContext(AuthContext);

  const [modalVisible, setModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [myGroups, setMyGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [isPublic, setIsPublic] = useState(false);
  const [groupLocationQuery, setGroupLocationQuery] = useState('');
  const [groupLocationSuggestions, setGroupLocationSuggestions] = useState([]);
  const [groupLocationSelected, setGroupLocationSelected] = useState(null);
  const [locationSearching, setLocationSearching] = useState(false);
  const locationDebounce = useRef(null);

  const [nearbyGroups, setNearbyGroups] = useState([]);
  const [userLocality, setUserLocality] = useState(null);
  const [localityLoading, setLocalityLoading] = useState(false);

  const quote = getDailyQuote();
  const generatePin = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  // ── Location search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupLocationQuery.trim() || groupLocationQuery.length < 2) {
      setGroupLocationSuggestions([]);
      return;
    }
    clearTimeout(locationDebounce.current);
    locationDebounce.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(groupLocationQuery)}&countrycodes=in&format=json&limit=6&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'StudySphere/1.0',
            },
          },
        );
        const data = await res.json();
        setGroupLocationSuggestions(data);
      } catch (e) {
        console.log('Location search error:', e.message);
      } finally {
        setLocationSearching(false);
      }
    }, 500);
    return () => clearTimeout(locationDebounce.current);
  }, [groupLocationQuery]);

  const getLocationDisplay = item => {
    const a = item.address || {};
    const local =
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.town ||
      a.village ||
      a.city_district;
    const city = a.city || a.state_district || a.county;
    const state = a.state;
    const main = local || city || item.display_name.split(',')[0];
    const secondary = local
      ? `${city || ''}, ${state || ''}`.trim().replace(/^,|,$/, '')
      : state;
    return { main, secondary, city: main };
  };

  // ── Device location ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserLocation = async () => {
      setLocalityLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const locality = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (locality) {
            setUserLocality(locality);
            fetchNearbyGroups(locality);
          }
        }
      } catch (e) {
        console.log('Device location error:', e.message);
      } finally {
        setLocalityLoading(false);
      }
    };
    fetchUserLocation();
  }, []);

  // ── Fetch nearby groups ───────────────────────────────────────────────────
  const fetchNearbyGroups = async locality => {
    if (!locality) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const nearbyQ = query(
        collection(db, 'studySessions'),
        where('isPublic', '==', true),
      );
      const snap = await getDocs(nearbyQ);
      const localityLower = locality.trim().toLowerCase();
      const nearby = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g => {
          if (g.host === uid) return false;
          if (g.members?.[uid] === true || g.members?.[uid] === false)
            return false;
          const groupLocality = (g.locationCity || '').trim().toLowerCase();
          return (
            groupLocality &&
            (groupLocality === localityLower ||
              groupLocality.includes(localityLower) ||
              localityLower.includes(groupLocality))
          );
        });
      setNearbyGroups(nearby);
    } catch (e) {
      console.log('Nearby fetch error:', e.message);
    }
  };

  // ── Fetch sessions ────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const hostedQ = query(
        collection(db, 'studySessions'),
        where('host', '==', uid),
      );
      const hostedSnap = await getDocs(hostedQ);
      const hosted = hostedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyGroups(hosted);

      const allRequests = [];
      for (const group of hosted) {
        if (group.joinRequests && group.joinRequests.length > 0) {
          for (const req of group.joinRequests) {
            try {
              const userDoc = await getDoc(doc(db, 'users', req.uid));
              const userData = userDoc.exists() ? userDoc.data() : {};
              allRequests.push({
                ...req,
                username:
                  userData.username || userData.email?.split('@')[0] || req.uid,
                sessionId: group.id,
                sessionName: group.groupName,
              });
            } catch {
              allRequests.push({
                ...req,
                username: req.uid,
                sessionId: group.id,
                sessionName: group.groupName,
              });
            }
          }
        }
      }
      setPendingRequests(allRequests);

      const joinedActiveQ = query(
        collection(db, 'studySessions'),
        where(`members.${uid}`, '==', true),
      );
      const joinedInactiveQ = query(
        collection(db, 'studySessions'),
        where(`members.${uid}`, '==', false),
      );
      const [activeSnap, inactiveSnap] = await Promise.all([
        getDocs(joinedActiveQ),
        getDocs(joinedInactiveQ),
      ]);
      const allJoined = [
        ...activeSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ...inactiveSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      ];
      const seen = new Set();
      const joined = allJoined.filter(g => {
        if (g.host === uid || seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      setJoinedGroups(joined);
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchSessions(),
      userLocality ? fetchNearbyGroups(userLocality) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [fetchSessions, userLocality]);

  // ── Create session ────────────────────────────────────────────────────────
  const handleCreateSession = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name.');
      return;
    }
    if (isPublic && !groupLocationSelected) {
      Alert.alert('Required', 'Please select a location for public groups.');
      return;
    }
    try {
      const uid = auth.currentUser.uid;
      const pin = generatePin();
      await addDoc(collection(db, 'studySessions'), {
        groupName: groupName.trim(),
        subject: subject.trim(),
        description: description.trim(),
        host: uid,
        pin,
        createdAt: serverTimestamp(),
        members: { [uid]: true },
        joinRequests: [],
        isPublic,
        locationCity: groupLocationSelected?.city || '',
        locationDisplay: groupLocationSelected?.display || '',
      });
      setGroupName('');
      setSubject('');
      setDescription('');
      setIsPublic(false);
      setGroupLocationQuery('');
      setGroupLocationSelected(null);
      setModalVisible(false);
      fetchSessions();
    } catch (e) {
      console.log(e.message);
    }
  };

  // ── Join session ──────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!joinPin.trim()) return;
    try {
      const q = query(
        collection(db, 'studySessions'),
        where('pin', '==', joinPin),
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        Alert.alert('Not Found', 'No session found with that PIN.');
        return;
      }
      const sessionDoc = snapshot.docs[0];
      const sessionId = sessionDoc.id;
      const sessionData = sessionDoc.data();
      const uid = auth.currentUser.uid;

      if (sessionData.members?.[uid] === true) {
        setJoinModalVisible(false);
        setJoinPin('');
        navigation.navigate('StudyGroup', { sessionId });
        return;
      }
      if (sessionData.members?.[uid] === false) {
        await updateDoc(doc(db, 'studySessions', sessionId), {
          [`members.${uid}`]: true,
        });
        setJoinModalVisible(false);
        setJoinPin('');
        fetchSessions();
        navigation.navigate('StudyGroup', { sessionId });
        return;
      }
      const alreadyRequested = (sessionData.joinRequests || []).some(
        r => r.uid === uid,
      );
      if (alreadyRequested) {
        Alert.alert(
          'Already Requested',
          'Your join request is pending host approval.',
        );
        return;
      }
      await updateDoc(doc(db, 'studySessions', sessionId), {
        joinRequests: arrayUnion({
          uid,
          username: profile?.username || user?.email?.split('@')[0] || uid,
          requestedAt: new Date().toISOString(),
        }),
      });
      setJoinModalVisible(false);
      setJoinPin('');
      Alert.alert(
        'Request Sent',
        'Your join request has been sent to the host for approval.',
      );
    } catch (e) {
      console.log(e.message);
    }
  };

  const handleApprove = async req => {
    try {
      const sessionRef = doc(db, 'studySessions', req.sessionId);
      const sessionDoc = await getDoc(sessionRef);
      const updated = (sessionDoc.data()?.joinRequests || []).filter(
        r => r.uid !== req.uid,
      );
      await updateDoc(sessionRef, {
        [`members.${req.uid}`]: true,
        joinRequests: updated,
      });
      fetchSessions();
    } catch (e) {
      console.log('Approve error:', e.message);
    }
  };

  const handleDecline = async req => {
    try {
      const sessionRef = doc(db, 'studySessions', req.sessionId);
      const sessionDoc = await getDoc(sessionRef);
      const updated = (sessionDoc.data()?.joinRequests || []).filter(
        r => r.uid !== req.uid,
      );
      await updateDoc(sessionRef, { joinRequests: updated });
      fetchSessions();
    } catch (e) {
      console.log('Decline error:', e.message);
    }
  };

  const joinDirect = async sessionId => {
    try {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, 'studySessions', sessionId), {
        [`members.${uid}`]: true,
      });
      navigation.navigate('StudyGroup', { sessionId });
    } catch (e) {
      console.log(e.message);
    }
  };

  const handleRequestNearby = async group => {
    const uid = auth.currentUser?.uid;
    const alreadyRequested = (group.joinRequests || []).some(
      r => r.uid === uid,
    );
    if (alreadyRequested) {
      Alert.alert(
        'Already Requested',
        'Your join request is pending host approval.',
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'studySessions', group.id), {
        joinRequests: arrayUnion({
          uid,
          username: profile?.username || user?.email?.split('@')[0] || uid,
          requestedAt: new Date().toISOString(),
        }),
      });
      Alert.alert(
        'Request Sent',
        'Your join request has been sent to the host.',
      );
      fetchNearbyGroups(userLocality);
    } catch (e) {
      console.log(e.message);
    }
  };

  const getMemberCount = group => {
    if (!group.members) return 0;
    return Object.values(group.members).filter(v => v === true).length;
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <AvatarIcon size={48} />
        </TouchableOpacity>
        <Text style={styles.logoText}>StudySphere</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting */}
        <Animated.View entering={FadeInDown.delay(200).duration(800)}>
          <Text style={styles.tagline}>FOCUS SANCTUARY</Text>
          <Text style={styles.greeting}>
            {greeting()},{'\n'}
            {profile?.username || user?.email?.split('@')[0]} 👋
          </Text>
        </Animated.View>

        {/* Daily Quote */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(800)}
          style={styles.quoteCard}
        >
          <View style={styles.quoteIconCircle}>
            <Ionicons name="bulb" size={20} color={COLORS.highlight} />
          </View>
          <View style={styles.quoteContent}>
            <Text style={styles.quoteText}>"{quote.text}"</Text>
            <Text style={styles.quoteAuthor}>
              — {quote.author.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Pending Join Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Join Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {pendingRequests.length} NEW
                </Text>
              </View>
            </View>
            {pendingRequests.map((req, i) => (
              <Animated.View
                key={`${req.uid}-${i}`}
                entering={FadeInDown.delay(500)}
                style={styles.requestCard}
              >
                <View style={styles.requestAvatar}>
                  <Text style={styles.avatarInitial}>
                    {req.username?.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestName}>{req.username}</Text>
                  <Text style={styles.requestSub}>
                    wants to join "{req.sessionName}"
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.actionButtonClose}
                    onPress={() => handleDecline(req)}
                  >
                    <Ionicons name="close" size={20} color="#E53E3E" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButtonCheck}
                    onPress={() => handleApprove(req)}
                  >
                    <Ionicons name="checkmark" size={20} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Your Sessions */}
        {myGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Sessions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {myGroups.map((group, index) => (
                // FIX 1: styles moved to Animated.View so Reanimated owns the styled element
                <Animated.View
                  key={group.id}
                  entering={FadeInRight.delay(600 + index * 100)}
                  style={[styles.sessionCard, styles.hostedCard]}
                >
                  <TouchableOpacity
                    onPress={() => joinDirect(group.id)}
                    activeOpacity={0.85}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>HOSTED</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {group.groupName}
                    </Text>
                    {group.subject ? (
                      <Text style={styles.cardSubject} numberOfLines={1}>
                        {group.subject}
                      </Text>
                    ) : null}
                    <View style={styles.cardFooter}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={COLORS.white}
                        style={{ opacity: 0.7 }}
                      />
                      <Text style={styles.memberStatusText}>
                        {getMemberCount(group)} active now
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
              <View style={{ width: 24 }} />
            </ScrollView>
          </View>
        )}

        {/* Joined Sessions */}
        {joinedGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Joined Sessions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {joinedGroups.map((group, index) => (
                // FIX 1: styles moved to Animated.View
                <Animated.View
                  key={group.id}
                  entering={FadeInRight.delay(700 + index * 100)}
                  style={styles.joinedCard}
                >
                  <TouchableOpacity
                    onPress={() => joinDirect(group.id)}
                    activeOpacity={0.85}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.iconCircle}>
                      <Ionicons
                        name="people"
                        size={20}
                        color={COLORS.primary}
                      />
                    </View>
                    <Text style={styles.joinedTitle} numberOfLines={2}>
                      {group.groupName}
                    </Text>
                    <Text style={styles.joinedSub} numberOfLines={1}>
                      {group.subject}
                    </Text>
                    <View style={styles.joinedFooter}>
                      <View style={styles.memberBadgeSmall}>
                        <Text style={styles.memberBadgeTextSmall}>MEMBER</Text>
                      </View>
                      <Text style={styles.memberTotalText}>
                        {getMemberCount(group)} Members
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
              <View style={{ width: 24 }} />
            </ScrollView>
          </View>
        )}

        {/* Nearby Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {userLocality ? `Near You · ${userLocality}` : 'Nearby Sessions'}
            </Text>
            {localityLoading && (
              <ActivityIndicator
                size="small"
                color={COLORS.accent}
                style={{ marginLeft: 6 }}
              />
            )}
          </View>

          {!userLocality && !localityLoading && (
            <View style={styles.emptyPrompt}>
              <Ionicons
                name="location-outline"
                size={20}
                color={COLORS.border}
              />
              <Text style={styles.emptyPromptText}>
                Allow location access to see nearby groups
              </Text>
            </View>
          )}

          {userLocality && nearbyGroups.length === 0 && (
            <View style={styles.emptyPrompt}>
              <Ionicons name="people-outline" size={20} color={COLORS.border} />
              <Text style={styles.emptyPromptText}>
                No public groups found near {userLocality}
              </Text>
            </View>
          )}

          {nearbyGroups.map((group, index) => (
            // FIX 1: styles moved to Animated.View
            <Animated.View
              key={group.id}
              entering={FadeInDown.delay(800 + index * 100)}
              style={styles.nearbyCard}
            >
              <View style={styles.nearbyHeader}>
                <View style={styles.locationTag}>
                  <Ionicons name="location" size={12} color={COLORS.primary} />
                  <Text style={styles.locationTagText}>
                    {group.locationDisplay || group.locationCity} · PUBLIC
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRequestNearby(group)}>
                  <Text style={styles.joinNowText}>JOIN NOW</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.nearbyTitle} numberOfLines={2}>
                {group.groupName}
              </Text>
              <Text style={styles.nearbySub} numberOfLines={2}>
                {group.subject}
              </Text>
              <View style={styles.nearbyFooter}>
                <Ionicons
                  name="people-outline"
                  size={13}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.nearbyMemberText}>
                  {getMemberCount(group)} members
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Empty State */}
        {myGroups.length === 0 &&
          joinedGroups.length === 0 &&
          pendingRequests.length === 0 &&
          nearbyGroups.length === 0 &&
          !localityLoading && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No active sessions</Text>
              <Text style={styles.emptySubtitle}>
                Create or join a study group to get started
              </Text>
            </View>
          )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            fetchSessions();
            setJoinModalVisible(true);
          }}
        >
          <Ionicons name="search-outline" size={20} color={COLORS.primary} />
          <Text style={styles.secondaryButtonText}>Join Session</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setGroupName('');
            setSubject('');
            setDescription('');
            setIsPublic(false);
            setGroupLocationQuery('');
            setGroupLocationSelected(null);
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
          <Text style={styles.primaryButtonText}>Create Session</Text>
        </TouchableOpacity>
      </View>

      {/* CREATE MODAL — FIX 2: outer TouchableOpacity dismisses, inner blocks propagation */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Create Study Group</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                placeholder="Group Name *"
                placeholderTextColor={COLORS.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
                style={styles.modalInput}
              />
              <TextInput
                placeholder="Subject"
                placeholderTextColor={COLORS.textSecondary}
                value={subject}
                onChangeText={setSubject}
                style={styles.modalInput}
              />
              <TextInput
                placeholder="Description"
                placeholderTextColor={COLORS.textSecondary}
                value={description}
                onChangeText={setDescription}
                style={styles.modalInput}
              />

              {/* Public/Private Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIsPublic(!isPublic)}
              >
                <View
                  style={[
                    styles.toggleSwitch,
                    isPublic && styles.toggleSwitchOn,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      isPublic && styles.toggleThumbOn,
                    ]}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.toggleLabel}>
                    {isPublic ? '🌍 Public Group' : '🔒 Private Group'}
                  </Text>
                  <Text style={styles.toggleSub}>
                    {isPublic
                      ? 'Visible to nearby users'
                      : 'Only joinable via PIN'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Location search for public groups */}
              {isPublic && (
                <View style={{ zIndex: 99 }}>
                  <Text style={styles.locationLabel}>Group Location *</Text>
                  <View
                    style={[
                      styles.locationInputWrapper,
                      groupLocationSelected && styles.locationInputSelected,
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={15}
                      color={COLORS.border}
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      style={styles.locationSearchInput}
                      placeholder="Search your area, locality..."
                      placeholderTextColor={COLORS.textSecondary}
                      value={groupLocationQuery}
                      onChangeText={t => {
                        setGroupLocationQuery(t);
                        setGroupLocationSelected(null);
                      }}
                      autoCorrect={false}
                    />
                    {locationSearching && (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    )}
                    {groupLocationSelected && (
                      <TouchableOpacity
                        onPress={() => {
                          setGroupLocationQuery('');
                          setGroupLocationSelected(null);
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={COLORS.border}
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {groupLocationSuggestions.length > 0 &&
                    !groupLocationSelected && (
                      <View style={styles.locationDropdown}>
                        {groupLocationSuggestions.map((item, idx) => {
                          const { main, secondary } = getLocationDisplay(item);
                          return (
                            <TouchableOpacity
                              key={item.place_id || idx}
                              style={styles.locationItem}
                              onPress={() => {
                                const { main, secondary } =
                                  getLocationDisplay(item);
                                const display = secondary
                                  ? `${main}, ${secondary}`
                                  : main;
                                setGroupLocationSelected({
                                  city: main,
                                  display,
                                });
                                setGroupLocationQuery(display);
                                setGroupLocationSuggestions([]);
                              }}
                            >
                              <Ionicons
                                name="location-outline"
                                size={13}
                                color={COLORS.accent}
                                style={{ marginRight: 6 }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.locationItemMain}>
                                  {main}
                                </Text>
                                {secondary ? (
                                  <Text
                                    style={styles.locationItemSub}
                                    numberOfLines={1}
                                  >
                                    {secondary}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                </View>
              )}

              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={handleCreateSession}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {isPublic ? 'Create Public Group' : 'Create Group'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* JOIN MODAL — FIX 2: same backdrop dismiss pattern */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setJoinModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Join Study Group</Text>
            <TextInput
              placeholder="Enter PIN to request joining"
              placeholderTextColor={COLORS.textSecondary}
              value={joinPin}
              onChangeText={setJoinPin}
              style={styles.modalInput}
              keyboardType="numeric"
            />
            <Text style={styles.joinNote}>
              Join requests require host approval
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={handleJoin}
            >
              <Text style={styles.modalPrimaryButtonText}>
                Send Join Request
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setJoinModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
  },
  avatarButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },

  scrollContent: { paddingHorizontal: 24 },

  tagline: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 2,
    marginBottom: 4,
    opacity: 0.6,
    marginTop: 8,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 36,
    marginBottom: 24,
  },

  quoteCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
    opacity: 0.9,
  },
  quoteIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quoteContent: { flex: 1 },
  quoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 10,
  },
  quoteAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1,
  },

  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },

  requestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#BEE3F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitial: { fontWeight: '800', color: COLORS.primary, fontSize: 14 },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  requestSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  actionButtonClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FED7D7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonCheck: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  horizontalScroll: { marginLeft: -24, paddingLeft: 24 },

  // Session card — styles now live here so Animated.View owns them (Fix 1)
  sessionCard: { width: 280, borderRadius: 24, padding: 24, marginRight: 16 },
  hostedCard: { backgroundColor: COLORS.primary },
  cardHeader: { marginBottom: 16 },
  cardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 6,
  },
  cardSubject: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberStatusText: { color: COLORS.white, fontSize: 12, opacity: 0.7 },

  // Joined card — styles now live here so Animated.View owns them (Fix 1)
  joinedCard: {
    width: 220,
    backgroundColor: COLORS.secondary,
    borderRadius: 24,
    padding: 20,
    marginRight: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  joinedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  joinedSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 },
  joinedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberBadgeSmall: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.accent,
  },
  memberTotalText: { fontSize: 11, color: COLORS.textSecondary },

  // Nearby card — styles now live here so Animated.View owns them (Fix 1)
  nearbyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nearbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationTagText: { fontSize: 11, fontWeight: '700', color: COLORS.accent },
  joinNowText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  nearbyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  nearbySub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },
  nearbyFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nearbyMemberText: { fontSize: 12, color: COLORS.textSecondary },

  emptyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  emptyPromptText: { fontSize: 13, color: COLORS.border },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.border,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.border,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1.2,
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal — Fix 2: outer is TouchableOpacity that dismisses
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 42, 67, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  joinNote: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 },
  modalPrimaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalPrimaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseButton: { marginTop: 16, alignItems: 'center', paddingBottom: 8 },
  modalCloseButtonText: { color: COLORS.textSecondary, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: { backgroundColor: COLORS.primary },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  toggleSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },

  locationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 8,
  },
  locationInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    marginBottom: 4,
  },
  locationInputSelected: { borderColor: COLORS.primary },
  locationSearchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  locationDropdown: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: COLORS.secondary,
  },
  locationItemMain: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  locationItemSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
});

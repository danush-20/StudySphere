import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const CLOUDINARY_CLOUD  = 'dpiytun2c';
const CLOUDINARY_PRESET = 'studysphere';
const MAX_SIZE_BYTES    = 10 * 1024 * 1024;

export default function MediaScreen({ route, navigation }) {
  const { sessionId, groupName } = route.params;
  const { profile, user }        = useContext(AuthContext);
  const { COLORS }               = useTheme();
  const insets                   = useSafeAreaInsets();

  const [mediaList,       setMediaList]       = useState([]);
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [downloading,     setDownloading]     = useState(null);

  // Upload arrow animation (from HTML)
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (uploading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(arrowAnim, {
            toValue: 1, duration: 1000,
            easing: Easing.inOut(Easing.ease), useNativeDriver: true,
          }),
          Animated.timing(arrowAnim, {
            toValue: 0, duration: 1000,
            easing: Easing.inOut(Easing.ease), useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [uploading]);

  // ── Firestore listener (original, unchanged) ──────────────────────────────

  useEffect(() => {
    const q = query(
      collection(db, 'studySessions', sessionId, 'media'),
      orderBy('uploadedAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setMediaList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [sessionId]);

  // ── Upload handlers (original, unchanged) ─────────────────────────────────

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(
        result.assets.map(a => ({
          uri: a.uri,
          name: a.fileName || `image_${Date.now()}.jpg`,
          mimeType: a.mimeType || 'image/jpeg',
          size: a.fileSize,
          type: 'image',
        })),
      );
    }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(
        result.assets.map(a => ({
          uri: a.uri,
          name: a.name,
          mimeType: 'application/pdf',
          size: a.size,
          type: 'pdf',
        })),
      );
    }
  };

  const uploadFiles = async files => {
    const oversized = files.filter(f => f.size && f.size > MAX_SIZE_BYTES);
    if (oversized.length > 0) {
      Alert.alert('File too large', `${oversized.map(f => f.name).join(', ')} exceeds the 10MB limit.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        let dataUri;
        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          const blob     = await response.blob();
          dataUri = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          dataUri = `data:${file.mimeType};base64,${base64}`;
        }

        const resourceType = file.type === 'pdf' ? 'raw' : 'image';
        const url    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
        const safeId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const formData = new FormData();
        formData.append('file',           dataUri);
        formData.append('upload_preset',  CLOUDINARY_PRESET);
        formData.append('folder',         `studysphere/${sessionId}`);
        formData.append('public_id',      safeId);

        const response = await fetch(url, { method: 'POST', body: formData });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || 'Cloudinary upload failed');
        }

        const data     = await response.json();
        const uploader = profile?.username || user?.email?.split('@')[0] || 'Unknown';

        await addDoc(collection(db, 'studySessions', sessionId, 'media'), {
          name:          file.name,
          url:           data.secure_url,
          type:          file.type,
          size:          file.size || 0,
          uploadedBy:    uploader,
          uploadedByUid: auth.currentUser?.uid,
          uploadedAt:    serverTimestamp(),
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      Alert.alert('Done', `${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully.`);
    } catch (e) {
      console.log('Upload error:', e.message);
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpen = async item => {
    if (item.type === 'image') { await Linking.openURL(item.url); return; }
    if (Platform.OS === 'web') { await Linking.openURL(item.url); return; }

    setDownloading(item.id);
    try {
      const safeFileName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';
      const fileUri      = FileSystem.cacheDirectory + safeFileName;
      const { uri }      = await FileSystem.downloadAsync(item.url, fileUri);

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri, flags: 1, type: 'application/pdf',
        });
      } else {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.log('Open error:', e.message);
      Alert.alert('Error', 'No PDF viewer found. Please install a PDF viewer app.');
    } finally {
      setDownloading(null);
    }
  };

  // ── Helpers (original, unchanged) ─────────────────────────────────────────

  const formatSize = bytes => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const uploadBarHeight = 80 + insets.bottom;
  const s = makeStyles(COLORS);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={s.mediaCard} onPress={() => handleOpen(item)} activeOpacity={0.85}>
      {item.type === 'image' ? (
        <Image source={{ uri: item.url }} style={s.thumbnail} resizeMode="cover" />
      ) : (
        <View style={s.pdfThumb}>
          <Ionicons name="document-text" size={28} color={COLORS.error} />
        </View>
      )}

      <View style={s.mediaInfo}>
        <Text style={s.mediaName} numberOfLines={1}>{item.name}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaText}>{item.uploadedBy}</Text>
          <View style={s.metaDot} />
          <Text style={s.metaText}>
            {formatDate(item.uploadedAt)}{item.size ? `  ·  ${formatSize(item.size)}` : ''}
          </Text>
        </View>
      </View>

      {downloading === item.id ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <View style={s.actionBtn}>
      <Ionicons
        name="open-outline"
        size={18}
        color={COLORS.textSecondary}  
      />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Media</Text>
          <Text style={s.headerSub}>{groupName}</Text>
        </View>
      </View>

      {/* Upload progress — animated arrow from HTML */}
      {uploading && (
        <View style={s.progressSection}>
          <View style={s.progressHeader}>
            <View style={s.progressIconWrap}>
              {/* Static cloud behind */}
              <Ionicons name="cloud-outline" size={18} color={COLORS.text} style={{ opacity: 0.3 }} />
              {/* Animated arrow rising through */}
              <Animated.View
                style={[
                  s.arrowOverlay,
                  {
                    opacity: arrowAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] }),
                    transform: [{
                      translateY: arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [6, -10] }),
                    }],
                  },
                ]}
              >
                <Ionicons name="arrow-up" size={13} color={COLORS.text} />
              </Animated.View>
            </View>
            <Text style={s.progressLabel}>Uploading...</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {/* File list */}
      <FlatList
        data={mediaList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[s.list, { paddingBottom: uploadBarHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          mediaList.length > 0 ? (
            <Text style={s.sectionLabel}>Recent Shared Files</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="images-outline" size={52} color={COLORS.border} />
            <Text style={s.emptyTitle}>No media yet</Text>
            <Text style={s.emptySub}>Upload images or PDFs to share with the group</Text>
          </View>
        }
      />

      {/* Upload bar */}
      <View style={[s.uploadBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={[s.uploadBtn, uploading && s.uploadBtnDisabled]}
          onPress={handlePickImage}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name="image-outline" size={19} color={COLORS.onPrimary} />
          <Text style={s.uploadBtnText}>Images</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.uploadBtn, s.pdfBtn, uploading && s.uploadBtnDisabled]}
          onPress={handlePickDocument}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name="document-outline" size={19} color={COLORS.onPrimary} />
          <Text style={s.uploadBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Theme-aware styles ────────────────────────────────────────────────────────
function makeStyles(COLORS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: COLORS.surface,
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17, fontWeight: '800',
      color: COLORS.text, letterSpacing: -0.4,
    },
    headerSub: {
      fontSize: 10, fontWeight: '600',
      color: COLORS.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.8,
    },

    progressSection: {
      marginHorizontal: 16, marginTop: 12,
      backgroundColor: COLORS.surfaceHigh,
      borderRadius: 14, padding: 14, gap: 10,
    },
    progressHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    progressIconWrap: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: COLORS.surface,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.06,
      shadowRadius: 4, elevation: 1,
      overflow: 'hidden',
    },
    arrowOverlay: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressLabel: {
      flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text,
    },
    progressTrack: {
      width: '100%', height: 3,
      backgroundColor: COLORS.surfaceHighest,
      borderRadius: 999, overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: COLORS.primaryBtn,
      borderRadius: 999,
    },

    list: { paddingHorizontal: 16, paddingTop: 16 },
    sectionLabel: {
      fontSize: 10, fontWeight: '800',
      color: COLORS.textSecondary,
      textTransform: 'uppercase', letterSpacing: 1.4,
      marginBottom: 12, paddingHorizontal: 2,
    },

    mediaCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.surface,
      borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
      shadowColor: '#000', shadowOpacity: 0.04,
      shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    thumbnail: {
      width: 54, height: 54, borderRadius: 10,
      backgroundColor: COLORS.surfaceHigh, flexShrink: 0,
    },
    pdfThumb: {
      width: 54, height: 54, borderRadius: 10,
      backgroundColor: COLORS.surfaceHigh,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    mediaInfo: { flex: 1, gap: 5 },
    mediaName: {
      fontSize: 13, fontWeight: '700',
      color: COLORS.text, letterSpacing: -0.1,
    },
    metaRow: {
      flexDirection: 'row', alignItems: 'center',
      gap: 5, flexWrap: 'wrap',
    },
    metaText: {
      fontSize: 10, fontWeight: '600',
      color: COLORS.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },
    metaDot: {
      width: 3, height: 3, borderRadius: 1.5,
      backgroundColor: COLORS.border,
    },
    actionBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: COLORS.surfaceHigh,
    },

    emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: {
      fontSize: 16, fontWeight: '700',
      color: COLORS.border, marginTop: 8,
    },
    emptySub: {
      fontSize: 13, color: COLORS.border,
      textAlign: 'center', lineHeight: 20, paddingHorizontal: 32,
    },

    uploadBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', gap: 12,
      paddingHorizontal: 16, paddingTop: 14,
      backgroundColor: COLORS.surface,
      shadowColor: '#000', shadowOpacity: 0.05,
      shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
      elevation: 8,
    },
    uploadBtn: {
      flex: 1, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center',
      gap: 8,
      backgroundColor: COLORS.primaryBtn,
      borderRadius: 999, paddingVertical: 14,
    },
    pdfBtn: { backgroundColor: COLORS.error },
    uploadBtnDisabled: { opacity: 0.5 },
    uploadBtnText: {
      color: COLORS.primaryBtnText,
      fontWeight: '800', fontSize: 14, letterSpacing: 0.2,
    },
  });
}
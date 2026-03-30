import React, { useState, useEffect, useContext } from 'react';
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

const CLOUDINARY_CLOUD = 'dpiytun2c';
const CLOUDINARY_PRESET = 'studysphere';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export default function MediaScreen({ route, navigation }) {
  const { sessionId, groupName } = route.params;
  const { profile, user } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  const [mediaList, setMediaList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloading, setDownloading] = useState(null);

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
      Alert.alert(
        'File too large',
        `${oversized.map(f => f.name).join(', ')} exceeds the 10MB limit.`,
      );
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
          const blob = await response.blob();
          dataUri = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
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
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
        const safeId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const formData = new FormData();
        formData.append('file', dataUri);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        formData.append('folder', `studysphere/${sessionId}`);
        formData.append('public_id', safeId);

        const response = await fetch(url, { method: 'POST', body: formData });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || 'Cloudinary upload failed');
        }

        const data = await response.json();
        const uploader = profile?.username || user?.email?.split('@')[0] || 'Unknown';

        await addDoc(collection(db, 'studySessions', sessionId, 'media'), {
          name: file.name,
          url: data.secure_url,
          type: file.type,
          size: file.size || 0,
          uploadedBy: uploader,
          uploadedByUid: auth.currentUser?.uid,
          uploadedAt: serverTimestamp(),
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      Alert.alert(
        'Done',
        `${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully.`,
      );
    } catch (e) {
      console.log('Upload error:', e.message);
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpen = async item => {
    if (item.type === 'image') {
      await Linking.openURL(item.url);
      return;
    }

    if (Platform.OS === 'web') {
      await Linking.openURL(item.url);
      return;
    }

    setDownloading(item.id);
    try {
      const safeFileName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';
      const fileUri = FileSystem.cacheDirectory + safeFileName;
      const { uri } = await FileSystem.downloadAsync(item.url, fileUri);

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
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

  // ── Render item ───────────────────────────────────────────────────────────

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mediaCard}
      onPress={() => handleOpen(item)}
      activeOpacity={0.85}
    >
      {/* Thumbnail */}
      {item.type === 'image' ? (
        <Image source={{ uri: item.url }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.pdfThumb}>
          <Ionicons name="document-text" size={28} color="#ba1a1a" />
        </View>
      )}

      {/* Info */}
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.uploadedBy}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>
            {formatDate(item.uploadedAt)}{item.size ? `  ·  ${formatSize(item.size)}` : ''}
          </Text>
        </View>
      </View>

      {/* Action icon */}
      {downloading === item.id ? (
        <ActivityIndicator size="small" color="#00152a" />
      ) : (
        <View style={styles.actionBtn}>
          <Ionicons
            name={item.type === 'image' ? 'open-outline' : 'eye-outline'}
            size={18}
            color="#43474d"
          />
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Upload bar bottom offset ──────────────────────────────────────────────
  const uploadBarHeight = 80 + insets.bottom;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#00152a" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Media</Text>
          <Text style={styles.headerSub}>{groupName}</Text>
        </View>
      </View>

      {/* Upload progress bar */}
      {uploading && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressIconWrap}>
              <Ionicons name="cloud-upload-outline" size={18} color="#00152a" />
            </View>
            <Text style={styles.progressLabel}>Uploading...</Text>
            <Text style={styles.progressPct}>{uploadProgress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {/* File list */}
      <FlatList
        data={mediaList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: uploadBarHeight + 12 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          mediaList.length > 0 ? (
            <Text style={styles.sectionLabel}>Recent Shared Files</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={52} color="#c3c6ce" />
            <Text style={styles.emptyTitle}>No media yet</Text>
            <Text style={styles.emptySub}>
              Upload images or PDFs to share with the group
            </Text>
          </View>
        }
      />

      {/* Upload action bar */}
      <View style={[styles.uploadBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
          onPress={handlePickImage}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name="image-outline" size={19} color="#fff" />
          <Text style={styles.uploadBtnText}>Images</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadBtn, styles.pdfBtn, uploading && styles.uploadBtnDisabled]}
          onPress={handlePickDocument}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name="document-outline" size={19} color="#fff" />
          <Text style={styles.uploadBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafe',
  },

  // ── Header ────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(246,250,254,0.85)',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
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
  headerText: {
    flexDirection: 'column',
    gap: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#00152a',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#43474d',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Upload progress ───────────────────────────────────────────────
  progressSection: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f0f4f8',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  progressLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#00152a',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00152a',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,181,158,0.3)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00152a',
    borderRadius: 999,
  },

  // ── List ──────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(67,71,77,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  // ── Media card ────────────────────────────────────────────────────
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#00152a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#f0f4f8',
    flexShrink: 0,
  },
  pdfThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: 'rgba(255,218,214,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mediaInfo: {
    flex: 1,
    gap: 5,
  },
  mediaName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#171c1f',
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#43474d',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#c3c6ce',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8',
  },

  // ── Empty state ───────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c3c6ce',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#c3c6ce',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },

  // ── Upload bar ────────────────────────────────────────────────────
  uploadBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: 'rgba(246,250,254,0.96)',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00152a',
    borderRadius: 999,
    paddingVertical: 14,
  },
  pdfBtn: {
    backgroundColor: '#ba1a1a',
  },
  uploadBtnDisabled: {
    opacity: 0.5,
  },
  uploadBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
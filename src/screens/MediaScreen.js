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
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const [mediaList, setMediaList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloading, setDownloading] = useState(null);

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
          // On web, convert blob URI to base64 using FileReader
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

        const uploader =
          profile?.username || user?.email?.split('@')[0] || 'Unknown';

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

    // PDF
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
      Alert.alert(
        'Error',
        'No PDF viewer found. Please install a PDF viewer app.',
      );
    } finally {
      setDownloading(null);
    }
  };

  const formatSize = bytes => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.mediaCard} onPress={() => handleOpen(item)}>
      {item.type === 'image' ? (
        <Image
          source={{ uri: item.url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.pdfThumb}>
          <Ionicons name="document-text" size={32} color="#e53935" />
        </View>
      )}
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.mediaMeta}>
          {item.uploadedBy} · {formatDate(item.uploadedAt)}
          {item.size ? `  ·  ${formatSize(item.size)}` : ''}
        </Text>
      </View>
      {downloading === item.id ? (
        <ActivityIndicator size="small" color="#2e7d32" />
      ) : (
        <Ionicons
          name={item.type === 'image' ? 'open-outline' : 'eye-outline'}
          size={20}
          color="#aaa"
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Media</Text>
          <Text style={styles.headerSub}>{groupName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {uploading && (
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${uploadProgress}%` }]}
          />
          <Text style={styles.progressText}>
            Uploading... {uploadProgress}%
          </Text>
        </View>
      )}

      <FlatList
        data={mediaList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={52} color="#ddd" />
            <Text style={styles.emptyTitle}>No media yet</Text>
            <Text style={styles.emptySub}>
              Upload images or PDFs to share with the group
            </Text>
          </View>
        }
      />

      <View style={styles.uploadRow}>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
          onPress={handlePickImage}
          disabled={uploading}
        >
          <Ionicons name="image-outline" size={20} color="#fff" />
          <Text style={styles.uploadBtnText}>Images</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.uploadBtn,
            styles.pdfBtn,
            uploading && styles.uploadBtnDisabled,
          ]}
          onPress={handlePickDocument}
          disabled={uploading}
        >
          <Ionicons name="document-outline" size={20} color="#fff" />
          <Text style={styles.uploadBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: '#eee',
  },
  backBtn: { padding: 4, width: 36 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 1 },
  progressBar: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#e8f5e9',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#a5d6a7',
  },
  progressText: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '600',
    zIndex: 1,
  },
  list: { padding: 16, paddingBottom: 100 },
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  pdfThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaInfo: { flex: 1, marginHorizontal: 12 },
  mediaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  mediaMeta: { fontSize: 12, color: '#aaa' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#bbb', marginTop: 16 },
  emptySub: {
    fontSize: 13,
    color: '#ccc',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  uploadRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderColor: '#eee',
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    paddingVertical: 13,
  },
  pdfBtn: { backgroundColor: '#e53935' },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

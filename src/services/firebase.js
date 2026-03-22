import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyCnjtWg4DpjUEMisrI0_2isaglauuCBlMI',
  authDomain: 'studysphere-a94b5.firebaseapp.com',
  projectId: 'studysphere-a94b5',
  storageBucket: 'studysphere-a94b5.firebasestorage.app',
  messagingSenderId: '634668096541',
  appId: '1:634668096541:web:dea5e41317610fd464baf4',
  measurementId: 'G-ZWVQV5PH2L',
  databaseURL:
    'https://studysphere-a94b5-default-rtdb.asia-southeast1.firebasedatabase.app'
};

// Prevent re-initialization on hot reload
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const rtdb = getDatabase(app);
export const db = getFirestore(app);

let auth;
try {
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (e) {
  auth = getAuth(app);
}

export { auth };

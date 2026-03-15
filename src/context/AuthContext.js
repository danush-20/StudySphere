import React, { createContext, useState, useEffect } from "react";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser) => {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setProfileExists(true);
        setProfile(userDoc.data());
      } else {
        setProfileExists(false);
        setProfile(null);
      }
    } catch (error) {
      console.log("Error fetching profile:", error.message);
      setProfileExists(false);
      setProfile(null);
    }
  };

  // Called after setDoc in GoogleSignInScreen to re-check Firestore
  const refreshProfile = async () => {
    if (auth.currentUser) {
      await fetchProfile(auth.currentUser);
    }
  };

  // Called after reload() in VerifyEmailScreen to re-read emailVerified
  const refreshUser = () => {
    setUser(auth.currentUser ? { ...auth.currentUser } : null);
  };

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfileExists(false);
        setProfile(null);
      }

      setLoading(false);

    });

    return unsubscribe;

  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, profileExists, loading, refreshUser, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );

}
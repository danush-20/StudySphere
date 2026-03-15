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

  const refreshUser = () => {
    // Forces context to re-read auth.currentUser after reload()
    setUser(auth.currentUser ? { ...auth.currentUser } : null);
  };

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      setUser(currentUser);

      if (currentUser) {

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

      } else {
        setProfileExists(false);
        setProfile(null);
      }

      setLoading(false);

    });

    return unsubscribe;

  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, profileExists, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );

}
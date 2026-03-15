import React, { createContext, useEffect, useState } from "react";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {

      if (firebaseUser) {

        setUser(firebaseUser);

        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data());
        } else {
          setProfile(null);
        }

      } else {

        setUser(null);
        setProfile(null);

      }

      setLoading(false);

    });

    return unsubscribe;

  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
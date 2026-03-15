import React, { useEffect, useState } from "react";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import GoogleSignInScreen from "../screens/GoogleSignInScreen";
import Home from "../screens/Home";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {

  const [user, setUser] = useState(null);
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      setUser(currentUser);

      if (currentUser) {

        try {

          const userDoc = await getDoc(doc(db, "users", currentUser.uid));

          if (userDoc.exists()) {
            setProfileExists(true);
          } else {
            setProfileExists(false);
          }

        } catch (error) {
          console.log(error.message);
        }

      }

      setLoading(false);

    });

    return unsubscribe;

  }, []);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>

      <Stack.Navigator screenOptions={{ headerShown: false }}>

        {!user && (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
            />

            <Stack.Screen
              name="Register"
              component={RegisterScreen}
            />
          </>
        )}

        {user && !profileExists && (
          <Stack.Screen
            name="GoogleSignIn"
            component={GoogleSignInScreen}
          />
        )}

        {user && profileExists && (
          <Stack.Screen
            name="Home"
            component={Home}
          />
        )}

      </Stack.Navigator>

    </NavigationContainer>
  );
}
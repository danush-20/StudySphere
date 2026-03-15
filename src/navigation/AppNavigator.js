import React, { useContext } from "react";
import { View, ActivityIndicator } from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthContext } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import VerifyEmailScreen from "../screens/VerifyEmailScreen";
import GoogleSignInScreen from "../screens/GoogleSignInScreen";
import Home from "../screens/Home";
import StudyGroup from "../screens/StudyGroup";
import FeedbackScreen from "../screens/FeedbackScreen";
import ReportIssueScreen from "../screens/ReportIssueScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {

  const { user, profileExists, loading } = useContext(AuthContext);

  const isGoogleUser = user?.providerData?.some(
    (p) => p.providerId === "google.com"
  );

  const needsVerification = user && !user.emailVerified && !isGoogleUser;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>

      <Stack.Navigator screenOptions={{ headerShown: false }}>

        {/* Not logged in */}
        {!user && (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}

        {/* Logged in but email not verified */}
        {needsVerification && (
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        )}

        {/* Logged in, verified, but no profile yet (Google users) */}
        {user && !needsVerification && !profileExists && (
          <Stack.Screen name="GoogleSignIn" component={GoogleSignInScreen} />
        )}

        {/* Fully set up */}
        {user && !needsVerification && profileExists && (
          <>
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
            <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
            <Stack.Screen name="StudyGroup" component={StudyGroup} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}

        
      </Stack.Navigator>

    </NavigationContainer>
  );

}
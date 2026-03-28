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
import MediaScreen from '../screens/MediaScreen';
import ChatScreen from '../screens/ChatScreen';

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
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right', // default for all screens
        }}
      >
        {!user && (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        )}

        {needsVerification && (
          <Stack.Screen
            name="VerifyEmail"
            component={VerifyEmailScreen}
            options={{ animation: 'fade' }}
          />
        )}

        {user && !needsVerification && !profileExists && (
          <Stack.Screen
            name="GoogleSignIn"
            component={GoogleSignInScreen}
            options={{ animation: 'fade' }}
          />
        )}

        {user && !needsVerification && profileExists && (
          <>
            <Stack.Screen
              name="Home"
              component={Home}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen
              name="StudyGroup"
              component={StudyGroup}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
            <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="Media"
              component={MediaScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );

}
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import SimpleNotificationService from './src/services/SimpleNotificationService';

export default function App() {
  useEffect(() => {
    SimpleNotificationService.init();

    const subscription = SimpleNotificationService.setupNotificationTapListener(
      data => {
        console.log('Notification tapped:', data);

        if (data?.type === 'join_request' && data?.groupId) {
          navigationRef.current?.navigate('JoinRequests', {
            groupId: data.groupId,
            groupName: data.groupName,
          });
        }
      },
    );

    return () => SimpleNotificationService.removeListener(subscription);
  }, []);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

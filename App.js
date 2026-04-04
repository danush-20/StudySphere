import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import SimpleNotificationService from './services/SimpleNotificationService';
import { useJoinRequestListener } from './hooks/useJoinRequestListener';


export default function App() {
    useEffect(() => {
      SimpleNotificationService.init();

      const subscription =
        SimpleNotificationService.setupNotificationTapListener(data => {
          console.log('Notification tapped:', data);
        });

      return () => SimpleNotificationService.removeListener(subscription);
    }, []);

    useJoinRequestListener(user?.uid, userGroups);
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
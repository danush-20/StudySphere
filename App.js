import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
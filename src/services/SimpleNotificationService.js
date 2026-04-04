import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show notifications when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class SimpleNotificationService {
  async init() {
    try {
      // Request basic permissions
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Setup Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'StudySphere',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      console.log('Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Timer complete notification
  async showTimerComplete(sessionName) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Timer Complete!',
          body: `${sessionName} session has ended. Great work! 🎉`,
          sound: 'default',
          data: { type: 'timer_complete' },
        },
        trigger: null, // Show immediately
      });
      console.log('Timer notification sent');
    } catch (error) {
      console.error('Error showing timer notification:', error);
    }
  }

  // Join request notification
  async showJoinRequest(requestId, userName, groupName) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '👋 New Join Request',
          body: `${userName} wants to join "${groupName}"`,
          sound: 'default',
          data: {
            type: 'join_request',
            requestId,
            userName,
            groupName,
          },
        },
        trigger: null, // Show immediately
      });
      console.log('Join request notification sent');
    } catch (error) {
      console.error('Error showing join request notification:', error);
    }
  }

  // Setup listener for when user taps notification
  setupNotificationTapListener(callback) {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);

        if (callback) {
          callback(data);
        }
      },
    );

    return subscription;
  }

  // Remove listener
  removeListener(subscription) {
    if (subscription) {
      Notifications.removeNotificationSubscription(subscription);
    }
  }
}

export default new SimpleNotificationService();

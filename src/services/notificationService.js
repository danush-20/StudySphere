import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request permissions and return granted status
export async function requestNotificationPermissions() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Schedule a local notification for a session
// triggerDate: the exact Date to fire the notification
// sessionName: group name to show in notification
// sessionId: used as identifier to cancel later
export async function scheduleSessionNotification(sessionId, sessionName, triggerDate) {
  // Cancel any existing notification for this session first
  await cancelSessionNotification(sessionId);

  const now = new Date();
  if (triggerDate <= now) return null; // already passed

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Study Session Starting Soon 📚",
      body: `"${sessionName}" is starting in a few minutes. Get ready!`,
      data: { sessionId },
      sound: true,
    },
    trigger: {
      date: triggerDate,
    },
    identifier: `session-${sessionId}`,
  });

  return id;
}

// Cancel a scheduled notification for a session
export async function cancelSessionNotification(sessionId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`session-${sessionId}`);
  } catch (e) {
    // Ignore if not found
  }
}

// Schedule notifications for all reminder options chosen by user
// reminderMinutes: array of numbers e.g. [15, 30, 60]
export async function scheduleAllReminders(sessionId, sessionName, scheduledAt, reminderMinutes) {
  const sessionDate = scheduledAt.toDate ? scheduledAt.toDate() : new Date(scheduledAt);

  for (const mins of reminderMinutes) {
    const triggerDate = new Date(sessionDate.getTime() - mins * 60 * 1000);
    const id = `session-${sessionId}-${mins}`;

    await cancelSessionNotificationById(id);

    const now = new Date();
    if (triggerDate <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Session in ${mins} minute${mins > 1 ? "s" : ""} ⏰`,
        body: `"${sessionName}" starts soon. Time to focus!`,
        data: { sessionId },
        sound: true,
      },
      trigger: { date: triggerDate },
      identifier: id,
    });
  }
}

export async function cancelSessionNotificationById(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {}
}

export async function cancelAllReminders(sessionId, reminderMinutes = [15, 30, 60]) {
  for (const mins of reminderMinutes) {
    await cancelSessionNotificationById(`session-${sessionId}-${mins}`);
  }
}
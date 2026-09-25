import {
  getToken,
  onMessage,
  deleteToken,
} from "firebase/messaging";

import { messaging } from "./firebase";

const VAPID_PUBLIC_KEY =
  "BMS1WZkLAOImpVgfGqAuY7jemuPiux9Z7qi6zu-ITLmQlKli5HkoobcyuSBrUNlfHQ98faCpMxJ-trLv8mSWI0";

/**
 * Ask notification permission and register the device
 * for Firebase Cloud Messaging.
 */
export async function registerForNotifications() {
  try {
    if (!messaging) {
      console.log("FCM is not supported on this browser.");
      return null;
    }

    if (!("Notification" in window)) {
      console.log("Notifications are not supported.");
      return null;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission denied.");
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.log("FCM token could not be generated.");
      return null;
    }

    console.log("FCM Token:", token);

    return token;
  } catch (error) {
    console.error("FCM registration error:", error);
    return null;
  }
}

/**
 * Receive notifications while the SugarCafe website is open.
 */
export function listenForForegroundMessages(callback) {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log("FCM foreground message:", payload);

    if (typeof callback === "function") {
      callback(payload);
    }
  });
}

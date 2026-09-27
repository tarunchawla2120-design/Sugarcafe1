import {
  getToken,
  onMessage,
} from "firebase/messaging";

import { messaging } from "./firebase";

/*
  VAPID public key comes from Vercel / .env
  Example:
  VITE_VAPID_PUBLIC_KEY=xxxxx
*/
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Ask notification permission and register the device
 * for Firebase Cloud Messaging.
 */
export async function registerForNotifications() {
  try {
    if (!messaging) {
      console.log("FCM is not available.");
      return null;
    }

    if (typeof window === "undefined") {
      return null;
    }

    if (!("Notification" in window)) {
      console.log("Notifications are not supported.");
      return null;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error(
        "VITE_VAPID_PUBLIC_KEY is missing."
      );
      return null;
    }

    const permission =
      await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission denied.");
      return null;
    }

    const registration =
      await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.log(
        "FCM token could not be generated."
      );
      return null;
    }

    console.log("FCM Token:", token);

    return token;
  } catch (error) {
    console.error(
      "FCM registration error:",
      error
    );

    return null;
  }
}

/**
 * Receive notifications while the
 * SugarCafe website is open.
 */
export function listenForForegroundMessages(
  callback
) {
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log(
      "FCM foreground message:",
      payload
    );

    if (typeof callback === "function") {
      callback(payload);
    }
  });
}

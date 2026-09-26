/* =========================================================
   SUGAR CAFE - WEB PUSH NOTIFICATIONS
   No Firebase Messaging / No FCM
========================================================= */

const PAYMENT_API_URL =
  import.meta.env.VITE_PAYMENT_API_URL || "";

const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

/* =========================================================
   HELPERS
========================================================= */

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (
    base64String +
    padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}

/* =========================================================
   SERVICE WORKER
========================================================= */

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "This browser does not support Service Worker."
    );
  }

  return navigator.serviceWorker.register(
    "/sw.js"
  );
}

/* =========================================================
   GET CURRENT PUSH STATUS
========================================================= */

export function getPushStatus() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

/* =========================================================
   GET EXISTING SUBSCRIPTION
========================================================= */

async function getExistingSubscription(
  registration
) {
  return registration.pushManager.getSubscription();
}

/* =========================================================
   CREATE PUSH SUBSCRIPTION
========================================================= */

async function createPushSubscription(
  registration
) {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "VITE_VAPID_PUBLIC_KEY is not configured."
    );
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,

    applicationServerKey:
      urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY
      ),
  });
}

/* =========================================================
   SAVE SUBSCRIPTION TO SERVER
========================================================= */

async function saveSubscriptionToServer({
  customerId,
  subscription,
}) {
  if (!PAYMENT_API_URL) {
    throw new Error(
      "VITE_PAYMENT_API_URL is not configured."
    );
  }

  const response = await fetch(
    `${PAYMENT_API_URL}/api/notifications/subscribe`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        customerId: String(customerId),
        subscription,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Notification subscription save failed."
    );
  }

  return data;
}

/* =========================================================
   ENABLE ORDER NOTIFICATIONS
========================================================= */

export async function enableOrderNotifications(
  customerId
) {
  if (!customerId) {
    throw new Error(
      "Customer ID is required."
    );
  }

  if (!("Notification" in window)) {
    throw new Error(
      "Notifications are not supported on this device/browser."
    );
  }

  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Service Worker is not supported."
    );
  }

  /* -----------------------------------------
     Request notification permission
  ----------------------------------------- */

  let permission =
    Notification.permission;

  if (permission === "default") {
    permission =
      await Notification.requestPermission();
  }

  if (permission !== "granted") {
    if (permission === "denied") {
      throw new Error(
        "Notifications blocked hain. Browser settings se Sugar Cafe notifications allow karo."
      );
    }

    throw new Error(
      "Notification permission nahi mili."
    );
  }

  /* -----------------------------------------
     Register service worker
  ----------------------------------------- */

  const registration =
    await getServiceWorkerRegistration();

  await navigator.serviceWorker.ready;

  /* -----------------------------------------
     Existing subscription
  ----------------------------------------- */

  let subscription =
    await getExistingSubscription(
      registration
    );

  /* -----------------------------------------
     Create new subscription
  ----------------------------------------- */

  if (!subscription) {
    subscription =
      await createPushSubscription(
        registration
      );
  }

  /* -----------------------------------------
     Save to backend
  ----------------------------------------- */

  const result =
    await saveSubscriptionToServer({
      customerId,
      subscription:
        subscription.toJSON(),
    });

  return {
    ok: true,
    permission,
    subscription,
    server: result,
  };
}

/* =========================================================
   DISABLE ORDER NOTIFICATIONS
========================================================= */

export async function disableOrderNotifications(
  customerId
) {
  if (!customerId) {
    throw new Error(
      "Customer ID is required."
    );
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration =
    await navigator.serviceWorker.getRegistration(
      "/sw.js"
    );

  if (!registration) {
    return;
  }

  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  if (PAYMENT_API_URL) {
    try {
      await fetch(
        `${PAYMENT_API_URL}/api/notifications/unsubscribe`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            customerId: String(customerId),
            endpoint:
              subscription.endpoint,
          }),
        }
      );
    } catch (error) {
      console.warn(
        "Failed to remove push subscription from server:",
        error
      );
    }
  }

  await subscription.unsubscribe();
}

/* =========================================================
   CHECK IF DEVICE IS SUBSCRIBED
========================================================= */

export async function isOrderNotificationsEnabled() {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration =
      await navigator.serviceWorker.getRegistration(
        "/sw.js"
      );

    if (!registration) {
      return false;
    }

    const subscription =
      await registration.pushManager.getSubscription();

    return Boolean(subscription);
  } catch {
    return false;
  }
}

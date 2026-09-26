/* =========================================================
   SUGAR CAFE - PUSH NOTIFICATIONS
   Customer Web Push Subscription
========================================================= */

const API_BASE_URL =
  import.meta.env.VITE_PAYMENT_API_URL || "";


/* =========================================================
   HELPERS
========================================================= */

function urlBase64ToUint8Array(base64String) {
  const padding =
    "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 =
    (base64String + padding)
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
   GET CUSTOMER ID
========================================================= */

function getCustomerId() {
  try {
    const directId =
      localStorage.getItem(
        "sugarCafeCustomerId"
      );

    if (directId) {
      return directId;
    }

    const oldId =
      localStorage.getItem("customerId");

    if (oldId) {
      return oldId;
    }

    const userRaw =
      localStorage.getItem(
        "sugarCafeUser"
      );

    if (userRaw) {
      const user =
        JSON.parse(userRaw);

      return (
        user?.customerId ||
        user?.id ||
        null
      );
    }

    return null;
  } catch (error) {
    console.error(
      "Unable to get customer ID:",
      error
    );

    return null;
  }
}


/* =========================================================
   CHECK SUPPORT
========================================================= */

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}


/* =========================================================
   GET NOTIFICATION PERMISSION
========================================================= */

export function getPushPermission() {
  if (
    typeof Notification ===
    "undefined"
  ) {
    return "unsupported";
  }

  return Notification.permission;
}


/* =========================================================
   REGISTER SERVICE WORKER
========================================================= */

export async function registerPushServiceWorker() {
  if (!isPushSupported()) {
    throw new Error(
      "Push notifications are not supported on this device/browser."
    );
  }

  const registration =
    await navigator.serviceWorker.register(
      "/sw.js",
      {
        scope: "/",
      }
    );

  await navigator.serviceWorker.ready;

  return registration;
}


/* =========================================================
   GET VAPID PUBLIC KEY
========================================================= */

async function getVapidPublicKey() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/notifications/vapid-public-key`,
      {
        method: "GET",
        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data?.publicKey
  ) {
    throw new Error(
      data?.error ||
        "Unable to get Web Push public key."
    );
  }

  return data.publicKey;
}


/* =========================================================
   GET EXISTING SUBSCRIPTION
========================================================= */

export async function getExistingPushSubscription() {
  if (!isPushSupported()) {
    return null;
  }

  const registration =
    await navigator.serviceWorker.ready;

  return registration.pushManager
    .getSubscription();
}


/* =========================================================
   SAVE SUBSCRIPTION TO SERVER
========================================================= */

async function saveSubscription(
  subscription,
  customerId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/notifications/subscribe`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          customerId,
          subscription:
            subscription.toJSON(),
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Unable to save push subscription."
    );
  }

  return data;
}


/* =========================================================
   SUBSCRIBE CUSTOMER
========================================================= */

export async function subscribeToPushNotifications(
  customerId = null
) {
  if (!isPushSupported()) {
    return {
      success: false,
      reason: "unsupported",
    };
  }

  const finalCustomerId =
    customerId || getCustomerId();

  if (!finalCustomerId) {
    return {
      success: false,
      reason: "customer-id-missing",
    };
  }

  /* ---------------------------------------------
     Permission
  --------------------------------------------- */

  let permission =
    Notification.permission;

  if (permission === "default") {
    permission =
      await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      success: false,
      reason:
        permission === "denied"
          ? "permission-denied"
          : "permission-not-granted",
    };
  }

  /* ---------------------------------------------
     Service Worker
  --------------------------------------------- */

  await registerPushServiceWorker();

  const registration =
    await navigator.serviceWorker.ready;

  /* ---------------------------------------------
     Existing subscription
  --------------------------------------------- */

  let subscription =
    await registration.pushManager
      .getSubscription();

  /* ---------------------------------------------
     Create new subscription
  --------------------------------------------- */

  if (!subscription) {
    const publicKey =
      await getVapidPublicKey();

    const applicationServerKey =
      urlBase64ToUint8Array(
        publicKey
      );

    subscription =
      await registration.pushManager.subscribe(
        {
          userVisibleOnly: true,

          applicationServerKey,
        }
      );
  }

  /* ---------------------------------------------
     Save on backend
  --------------------------------------------- */

  await saveSubscription(
    subscription,
    finalCustomerId
  );

  return {
    success: true,
    subscription,
    permission: "granted",
  };
}


/* =========================================================
   UNSUBSCRIBE CUSTOMER
========================================================= */

export async function unsubscribeFromPushNotifications(
  customerId = null
) {
  if (!isPushSupported()) {
    return {
      success: false,
      reason: "unsupported",
    };
  }

  const finalCustomerId =
    customerId || getCustomerId();

  const subscription =
    await getExistingPushSubscription();

  if (!subscription) {
    return {
      success: true,
      alreadyUnsubscribed: true,
    };
  }

  try {
    if (finalCustomerId) {
      await fetch(
        `${API_BASE_URL}/api/notifications/unsubscribe`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            customerId:
              finalCustomerId,

            endpoint:
              subscription.endpoint,
          }),
        }
      );
    }
  } catch (error) {
    console.error(
      "Unable to remove subscription from server:",
      error
    );
  }

  await subscription.unsubscribe();

  return {
    success: true,
  };
}


/* =========================================================
   ENABLE PUSH
   Useful after a button click.
========================================================= */

export async function enableOrderNotifications(
  customerId = null
) {
  try {
    return await subscribeToPushNotifications(
      customerId
    );
  } catch (error) {
    console.error(
      "Push notification setup failed:",
      error
    );

    return {
      success: false,
      reason: "setup-failed",
      error: error?.message || String(error),
    };
  }
}


/* =========================================================
   PUSH STATUS
========================================================= */

export async function getPushStatus() {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
    };
  }

  const subscription =
    await getExistingPushSubscription();

  return {
    supported: true,

    permission:
      Notification.permission,

    subscribed:
      Boolean(subscription),

    endpoint:
      subscription?.endpoint || null,
  };
}

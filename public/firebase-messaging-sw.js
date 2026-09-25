importScripts(
  "https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyBaWoS-bvWh454kn_Dq1nkTEjHBNVQKohs",
  authDomain: "sugarcafe-9e54d.firebaseapp.com",
  projectId: "sugarcafe-9e54d",
  storageBucket: "sugarcafe-9e54d.firebasestorage.app",
  messagingSenderId: "417153769971",
  appId: "1:417153769971:web:e515c341086006be063286",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Background message:",
    payload
  );

  const title =
    payload.notification?.title || "Sugar Café";

  const options = {
    body:
      payload.notification?.body ||
      "Sugar Café mein kuch tasty aapka wait kar raha hai! 🍕",
    data: {
      url: payload.data?.url || "/",
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    })
  );
});

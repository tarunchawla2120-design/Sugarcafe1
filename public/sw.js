/* =========================================================
   SUGAR CAFE - WEB PUSH SERVICE WORKER
========================================================= */

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Sugar Cafe",
      body: "Your order has been updated.",
    };
  }

  const title = data.title || "Sugar Cafe";

  const options = {
    body:
      data.body ||
      "Your Sugar Cafe order has been updated.",

    icon:
      data.icon ||
      "/sugar-cafe-icon-192.png",

    badge:
      data.badge ||
      "/sugar-cafe-badge-72.png",

    tag:
      data.tag ||
      "sugar-cafe-order",

    renotify: true,

    requireInteraction: false,

    data: data.data || {
      url: "/orders",
    },

    vibrate: [
      200,
      100,
      200,
      100,
      300,
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});


/* =========================================================
   NOTIFICATION CLICK
========================================================= */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const notificationData =
      event.notification.data || {};

    const targetUrl =
      notificationData.url || "/orders";

    event.waitUntil(
      clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }).then((clientList) => {
        for (const client of clientList) {
          if (
            "focus" in client &&
            client.url.includes(
              new URL(targetUrl, self.location.origin)
                .pathname
            )
          ) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(
            new URL(
              targetUrl,
              self.location.origin
            ).href
          );
        }

        return null;
      })
    );
  }
);


/* =========================================================
   SERVICE WORKER INSTALL
========================================================= */

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  }
);


/* =========================================================
   SERVICE WORKER ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      self.clients.claim()
    );
  }
);

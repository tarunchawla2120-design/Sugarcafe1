import http from "node:http";
import crypto from "node:crypto";

import webpush from "web-push";

import {
  initializeApp,
  cert,
  getApps,
} from "firebase-admin/app";

import {
  getFirestore,
  FieldValue,
} from "firebase-admin/firestore";

/* =========================================================
   SUGAR CAFE SERVER
   Razorpay + Web Push Notifications
========================================================= */

/* =========================================================
   ENV
========================================================= */

const PORT = Number(process.env.PAYMENT_SERVER_PORT || 8267);

const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/* =========================================================
   WEB PUSH ENV
========================================================= */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:hello@sugarcafe.in";

const PUSH_ENABLED = Boolean(
  VAPID_PUBLIC_KEY &&
  VAPID_PRIVATE_KEY
);

/* =========================================================
   FIREBASE ADMIN
========================================================= */

let db = null;

function getFirebaseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing."
    );
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."
    );
  }

  if (
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is invalid or missing project_id, client_email or private_key."
    );
  }

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
  };
}

function getDb() {
  if (db) {
    return db;
  }

  const serviceAccount = getFirebaseServiceAccount();

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount),
        });

  db = getFirestore(app);

  return db;
}

/* =========================================================
   CONFIGURE WEB PUSH
========================================================= */

if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  console.log("Web Push: ENABLED");
} else {
  console.log(
    "Web Push: DISABLED - VAPID keys are not configured."
  );
}

/* =========================================================
   HELPERS
========================================================= */

const json = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });

const sendCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
};

/* =========================================================
   RAZORPAY
========================================================= */

const razorpayRequest = async (path, options = {}) => {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error(
      "Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server."
    );
  }

  const auth = Buffer
    .from(`${KEY_ID}:${KEY_SECRET}`)
    .toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1${path}`,
    {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.description ||
        "Razorpay API request failed."
    );
  }

  return data;
};

/* =========================================================
   PUSH NOTIFICATION CONTENT
========================================================= */

function getNotificationContent({
  status,
  orderNumber,
  orderType,
}) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  const number = orderNumber
    ? ` #${orderNumber}`
    : "";

  switch (normalized) {
    case "new":
      return {
        title: "🛎️ Order Received",
        body: `Your Sugar Cafe order${number} has been received successfully.`,
      };

    case "preparing":
    case "accepted":
      return {
        title: "👨‍🍳 Order Preparing",
        body: `Your order${number} is now being prepared fresh.`,
      };

    case "food ready":
    case "ready":
    case "food_ready":
      if (
        String(orderType || "").toLowerCase() ===
        "takeaway"
      ) {
        return {
          title: "🍔 Order Ready",
          body: `Your order${number} is ready for pickup.`,
        };
      }

      return {
        title: "🍔 Order Ready",
        body: `Your order${number} is ready.`,
      };

    case "dispatched":
      return {
        title: "🛵 Out for Delivery",
        body: `Your order${number} is on the way.`,
      };

    case "delivered":
      return {
        title: "🎉 Order Delivered",
        body: `Your Sugar Cafe order${number} has been delivered. Enjoy!`,
      };

    case "rejected":
    case "cancelled":
    case "canceled":
      return {
        title: "❌ Order Update",
        body: `Your order${number} could not be accepted.`,
      };

    default:
      return {
        title: "Sugar Cafe",
        body: `There is an update on your order${number}.`,
      };
  }
}

/* =========================================================
   SAVE PUSH SUBSCRIPTION
========================================================= */

async function savePushSubscription({
  customerId,
  subscription,
}) {
  if (!customerId) {
    throw new Error("customerId is required.");
  }

  if (!subscription?.endpoint) {
    throw new Error(
      "A valid push subscription is required."
    );
  }

  const firestore = getDb();

  /*
    Endpoint can be very long and may contain characters
    that are not suitable for a Firestore document ID.

    SHA-256 gives us a stable safe ID.
  */

  const subscriptionId = crypto
    .createHash("sha256")
    .update(subscription.endpoint)
    .digest("hex");

  const ref = firestore
    .collection("pushSubscriptions")
    .doc(subscriptionId);

  await ref.set(
    {
      customerId: String(customerId),
      subscription,
      endpoint: subscription.endpoint,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  return subscriptionId;
}

/* =========================================================
   REMOVE PUSH SUBSCRIPTION
========================================================= */

async function removePushSubscription({
  customerId,
  endpoint,
}) {
  if (!customerId || !endpoint) {
    throw new Error(
      "customerId and endpoint are required."
    );
  }

  const firestore = getDb();

  const subscriptionId = crypto
    .createHash("sha256")
    .update(endpoint)
    .digest("hex");

  const ref = firestore
    .collection("pushSubscriptions")
    .doc(subscriptionId);

  const snapshot = await ref.get();

  if (
    snapshot.exists &&
    String(snapshot.data()?.customerId) ===
      String(customerId)
  ) {
    await ref.delete();
  }
}

/* =========================================================
   SEND PUSH TO CUSTOMER
========================================================= */

async function sendPushToCustomer({
  customerId,
  status,
  orderNumber,
  orderId,
  orderType,
}) {
  if (!PUSH_ENABLED) {
    console.log(
      "Push skipped because VAPID keys are not configured."
    );

    return {
      sent: 0,
      failed: 0,
      skipped: true,
    };
  }

  if (!customerId) {
    throw new Error(
      "customerId is required for push notification."
    );
  }

  const firestore = getDb();

  const snapshot = await firestore
    .collection("pushSubscriptions")
    .where(
      "customerId",
      "==",
      String(customerId)
    )
    .get();

  if (snapshot.empty) {
    return {
      sent: 0,
      failed: 0,
      subscriptions: 0,
    };
  }

  const notification =
    getNotificationContent({
      status,
      orderNumber,
      orderType,
    });

  const payload = JSON.stringify({
    title: notification.title,

    body: notification.body,

    icon: "/sugar-cafe-icon-192.png",

    badge: "/sugar-cafe-badge-72.png",

    tag: `sugar-cafe-order-${orderId || orderNumber || "update"}`,

    renotify: true,

    data: {
      type: "ORDER_STATUS",
      orderId: orderId || null,
      orderNumber: orderNumber || null,
      status: status || null,
      url: "/orders",
    },
  });

  let sent = 0;
  let failed = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const subscription = data.subscription;

    if (!subscription?.endpoint) {
      failed += 1;
      continue;
    }

    try {
      await webpush.sendNotification(
        subscription,
        payload
      );

      sent += 1;
    } catch (error) {
      failed += 1;

      console.error(
        "Web Push error:",
        error?.statusCode,
        error?.message
      );

      /*
        404 / 410 normally means the browser subscription
        is no longer valid.

        Remove it so future notifications don't repeatedly
        fail.
      */

      if (
        error?.statusCode === 404 ||
        error?.statusCode === 410
      ) {
        try {
          await document.ref.delete();
        } catch (deleteError) {
          console.error(
            "Failed to remove expired subscription:",
            deleteError.message
          );
        }
      }
    }
  }

  return {
    sent,
    failed,
    subscriptions: snapshot.size,
  };
}

/* =========================================================
   SERVER
========================================================= */

const server = http.createServer(
  async (req, res) => {
    sendCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      /* =====================================================
         PAYMENT HEALTH
      ===================================================== */

      if (
        req.method === "GET" &&
        req.url === "/api/payment/health"
      ) {
        return json(res, 200, {
          ok: true,

          razorpayConfigured:
            Boolean(KEY_ID && KEY_SECRET),

          pushConfigured: PUSH_ENABLED,

          firebaseConfigured:
            Boolean(
              process.env
                .FIREBASE_SERVICE_ACCOUNT_JSON
            ),

          port: PORT,
        });
      }

      /* =====================================================
         PUSH HEALTH
      ===================================================== */

      if (
        req.method === "GET" &&
        req.url === "/api/notifications/health"
      ) {
        return json(res, 200, {
          ok: true,
          pushEnabled: PUSH_ENABLED,
          vapidPublicKey: VAPID_PUBLIC_KEY || null,
        });
      }

      /* =====================================================
         GET PUBLIC VAPID KEY
      ===================================================== */

      if (
        req.method === "GET" &&
        req.url ===
          "/api/notifications/vapid-public-key"
      ) {
        if (!VAPID_PUBLIC_KEY) {
          return json(res, 503, {
            ok: false,
            error:
              "VAPID public key is not configured.",
          });
        }

        return json(res, 200, {
          ok: true,
          publicKey: VAPID_PUBLIC_KEY,
        });
      }

      /* =====================================================
         SAVE PUSH SUBSCRIPTION
      ===================================================== */

      if (
        req.method === "POST" &&
        req.url ===
          "/api/notifications/subscribe"
      ) {
        const body = await readBody(req);

        const customerId = String(
          body.customerId || ""
        ).trim();

        const subscription =
          body.subscription || null;

        if (!customerId) {
          return json(res, 400, {
            ok: false,
            error: "customerId is required.",
          });
        }

        if (!subscription?.endpoint) {
          return json(res, 400, {
            ok: false,
            error:
              "Valid push subscription is required.",
          });
        }

        const subscriptionId =
          await savePushSubscription({
            customerId,
            subscription,
          });

        return json(res, 200, {
          ok: true,
          saved: true,
          subscriptionId,
        });
      }

      /* =====================================================
         REMOVE PUSH SUBSCRIPTION
      ===================================================== */

      if (
        req.method === "POST" &&
        req.url ===
          "/api/notifications/unsubscribe"
      ) {
        const body = await readBody(req);

        const customerId = String(
          body.customerId || ""
        ).trim();

        const endpoint = String(
          body.endpoint || ""
        ).trim();

        if (!customerId || !endpoint) {
          return json(res, 400, {
            ok: false,
            error:
              "customerId and endpoint are required.",
          });
        }

        await removePushSubscription({
          customerId,
          endpoint,
        });

        return json(res, 200, {
          ok: true,
          removed: true,
        });
      }

      /* =====================================================
         SEND ORDER STATUS NOTIFICATION
      ===================================================== */

      if (
        req.method === "POST" &&
        req.url ===
          "/api/notifications/order-status"
      ) {
        const body = await readBody(req);

        const customerId = String(
          body.customerId || ""
        ).trim();

        const status = String(
          body.status || ""
        ).trim();

        const orderNumber = String(
          body.orderNumber || ""
        ).trim();

        const orderId = String(
          body.orderId || ""
        ).trim();

        const orderType = String(
          body.orderType || ""
        ).trim();

        if (!customerId) {
          return json(res, 400, {
            ok: false,
            error: "customerId is required.",
          });
        }

        if (!status) {
          return json(res, 400, {
            ok: false,
            error: "status is required.",
          });
        }

        const result =
          await sendPushToCustomer({
            customerId,
            status,
            orderNumber,
            orderId,
            orderType,
          });

        return json(res, 200, {
          ok: true,
          ...result,
        });
      }

      /* =====================================================
         RAZORPAY CREATE ORDER
      ===================================================== */

      if (
        req.method === "POST" &&
        req.url ===
          "/api/payment/create-order"
      ) {
        const body = await readBody(req);

        const orderData =
          body.orderData || {};

        const items = Array.isArray(
          orderData.items
        )
          ? orderData.items
          : [];

        if (!items.length) {
          return json(res, 400, {
            error: "Cart is empty.",
          });
        }

        const subtotal = items.reduce(
          (sum, item) => {
            const price = Number(
              item?.price
            );

            const qty = Math.floor(
              Number(item?.qty)
            );

            if (
              !Number.isFinite(price) ||
              price < 0 ||
              !Number.isFinite(qty) ||
              qty < 1 ||
              qty > 99
            ) {
              throw new Error(
                "Invalid cart item."
              );
            }

            return sum + price * qty;
          },
          0
        );

        const delivery = Number(
          orderData.deliveryCharge || 0
        );

        const discount = Number(
          orderData.discount || 0
        );

        const gst = Number(
          orderData.gst || 0
        );

        const calculatedTotal =
          subtotal +
          delivery -
          discount +
          gst;

        const requestedTotal = Number(
          orderData.total
        );

        if (
          !Number.isFinite(
            requestedTotal
          ) ||
          Math.round(
            requestedTotal * 100
          ) !==
            Math.round(
              calculatedTotal * 100
            )
        ) {
          return json(res, 400, {
            error:
              "Order total changed. Please refresh your cart and try again.",
          });
        }

        const razorpayOrder =
          await razorpayRequest(
            "/orders",
            {
              method: "POST",

              body: JSON.stringify({
                amount: Math.round(
                  calculatedTotal * 100
                ),

                currency: "INR",

                receipt: String(
                  orderData.orderNumber ||
                    `SC-${Date.now()}`
                ),

                notes: {
                  sugarcafe_order_number:
                    String(
                      orderData.orderNumber ||
                        ""
                    ),
                },
              }),
            }
          );

        return json(res, 200, {
          keyId: KEY_ID,

          orderId:
            razorpayOrder.id,

          amount:
            razorpayOrder.amount,

          currency:
            razorpayOrder.currency,

          serverValidatedTotal:
            calculatedTotal,

          finalized: false,
        });
      }

      /* =====================================================
         RAZORPAY VERIFY
      ===================================================== */

      if (
        req.method === "POST" &&
        req.url ===
          "/api/payment/verify"
      ) {
        const body = await readBody(req);

        const orderId = String(
          body.razorpayOrderId || ""
        );

        const paymentId = String(
          body.razorpayPaymentId || ""
        );

        const receivedSignature =
          String(
            body.razorpaySignature || ""
          );

        if (
          !orderId ||
          !paymentId ||
          !receivedSignature
        ) {
          return json(res, 400, {
            verified: false,
            error:
              "Incomplete payment response.",
          });
        }

        const expectedSignature =
          crypto
            .createHmac(
              "sha256",
              KEY_SECRET
            )
            .update(
              `${orderId}|${paymentId}`
            )
            .digest("hex");

        const expected =
          Buffer.from(
            expectedSignature,
            "utf8"
          );

        const received =
          Buffer.from(
            receivedSignature,
            "utf8"
          );

        const verified =
          expected.length ===
            received.length &&
          crypto.timingSafeEqual(
            expected,
            received
          );

        if (!verified) {
          return json(res, 400, {
            verified: false,
            error:
              "Invalid payment signature.",
          });
        }

        const payment =
          await razorpayRequest(
            `/payments/${paymentId}`,
            {
              method: "GET",
            }
          );

        if (
          payment.order_id !==
            orderId ||
          payment.currency !== "INR" ||
          payment.status !==
            "captured" ||
          payment.captured !== true
        ) {
          return json(res, 400, {
            verified: false,
            captured: false,
            error: `Payment is not captured or order does not match. Current status: ${
              payment.status ||
              "unknown"
            }.`,
          });
        }

        return json(res, 200, {
          verified: true,
          captured: true,
          finalized: false,
          paymentId,
          paymentStatus:
            payment.status,
          method:
            payment.method || null,
        });
      }

      /* =====================================================
         404
      ===================================================== */

      return json(res, 404, {
        error: "Not found",
      });
    } catch (error) {
      console.error(
        "Sugar Cafe server error:",
        error?.stack || error?.message
      );

      return json(res, 500, {
        error:
          error?.message ||
          "Internal server error.",
      });
    }
  }
);

/* =========================================================
   START SERVER
========================================================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Sugar Cafe server running on http://0.0.0.0:${PORT}`
    );

    console.log(
      `Razorpay: ${
        KEY_ID && KEY_SECRET
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Web Push: ${
        PUSH_ENABLED
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );
  }
);
